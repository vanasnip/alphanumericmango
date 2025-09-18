/**
 * Notification WebSocket Server
 * Real-time notification ingestion via WebSocket connections
 */

import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import Database from 'better-sqlite3';
import Joi from 'joi';
import { nanoid } from 'nanoid';

interface ConnectionInfo {
  id: string;
  apiKey: string;
  projectId: string;
  connectedAt: Date;
  messageCount: number;
  lastMessageAt?: Date;
}

interface ServerStatistics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  totalNotifications: number;
  uptime: number;
  startedAt: Date;
}

// Rate limiting for WebSocket connections
class RateLimiter {
  private limits = new Map<string, { count: number; resetTime: number }>();
  private maxRequests = 60; // requests per minute
  private windowMs = 60 * 1000; // 1 minute

  isAllowed(connectionId: string): boolean {
    const now = Date.now();
    const limit = this.limits.get(connectionId);

    if (!limit || now > limit.resetTime) {
      this.limits.set(connectionId, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (limit.count >= this.maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [connectionId, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(connectionId);
      }
    }
  }
}

// Message validation schemas
const notificationMessageSchema = Joi.object({
  type: Joi.string().valid('notification').required(),
  data: Joi.object({
    user_id: Joi.string().required().trim().min(1).max(255),
    project_id: Joi.string().optional().trim().min(1).max(255),
    template_id: Joi.string().optional().trim().min(1).max(255),
    channel: Joi.string().valid('in_app', 'email', 'sms', 'push', 'webhook').default('in_app'),
    priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
    subject: Joi.string().optional().trim().max(500),
    body: Joi.string().required().trim().min(1).max(10000),
    data: Joi.object().optional().default({}),
    scheduled_at: Joi.string().isoDate().optional()
  }).required()
});

const batchMessageSchema = Joi.object({
  type: Joi.string().valid('batch_notification').required(),
  data: Joi.array().items(notificationMessageSchema.extract('data')).min(1).max(50).required()
});

const pingMessageSchema = Joi.object({
  type: Joi.string().valid('ping').required()
});

const messageSchema = Joi.alternatives().try(
  notificationMessageSchema,
  batchMessageSchema,
  pingMessageSchema
);

export class NotificationWebSocketServer {
  private db: Database.Database;
  private wss?: WebSocketServer;
  private connections = new Map<string, { ws: WebSocket; info: ConnectionInfo }>();
  private rateLimiter = new RateLimiter();
  private statistics: ServerStatistics;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(database: Database.Database) {
    this.db = database;
    this.statistics = {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      totalNotifications: 0,
      uptime: 0,
      startedAt: new Date()
    };
  }

  public async start(port: number = 8080): Promise<number> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ 
        port,
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      
      this.wss.on('listening', () => {
        const address = this.wss!.address();
        const actualPort = typeof address === 'object' ? address.port : port;
        console.log(`WebSocket server listening on port ${actualPort}`);
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
          this.rateLimiter.cleanup();
        }, 60000); // Cleanup every minute

        resolve(actualPort);
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      if (this.wss) {
        // Close all connections
        this.connections.forEach(({ ws }) => {
          ws.close(1001, 'Server shutting down');
        });

        this.wss.close(() => {
          console.log('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getStatistics(): ServerStatistics {
    return {
      ...this.statistics,
      activeConnections: this.connections.size,
      uptime: Date.now() - this.statistics.startedAt.getTime()
    };
  }

  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
      const apiKey = url.searchParams.get('api_key');

      if (!apiKey) {
        console.warn('WebSocket connection rejected: Missing API key');
        return false;
      }

      // Verify API key exists and is active
      const project = this.db.prepare('SELECT * FROM projects WHERE api_key = ? AND is_active = 1').get(apiKey);
      
      if (!project) {
        console.warn('WebSocket connection rejected: Invalid API key');
        return false;
      }

      // Store project info for later use
      info.req.project = project;
      return true;

    } catch (error) {
      console.error('Error verifying WebSocket client:', error);
      return false;
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connectionId = nanoid();
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const apiKey = url.searchParams.get('api_key')!;
    const project = (req as any).project;

    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      apiKey,
      projectId: project.id,
      connectedAt: new Date(),
      messageCount: 0
    };

    this.connections.set(connectionId, { ws, info: connectionInfo });
    this.statistics.totalConnections++;

    console.log(`WebSocket connection established: ${connectionId} (project: ${project.identifier})`);

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connection_established',
      connection_id: connectionId,
      project: {
        id: project.id,
        name: project.name,
        identifier: project.identifier
      }
    });

    // Handle messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(connectionId, data);
    });

    // Handle ping/pong for keepalive
    ws.on('ping', () => {
      ws.pong();
    });

    ws.on('pong', () => {
      // Update last activity
      connectionInfo.lastMessageAt = new Date();
    });

    // Handle connection close
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(connectionId, code, reason.toString());
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      this.handleDisconnection(connectionId, 1011, 'Internal error');
    });

    // Set up ping interval for keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds
  }

  private handleMessage(connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const { ws, info } = connection;

    try {
      // Check rate limit
      if (!this.rateLimiter.isAllowed(connectionId)) {
        this.sendMessage(ws, {
          success: false,
          error: 'Rate limit exceeded. Please slow down your requests.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Check message size
      if (data.length > 1024 * 1024) { // 1MB limit
        this.sendMessage(ws, {
          success: false,
          error: 'Message size exceeds maximum allowed size (1MB)',
          code: 'MESSAGE_TOO_LARGE'
        });
        return;
      }

      // Parse message
      let message: any;
      try {
        message = JSON.parse(data.toString());
      } catch (parseError) {
        this.sendMessage(ws, {
          success: false,
          error: 'Invalid JSON format',
          code: 'INVALID_JSON'
        });
        return;
      }

      // Validate message
      const { error, value } = messageSchema.validate(message, { abortEarly: false });
      if (error) {
        this.sendMessage(ws, {
          success: false,
          error: 'Message validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
        return;
      }

      // Update connection stats
      info.messageCount++;
      info.lastMessageAt = new Date();
      this.statistics.totalMessages++;

      // Process message based on type
      this.processMessage(connectionId, value);

    } catch (error) {
      console.error(`Error handling message from ${connectionId}:`, error);
      this.sendMessage(ws, {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  private async processMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const { ws, info } = connection;

    switch (message.type) {
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'notification':
        await this.processNotification(connectionId, message.data);
        break;

      case 'batch_notification':
        await this.processBatchNotification(connectionId, message.data);
        break;

      default:
        this.sendMessage(ws, {
          success: false,
          error: `Unsupported message type: ${message.type}`,
          code: 'UNSUPPORTED_MESSAGE_TYPE'
        });
    }
  }

  private async processNotification(connectionId: string, notificationData: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const { ws, info } = connection;

    try {
      // Verify user exists
      const user = this.db.prepare('SELECT id FROM users WHERE external_id = ? AND is_active = 1')
        .get(notificationData.user_id);
      
      if (!user) {
        this.sendMessage(ws, {
          success: false,
          error: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Use project from connection
      const projectId = notificationData.project_id || info.projectId;

      // Create notification
      const notificationId = nanoid();
      const now = new Date().toISOString();

      const insertStmt = this.db.prepare(`
        INSERT INTO notifications 
        (id, project_id, user_id, template_id, channel, status, priority, subject, body, data, scheduled_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        notificationId,
        projectId,
        user.id,
        notificationData.template_id || null,
        notificationData.channel || 'in_app',
        notificationData.priority || 'normal',
        notificationData.subject || null,
        notificationData.body,
        JSON.stringify(notificationData.data || {}),
        notificationData.scheduled_at || null,
        now,
        now
      );

      // Log event
      const eventStmt = this.db.prepare(`
        INSERT INTO events (notification_id, event_type, event_data, created_at)
        VALUES (?, 'created', ?, ?)
      `);

      eventStmt.run(
        notificationId,
        JSON.stringify({
          source: 'websocket',
          connection_id: connectionId,
          project_id: projectId
        }),
        now
      );

      this.statistics.totalNotifications++;

      this.sendMessage(ws, {
        success: true,
        notification_id: notificationId,
        status: 'pending',
        created_at: now
      });

    } catch (error) {
      console.error(`Error creating notification for ${connectionId}:`, error);
      
      let errorMessage = 'Failed to create notification';
      let errorCode = 'CREATION_FAILED';

      if (error.message.includes('FOREIGN KEY constraint failed')) {
        errorMessage = 'Invalid reference to project, user, or template';
        errorCode = 'FOREIGN_KEY_VIOLATION';
      } else if (error.message.includes('database')) {
        errorMessage = 'Database error occurred';
        errorCode = 'DATABASE_ERROR';
      }

      this.sendMessage(ws, {
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }
  }

  private async processBatchNotification(connectionId: string, notificationDataArray: any[]): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const { ws, info } = connection;

    try {
      const batchId = nanoid();
      const now = new Date().toISOString();
      const results: any[] = [];
      const errors: any[] = [];

      // Create batch record
      const batchStmt = this.db.prepare(`
        INSERT INTO batches (id, project_id, name, total_notifications, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'processing', ?, ?)
      `);

      batchStmt.run(batchId, info.projectId, `WebSocket Batch ${batchId}`, notificationDataArray.length, now, now);

      // Process notifications in transaction
      const transaction = this.db.transaction((notifications: any[]) => {
        for (let i = 0; i < notifications.length; i++) {
          try {
            const notificationData = notifications[i];

            // Verify user exists
            const user = this.db.prepare('SELECT id FROM users WHERE external_id = ? AND is_active = 1')
              .get(notificationData.user_id);
            
            if (!user) {
              errors.push({
                index: i,
                error: 'User not found or inactive',
                user_id: notificationData.user_id
              });
              continue;
            }

            const notificationId = nanoid();
            
            const insertStmt = this.db.prepare(`
              INSERT INTO notifications 
              (id, project_id, user_id, channel, priority, subject, body, data, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertStmt.run(
              notificationId,
              info.projectId,
              user.id,
              notificationData.channel || 'in_app',
              notificationData.priority || 'normal',
              notificationData.subject || null,
              notificationData.body,
              JSON.stringify(notificationData.data || {}),
              now
            );

            // Link to batch
            const batchLinkStmt = this.db.prepare(`
              INSERT INTO batch_notifications (batch_id, notification_id) VALUES (?, ?)
            `);
            batchLinkStmt.run(batchId, notificationId);

            results.push({
              index: i,
              notification_id: notificationId,
              status: 'created'
            });

          } catch (err) {
            errors.push({
              index: i,
              error: err.message,
              code: 'CREATION_FAILED'
            });
          }
        }
      });

      transaction(notificationDataArray);

      // Update batch status
      const updateBatchStmt = this.db.prepare(`
        UPDATE batches 
        SET status = 'completed', sent_notifications = ?, failed_notifications = ?, completed_at = ?
        WHERE id = ?
      `);

      updateBatchStmt.run(results.length, errors.length, now, batchId);

      this.statistics.totalNotifications += results.length;

      this.sendMessage(ws, {
        success: true,
        batch_id: batchId,
        total: notificationDataArray.length,
        created_count: results.length,
        failed_count: errors.length,
        results: results.length > 0 ? results : undefined,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error(`Error processing batch for ${connectionId}:`, error);
      this.sendMessage(ws, {
        success: false,
        error: 'Batch processing failed',
        code: 'BATCH_ERROR',
        message: error.message
      });
    }
  }

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const { info } = connection;
      console.log(`WebSocket disconnection: ${connectionId} (code: ${code}, reason: ${reason})`);
      console.log(`Connection stats: ${info.messageCount} messages, duration: ${Date.now() - info.connectedAt.getTime()}ms`);
      
      this.connections.delete(connectionId);
    }
  }
}

// Add types for Express Request extension (if needed)
declare global {
  namespace Express {
    interface Request {
      project?: any;
    }
  }
}
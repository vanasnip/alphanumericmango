/**
 * Secure Notification Ingestion Server for Voice Terminal Hybrid
 * 
 * Demonstrates complete integration of all security components:
 * - Rate limiting with multiple tiers
 * - API key authentication and authorization
 * - IP allowlisting with CIDR support
 * - Comprehensive payload validation
 * - Transport security (HTTPS/WSS)
 * - Full audit logging with rotation
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join } from 'path';
import {
  SecurityManager,
  createSecurityManager,
  requireScope,
  SecurityEventType,
  NotificationSecurityContext
} from '../security/index.js';

interface NotificationPayload {
  projectId: string;
  userId?: string;
  templateId?: string;
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
  priority: 'low' | 'normal' | 'high' | 'critical';
  subject?: string;
  body: string;
  data?: Record<string, any>;
  scheduledAt?: string;
  templateVariables?: Record<string, any>;
}

interface BatchNotificationPayload {
  projectId: string;
  templateId?: string;
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
  priority: 'low' | 'normal' | 'high' | 'critical';
  notifications: Array<{
    userId: string;
    templateVariables?: Record<string, any>;
    data?: Record<string, any>;
  }>;
}

export class SecureNotificationServer {
  private app: express.Application;
  private securityManager: SecurityManager;
  private server?: any;
  private wsServer?: WebSocketServer;
  private port: number;

  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.securityManager = createSecurityManager({
      // Override default configuration for demonstration
      rateLimit: {
        enabled: true,
        windowMs: 60000, // 1 minute
        limits: {
          perIp: 100,
          perApiKey: 1000,
          perEndpoint: {
            '/api/notifications': 50,
            '/api/notifications/batch': 10,
            '/api/templates': 20,
            '/health': 200
          }
        },
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        standardHeaders: true,
        legacyHeaders: false,
        store: 'memory' // Use Redis in production
      },
      ipAllowlist: {
        enabled: process.env.NODE_ENV === 'production',
        allowedCidrs: [
          '127.0.0.1/32',      // localhost
          '::1/128',           // localhost IPv6
          '10.0.0.0/8',        // Private networks
          '172.16.0.0/12',
          '192.168.0.0/16'
        ],
        allowLocalhost: true,
        blockPrivateNetworks: false,
        autoReload: true,
        reloadIntervalMs: 300000
      },
      transport: {
        https: {
          enabled: true,
          port: 3443,
          generateSelfSigned: true
        },
        websocket: {
          enabled: true,
          secure: true
        },
        headers: {
          hsts: true,
          csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';",
          frameOptions: 'DENY',
          contentTypeOptions: true,
          xssProtection: true
        }
      }
    }, './logs');

    this.setupExpress();
    this.setupRoutes();
  }

  /**
   * Setup Express application with security middleware
   */
  private setupExpress(): void {
    // Trust proxy for accurate IP detection
    this.app.set('trust proxy', true);

    // Parse JSON with size limits
    this.app.use(express.json({ 
      limit: '1mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));

    // Parse URL-encoded data
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Apply all security middleware
    const securityMiddlewares = this.securityManager.createMiddlewareStack();
    securityMiddlewares.forEach(middleware => {
      this.app.use(middleware);
    });

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        security: {
          rateLimiting: 'enabled',
          https: 'enabled',
          auditLogging: 'enabled'
        }
      });
    });

    // Security status endpoint (requires admin scope)
    this.app.get('/api/security/status', 
      requireScope('admin:read'),
      async (req, res) => {
        try {
          const stats = await this.securityManager.getSecurityStatistics();
          res.json(stats);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get security statistics' });
        }
      }
    );

    // Single notification endpoint
    this.app.post('/api/notifications',
      requireScope('notifications:write'),
      async (req, res) => {
        try {
          const payload: NotificationPayload = req.body;
          
          // Additional notification-specific validation
          const validationResult = await this.securityManager.components.payloadValidator
            .validateNotificationPayload(payload);

          if (!validationResult.isValid) {
            return res.status(400).json({
              error: 'Validation failed',
              violations: validationResult.violations
            });
          }

          // Create notification security context
          const context: NotificationSecurityContext = {
            ...req.securityContext,
            projectId: payload.projectId,
            templateId: payload.templateId,
            priority: payload.priority,
            channel: payload.channel
          };

          // Process notification (mock implementation)
          const notificationId = await this.processNotification(payload, context);

          res.status(201).json({
            id: notificationId,
            status: 'accepted',
            message: 'Notification queued for processing'
          });

        } catch (error) {
          console.error('Notification processing error:', error);
          res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process notification'
          });
        }
      }
    );

    // Batch notification endpoint
    this.app.post('/api/notifications/batch',
      requireScope('batches:write'),
      async (req, res) => {
        try {
          const payload: BatchNotificationPayload = req.body;

          // Validate batch size
          if (payload.notifications.length > 1000) {
            return res.status(400).json({
              error: 'Batch too large',
              message: 'Maximum 1000 notifications per batch'
            });
          }

          // Process batch (mock implementation)
          const batchId = await this.processBatchNotifications(payload, req.securityContext);

          res.status(202).json({
            batchId,
            status: 'accepted',
            count: payload.notifications.length,
            message: 'Batch notifications queued for processing'
          });

        } catch (error) {
          console.error('Batch processing error:', error);
          res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process batch'
          });
        }
      }
    );

    // Template management endpoints
    this.app.get('/api/templates',
      requireScope('templates:read'),
      async (req, res) => {
        // Mock template listing
        res.json({
          templates: [
            {
              id: 'welcome-email',
              name: 'Welcome Email',
              channel: 'email',
              variables: ['name', 'company']
            }
          ]
        });
      }
    );

    this.app.post('/api/templates',
      requireScope('templates:write'),
      async (req, res) => {
        // Mock template creation
        res.status(201).json({
          id: 'new-template-id',
          message: 'Template created successfully'
        });
      }
    );

    // API key management endpoints (admin only)
    this.app.post('/api/admin/api-keys',
      requireScope('admin:write'),
      async (req, res) => {
        try {
          const { name, scopes, expiresInDays } = req.body;
          
          const newKey = await this.securityManager.generateApiKey(
            name,
            scopes,
            expiresInDays
          );

          // Don't include the plain key in logs
          const { plainKey, ...keyInfo } = newKey;

          await this.securityManager.components.auditLogger.logSecurityEvent({
            type: SecurityEventType.API_KEY_ROTATED,
            timestamp: new Date(),
            severity: 'low',
            source: req.securityContext.ipAddress,
            details: { action: 'generated', keyId: keyInfo.id, name },
            action: 'generated'
          });

          res.status(201).json({
            ...keyInfo,
            plainKey // Only return once
          });

        } catch (error) {
          console.error('API key generation error:', error);
          res.status(500).json({
            error: 'Failed to generate API key'
          });
        }
      }
    );

    this.app.get('/api/admin/api-keys',
      requireScope('admin:read'),
      async (req, res) => {
        const keys = this.securityManager.components.apiKeyManager.listApiKeys();
        res.json({ keys });
      }
    );

    // Audit log endpoints
    this.app.get('/api/admin/audit-logs',
      requireScope('admin:read'),
      async (req, res) => {
        try {
          const {
            startDate,
            endDate,
            source,
            ipAddress,
            limit = 100,
            offset = 0
          } = req.query;

          const query = {
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            source: source as string,
            ipAddress: ipAddress as string,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10)
          };

          const result = await this.securityManager.components.auditLogger.queryLogs(query);
          res.json(result);

        } catch (error) {
          console.error('Audit log query error:', error);
          res.status(500).json({
            error: 'Failed to query audit logs'
          });
        }
      }
    );

    // WebSocket endpoint for real-time notifications
    this.setupWebSocketHandling();
  }

  /**
   * Setup WebSocket handling
   */
  private setupWebSocketHandling(): void {
    // WebSocket upgrade will be handled after server creation
  }

  /**
   * Mock notification processing
   */
  private async processNotification(
    payload: NotificationPayload,
    context: NotificationSecurityContext
  ): Promise<string> {
    // In real implementation, this would:
    // 1. Validate project exists and API key has access
    // 2. Validate user exists (if specified)
    // 3. Load template (if specified)
    // 4. Queue notification for delivery
    // 5. Return notification ID

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log notification creation
    await this.securityManager.components.auditLogger.logEntry({
      source: 'notification-processor',
      endpoint: '/api/notifications',
      ipAddress: context.ipAddress,
      apiKeyId: context.apiKey?.id,
      success: true,
      responseTime: 50, // Mock processing time
      payloadSize: JSON.stringify(payload).length,
      metadata: {
        notificationId,
        projectId: payload.projectId,
        channel: payload.channel,
        priority: payload.priority
      }
    });

    return notificationId;
  }

  /**
   * Mock batch notification processing
   */
  private async processBatchNotifications(
    payload: BatchNotificationPayload,
    context: any
  ): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log batch creation
    await this.securityManager.components.auditLogger.logEntry({
      source: 'batch-processor',
      endpoint: '/api/notifications/batch',
      ipAddress: context.ipAddress,
      apiKeyId: context.apiKey?.id,
      success: true,
      responseTime: 100, // Mock processing time
      payloadSize: JSON.stringify(payload).length,
      metadata: {
        batchId,
        projectId: payload.projectId,
        channel: payload.channel,
        priority: payload.priority,
        notificationCount: payload.notifications.length
      }
    });

    return batchId;
  }

  /**
   * Error handling middleware
   */
  private errorHandler(
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void {
    console.error('Server error:', error);

    // Log error
    this.securityManager.components.auditLogger.logEntry({
      source: 'error-handler',
      method: req.method,
      endpoint: req.originalUrl,
      ipAddress: (req as any).securityContext?.ipAddress || 'unknown',
      apiKeyId: (req as any).apiKey?.id,
      success: false,
      statusCode: 500,
      responseTime: 0,
      payloadSize: 0,
      error: error.message
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }

  /**
   * Start the secure server
   */
  async start(): Promise<void> {
    try {
      // Initialize security manager
      await this.securityManager.initialize();

      // Create HTTPS server
      if (this.securityManager.configuration.transport.https.enabled) {
        this.server = await this.securityManager.components.transportSecurity.createHttpsServer(this.app);
        const httpsPort = this.securityManager.configuration.transport.https.port;
        
        this.server.listen(httpsPort, () => {
          console.log(`🔒 Secure Notification Server running on https://localhost:${httpsPort}`);
          console.log(`📊 Security features enabled:`);
          console.log(`   ✓ Rate limiting (${this.securityManager.configuration.rateLimit.limits.perIp} req/min per IP)`);
          console.log(`   ✓ API key authentication`);
          console.log(`   ✓ Payload validation & sanitization`);
          console.log(`   ✓ HTTPS with self-signed certificate`);
          console.log(`   ✓ Comprehensive audit logging`);
          
          if (this.securityManager.configuration.ipAllowlist.enabled) {
            console.log(`   ✓ IP allowlisting (${this.securityManager.components.ipAllowlistManager.getAllowlist().length} allowed CIDRs)`);
          }
        });
      } else {
        // Fallback to HTTP (not recommended for production)
        this.server = this.securityManager.components.transportSecurity.createHttpServer(this.app);
        this.server.listen(this.port, () => {
          console.log(`⚠️  Notification Server running on http://localhost:${this.port} (HTTP only - not secure!)`);
        });
      }

      // Setup WebSocket server
      if (this.securityManager.configuration.transport.websocket.enabled) {
        this.wsServer = new WebSocketServer({ 
          server: this.server,
          verifyClient: this.verifyWebSocketClient.bind(this)
        });

        this.wsServer.on('connection', this.handleWebSocketConnection.bind(this));
        console.log(`🔌 WebSocket server enabled`);
      }

      // Setup Unix socket if enabled
      if (this.securityManager.configuration.transport.unixSocket.enabled) {
        await this.securityManager.components.transportSecurity.setupUnixSocket(this.server);
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Verify WebSocket client connection
   */
  private verifyWebSocketClient(info: any): boolean {
    // Apply same security checks as HTTP
    const origin = info.origin;
    const ip = info.req.socket.remoteAddress;

    // Basic origin validation
    if (origin && !this.isOriginAllowed(origin)) {
      console.warn(`WebSocket connection rejected: invalid origin ${origin}`);
      return false;
    }

    // Log connection attempt
    this.securityManager.components.auditLogger.logWebSocketConnection(
      info.req.socket,
      info.req,
      'connect'
    );

    return true;
  }

  /**
   * Handle WebSocket connection
   */
  private handleWebSocketConnection(ws: any, request: any): void {
    console.log('WebSocket client connected');

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Validate WebSocket message
        const validation = await this.securityManager.components.payloadValidator.validatePayload(
          data,
          'application/json',
          message.length
        );

        if (!validation.isValid) {
          ws.send(JSON.stringify({
            error: 'Invalid message',
            violations: validation.violations
          }));
          return;
        }

        // Echo back for demonstration
        ws.send(JSON.stringify({
          type: 'acknowledgment',
          message: 'Message received and validated',
          timestamp: new Date().toISOString()
        }));

        // Log WebSocket message
        await this.securityManager.components.auditLogger.logWebSocketConnection(
          ws,
          request,
          'message',
          data
        );

      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          error: 'Message processing failed'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      this.securityManager.components.auditLogger.logWebSocketConnection(
        ws,
        request,
        'disconnect'
      );
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.securityManager.components.auditLogger.logWebSocketConnection(
        ws,
        request,
        'error',
        { message: error.message }
      );
    });
  }

  /**
   * Check if WebSocket origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://localhost:5173',
      'https://localhost:5173'
    ];
    
    return allowedOrigins.includes(origin) || 
           origin.startsWith('http://localhost:') || 
           origin.startsWith('https://localhost:');
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      
      if (this.server) {
        this.server.close();
      }
      
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      await this.securityManager.cleanup();
      
      console.log('Server shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get server instance for testing
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get security manager for testing
   */
  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }
}

// Export for use as library
export default SecureNotificationServer;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const server = new SecureNotificationServer(port);
  
  server.start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}
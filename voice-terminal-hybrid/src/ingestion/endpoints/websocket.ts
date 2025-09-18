/**
 * WebSocket server for real-time notification streaming
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { IngestionConfig, IngestionResult } from '../types/index.js';

export interface WebSocketEndpointOptions {
  config: IngestionConfig;
  processor: (payload: any, source: 'websocket') => Promise<IngestionResult>;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastSeen: number;
  remoteAddress?: string;
  userAgent?: string;
}

/**
 * WebSocket server for notification ingestion and streaming
 */
export class NotificationWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocketClient>();
  private options: WebSocketEndpointOptions;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(options: WebSocketEndpointOptions) {
    this.options = options;
    this.wss = new WebSocketServer({
      port: options.config.port,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    this.options.logger?.info('WebSocket server started', {
      port: this.options.config.port,
      path: '/ws'
    });
  }

  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    // Basic verification - can be extended with more sophisticated auth
    const { req } = info;
    
    // Check IP allowlist if configured
    if (this.options.config.ipAllowlist && this.options.config.ipAllowlist.length > 0) {
      const clientIP = req.socket.remoteAddress;
      if (!clientIP || !this.options.config.ipAllowlist.includes(clientIP)) {
        this.options.logger?.warn('WebSocket connection rejected - IP not in allowlist', {
          clientIP,
          origin: info.origin
        });
        return false;
      }
    }

    return true;
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      authenticated: !this.options.config.websocket.authRequired, // Auto-auth if not required
      subscriptions: new Set(),
      lastSeen: Date.now(),
      remoteAddress: request.socket.remoteAddress,
      userAgent: request.headers['user-agent']
    };

    this.clients.set(clientId, client);

    this.options.logger?.info('WebSocket client connected', {
      clientId,
      remoteAddress: client.remoteAddress,
      userAgent: client.userAgent,
      totalClients: this.clients.size
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'welcome',
      clientId,
      authenticated: client.authenticated,
      timestamp: new Date().toISOString()
    });

    // Setup client event handlers
    socket.on('message', (data) => this.handleClientMessage(client, data));
    socket.on('close', () => this.handleClientDisconnect(client));
    socket.on('error', (error) => this.handleClientError(client, error));
    socket.on('pong', () => this.handleClientPong(client));
  }

  private handleClientMessage(client: WebSocketClient, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      client.lastSeen = Date.now();

      this.options.logger?.info('WebSocket message received', {
        clientId: client.id,
        messageType: message.type,
        authenticated: client.authenticated
      });

      switch (message.type) {
        case 'auth':
          this.handleAuthentication(client, message);
          break;
        case 'subscribe':
          this.handleSubscription(client, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(client, message);
          break;
        case 'notification':
          this.handleNotificationIngestion(client, message);
          break;
        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        default:
          this.sendToClient(client, {
            type: 'error',
            error: { code: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown message type: ${message.type}` }
          });
      }
    } catch (error) {
      this.options.logger?.warn('Invalid WebSocket message', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.sendToClient(client, {
        type: 'error',
        error: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message' }
      });
    }
  }

  private handleAuthentication(client: WebSocketClient, message: any): void {
    if (!this.options.config.websocket.authRequired) {
      client.authenticated = true;
      this.sendToClient(client, { type: 'auth_success' });
      return;
    }

    const { apiKey } = message;
    if (!apiKey) {
      this.sendToClient(client, {
        type: 'auth_error',
        error: { code: 'MISSING_API_KEY', message: 'API key required' }
      });
      return;
    }

    if (apiKey !== this.options.config.apiKey) {
      this.options.logger?.warn('WebSocket authentication failed', {
        clientId: client.id,
        remoteAddress: client.remoteAddress
      });

      this.sendToClient(client, {
        type: 'auth_error',
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' }
      });
      return;
    }

    client.authenticated = true;
    this.sendToClient(client, { type: 'auth_success' });
    
    this.options.logger?.info('WebSocket client authenticated', {
      clientId: client.id
    });
  }

  private handleSubscription(client: WebSocketClient, message: any): void {
    if (!client.authenticated) {
      this.sendToClient(client, {
        type: 'error',
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' }
      });
      return;
    }

    const { channels } = message;
    if (!Array.isArray(channels)) {
      this.sendToClient(client, {
        type: 'error',
        error: { code: 'INVALID_CHANNELS', message: 'Channels must be an array' }
      });
      return;
    }

    channels.forEach(channel => {
      if (typeof channel === 'string') {
        client.subscriptions.add(channel);
      }
    });

    this.sendToClient(client, {
      type: 'subscription_success',
      channels: Array.from(client.subscriptions)
    });

    this.options.logger?.info('WebSocket client subscribed', {
      clientId: client.id,
      channels: Array.from(client.subscriptions)
    });
  }

  private handleUnsubscription(client: WebSocketClient, message: any): void {
    const { channels } = message;
    if (!Array.isArray(channels)) {
      this.sendToClient(client, {
        type: 'error',
        error: { code: 'INVALID_CHANNELS', message: 'Channels must be an array' }
      });
      return;
    }

    channels.forEach(channel => {
      if (typeof channel === 'string') {
        client.subscriptions.delete(channel);
      }
    });

    this.sendToClient(client, {
      type: 'unsubscription_success',
      channels: Array.from(client.subscriptions)
    });
  }

  private async handleNotificationIngestion(client: WebSocketClient, message: any): Promise<void> {
    if (!client.authenticated) {
      this.sendToClient(client, {
        type: 'error',
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' }
      });
      return;
    }

    try {
      const payload = {
        ...message.payload,
        clientId: client.id,
        remoteAddress: client.remoteAddress,
        timestamp: new Date().toISOString()
      };

      const result = await this.options.processor(payload, 'websocket');

      if (result.success) {
        this.sendToClient(client, {
          type: 'notification_success',
          notificationId: result.notification?.id,
          messageId: message.id
        });

        // Broadcast to subscribed clients if notification has tags
        if (result.notification?.tags) {
          this.broadcastNotification(result.notification, result.notification.tags);
        }
      } else {
        this.sendToClient(client, {
          type: 'notification_error',
          error: result.error,
          messageId: message.id
        });
      }
    } catch (error) {
      this.options.logger?.error('WebSocket notification processing error', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.sendToClient(client, {
        type: 'notification_error',
        error: { code: 'PROCESSING_ERROR', message: 'Failed to process notification' },
        messageId: message.id
      });
    }
  }

  private handleClientDisconnect(client: WebSocketClient): void {
    this.clients.delete(client.id);
    
    this.options.logger?.info('WebSocket client disconnected', {
      clientId: client.id,
      totalClients: this.clients.size
    });
  }

  private handleClientError(client: WebSocketClient, error: Error): void {
    this.options.logger?.error('WebSocket client error', {
      clientId: client.id,
      error: error.message
    });
  }

  private handleClientPong(client: WebSocketClient): void {
    client.lastSeen = Date.now();
  }

  private handleServerError(error: Error): void {
    this.options.logger?.error('WebSocket server error', {
      error: error.message,
      stack: error.stack
    });
  }

  private sendToClient(client: WebSocketClient, message: any): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        this.options.logger?.error('Failed to send message to client', {
          clientId: client.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private broadcastNotification(notification: any, channels: string[]): void {
    const message = {
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    };

    let broadcastCount = 0;
    
    for (const client of this.clients.values()) {
      if (!client.authenticated) continue;
      
      // Check if client is subscribed to any of the notification channels
      const hasSubscription = channels.some(channel => client.subscriptions.has(channel)) ||
                            client.subscriptions.has('*'); // Wildcard subscription

      if (hasSubscription) {
        this.sendToClient(client, message);
        broadcastCount++;
      }
    }

    this.options.logger?.info('Notification broadcasted', {
      notificationId: notification.id,
      channels,
      clientCount: broadcastCount
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 60 seconds

      for (const client of this.clients.values()) {
        if (client.socket.readyState === WebSocket.OPEN) {
          if (now - client.lastSeen > staleThreshold) {
            // Send ping to check if client is still alive
            client.socket.ping();
          }
        } else {
          // Remove dead connections
          this.clients.delete(client.id);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Get connected client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get authenticated client count
   */
  public getAuthenticatedClientCount(): number {
    return Array.from(this.clients.values()).filter(client => client.authenticated).length;
  }

  /**
   * Broadcast a notification to all subscribed clients
   */
  public broadcast(notification: any, channels: string[] = ['*']): void {
    this.broadcastNotification(notification, channels);
  }

  /**
   * Close the WebSocket server
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      this.wss.close(() => {
        this.options.logger?.info('WebSocket server closed');
        resolve();
      });
    });
  }
}
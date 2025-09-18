/**
 * Main notification ingestion server
 * Coordinates all ingestion methods and provides a unified interface
 */

import express from 'express';
import { createServer } from 'http';
import { NotificationProcessor } from './processors/index.js';
import { createWebhookEndpoint } from './endpoints/webhook.js';
import { NotificationWebSocketServer } from './endpoints/websocket.js';
import { NotificationFileWatcher } from './endpoints/file-watcher.js';
import { NotificationUnixSocket } from './endpoints/unix-socket.js';
import { loadConfig, validateConfig, createConsoleLogger } from './config/index.js';
import type { 
  IngestionConfig, 
  IngestionResult, 
  IngestionSource, 
  BaseNotification 
} from './types/index.js';
import type { Logger } from './config/logger.js';

export interface NotificationIngestionServerOptions {
  config?: Partial<IngestionConfig>;
  logger?: Logger;
  onNotificationReceived?: (notification: BaseNotification, source: IngestionSource) => Promise<void>;
  onError?: (error: any, source: IngestionSource) => Promise<void>;
}

/**
 * Main notification ingestion server that coordinates all ingestion methods
 */
export class NotificationIngestionServer {
  private config: IngestionConfig;
  private logger: Logger;
  private processor: NotificationProcessor;
  
  private httpServer?: ReturnType<typeof createServer>;
  private webSocketServer?: NotificationWebSocketServer;
  private fileWatcher?: NotificationFileWatcher;
  private unixSocket?: NotificationUnixSocket;
  
  private isRunning = false;
  private startTime?: Date;
  private stats = {
    totalNotifications: 0,
    bySource: {
      webhook: 0,
      websocket: 0,
      file: 0,
      'unix-socket': 0
    },
    errors: 0
  };

  constructor(options: NotificationIngestionServerOptions = {}) {
    // Load and merge configuration
    this.config = { ...loadConfig(), ...options.config };
    
    // Validate configuration
    const validation = validateConfig(this.config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Setup logger
    this.logger = options.logger || createConsoleLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      colorize: process.env.NODE_ENV !== 'production'
    });

    // Create processor
    this.processor = new NotificationProcessor({
      logger: this.logger,
      onNotificationProcessed: this.handleNotificationProcessed.bind(this),
      onProcessingError: this.handleProcessingError.bind(this)
    });

    // Store callbacks
    this.onNotificationReceived = options.onNotificationReceived;
    this.onError = options.onError;
  }

  private onNotificationReceived?: (notification: BaseNotification, source: IngestionSource) => Promise<void>;
  private onError?: (error: any, source: IngestionSource) => Promise<void>;

  /**
   * Start the ingestion server with all endpoints
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Ingestion server already running');
      return;
    }

    this.logger.info('Starting notification ingestion server', {
      config: {
        port: this.config.port,
        apiKeyConfigured: !!this.config.apiKey,
        ipAllowlistCount: this.config.ipAllowlist?.length || 0,
        maxPayloadSize: this.config.maxPayloadSize,
        fileWatchDirectory: this.config.fileWatcher.directory,
        unixSocketPath: this.config.unixSocket.path,
        websocketEnabled: this.config.websocket.enabled
      }
    });

    try {
      // Start HTTP server with webhook endpoint
      await this.startHttpServer();

      // Start WebSocket server
      if (this.config.websocket.enabled) {
        await this.startWebSocketServer();
      }

      // Start file watcher
      await this.startFileWatcher();

      // Start Unix socket
      await this.startUnixSocket();

      this.isRunning = true;
      this.startTime = new Date();

      this.logger.info('Notification ingestion server started successfully', {
        port: this.config.port,
        endpoints: {
          webhook: true,
          websocket: this.config.websocket.enabled,
          fileWatcher: true,
          unixSocket: true
        }
      });

    } catch (error) {
      this.logger.error('Failed to start ingestion server', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Cleanup on failure
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop the ingestion server and cleanup resources
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping notification ingestion server');

    const stopPromises: Promise<void>[] = [];

    // Stop HTTP server
    if (this.httpServer) {
      stopPromises.push(new Promise(resolve => {
        this.httpServer!.close(() => resolve());
      }));
    }

    // Stop WebSocket server
    if (this.webSocketServer) {
      stopPromises.push(this.webSocketServer.close());
    }

    // Stop file watcher
    if (this.fileWatcher) {
      stopPromises.push(this.fileWatcher.stop());
    }

    // Stop Unix socket
    if (this.unixSocket) {
      stopPromises.push(this.unixSocket.stop());
    }

    try {
      await Promise.all(stopPromises);
      
      this.isRunning = false;
      const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
      
      this.logger.info('Notification ingestion server stopped', {
        uptime,
        stats: this.stats
      });
    } catch (error) {
      this.logger.error('Error stopping ingestion server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start HTTP server with webhook endpoint
   */
  private async startHttpServer(): Promise<void> {
    const app = express();
    
    // Add webhook endpoint
    const webhookRouter = createWebhookEndpoint({
      config: this.config,
      processor: this.processor.processNotification.bind(this.processor),
      logger: this.logger
    });
    
    app.use(webhookRouter);

    // Add health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      });
    });

    // Add stats endpoint
    app.get('/stats', (req, res) => {
      res.json(this.getStats());
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          availableEndpoints: ['/webhook', '/ws', '/health', '/stats']
        }
      });
    });

    // Error handler
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('HTTP server error', {
        error: error.message,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    });

    this.httpServer = createServer(app);

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.config.port, () => {
        this.logger.info('HTTP server started', { port: this.config.port });
        resolve();
      });

      this.httpServer!.on('error', reject);
    });
  }

  /**
   * Start WebSocket server
   */
  private async startWebSocketServer(): Promise<void> {
    this.webSocketServer = new NotificationWebSocketServer({
      config: this.config,
      processor: this.processor.processNotification.bind(this.processor),
      logger: this.logger
    });

    // WebSocket server runs on the same port as HTTP server
    // It's handled by the ws library automatically
  }

  /**
   * Start file watcher
   */
  private async startFileWatcher(): Promise<void> {
    this.fileWatcher = new NotificationFileWatcher({
      config: this.config,
      processor: this.processor.processNotification.bind(this.processor),
      logger: this.logger
    });

    await this.fileWatcher.start();
  }

  /**
   * Start Unix socket
   */
  private async startUnixSocket(): Promise<void> {
    this.unixSocket = new NotificationUnixSocket({
      config: this.config,
      processor: this.processor.processNotification.bind(this.processor),
      logger: this.logger
    });

    await this.unixSocket.start();
  }

  /**
   * Handle successfully processed notification
   */
  private async handleNotificationProcessed(notification: BaseNotification, source: IngestionSource): Promise<void> {
    this.stats.totalNotifications++;
    this.stats.bySource[source]++;

    this.logger.debug('Notification processed and counted', {
      notificationId: notification.id,
      source,
      totalCount: this.stats.totalNotifications
    });

    // Trigger external callback
    if (this.onNotificationReceived) {
      try {
        await this.onNotificationReceived(notification, source);
      } catch (error) {
        this.logger.error('External notification callback failed', {
          notificationId: notification.id,
          source,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Broadcast to WebSocket clients if available
    if (this.webSocketServer && notification.tags) {
      this.webSocketServer.broadcast(notification, notification.tags);
    }

    // Broadcast to Unix socket clients if available
    if (this.unixSocket) {
      this.unixSocket.broadcast(notification);
    }
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(error: any, payload: any, source: IngestionSource): Promise<void> {
    this.stats.errors++;

    this.logger.error('Notification processing error', {
      source,
      error: error instanceof Error ? error.message : String(error),
      totalErrors: this.stats.errors
    });

    // Trigger external error callback
    if (this.onError) {
      try {
        await this.onError(error, source);
      } catch (callbackError) {
        this.logger.error('External error callback failed', {
          source,
          originalError: error instanceof Error ? error.message : String(error),
          callbackError: callbackError instanceof Error ? callbackError.message : String(callbackError)
        });
      }
    }
  }

  /**
   * Get server statistics
   */
  public getStats(): {
    isRunning: boolean;
    uptime: number;
    startTime?: string;
    totalNotifications: number;
    notificationsBySource: typeof this.stats.bySource;
    errors: number;
    endpoints: {
      webhook: { port: number };
      websocket: { enabled: boolean; clientCount?: number };
      fileWatcher: { directory: string; queueSize?: number };
      unixSocket: { path: string; clientCount?: number };
    };
  } {
    return {
      isRunning: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      startTime: this.startTime?.toISOString(),
      totalNotifications: this.stats.totalNotifications,
      notificationsBySource: { ...this.stats.bySource },
      errors: this.stats.errors,
      endpoints: {
        webhook: {
          port: this.config.port
        },
        websocket: {
          enabled: this.config.websocket.enabled,
          clientCount: this.webSocketServer?.getClientCount()
        },
        fileWatcher: {
          directory: this.config.fileWatcher.directory,
          queueSize: this.fileWatcher?.getStatus().queueSize
        },
        unixSocket: {
          path: this.config.unixSocket.path,
          clientCount: this.unixSocket?.getStatus().clientCount
        }
      }
    };
  }

  /**
   * Test notification processing without persistence
   */
  public async testNotification(payload: any): Promise<{
    validation: ReturnType<typeof this.processor.validatePayload>;
    transformation: Awaited<ReturnType<typeof this.processor.testTransformation>>;
  }> {
    return {
      validation: this.processor.validatePayload(payload),
      transformation: await this.processor.testTransformation(payload)
    };
  }

  /**
   * Manually process a notification (useful for testing)
   */
  public async processNotification(payload: any, source: IngestionSource = 'webhook'): Promise<IngestionResult> {
    return this.processor.processNotification(payload, source);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<IngestionConfig> {
    return { ...this.config };
  }
}
/**
 * Unix socket/named pipe for local IPC notification ingestion
 */

import { createServer, Server } from 'net';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Socket } from 'net';
import type { IngestionConfig, IngestionResult } from '../types/index.js';

export interface UnixSocketOptions {
  config: IngestionConfig;
  processor: (payload: any, source: 'unix-socket') => Promise<IngestionResult>;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}

export interface SocketClient {
  id: string;
  socket: Socket;
  remoteAddress: string;
  connectedAt: number;
  messagesReceived: number;
}

/**
 * Unix socket server for local IPC notification ingestion
 */
export class NotificationUnixSocket {
  private server: Server;
  private options: UnixSocketOptions;
  private isRunning = false;
  private clients = new Map<string, SocketClient>();
  private socketPath: string;

  constructor(options: UnixSocketOptions) {
    this.options = options;
    this.socketPath = this.getSocketPath();
    this.server = createServer();
    this.setupEventHandlers();
  }

  /**
   * Start the Unix socket server
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.options.logger?.warn('Unix socket server already running');
      return;
    }

    try {
      // Clean up any existing socket file
      await this.cleanupExistingSocket();

      // Ensure directory exists
      await this.ensureSocketDirectory();

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.socketPath, () => {
          this.isRunning = true;
          this.options.logger?.info('Unix socket server started', {
            socketPath: this.socketPath,
            mode: this.options.config.unixSocket.mode
          });
          resolve();
        });

        this.server.on('error', reject);
      });

      // Set socket permissions if specified
      if (this.options.config.unixSocket.mode) {
        await fs.chmod(this.socketPath, this.options.config.unixSocket.mode);
      }

    } catch (error) {
      this.options.logger?.error('Failed to start Unix socket server', {
        error: error instanceof Error ? error.message : String(error),
        socketPath: this.socketPath
      });
      throw error;
    }
  }

  /**
   * Stop the Unix socket server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close all client connections
      for (const client of this.clients.values()) {
        client.socket.destroy();
      }
      this.clients.clear();

      // Close server
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      });

      // Clean up socket file
      await this.cleanupSocket();

      this.options.logger?.info('Unix socket server stopped');
    } catch (error) {
      this.options.logger?.error('Error stopping Unix socket server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for the server
   */
  private setupEventHandlers(): void {
    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleServerError.bind(this));
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    const clientId = this.generateClientId();
    const client: SocketClient = {
      id: clientId,
      socket,
      remoteAddress: socket.remoteAddress || 'unix-socket',
      connectedAt: Date.now(),
      messagesReceived: 0
    };

    this.clients.set(clientId, client);

    this.options.logger?.info('Unix socket client connected', {
      clientId,
      totalClients: this.clients.size
    });

    // Setup client event handlers
    socket.on('data', (data) => this.handleClientData(client, data));
    socket.on('close', () => this.handleClientDisconnect(client));
    socket.on('error', (error) => this.handleClientError(client, error));

    // Send welcome message
    this.sendToClient(client, {
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle data from client
   */
  private async handleClientData(client: SocketClient, data: Buffer): Promise<void> {
    try {
      const messages = this.parseMessages(data.toString());
      
      for (const messageStr of messages) {
        if (!messageStr.trim()) continue;

        try {
          const message = JSON.parse(messageStr);
          client.messagesReceived++;

          this.options.logger?.info('Unix socket message received', {
            clientId: client.id,
            messageType: message.type,
            messageSize: messageStr.length
          });

          await this.processMessage(client, message);
        } catch (parseError) {
          this.options.logger?.warn('Invalid JSON message from Unix socket client', {
            clientId: client.id,
            error: parseError instanceof Error ? parseError.message : String(parseError),
            messagePreview: messageStr.slice(0, 100)
          });

          this.sendToClient(client, {
            type: 'error',
            error: {
              code: 'INVALID_JSON',
              message: 'Invalid JSON message'
            }
          });
        }
      }
    } catch (error) {
      this.options.logger?.error('Error processing client data', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Parse multiple messages from data buffer
   * Messages can be separated by newlines or null bytes
   */
  private parseMessages(data: string): string[] {
    // Split by newlines and null bytes
    return data.split(/\n|\0/).filter(msg => msg.trim());
  }

  /**
   * Process a single message from client
   */
  private async processMessage(client: SocketClient, message: any): Promise<void> {
    try {
      const payload = {
        ...message,
        clientId: client.id,
        socketPath: this.socketPath,
        timestamp: new Date().toISOString()
      };

      const result = await this.options.processor(payload, 'unix-socket');

      if (result.success) {
        this.sendToClient(client, {
          type: 'success',
          notificationId: result.notification?.id,
          messageId: message.id
        });

        this.options.logger?.info('Unix socket notification processed successfully', {
          clientId: client.id,
          notificationId: result.notification?.id,
          source: result.notification?.source
        });
      } else {
        this.sendToClient(client, {
          type: 'error',
          error: result.error,
          messageId: message.id
        });

        this.options.logger?.warn('Unix socket notification processing failed', {
          clientId: client.id,
          error: result.error
        });
      }
    } catch (error) {
      this.options.logger?.error('Error processing Unix socket message', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.sendToClient(client, {
        type: 'error',
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process message'
        },
        messageId: message.id
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(client: SocketClient): void {
    this.clients.delete(client.id);
    
    this.options.logger?.info('Unix socket client disconnected', {
      clientId: client.id,
      totalClients: this.clients.size,
      messagesReceived: client.messagesReceived,
      connectionDuration: Date.now() - client.connectedAt
    });
  }

  /**
   * Handle client error
   */
  private handleClientError(client: SocketClient, error: Error): void {
    this.options.logger?.error('Unix socket client error', {
      clientId: client.id,
      error: error.message
    });
  }

  /**
   * Handle server error
   */
  private handleServerError(error: Error): void {
    this.options.logger?.error('Unix socket server error', {
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Send message to client
   */
  private sendToClient(client: SocketClient, message: any): void {
    try {
      const data = JSON.stringify(message) + '\n';
      client.socket.write(data);
    } catch (error) {
      this.options.logger?.error('Failed to send message to Unix socket client', {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get socket path based on configuration or default
   */
  private getSocketPath(): string {
    if (this.options.config.unixSocket.path) {
      return this.options.config.unixSocket.path;
    }

    // Default path
    const voiceTerminalDir = join(homedir(), '.voice-terminal');
    return join(voiceTerminalDir, 'notify.pipe');
  }

  /**
   * Ensure socket directory exists
   */
  private async ensureSocketDirectory(): Promise<void> {
    const socketDir = this.socketPath.split('/').slice(0, -1).join('/');
    
    try {
      await fs.mkdir(socketDir, { recursive: true });
      this.options.logger?.info('Socket directory created', { socketDir });
    } catch (error) {
      this.options.logger?.error('Failed to create socket directory', {
        socketDir,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up existing socket file
   */
  private async cleanupExistingSocket(): Promise<void> {
    try {
      await fs.unlink(this.socketPath);
      this.options.logger?.info('Existing socket file removed', { socketPath: this.socketPath });
    } catch (error) {
      // It's OK if the file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        this.options.logger?.warn('Failed to remove existing socket file', {
          socketPath: this.socketPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Clean up socket file on shutdown
   */
  private async cleanupSocket(): Promise<void> {
    try {
      await fs.unlink(this.socketPath);
      this.options.logger?.info('Socket file cleaned up', { socketPath: this.socketPath });
    } catch (error) {
      this.options.logger?.warn('Failed to clean up socket file', {
        socketPath: this.socketPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `unix_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Get server status
   */
  public getStatus(): {
    isRunning: boolean;
    socketPath: string;
    clientCount: number;
    totalMessagesReceived: number;
  } {
    const totalMessagesReceived = Array.from(this.clients.values())
      .reduce((sum, client) => sum + client.messagesReceived, 0);

    return {
      isRunning: this.isRunning,
      socketPath: this.socketPath,
      clientCount: this.clients.size,
      totalMessagesReceived
    };
  }

  /**
   * Send notification to all connected clients
   */
  public broadcast(notification: any): void {
    const message = {
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    };

    let broadcastCount = 0;
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
      broadcastCount++;
    }

    this.options.logger?.info('Notification broadcasted via Unix socket', {
      notificationId: notification.id,
      clientCount: broadcastCount
    });
  }
}
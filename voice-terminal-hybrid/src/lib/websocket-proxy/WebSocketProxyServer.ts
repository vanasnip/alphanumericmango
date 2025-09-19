/**
 * CRITICAL SECURITY: WebSocket Proxy Server for Secure Terminal Access
 * Bridges browser clients with secure tmux backend while maintaining all security characteristics
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { URL } from 'url';

import { ConnectionManager } from './ConnectionManager.js';
import { SessionPersistence } from './SessionPersistence.js';
import { LoadBalancer } from './LoadBalancer.js';
import { AuthenticationHandler } from './AuthenticationHandler.js';

import { SecureCommandExecutor, SecureExecutionResult } from '../tmux/security/SecureCommandExecutor.js';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../tmux/security/AuditLogger.js';
import { ITerminalBackend, BackendResult, ExecutionContext } from '../tmux/backends/ITerminalBackend.js';
import type { TmuxSession, CommandExecution, PerformanceMetrics } from '../tmux/types.js';

// WebSocket Message Protocol
export interface ProxyMessage {
  id: string;
  type: ProxyMessageType;
  timestamp: number;
  data: any;
  sessionId?: string;
  authToken?: string;
  clientId?: string;
}

export type ProxyMessageType = 
  | 'auth'
  | 'session-create' 
  | 'session-destroy'
  | 'session-list'
  | 'session-attach'
  | 'session-detach'
  | 'command-execute'
  | 'output-stream'
  | 'heartbeat'
  | 'error'
  | 'metrics'
  | 'batch-execute';

export interface ProxyResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  latency?: number;
  backendInfo?: {
    type: string;
    latency: number;
    load: number;
  };
}

// Server Configuration
export interface ProxyServerConfig {
  port: number;
  host: string;
  maxConnections: number;
  authRequired: boolean;
  enableCompression: boolean;
  heartbeatInterval: number;
  connectionTimeout: number;
  messageTimeout: number;
  
  // Security settings
  rateLimitConfig: {
    windowMs: number;
    maxRequests: number;
    blockDurationMs: number;
  };
  
  // Backend integration
  secureCommandConfig: {
    socketPath: string;
    commandTimeout: number;
    enableAuditLogging: boolean;
    maxConcurrentCommands: number;
  };
  
  // Session persistence
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  
  // Load balancing
  backendPoolConfig: {
    maxBackends: number;
    healthCheckInterval: number;
    failoverThreshold: number;
  };
}

// Performance Monitoring
interface ProxyPerformanceMetrics {
  activeConnections: number;
  totalConnectionsHandled: number;
  messagesPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  backendLatency: number;
  memoryUsage: number;
}

// Connection State
interface ClientConnection {
  id: string;
  ws: WebSocket;
  isAuthenticated: boolean;
  userId?: string;
  sessionId?: string;
  connectedAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  messageCount: number;
  errorCount: number;
}

export class WebSocketProxyServer extends EventEmitter {
  private server: WebSocketServer;
  private config: ProxyServerConfig;
  private connectionManager: ConnectionManager;
  private sessionPersistence: SessionPersistence;
  private loadBalancer: LoadBalancer;
  private authHandler: AuthenticationHandler;
  private secureExecutor: SecureCommandExecutor;
  private auditLogger: AuditLogger;
  
  private isRunning = false;
  private connections = new Map<string, ClientConnection>();
  private latencyMetrics: number[] = [];
  private performanceMetrics: ProxyPerformanceMetrics;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor(config: ProxyServerConfig) {
    super();
    this.config = config;
    
    // Initialize performance metrics
    this.performanceMetrics = {
      activeConnections: 0,
      totalConnectionsHandled: 0,
      messagesPerSecond: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      backendLatency: 0,
      memoryUsage: 0
    };

    // Initialize security components
    this.auditLogger = new AuditLogger({
      enableConsoleOutput: true,
      logLevel: SecuritySeverity.INFO
    });

    this.secureExecutor = new SecureCommandExecutor({
      socketPath: config.secureCommandConfig.socketPath,
      commandTimeout: config.secureCommandConfig.commandTimeout,
      enableAuditLogging: config.secureCommandConfig.enableAuditLogging,
      rateLimitConfig: config.rateLimitConfig,
      maxConcurrentCommands: config.secureCommandConfig.maxConcurrentCommands
    });

    // Initialize proxy components
    this.connectionManager = new ConnectionManager({
      maxConnections: config.maxConnections,
      connectionTimeout: config.connectionTimeout,
      auditLogger: this.auditLogger
    });

    this.sessionPersistence = new SessionPersistence(config.redisConfig);
    
    this.loadBalancer = new LoadBalancer({
      maxBackends: config.backendPoolConfig.maxBackends,
      healthCheckInterval: config.backendPoolConfig.healthCheckInterval,
      failoverThreshold: config.backendPoolConfig.failoverThreshold,
      auditLogger: this.auditLogger
    });

    this.authHandler = new AuthenticationHandler({
      enableAuditLogging: true,
      auditLogger: this.auditLogger
    });

    this.setupEventHandlers();
  }

  /**
   * CRITICAL: Start the WebSocket proxy server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      // Initialize components
      await this.sessionPersistence.initialize();
      await this.loadBalancer.initialize();
      
      // Create WebSocket server
      this.server = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
        maxPayload: 1024 * 1024, // 1MB max message size
        perMessageDeflate: this.config.enableCompression
      });

      this.setupServerEventHandlers();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      // Start heartbeat
      this.startHeartbeat();

      this.isRunning = true;

      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_INIT,
        severity: SecuritySeverity.INFO,
        source: 'WebSocketProxyServer',
        description: 'WebSocket proxy server started successfully',
        metadata: {
          port: this.config.port,
          host: this.config.host,
          maxConnections: this.config.maxConnections
        },
        outcome: 'success',
        riskScore: 2
      });

      console.log(`WebSocket proxy server started on ${this.config.host}:${this.config.port}`);
      
    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.CONFIG_VIOLATION,
        severity: SecuritySeverity.CRITICAL,
        source: 'WebSocketProxyServer',
        description: 'Failed to start WebSocket proxy server',
        metadata: {
          error: error.message
        },
        outcome: 'failure',
        riskScore: 9
      });
      
      throw new Error(`Failed to start WebSocket proxy server: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Stop the WebSocket proxy server gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop accepting new connections
      this.isRunning = false;
      
      // Stop monitoring
      this.stopPerformanceMonitoring();
      this.stopHeartbeat();

      // Gracefully close all connections
      for (const [clientId, connection] of this.connections) {
        try {
          await this.disconnectClient(clientId, 'Server shutdown');
        } catch (error) {
          console.error(`Error disconnecting client ${clientId}:`, error);
        }
      }

      // Close server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
      }

      // Shutdown components
      await this.secureExecutor.shutdown();
      await this.sessionPersistence.shutdown();
      await this.loadBalancer.shutdown();
      await this.auditLogger.shutdown();

      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_SHUTDOWN,
        severity: SecuritySeverity.INFO,
        source: 'WebSocketProxyServer',
        description: 'WebSocket proxy server shutdown completed',
        outcome: 'success',
        riskScore: 1
      });

      console.log('WebSocket proxy server stopped');
      
    } catch (error) {
      console.error('Error during server shutdown:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: Setup server event handlers
   */
  private setupServerEventHandlers(): void {
    this.server.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      await this.handleNewConnection(ws, request);
    });

    this.server.on('error', async (error: Error) => {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_POLICY_VIOLATION,
        severity: SecuritySeverity.HIGH,
        source: 'WebSocketProxyServer',
        description: 'WebSocket server error',
        metadata: {
          error: error.message
        },
        outcome: 'failure',
        riskScore: 7
      });
      
      this.emit('error', error);
    });

    this.server.on('close', () => {
      this.emit('close');
    });
  }

  /**
   * CRITICAL: Handle new WebSocket connection with security validation
   */
  private async handleNewConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const startTime = performance.now();
    const clientIp = request.socket.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    const clientId = this.generateClientId();

    try {
      // Check connection limits
      if (!this.connectionManager.canAcceptConnection()) {
        ws.close(1013, 'Server overloaded');
        return;
      }

      // Create connection record
      const connection: ClientConnection = {
        id: clientId,
        ws,
        isAuthenticated: false,
        connectedAt: new Date(),
        lastActivity: new Date(),
        ipAddress: clientIp,
        userAgent,
        messageCount: 0,
        errorCount: 0
      };

      this.connections.set(clientId, connection);
      this.performanceMetrics.activeConnections++;
      this.performanceMetrics.totalConnectionsHandled++;

      // Register with connection manager
      this.connectionManager.registerConnection(clientId, {
        ipAddress: clientIp,
        userAgent,
        connectedAt: connection.connectedAt
      });

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers(ws, connection);

      // Parse URL for authentication token
      const url = new URL(request.url || '/', `http://${request.headers.host}`);
      const authToken = url.searchParams.get('token');

      if (this.config.authRequired && authToken) {
        // Authenticate connection
        await this.authenticateConnection(connection, authToken);
      }

      const connectionTime = performance.now() - startTime;
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'WebSocketProxyServer',
        description: 'New WebSocket connection established',
        metadata: {
          clientId,
          clientIp,
          userAgent,
          connectionTime,
          authenticated: connection.isAuthenticated
        },
        clientInfo: {
          sessionId: clientId,
          ipAddress: clientIp,
          userAgent
        },
        outcome: 'success',
        riskScore: 2
      });

    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.HIGH,
        source: 'WebSocketProxyServer',
        description: 'Failed to handle new connection',
        metadata: {
          clientId,
          clientIp,
          error: error.message
        },
        clientInfo: {
          sessionId: clientId,
          ipAddress: clientIp,
          userAgent
        },
        outcome: 'blocked',
        riskScore: 6
      });

      ws.close(1011, 'Connection handling failed');
      this.connections.delete(clientId);
      this.performanceMetrics.activeConnections--;
    }
  }

  /**
   * CRITICAL: Setup WebSocket message handlers with security validation
   */
  private setupWebSocketHandlers(ws: WebSocket, connection: ClientConnection): void {
    ws.on('message', async (data: Buffer) => {
      await this.handleMessage(connection, data);
    });

    ws.on('close', async (code: number, reason: Buffer) => {
      await this.handleDisconnection(connection, code, reason.toString());
    });

    ws.on('error', async (error: Error) => {
      connection.errorCount++;
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        source: 'WebSocketProxyServer',
        description: 'WebSocket connection error',
        metadata: {
          clientId: connection.id,
          error: error.message,
          errorCount: connection.errorCount
        },
        clientInfo: {
          sessionId: connection.id,
          ipAddress: connection.ipAddress,
          userAgent: connection.userAgent
        },
        outcome: 'failure',
        riskScore: 5
      });
    });

    ws.on('pong', () => {
      connection.lastActivity = new Date();
    });
  }

  /**
   * CRITICAL: Handle incoming WebSocket messages with comprehensive security
   */
  private async handleMessage(connection: ClientConnection, data: Buffer): Promise<void> {
    const startTime = performance.now();
    connection.lastActivity = new Date();
    connection.messageCount++;

    try {
      // Parse message
      const message: ProxyMessage = JSON.parse(data.toString());
      
      // Validate message structure
      if (!this.isValidMessage(message)) {
        throw new Error('Invalid message format');
      }

      // Check authentication for protected operations
      if (this.requiresAuthentication(message.type) && !connection.isAuthenticated) {
        await this.sendError(connection, message.id, 'Authentication required', 401);
        return;
      }

      // Process message based on type
      const response = await this.processMessage(connection, message);
      
      // Send response
      await this.sendResponse(connection, response);
      
      // Record latency
      const latency = performance.now() - startTime;
      this.latencyMetrics.push(latency);
      
      // Update performance metrics
      this.updatePerformanceMetrics();

    } catch (error) {
      connection.errorCount++;
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.INPUT_VALIDATION_FAILED,
        severity: SecuritySeverity.MEDIUM,
        source: 'WebSocketProxyServer',
        description: 'Message handling error',
        metadata: {
          clientId: connection.id,
          error: error.message,
          messageLength: data.length
        },
        clientInfo: {
          sessionId: connection.id,
          ipAddress: connection.ipAddress,
          userAgent: connection.userAgent
        },
        outcome: 'blocked',
        riskScore: 5
      });

      // Send error response if we can determine message ID
      try {
        const message = JSON.parse(data.toString());
        if (message.id) {
          await this.sendError(connection, message.id, error.message, 400);
        }
      } catch {
        // Cannot parse message, close connection
        connection.ws.close(1003, 'Invalid message format');
      }
    }
  }

  /**
   * CRITICAL: Process WebSocket messages with backend integration
   */
  private async processMessage(connection: ClientConnection, message: ProxyMessage): Promise<ProxyResponse> {
    const startTime = performance.now();
    
    try {
      // Get execution context
      const context: ExecutionContext = {
        sessionId: connection.sessionId,
        clientIp: connection.ipAddress,
        userId: connection.userId,
        requestId: message.id,
        metadata: {
          userAgent: connection.userAgent,
          messageType: message.type
        }
      };

      let result: any;
      let backendInfo: any;

      switch (message.type) {
        case 'auth':
          result = await this.handleAuthMessage(connection, message);
          break;

        case 'session-create':
          result = await this.handleSessionCreate(message, context);
          backendInfo = await this.getBackendInfo();
          break;

        case 'session-destroy':
          result = await this.handleSessionDestroy(message, context);
          backendInfo = await this.getBackendInfo();
          break;

        case 'session-list':
          result = await this.handleSessionList(context);
          backendInfo = await this.getBackendInfo();
          break;

        case 'session-attach':
          result = await this.handleSessionAttach(connection, message, context);
          break;

        case 'session-detach':
          result = await this.handleSessionDetach(connection, message);
          break;

        case 'command-execute':
          result = await this.handleCommandExecute(message, context);
          backendInfo = await this.getBackendInfo();
          break;

        case 'batch-execute':
          result = await this.handleBatchExecute(message, context);
          backendInfo = await this.getBackendInfo();
          break;

        case 'heartbeat':
          result = { timestamp: Date.now(), status: 'ok' };
          break;

        case 'metrics':
          result = this.getProxyMetrics();
          break;

        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      const latency = performance.now() - startTime;

      return {
        id: message.id,
        success: true,
        data: result,
        timestamp: Date.now(),
        latency,
        backendInfo
      };

    } catch (error) {
      const latency = performance.now() - startTime;
      
      return {
        id: message.id,
        success: false,
        error: error.message,
        timestamp: Date.now(),
        latency
      };
    }
  }

  /**
   * CRITICAL: Handle session creation with backend allocation
   */
  private async handleSessionCreate(message: ProxyMessage, context: ExecutionContext): Promise<TmuxSession> {
    const { name, options = {} } = message.data;
    
    // Get optimal backend
    const backend = await this.loadBalancer.getOptimalBackend();
    
    // Create session via secure executor
    const result = await this.secureExecutor.executeSecureCommand(
      'new-session',
      { sessionName: name },
      {
        sessionId: context.sessionId,
        clientIp: context.clientIp,
        userId: context.userId
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to create session');
    }

    // Parse session info from tmux output
    const sessionId = result.stdout?.trim();
    if (!sessionId) {
      throw new Error('Failed to get session ID from tmux');
    }

    const session: TmuxSession = {
      id: sessionId,
      name,
      pid: 0, // Will be populated by backend
      created: new Date(),
      windows: [],
      attached: false
    };

    // Store session in persistence layer
    await this.sessionPersistence.storeSession(session);

    return session;
  }

  /**
   * CRITICAL: Handle session destruction with cleanup
   */
  private async handleSessionDestroy(message: ProxyMessage, context: ExecutionContext): Promise<void> {
    const { sessionId } = message.data;
    
    // Destroy session via secure executor
    const result = await this.secureExecutor.executeSecureCommand(
      'kill-session',
      { sessionId },
      {
        sessionId: context.sessionId,
        clientIp: context.clientIp,
        userId: context.userId
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to destroy session');
    }

    // Clean up persistence
    await this.sessionPersistence.removeSession(sessionId);
  }

  /**
   * CRITICAL: Handle command execution with security validation
   */
  private async handleCommandExecute(message: ProxyMessage, context: ExecutionContext): Promise<CommandExecution> {
    const { sessionId, command, target } = message.data;
    
    // Execute command via secure executor
    const result = await this.secureExecutor.executeSecureCommand(
      'send-keys',
      { target: target || sessionId, command },
      {
        sessionId: context.sessionId,
        clientIp: context.clientIp,
        userId: context.userId
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Command execution failed');
    }

    const execution: CommandExecution = {
      sessionId,
      windowId: '',
      paneId: target || '',
      command,
      timestamp: Date.now(),
      executionTime: result.executionTime
    };

    return execution;
  }

  /**
   * Get current proxy performance metrics
   */
  public getProxyMetrics(): ProxyPerformanceMetrics {
    this.updatePerformanceMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate latency percentiles
    if (this.latencyMetrics.length > 0) {
      const sorted = this.latencyMetrics.slice().sort((a, b) => a - b);
      this.performanceMetrics.averageLatency = sorted.reduce((sum, lat) => sum + lat, 0) / sorted.length;
      this.performanceMetrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
      this.performanceMetrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
    }

    // Update memory usage
    this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
    
    // Keep latency metrics window manageable
    if (this.latencyMetrics.length > 10000) {
      this.latencyMetrics = this.latencyMetrics.slice(-5000);
    }
  }

  // Helper methods implementation would continue...
  
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidMessage(message: any): message is ProxyMessage {
    return message && 
           typeof message.id === 'string' &&
           typeof message.type === 'string' &&
           typeof message.timestamp === 'number' &&
           message.data !== undefined;
  }

  private requiresAuthentication(messageType: ProxyMessageType): boolean {
    const publicTypes: ProxyMessageType[] = ['auth', 'heartbeat'];
    return !publicTypes.includes(messageType);
  }

  private async sendResponse(connection: ClientConnection, response: ProxyResponse): Promise<void> {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(response));
    }
  }

  private async sendError(connection: ClientConnection, messageId: string, error: string, code?: number): Promise<void> {
    const response: ProxyResponse = {
      id: messageId,
      success: false,
      error,
      timestamp: Date.now()
    };
    
    await this.sendResponse(connection, response);
  }

  private setupEventHandlers(): void {
    // Implementation for internal event handling
  }

  private async authenticateConnection(connection: ClientConnection, token: string): Promise<void> {
    // Implementation for authentication
  }

  private async handleAuthMessage(connection: ClientConnection, message: ProxyMessage): Promise<any> {
    // Implementation for auth handling
    return { authenticated: true };
  }

  private async handleSessionList(context: ExecutionContext): Promise<TmuxSession[]> {
    // Implementation for session listing
    return [];
  }

  private async handleSessionAttach(connection: ClientConnection, message: ProxyMessage, context: ExecutionContext): Promise<void> {
    // Implementation for session attachment
  }

  private async handleSessionDetach(connection: ClientConnection, message: ProxyMessage): Promise<void> {
    // Implementation for session detachment
  }

  private async handleBatchExecute(message: ProxyMessage, context: ExecutionContext): Promise<any> {
    // Implementation for batch execution
    return {};
  }

  private async getBackendInfo(): Promise<any> {
    return {
      type: 'tmux',
      latency: 0,
      load: 0
    };
  }

  private async handleDisconnection(connection: ClientConnection, code: number, reason: string): Promise<void> {
    // Implementation for disconnection handling
    this.connections.delete(connection.id);
    this.performanceMetrics.activeConnections--;
  }

  private async disconnectClient(clientId: string, reason: string): Promise<void> {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.ws.close(1000, reason);
      this.connections.delete(clientId);
    }
  }

  private startPerformanceMonitoring(): void {
    this.metricsTimer = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000);
  }

  private stopPerformanceMonitoring(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
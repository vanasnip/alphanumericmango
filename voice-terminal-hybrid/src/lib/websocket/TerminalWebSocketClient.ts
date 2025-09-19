import { terminalStore } from '../stores/terminalStore.js';
import type { 
  TmuxSession, 
  TmuxEvent, 
  CommandExecution, 
  PerformanceMetrics 
} from '../tmux/types.js';
import type { 
  TerminalConnectionState, 
  QueuedCommand, 
  TerminalOutputLine 
} from '../stores/terminalStore.js';

// WebSocket Message Types
export type WSMessageType = 
  | 'session-list'
  | 'session-create'
  | 'session-attach'
  | 'session-detach'
  | 'command-execute'
  | 'output-stream'
  | 'error'
  | 'heartbeat'
  | 'performance-metrics'
  | 'security-validation';

export interface WSMessage {
  type: WSMessageType;
  id: string;
  timestamp: number;
  data: any;
  sessionId?: string;
  requiresAuth?: boolean;
}

// WebSocket Response Types
export interface WSResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  latency?: number;
}

// Connection Configuration
export interface WSConnectionConfig {
  url: string;
  protocols?: string[];
  timeout: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  enableCompression: boolean;
  enableBinaryFrames: boolean;
  securityToken?: string;
}

// Security Context
export interface SecurityContext {
  token: string;
  sessionId: string;
  permissions: string[];
  expiresAt: number;
}

// Performance Monitoring
interface PerformanceMonitor {
  connectionLatency: number[];
  messageLatency: number[];
  throughputBytes: number;
  messagesPerSecond: number;
  lastHeartbeat: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

export class TerminalWebSocketClient {
  private ws: WebSocket | null = null;
  private config: WSConnectionConfig;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private messageQueue: WSMessage[] = [];
  private pendingMessages = new Map<string, { resolve: Function; reject: Function; timestamp: number }>();
  private securityContext: SecurityContext | null = null;
  private performanceMonitor: PerformanceMonitor;
  private connectionState: TerminalConnectionState = 'disconnected';

  // Event callbacks
  private onConnectionStateChange?: (state: TerminalConnectionState) => void;
  private onSessionUpdate?: (session: TmuxSession) => void;
  private onOutputReceived?: (output: TerminalOutputLine) => void;
  private onError?: (error: Error) => void;

  constructor(config: Partial<WSConnectionConfig> = {}) {
    this.config = {
      url: 'ws://localhost:8080/terminal',
      timeout: 5000,
      reconnectInterval: 2000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      enableCompression: true,
      enableBinaryFrames: false,
      ...config
    };

    this.performanceMonitor = {
      connectionLatency: [],
      messageLatency: [],
      throughputBytes: 0,
      messagesPerSecond: 0,
      lastHeartbeat: 0,
      connectionQuality: 'disconnected'
    };

    this.initializeTerminalStoreIntegration();
  }

  // Initialize integration with terminal store
  private initializeTerminalStoreIntegration() {
    // Subscribe to terminal store for command queue processing
    terminalStore.subscribe(state => {
      if (state.commandQueue.length > 0 && !state.isProcessingCommands && this.isConnected()) {
        this.processCommandQueue();
      }
    });
  }

  // Connection Management
  async connect(securityToken?: string): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    this.updateConnectionState('connecting');

    try {
      const startTime = performance.now();
      
      // Prepare connection URL with security token
      let url = this.config.url;
      if (securityToken || this.config.securityToken) {
        const token = securityToken || this.config.securityToken;
        url += `?token=${encodeURIComponent(token)}`;
      }

      // Create WebSocket connection
      this.ws = new WebSocket(url, this.config.protocols);
      
      // Configure WebSocket
      if (this.config.enableCompression) {
        // Note: Compression is handled by the browser automatically
      }

      this.setupEventHandlers();

      // Wait for connection or timeout
      await this.waitForConnection();
      
      // Record connection latency
      const connectionLatency = performance.now() - startTime;
      this.performanceMonitor.connectionLatency.push(connectionLatency);
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Process any queued messages
      this.processMessageQueue();
      
      this.updateConnectionState('connected');
      
    } catch (error) {
      this.updateConnectionState('error');
      this.handleConnectionError(error as Error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.updateConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Message Handling
  async sendMessage<T = any>(message: Omit<WSMessage, 'id' | 'timestamp'>): Promise<WSResponse<T>> {
    const fullMessage: WSMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now()
    };

    // Queue message if not connected
    if (!this.isConnected()) {
      this.messageQueue.push(fullMessage);
      await this.attemptReconnect();
      
      if (!this.isConnected()) {
        throw new Error('Not connected to WebSocket server');
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(fullMessage.id);
        reject(new Error('Message timeout'));
      }, this.config.timeout);

      this.pendingMessages.set(fullMessage.id, {
        resolve: (response: WSResponse<T>) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: performance.now()
      });

      // Send message
      const messageStr = JSON.stringify(fullMessage);
      this.ws!.send(messageStr);
      
      // Update performance metrics
      this.performanceMonitor.throughputBytes += messageStr.length;
    });
  }

  // Terminal Operations
  async listSessions(): Promise<TmuxSession[]> {
    const response = await this.sendMessage<TmuxSession[]>({
      type: 'session-list',
      data: {}
    });
    
    if (response.success && response.data) {
      // Update terminal store with sessions
      response.data.forEach(session => {
        terminalStore.createSession(session);
      });
      return response.data;
    }
    
    throw new Error(response.error || 'Failed to list sessions');
  }

  async createSession(name: string, options: any = {}): Promise<TmuxSession> {
    const response = await this.sendMessage<TmuxSession>({
      type: 'session-create',
      data: { name, options }
    });
    
    if (response.success && response.data) {
      terminalStore.createSession(response.data);
      return response.data;
    }
    
    throw new Error(response.error || 'Failed to create session');
  }

  async attachSession(sessionId: string): Promise<void> {
    const response = await this.sendMessage({
      type: 'session-attach',
      data: { sessionId },
      sessionId
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to attach session');
    }
    
    terminalStore.setActiveSession(sessionId);
    terminalStore.updateSessionConnectionState(sessionId, 'connected');
  }

  async executeCommand(sessionId: string, command: string, options: { 
    windowId?: string; 
    paneId?: string; 
    voiceInitiated?: boolean;
    priority?: 'low' | 'normal' | 'high';
  } = {}): Promise<CommandExecution> {
    // Create command execution record
    const execution: CommandExecution = {
      sessionId,
      windowId: options.windowId || '',
      paneId: options.paneId || '',
      command,
      timestamp: Date.now()
    };

    const startTime = performance.now();
    
    const response = await this.sendMessage<CommandExecution>({
      type: 'command-execute',
      data: { ...execution, options },
      sessionId
    });
    
    const executionTime = performance.now() - startTime;
    
    if (response.success && response.data) {
      const completedExecution = {
        ...response.data,
        executionTime
      };
      
      // Record performance metrics
      terminalStore.recordCommandExecution(completedExecution);
      
      return completedExecution;
    }
    
    throw new Error(response.error || 'Failed to execute command');
  }

  // Queue Processing
  private async processCommandQueue(): Promise<void> {
    terminalStore.setProcessingCommands(true);
    
    try {
      let command = terminalStore.dequeueCommand();
      
      while (command && this.isConnected()) {
        try {
          await this.executeCommand(
            command.sessionId,
            command.command,
            {
              windowId: command.windowId,
              paneId: command.paneId,
              voiceInitiated: command.voiceInitiated,
              priority: command.priority
            }
          );
        } catch (error) {
          console.error('Failed to execute queued command:', error);
          // Add command output for error
          terminalStore.addOutput(
            command.sessionId,
            `Error executing command: ${error}`,
            'error'
          );
        }
        
        command = terminalStore.dequeueCommand();
      }
    } finally {
      terminalStore.setProcessingCommands(false);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        const messageStr = JSON.stringify(message);
        this.ws!.send(messageStr);
        this.performanceMonitor.throughputBytes += messageStr.length;
      }
    }
  }

  // Event Handlers
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateConnectionQuality();
    };

    this.ws.onclose = (event) => {
      this.updateConnectionState('disconnected');
      this.stopHeartbeat();
      
      if (event.code !== 1000) { // Not a normal closure
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionState('error');
      if (this.onError) {
        this.onError(new Error('WebSocket connection error'));
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string | ArrayBuffer): void {
    try {
      let message: any;
      
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        // Handle binary frames if enabled
        message = this.parseBinaryMessage(data);
      }

      // Handle different message types
      switch (message.type) {
        case 'output-stream':
          this.handleOutputStream(message);
          break;
        case 'session-update':
          this.handleSessionUpdate(message);
          break;
        case 'performance-metrics':
          this.handlePerformanceMetrics(message);
          break;
        case 'heartbeat':
          this.handleHeartbeat(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        default:
          // Handle response to pending message
          this.handleResponse(message);
      }
      
      // Update performance metrics
      this.updatePerformanceMetrics();
      
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handleOutputStream(message: any): void {
    const { sessionId, content, type, windowId, paneId } = message.data;
    
    terminalStore.addOutput(sessionId, content, type, windowId, paneId);
    
    if (this.onOutputReceived) {
      this.onOutputReceived({
        id: `${sessionId}-${Date.now()}`,
        timestamp: new Date(),
        content,
        type,
        sessionId,
        windowId,
        paneId,
        isVisible: true
      });
    }
  }

  private handleSessionUpdate(message: any): void {
    const session: TmuxSession = message.data;
    terminalStore.createSession(session);
    
    if (this.onSessionUpdate) {
      this.onSessionUpdate(session);
    }
  }

  private handlePerformanceMetrics(message: any): void {
    const { sessionId, metrics } = message.data;
    terminalStore.updatePerformanceMetrics(sessionId, metrics);
  }

  private handleHeartbeat(message: any): void {
    this.performanceMonitor.lastHeartbeat = Date.now();
    this.updateConnectionQuality();
  }

  private handleErrorMessage(message: any): void {
    console.error('Server error:', message.data);
    if (this.onError) {
      this.onError(new Error(message.data.message || 'Server error'));
    }
  }

  private handleResponse(message: any): void {
    const pending = this.pendingMessages.get(message.id);
    if (pending) {
      this.pendingMessages.delete(message.id);
      
      // Calculate response latency
      const latency = performance.now() - pending.timestamp;
      this.performanceMonitor.messageLatency.push(latency);
      
      const response: WSResponse = {
        ...message,
        latency
      };
      
      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Request failed'));
      }
    }
  }

  // Connection Management Helpers
  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      if (this.ws) {
        this.ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        this.ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        };
      }
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      }
    }, this.config.reconnectInterval * this.reconnectAttempts);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({
          type: 'heartbeat',
          data: { timestamp: Date.now() }
        }).catch(error => {
          console.error('Heartbeat failed:', error);
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Performance Monitoring
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    
    // Calculate messages per second (last 60 seconds)
    const recentLatencies = this.performanceMonitor.messageLatency.filter(
      timestamp => now - timestamp < 60000
    );
    this.performanceMonitor.messagesPerSecond = recentLatencies.length;
    
    // Update connection quality
    this.updateConnectionQuality();
  }

  private updateConnectionQuality(): void {
    const avgLatency = this.getAverageLatency();
    const timeSinceHeartbeat = Date.now() - this.performanceMonitor.lastHeartbeat;
    
    if (!this.isConnected() || timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
      this.performanceMonitor.connectionQuality = 'disconnected';
    } else if (avgLatency < 50) {
      this.performanceMonitor.connectionQuality = 'excellent';
    } else if (avgLatency < 150) {
      this.performanceMonitor.connectionQuality = 'good';
    } else {
      this.performanceMonitor.connectionQuality = 'poor';
    }
  }

  private getAverageLatency(): number {
    const latencies = this.performanceMonitor.messageLatency;
    if (latencies.length === 0) return 0;
    
    return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
  }

  // Utility Methods
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseBinaryMessage(data: ArrayBuffer): any {
    // Implement binary message parsing if needed
    const view = new DataView(data);
    // This would depend on the specific binary protocol
    return { type: 'binary', data: view };
  }

  private updateConnectionState(state: TerminalConnectionState): void {
    this.connectionState = state;
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('Connection error:', error);
    if (this.onError) {
      this.onError(error);
    }
  }

  // Public Getters
  getConnectionState(): TerminalConnectionState {
    return this.connectionState;
  }

  getPerformanceMetrics(): PerformanceMonitor {
    return { ...this.performanceMonitor };
  }

  getMessageQueueLength(): number {
    return this.messageQueue.length;
  }

  // Event Listeners
  onConnectionStateChanged(callback: (state: TerminalConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  onSessionUpdated(callback: (session: TmuxSession) => void): void {
    this.onSessionUpdate = callback;
  }

  onOutputReceived(callback: (output: TerminalOutputLine) => void): void {
    this.onOutputReceived = callback;
  }

  onErrorOccurred(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.messageQueue = [];
    this.pendingMessages.clear();
  }
}

// Default client instance
export const terminalWebSocketClient = new TerminalWebSocketClient();

// Performance monitoring debug information
export const terminalWebSocketDebug = {
  componentPhase: 'mount' as 'mount' | 'update' | 'unmount' | 'error',
  componentName: 'TerminalWebSocketClient',
  renderTime: 0,
  propsCount: 0,
  stateComplexity: 'high' as 'low' | 'medium' | 'high'
};
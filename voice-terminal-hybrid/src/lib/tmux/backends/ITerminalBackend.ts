import { EventEmitter } from 'events';
import type { 
  TmuxSession, 
  TmuxWindow, 
  TmuxPane, 
  CommandExecution, 
  PerformanceMetrics,
  TmuxEvent 
} from '../types';

/**
 * Health status for backend monitoring and selection
 */
export interface BackendHealth {
  isHealthy: boolean;
  latency: number;
  errorRate: number;
  lastCheck: Date;
  consecutiveFailures: number;
  details?: Record<string, any>;
}

/**
 * Backend capabilities for feature detection
 */
export interface BackendCapabilities {
  supportsContinuousCapture: boolean;
  supportsSessionRecovery: boolean;
  supportsContainerIsolation: boolean;
  supportsBatchExecution: boolean;
  supportsWebSocketProxy: boolean;
  maxConcurrentSessions: number;
  maxConcurrentCommands: number;
  requiresExternalProcess: boolean;
}

/**
 * Configuration for backend initialization
 */
export interface BackendConfig {
  socketPath?: string;
  defaultShell?: string;
  captureBufferSize?: number;
  commandTimeout?: number;
  performanceMode?: 'balanced' | 'performance' | 'reliability';
  maxRetries?: number;
  healthCheckInterval?: number;
  
  // Backend-specific configuration
  backendSpecific?: Record<string, any>;
}

/**
 * Context for command execution with client information
 */
export interface ExecutionContext {
  sessionId?: string;
  clientIp?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Result of backend operations
 */
export interface BackendResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metrics?: {
    executionTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

/**
 * Interface for terminal backend implementations
 * 
 * This interface defines the contract that all terminal backends must implement
 * to provide pluggable, swappable terminal functionality with consistent API.
 */
export interface ITerminalBackend extends EventEmitter {
  /**
   * Unique identifier for this backend type
   */
  readonly type: string;
  
  /**
   * Human-readable name for this backend
   */
  readonly name: string;
  
  /**
   * Version of this backend implementation
   */
  readonly version: string;
  
  /**
   * Backend capabilities for feature detection
   */
  readonly capabilities: BackendCapabilities;

  /**
   * Initialize the backend with configuration
   * @param config Backend configuration
   * @returns Promise that resolves when backend is ready
   */
  initialize(config: BackendConfig): Promise<BackendResult<void>>;

  /**
   * Check if backend is initialized and ready
   * @returns True if backend is ready for operations
   */
  isInitialized(): boolean;

  /**
   * Get current health status of the backend
   * @returns Current health information
   */
  getHealth(): Promise<BackendHealth>;

  /**
   * Perform health check and update status
   * @returns Updated health status
   */
  performHealthCheck(): Promise<BackendHealth>;

  /**
   * Create a new terminal session
   * @param name Session name
   * @param context Execution context
   * @returns Promise resolving to session information
   */
  createSession(name: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession>>;

  /**
   * Destroy a terminal session
   * @param sessionId Session identifier
   * @param context Execution context
   * @returns Promise indicating success/failure
   */
  destroySession(sessionId: string, context?: ExecutionContext): Promise<BackendResult<void>>;

  /**
   * Execute a command in a specific session
   * @param sessionId Session identifier
   * @param command Command to execute
   * @param paneId Optional pane identifier
   * @param context Execution context
   * @returns Promise resolving to command execution result
   */
  executeCommand(
    sessionId: string, 
    command: string, 
    paneId?: string, 
    context?: ExecutionContext
  ): Promise<BackendResult<CommandExecution>>;

  /**
   * Execute multiple commands in batch for performance
   * @param sessionId Session identifier
   * @param commands Array of commands to execute
   * @param context Execution context
   * @returns Promise resolving to array of execution results
   */
  executeBatch(
    sessionId: string, 
    commands: string[], 
    context?: ExecutionContext
  ): Promise<BackendResult<CommandExecution[]>>;

  /**
   * Capture output from a session/pane
   * @param sessionId Session identifier
   * @param paneId Optional pane identifier
   * @param lines Number of lines to capture
   * @param context Execution context
   * @returns Promise resolving to captured output
   */
  captureOutput(
    sessionId: string, 
    paneId?: string, 
    lines?: number, 
    context?: ExecutionContext
  ): Promise<BackendResult<string>>;

  /**
   * Start continuous output capture for real-time monitoring
   * @param sessionId Session identifier
   * @param paneId Optional pane identifier
   * @param context Execution context
   * @returns Promise indicating start success
   */
  startContinuousCapture(
    sessionId: string, 
    paneId?: string, 
    context?: ExecutionContext
  ): Promise<BackendResult<void>>;

  /**
   * Stop continuous output capture
   * @param sessionId Session identifier
   * @param paneId Optional pane identifier
   * @returns Promise indicating stop success
   */
  stopContinuousCapture(
    sessionId: string, 
    paneId?: string
  ): Promise<BackendResult<void>>;

  /**
   * List all active sessions
   * @param context Execution context
   * @returns Promise resolving to array of sessions
   */
  listSessions(context?: ExecutionContext): Promise<BackendResult<TmuxSession[]>>;

  /**
   * Get detailed information about a specific session
   * @param sessionId Session identifier
   * @param context Execution context
   * @returns Promise resolving to session details
   */
  getSession(sessionId: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession | null>>;

  /**
   * List windows in a session
   * @param sessionId Session identifier
   * @param context Execution context
   * @returns Promise resolving to array of windows
   */
  listWindows(sessionId: string, context?: ExecutionContext): Promise<BackendResult<TmuxWindow[]>>;

  /**
   * List panes in a window
   * @param sessionId Session identifier
   * @param windowId Window identifier
   * @param context Execution context
   * @returns Promise resolving to array of panes
   */
  listPanes(
    sessionId: string, 
    windowId: string, 
    context?: ExecutionContext
  ): Promise<BackendResult<TmuxPane[]>>;

  /**
   * Get performance metrics from this backend
   * @returns Current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;

  /**
   * Get extended metrics specific to this backend
   * @returns Backend-specific metrics
   */
  getExtendedMetrics(): Record<string, any>;

  /**
   * Test connectivity and basic functionality
   * @returns Promise resolving to test results
   */
  testConnectivity(): Promise<BackendResult<{
    canConnect: boolean;
    canCreateSession: boolean;
    canExecuteCommand: boolean;
    averageLatency: number;
  }>>;

  /**
   * Hot-reload configuration without restart
   * @param config New configuration
   * @returns Promise indicating reload success
   */
  reloadConfig(config: Partial<BackendConfig>): Promise<BackendResult<void>>;

  /**
   * Gracefully shutdown the backend
   * @returns Promise indicating shutdown completion
   */
  shutdown(): Promise<BackendResult<void>>;

  /**
   * Get current configuration
   * @returns Current backend configuration
   */
  getConfig(): BackendConfig;

  /**
   * Backend-specific operation for extending functionality
   * @param operation Operation name
   * @param parameters Operation parameters
   * @param context Execution context
   * @returns Promise resolving to operation result
   */
  executeBackendSpecific(
    operation: string, 
    parameters: Record<string, any>, 
    context?: ExecutionContext
  ): Promise<BackendResult<any>>;
}

/**
 * Event types emitted by backend implementations
 */
export interface BackendEventMap {
  // Health events
  'health-check': { backend: string; health: BackendHealth };
  'health-degraded': { backend: string; health: BackendHealth };
  'health-recovered': { backend: string; health: BackendHealth };
  
  // Session events
  'session-created': { backend: string; session: TmuxSession };
  'session-destroyed': { backend: string; sessionId: string };
  'session-error': { backend: string; sessionId: string; error: string };
  
  // Command events
  'command-executed': { backend: string; execution: CommandExecution };
  'command-failed': { backend: string; sessionId: string; command: string; error: string };
  'batch-completed': { backend: string; sessionId: string; results: CommandExecution[] };
  
  // Output events
  'output-received': { backend: string; sessionId: string; paneId?: string; data: string };
  'capture-started': { backend: string; sessionId: string; paneId?: string };
  'capture-stopped': { backend: string; sessionId: string; paneId?: string };
  
  // Performance events
  'performance-warning': { backend: string; metric: string; value: number; threshold: number };
  'performance-critical': { backend: string; metric: string; value: number; threshold: number };
  
  // Backend events
  'backend-ready': { backend: string; capabilities: BackendCapabilities };
  'backend-error': { backend: string; error: string };
  'backend-shutdown': { backend: string };
  'config-reloaded': { backend: string; config: BackendConfig };
}

/**
 * Base class providing common backend functionality
 */
export abstract class BaseTerminalBackend extends EventEmitter implements ITerminalBackend {
  abstract readonly type: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: BackendCapabilities;

  protected config: BackendConfig = {};
  protected initialized = false;
  protected lastHealth: BackendHealth;

  constructor() {
    super();
    this.lastHealth = {
      isHealthy: false,
      latency: Infinity,
      errorRate: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0
    };
  }

  abstract initialize(config: BackendConfig): Promise<BackendResult<void>>;
  abstract createSession(name: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession>>;
  abstract destroySession(sessionId: string, context?: ExecutionContext): Promise<BackendResult<void>>;
  abstract executeCommand(sessionId: string, command: string, paneId?: string, context?: ExecutionContext): Promise<BackendResult<CommandExecution>>;
  abstract captureOutput(sessionId: string, paneId?: string, lines?: number, context?: ExecutionContext): Promise<BackendResult<string>>;
  abstract listSessions(context?: ExecutionContext): Promise<BackendResult<TmuxSession[]>>;
  abstract getPerformanceMetrics(): PerformanceMetrics;

  isInitialized(): boolean {
    return this.initialized;
  }

  async getHealth(): Promise<BackendHealth> {
    return this.lastHealth;
  }

  getConfig(): BackendConfig {
    return { ...this.config };
  }

  async getSession(sessionId: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession | null>> {
    const sessionsResult = await this.listSessions(context);
    if (!sessionsResult.success) {
      return { success: false, error: sessionsResult.error };
    }
    
    const session = sessionsResult.data?.find(s => s.id === sessionId) || null;
    return { success: true, data: session };
  }

  async executeBatch(sessionId: string, commands: string[], context?: ExecutionContext): Promise<BackendResult<CommandExecution[]>> {
    const results: CommandExecution[] = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(sessionId, command, undefined, context);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        return { 
          success: false, 
          error: `Batch execution failed on command: ${command}. Error: ${result.error}` 
        };
      }
    }
    
    return { success: true, data: results };
  }

  async listWindows(sessionId: string, context?: ExecutionContext): Promise<BackendResult<TmuxWindow[]>> {
    const sessionResult = await this.getSession(sessionId, context);
    if (!sessionResult.success || !sessionResult.data) {
      return { success: false, error: `Session ${sessionId} not found` };
    }
    
    return { success: true, data: sessionResult.data.windows };
  }

  async listPanes(sessionId: string, windowId: string, context?: ExecutionContext): Promise<BackendResult<TmuxPane[]>> {
    const windowsResult = await this.listWindows(sessionId, context);
    if (!windowsResult.success) {
      return { success: false, error: windowsResult.error };
    }
    
    const window = windowsResult.data?.find(w => w.id === windowId);
    if (!window) {
      return { success: false, error: `Window ${windowId} not found in session ${sessionId}` };
    }
    
    return { success: true, data: window.panes };
  }

  async startContinuousCapture(sessionId: string, paneId?: string, context?: ExecutionContext): Promise<BackendResult<void>> {
    // Default implementation - subclasses should override for better performance
    return { success: false, error: 'Continuous capture not implemented in base class' };
  }

  async stopContinuousCapture(sessionId: string, paneId?: string): Promise<BackendResult<void>> {
    // Default implementation - subclasses should override
    return { success: false, error: 'Continuous capture not implemented in base class' };
  }

  getExtendedMetrics(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      lastHealthCheck: this.lastHealth.lastCheck,
      isHealthy: this.lastHealth.isHealthy
    };
  }

  async testConnectivity(): Promise<BackendResult<{ canConnect: boolean; canCreateSession: boolean; canExecuteCommand: boolean; averageLatency: number; }>> {
    const startTime = performance.now();
    
    try {
      // Test basic connectivity
      const healthResult = await this.performHealthCheck();
      const canConnect = healthResult.isHealthy;
      
      if (!canConnect) {
        return {
          success: true,
          data: {
            canConnect: false,
            canCreateSession: false,
            canExecuteCommand: false,
            averageLatency: Infinity
          }
        };
      }
      
      // Test session creation
      const testSessionName = `test-connectivity-${Date.now()}`;
      const sessionResult = await this.createSession(testSessionName);
      const canCreateSession = sessionResult.success;
      
      let canExecuteCommand = false;
      
      if (canCreateSession && sessionResult.data) {
        // Test command execution
        const commandResult = await this.executeCommand(sessionResult.data.id, 'echo "test"');
        canExecuteCommand = commandResult.success;
        
        // Clean up test session
        await this.destroySession(sessionResult.data.id);
      }
      
      const totalTime = performance.now() - startTime;
      
      return {
        success: true,
        data: {
          canConnect,
          canCreateSession,
          canExecuteCommand,
          averageLatency: totalTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Connectivity test failed: ${error.message}`
      };
    }
  }

  async reloadConfig(config: Partial<BackendConfig>): Promise<BackendResult<void>> {
    this.config = { ...this.config, ...config };
    this.emit('config-reloaded', { backend: this.type, config: this.config });
    return { success: true };
  }

  async performHealthCheck(): Promise<BackendHealth> {
    const startTime = performance.now();
    
    try {
      // Basic health check - subclasses should override for more comprehensive checks
      const sessionsResult = await this.listSessions();
      const latency = performance.now() - startTime;
      
      const health: BackendHealth = {
        isHealthy: sessionsResult.success,
        latency,
        errorRate: this.lastHealth.errorRate,
        lastCheck: new Date(),
        consecutiveFailures: sessionsResult.success ? 0 : this.lastHealth.consecutiveFailures + 1,
        details: {
          listSessionsSuccess: sessionsResult.success,
          lastError: sessionsResult.error
        }
      };
      
      this.lastHealth = health;
      this.emit('health-check', { backend: this.type, health });
      
      if (!health.isHealthy && this.lastHealth.isHealthy) {
        this.emit('health-degraded', { backend: this.type, health });
      } else if (health.isHealthy && !this.lastHealth.isHealthy) {
        this.emit('health-recovered', { backend: this.type, health });
      }
      
      return health;
    } catch (error) {
      const health: BackendHealth = {
        isHealthy: false,
        latency: Infinity,
        errorRate: this.lastHealth.errorRate,
        lastCheck: new Date(),
        consecutiveFailures: this.lastHealth.consecutiveFailures + 1,
        details: {
          error: error.message
        }
      };
      
      this.lastHealth = health;
      this.emit('health-check', { backend: this.type, health });
      this.emit('health-degraded', { backend: this.type, health });
      
      return health;
    }
  }

  async executeBackendSpecific(operation: string, parameters: Record<string, any>, context?: ExecutionContext): Promise<BackendResult<any>> {
    return { 
      success: false, 
      error: `Backend-specific operation '${operation}' not implemented in ${this.type}` 
    };
  }

  async shutdown(): Promise<BackendResult<void>> {
    this.initialized = false;
    this.emit('backend-shutdown', { backend: this.type });
    this.removeAllListeners();
    return { success: true };
  }

  protected updateHealth(health: Partial<BackendHealth>): void {
    this.lastHealth = { ...this.lastHealth, ...health, lastCheck: new Date() };
  }

  protected recordLatency(latency: number): void {
    this.lastHealth = {
      ...this.lastHealth,
      latency,
      lastCheck: new Date()
    };
  }

  protected recordError(): void {
    this.lastHealth = {
      ...this.lastHealth,
      consecutiveFailures: this.lastHealth.consecutiveFailures + 1,
      errorRate: Math.min(this.lastHealth.errorRate + 0.1, 1.0),
      lastCheck: new Date()
    };
  }

  protected recordSuccess(): void {
    this.lastHealth = {
      ...this.lastHealth,
      consecutiveFailures: 0,
      errorRate: Math.max(this.lastHealth.errorRate - 0.05, 0.0),
      lastCheck: new Date()
    };
  }
}
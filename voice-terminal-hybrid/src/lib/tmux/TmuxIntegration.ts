import { BackendManager, type BackendManagerConfig } from './backends/BackendManager';
import type { ITerminalBackend, BackendConfig, ExecutionContext } from './backends/ITerminalBackend';
import type { 
  TmuxSession, 
  CommandExecution, 
  TmuxConfig,
  PerformanceMetrics
} from './types';

/**
 * Configuration for TmuxIntegration with backend abstraction support
 */
export interface TmuxIntegrationConfig extends TmuxConfig {
  // Backend-specific configuration
  backendType?: string;
  enableBackendFallback?: boolean;
  fallbackBackends?: string[];
  enableABTesting?: boolean;
  backendSelectionStrategy?: 'round-robin' | 'least-connections' | 'performance-based' | 'health-based' | 'weighted-random' | 'primary-fallback';
  
  // Client context for backend selection
  clientInfo?: {
    clientIp?: string;
    userId?: string;
    sessionId?: string;
  };
}

export class TmuxIntegration {
  private backendManager: BackendManager;
  private activeSession: TmuxSession | null = null;
  private commandQueue: Array<{command: string, sessionId?: string, resolve: Function, reject: Function}> = [];
  private processing = false;
  private commandHistory: CommandExecution[] = [];
  private config: TmuxIntegrationConfig;
  private executionContext: ExecutionContext;

  constructor(config: TmuxIntegrationConfig = {}) {
    this.config = config;
    
    // Create execution context from client info
    this.executionContext = {
      sessionId: config.clientInfo?.sessionId,
      clientIp: config.clientInfo?.clientIp,
      userId: config.clientInfo?.userId,
      metadata: {
        integrationVersion: '2.0.0',
        backendAbstraction: true
      }
    };

    // Convert TmuxConfig to BackendConfig
    const backendConfig: BackendConfig = {
      socketPath: config.socketPath,
      defaultShell: config.defaultShell,
      captureBufferSize: config.captureBufferSize,
      commandTimeout: config.commandTimeout,
      performanceMode: config.performanceMode
    };

    // Create BackendManager configuration
    const managerConfig: Partial<BackendManagerConfig> = {
      selectionStrategy: config.backendSelectionStrategy || 'primary-fallback',
      fallbackBackends: config.fallbackBackends || ['tmux'],
      enableABTesting: config.enableABTesting || false,
      enableHotSwap: true,
      healthCheckInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      performanceThresholds: {
        maxLatency: 100,
        minSuccessRate: 0.95,
        maxErrorRate: 0.05
      }
    };

    this.backendManager = new BackendManager(managerConfig);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to backend manager events
    this.backendManager.on('command-executed', (event) => {
      if (event.execution) {
        this.commandHistory.push(event.execution);
        if (this.commandHistory.length > 1000) {
          this.commandHistory = this.commandHistory.slice(-1000);
        }
      }
    });

    this.backendManager.on('session-destroyed', (event) => {
      if (this.activeSession?.id === event.sessionId) {
        this.activeSession = null;
      }
    });

    // Monitor backend health and performance
    this.backendManager.on('backend-health-degraded', (event) => {
      console.warn(`Backend ${event.backendId} health degraded:`, event.health);
    });

    this.backendManager.on('backend-performance-warning', (event) => {
      console.warn(`Backend ${event.backendId} performance warning:`, event);
    });

    this.backendManager.on('backend-hot-swapped', (event) => {
      console.info(`Backend hot-swapped from ${event.oldBackendId} to ${event.newBackendId}`);
    });
  }

  async initialize(): Promise<void> {
    // Initialize the backend manager
    const initResult = await this.backendManager.initialize();
    if (!initResult.success) {
      throw new Error(`Failed to initialize backend manager: ${initResult.error}`);
    }
    
    // Get existing sessions or create default
    const sessionsResult = await this.backendManager.listSessions(this.executionContext);
    if (sessionsResult.success && sessionsResult.data) {
      const sessions = sessionsResult.data;
      if (sessions.length === 0) {
        await this.createSession('default');
      } else {
        this.activeSession = sessions[0];
      }
    } else {
      // If we can't list sessions, try to create a default one
      await this.createSession('default');
    }
  }

  async createSession(name: string): Promise<TmuxSession> {
    const result = await this.backendManager.createSession(name, this.executionContext);
    
    if (!result.success || !result.data) {
      throw new Error(`Failed to create session: ${result.error}`);
    }

    const session = result.data;
    if (!this.activeSession) {
      this.activeSession = session;
    }
    return session;
  }

  async executeCommand(command: string, sessionId?: string): Promise<CommandExecution> {
    const targetSession = sessionId || this.activeSession?.id;
    
    if (!targetSession) {
      throw new Error('No active session');
    }

    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, sessionId: targetSession, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.commandQueue.length > 0) {
      const { command, sessionId, resolve, reject } = this.commandQueue.shift()!;
      
      try {
        const result = await this.backendManager.executeCommand(
          sessionId!, 
          command, 
          undefined, 
          this.executionContext
        );
        
        if (result.success && result.data) {
          resolve(result.data);
        } else {
          reject(new Error(result.error || 'Command execution failed'));
        }
      } catch (error) {
        reject(error);
      }

      // Check if we should throttle based on current performance
      const metrics = this.getAggregatedPerformanceMetrics();
      if (metrics.averageLatency < 10) {
        continue;
      } else {
        await new Promise(r => setTimeout(r, 5));
      }
    }

    this.processing = false;
  }

  async executeBatch(commands: string[]): Promise<CommandExecution[]> {
    const targetSession = this.activeSession?.id;
    if (!targetSession) {
      throw new Error('No active session');
    }

    const startTime = performance.now();

    // Use backend manager's intelligent batch execution
    const result = await this.backendManager.executeWithBackend(
      async (backend) => {
        // Check if backend supports batch execution
        if (backend.capabilities.supportsBatchExecution) {
          return backend.executeBatch(targetSession, commands, this.executionContext);
        } else {
          // Fallback to sequential execution
          const results: CommandExecution[] = [];
          for (const command of commands) {
            const cmdResult = await backend.executeCommand(
              targetSession, 
              command, 
              undefined, 
              this.executionContext
            );
            if (cmdResult.success && cmdResult.data) {
              results.push(cmdResult.data);
            } else {
              throw new Error(cmdResult.error || 'Command execution failed');
            }
          }
          return { success: true, data: results };
        }
      },
      this.executionContext
    );

    if (!result.success || !result.data) {
      throw new Error(`Batch execution failed: ${result.error}`);
    }

    const totalTime = performance.now() - startTime;
    const avgTimePerCommand = totalTime / commands.length;
    
    console.log(`Batch execution of ${commands.length} commands took ${totalTime}ms (avg: ${avgTimePerCommand.toFixed(2)}ms per command)`);

    return result.data;
  }

  async getOutput(lines: number = 100, sessionId?: string): Promise<string> {
    const targetSession = sessionId || this.activeSession?.id;
    
    if (!targetSession) {
      throw new Error('No active session');
    }

    const result = await this.backendManager.executeWithBackend(
      (backend) => backend.captureOutput(targetSession, undefined, lines, this.executionContext),
      this.executionContext
    );

    if (!result.success || result.data === undefined) {
      throw new Error(`Failed to capture output: ${result.error}`);
    }

    return result.data;
  }

  async startContinuousCapture(callback: (output: string) => void, sessionId?: string): Promise<void> {
    const targetSession = sessionId || this.activeSession?.id;
    
    if (!targetSession) {
      throw new Error('No active session');
    }

    // Start continuous capture through backend manager
    const result = await this.backendManager.executeWithBackend(
      async (backend) => {
        if (backend.capabilities.supportsContinuousCapture) {
          return backend.startContinuousCapture(targetSession, undefined, this.executionContext);
        } else {
          return { success: false, error: 'Backend does not support continuous capture' };
        }
      },
      this.executionContext
    );

    if (!result.success) {
      throw new Error(`Failed to start continuous capture: ${result.error}`);
    }
    
    // Listen for output events from backend manager
    this.backendManager.on('output-received', (event) => {
      if (event.sessionId === targetSession) {
        callback(event.data);
      }
    });
  }

  async switchSession(sessionId: string): Promise<void> {
    const result = await this.backendManager.executeWithBackend(
      (backend) => backend.getSession(sessionId, this.executionContext),
      this.executionContext
    );

    if (!result.success || !result.data) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.activeSession = result.data;
  }

  async getSessions(): Promise<TmuxSession[]> {
    const result = await this.backendManager.listSessions(this.executionContext);
    
    if (!result.success || !result.data) {
      throw new Error(`Failed to get sessions: ${result.error}`);
    }

    return result.data;
  }

  getActiveSession(): TmuxSession | null {
    return this.activeSession;
  }

  /**
   * Get performance metrics from the backend manager
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const aggregated = this.backendManager.getAggregatedMetrics();
    
    // Convert aggregated metrics to PerformanceMetrics format
    return {
      commandInjectionLatency: [], // Individual latencies not available in aggregated view
      outputCaptureLatency: [],
      averageLatency: aggregated.averageLatency,
      p95Latency: 0, // Not available in current aggregated metrics
      p99Latency: 0, // Not available in current aggregated metrics
      totalCommands: aggregated.totalOperations,
      failedCommands: aggregated.totalOperations - (aggregated.totalOperations * aggregated.successRate),
      successRate: aggregated.successRate * 100
    };
  }

  /**
   * Get aggregated performance metrics from all backends
   */
  getAggregatedPerformanceMetrics() {
    return this.backendManager.getAggregatedMetrics();
  }

  /**
   * Get comprehensive performance metrics including backend-specific data
   */
  async getEnhancedPerformanceMetrics(): Promise<{
    aggregated: ReturnType<typeof this.backendManager.getAggregatedMetrics>;
    backendHealth: Record<string, any>;
    backendSpecific: Record<string, any>;
  }> {
    const aggregated = this.backendManager.getAggregatedMetrics();
    const health = await this.backendManager.getBackendHealthStatus();
    
    // Get backend-specific metrics through executeWithBackend
    let backendSpecific = {};
    try {
      const result = await this.backendManager.executeWithBackend(
        async (backend) => {
          const extended = backend.getExtendedMetrics();
          
          // Try to get enhanced metrics if it's a TmuxBackend
          let enhanced = null;
          try {
            const enhancedResult = await backend.executeBackendSpecific(
              'getEnhancedMetrics',
              {},
              this.executionContext
            );
            if (enhancedResult.success) {
              enhanced = enhancedResult.data;
            }
          } catch {
            // Enhanced metrics not available
          }
          
          return {
            success: true,
            data: { extended, enhanced }
          };
        },
        this.executionContext
      );
      
      if (result.success) {
        backendSpecific = result.data || {};
      }
    } catch (error) {
      console.warn('Failed to get backend-specific metrics:', error);
    }

    return {
      aggregated,
      backendHealth: health,
      backendSpecific
    };
  }

  /**
   * Check if performance target is being met across all backends
   */
  async isPerformanceTargetMet(): Promise<boolean> {
    const aggregated = this.backendManager.getAggregatedMetrics();
    
    // Check basic performance thresholds
    const targetMet = aggregated.averageLatency < 100 && // < 100ms
                     aggregated.successRate > 0.95; // > 95%
    
    // Try to get more specific target information from backends
    try {
      const result = await this.backendManager.executeWithBackend(
        async (backend) => {
          const targetResult = await backend.executeBackendSpecific(
            'isPerformanceTargetMet',
            {},
            this.executionContext
          );
          return targetResult;
        },
        this.executionContext
      );
      
      if (result.success && typeof result.data === 'boolean') {
        return result.data && targetMet;
      }
    } catch {
      // Backend-specific target check not available
    }
    
    return targetMet;
  }

  /**
   * Get performance summary for monitoring
   */
  async getPerformanceSummary(): Promise<{
    averageLatency: number;
    targetLatency: number;
    isTargetMet: boolean;
    successRate: number;
    backendCount: number;
    activeBackends: number;
    cacheHitRate?: number;
    connectionPoolHealth?: number;
    batchingEfficiency?: number;
  }> {
    const aggregated = this.backendManager.getAggregatedMetrics();
    const isTargetMet = await this.isPerformanceTargetMet();
    
    let summary = {
      averageLatency: aggregated.averageLatency,
      targetLatency: 100, // Default target
      isTargetMet,
      successRate: aggregated.successRate,
      backendCount: aggregated.backendCount,
      activeBackends: aggregated.activeBackends
    };
    
    // Try to get enhanced summary from backends
    try {
      const result = await this.backendManager.executeWithBackend(
        async (backend) => {
          const summaryResult = await backend.executeBackendSpecific(
            'getPerformanceSummary',
            {},
            this.executionContext
          );
          return summaryResult;
        },
        this.executionContext
      );
      
      if (result.success && result.data) {
        summary = { ...summary, ...result.data };
      }
    } catch {
      // Enhanced summary not available
    }
    
    return summary;
  }

  /**
   * Get backend information and health status
   */
  async getBackendStatus(): Promise<{
    backends: Record<string, any>;
    activeBackend: string | null;
    healthStatus: Record<string, any>;
  }> {
    const health = await this.backendManager.getBackendHealthStatus();
    const aggregated = this.backendManager.getAggregatedMetrics();
    
    return {
      backends: aggregated.backendMetrics,
      activeBackend: null, // BackendManager doesn't expose current active backend
      healthStatus: health
    };
  }

  getCommandHistory(): CommandExecution[] {
    return [...this.commandHistory];
  }

  async cleanup(): Promise<void> {
    await this.backendManager.shutdown();
    this.commandQueue = [];
    this.commandHistory = [];
    this.activeSession = null;
  }

  /**
   * Backend management methods for advanced usage
   */
  
  /**
   * Hot-swap the current backend (for maintenance)
   */
  async hotSwapBackend(newConfig?: BackendConfig): Promise<boolean> {
    // This would require knowing which backend to swap
    // For now, this is a placeholder for future implementation
    console.warn('Hot-swap functionality requires backend identification');
    return false;
  }

  /**
   * Enable/disable A/B testing
   */
  enableABTesting(config: any): void {
    console.warn('A/B testing configuration changes require manager restart');
  }

  /**
   * Get current backend selection strategy
   */
  getBackendStrategy(): string {
    return this.config.backendSelectionStrategy || 'primary-fallback';
  }
}
}
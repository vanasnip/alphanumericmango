import { 
  ITerminalBackend, 
  BaseTerminalBackend, 
  BackendConfig, 
  BackendResult, 
  ExecutionContext, 
  BackendCapabilities,
  BackendHealth
} from './ITerminalBackend';
import { TmuxSessionManager } from '../TmuxSessionManager';
import type { 
  TmuxSession, 
  CommandExecution, 
  PerformanceMetrics,
  TmuxConfig 
} from '../types';

/**
 * Tmux-based terminal backend implementation
 * 
 * This backend wraps the existing TmuxSessionManager to provide
 * the standardized ITerminalBackend interface while maintaining
 * all existing security and performance optimizations.
 */
export class TmuxBackend extends BaseTerminalBackend {
  readonly type = 'tmux';
  readonly name = 'Tmux Terminal Backend';
  readonly version = '1.0.0';
  
  readonly capabilities: BackendCapabilities = {
    supportsContinuousCapture: true,
    supportsSessionRecovery: true,
    supportsContainerIsolation: false, // tmux doesn't provide container isolation
    supportsBatchExecution: true,
    supportsWebSocketProxy: false, // will be added in future backends
    maxConcurrentSessions: 100,
    maxConcurrentCommands: 50,
    requiresExternalProcess: true
  };

  private sessionManager: TmuxSessionManager | null = null;
  private continuousCaptures: Map<string, boolean> = new Map();
  private performanceMonitor: {
    commandCount: number;
    errorCount: number;
    startTime: number;
  } = {
    commandCount: 0,
    errorCount: 0,
    startTime: Date.now()
  };

  constructor() {
    super();
    this.setupEventForwarding();
  }

  async initialize(config: BackendConfig): Promise<BackendResult<void>> {
    try {
      // Convert backend config to tmux config
      const tmuxConfig: TmuxConfig = {
        socketPath: config.socketPath,
        defaultShell: config.defaultShell,
        captureBufferSize: config.captureBufferSize,
        commandTimeout: config.commandTimeout,
        performanceMode: config.performanceMode
      };

      this.sessionManager = new TmuxSessionManager(tmuxConfig);
      this.config = config;

      // Initialize the session manager
      await this.sessionManager.initialize();

      this.initialized = true;
      this.updateHealth({ isHealthy: true, consecutiveFailures: 0 });
      
      // Start health monitoring
      this.startHealthMonitoring();

      this.emit('backend-ready', { 
        backend: this.type, 
        capabilities: this.capabilities 
      });

      return { 
        success: true,
        metrics: {
          executionTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      this.recordError();
      this.emit('backend-error', { 
        backend: this.type, 
        error: error.message 
      });
      
      return { 
        success: false, 
        error: `Failed to initialize tmux backend: ${error.message}` 
      };
    }
  }

  private setupEventForwarding(): void {
    // Forward events from session manager to backend events
    this.on('newListener', (event, listener) => {
      if (!this.sessionManager) return;

      // Forward session manager events to backend events
      switch (event) {
        case 'session-created':
          this.sessionManager.on('session-created', (tmuxEvent) => {
            this.emit('session-created', {
              backend: this.type,
              session: tmuxEvent.data
            });
          });
          break;
        
        case 'session-destroyed':
          this.sessionManager.on('session-closed', (tmuxEvent) => {
            this.emit('session-destroyed', {
              backend: this.type,
              sessionId: tmuxEvent.sessionId!
            });
          });
          break;
        
        case 'command-executed':
          this.sessionManager.on('command-executed', (tmuxEvent) => {
            this.performanceMonitor.commandCount++;
            this.emit('command-executed', {
              backend: this.type,
              execution: tmuxEvent.data
            });
          });
          break;
        
        case 'output-received':
          this.sessionManager.on('output-received', (tmuxEvent) => {
            this.emit('output-received', {
              backend: this.type,
              sessionId: tmuxEvent.sessionId!,
              paneId: tmuxEvent.paneId,
              data: tmuxEvent.data
            });
          });
          break;
      }
    });
  }

  private startHealthMonitoring(): void {
    // Perform health checks every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000);
  }

  async performHealthCheck(): Promise<BackendHealth> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Session manager not initialized');
      }

      // Test basic functionality
      const sessions = this.sessionManager.getSessions();
      const performanceMetrics = this.sessionManager.getPerformanceMetrics();
      const enhancedMetrics = this.sessionManager.getEnhancedPerformanceMetrics();
      
      const latency = performance.now() - startTime;
      
      // Calculate error rate
      const totalOperations = this.performanceMonitor.commandCount;
      const errorRate = totalOperations > 0 
        ? this.performanceMonitor.errorCount / totalOperations 
        : 0;

      const health: BackendHealth = {
        isHealthy: enhancedMetrics.isTargetMet && errorRate < 0.05,
        latency,
        errorRate,
        lastCheck: new Date(),
        consecutiveFailures: enhancedMetrics.isTargetMet ? 0 : this.lastHealth.consecutiveFailures + 1,
        details: {
          sessionCount: sessions.length,
          averageLatency: performanceMetrics.averageLatency,
          successRate: performanceMetrics.successRate,
          targetLatencyMet: enhancedMetrics.isTargetMet,
          connectionPoolHealth: enhancedMetrics.connectionPool?.healthyConnections || 0,
          cacheHitRate: enhancedMetrics.cache?.hitRate || 0,
          performanceMode: enhancedMetrics.performanceMode
        }
      };

      this.lastHealth = health;
      this.emit('health-check', { backend: this.type, health });

      // Emit performance warnings if needed
      if (performanceMetrics.averageLatency > 50) {
        this.emit('performance-warning', {
          backend: this.type,
          metric: 'averageLatency',
          value: performanceMetrics.averageLatency,
          threshold: 50
        });
      }

      if (errorRate > 0.1) {
        this.emit('performance-critical', {
          backend: this.type,
          metric: 'errorRate',
          value: errorRate,
          threshold: 0.1
        });
      }

      return health;
    } catch (error) {
      const health: BackendHealth = {
        isHealthy: false,
        latency: Infinity,
        errorRate: 1.0,
        lastCheck: new Date(),
        consecutiveFailures: this.lastHealth.consecutiveFailures + 1,
        details: {
          error: error.message,
          sessionManagerInitialized: !!this.sessionManager
        }
      };

      this.lastHealth = health;
      this.emit('health-degraded', { backend: this.type, health });
      
      return health;
    }
  }

  async createSession(name: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const clientInfo = context ? {
        clientIp: context.clientIp,
        userId: context.userId
      } : undefined;

      const session = await this.sessionManager.createSession(name, clientInfo);
      
      this.recordSuccess();
      
      return {
        success: true,
        data: session,
        metrics: {
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;
      
      this.emit('session-error', {
        backend: this.type,
        sessionId: name,
        error: error.message
      });

      return {
        success: false,
        error: `Failed to create session: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async destroySession(sessionId: string, context?: ExecutionContext): Promise<BackendResult<void>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const clientInfo = context ? {
        clientIp: context.clientIp,
        userId: context.userId
      } : undefined;

      await this.sessionManager.destroySession(sessionId, clientInfo);
      
      // Clean up any continuous captures for this session
      const captureKeys = Array.from(this.continuousCaptures.keys())
        .filter(key => key.startsWith(sessionId));
      
      captureKeys.forEach(key => {
        this.continuousCaptures.delete(key);
      });

      this.recordSuccess();
      
      return {
        success: true,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;

      return {
        success: false,
        error: `Failed to destroy session: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async executeCommand(
    sessionId: string, 
    command: string, 
    paneId?: string, 
    context?: ExecutionContext
  ): Promise<BackendResult<CommandExecution>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const clientInfo = context ? {
        clientIp: context.clientIp,
        userId: context.userId
      } : undefined;

      const execution = await this.sessionManager.sendCommand(sessionId, command, paneId, clientInfo);
      
      this.recordSuccess();
      this.performanceMonitor.commandCount++;
      
      return {
        success: true,
        data: execution,
        metrics: {
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;
      
      this.emit('command-failed', {
        backend: this.type,
        sessionId,
        command,
        error: error.message
      });

      return {
        success: false,
        error: `Failed to execute command: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async executeBatch(
    sessionId: string, 
    commands: string[], 
    context?: ExecutionContext
  ): Promise<BackendResult<CommandExecution[]>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      // Use the session manager's optimized batch execution
      const results = await this.sessionManager.executeBatch(commands);
      
      this.recordSuccess();
      this.performanceMonitor.commandCount += commands.length;
      
      this.emit('batch-completed', {
        backend: this.type,
        sessionId,
        results
      });
      
      return {
        success: true,
        data: results,
        metrics: {
          executionTime: performance.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;

      return {
        success: false,
        error: `Failed to execute batch: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async captureOutput(
    sessionId: string, 
    paneId?: string, 
    lines: number = 100, 
    context?: ExecutionContext
  ): Promise<BackendResult<string>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const clientInfo = context ? {
        clientIp: context.clientIp,
        userId: context.userId
      } : undefined;

      const output = await this.sessionManager.captureOutput(sessionId, paneId, clientInfo, lines);
      
      this.recordSuccess();
      
      return {
        success: true,
        data: output,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;

      return {
        success: false,
        error: `Failed to capture output: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async startContinuousCapture(
    sessionId: string, 
    paneId?: string, 
    context?: ExecutionContext
  ): Promise<BackendResult<void>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const captureKey = `${sessionId}-${paneId || 'default'}`;
      
      if (this.continuousCaptures.has(captureKey)) {
        return { 
          success: true,
          metrics: { executionTime: performance.now() - startTime }
        };
      }

      const clientInfo = context ? {
        clientIp: context.clientIp,
        userId: context.userId
      } : undefined;

      await this.sessionManager.startContinuousCapture(sessionId, paneId, clientInfo);
      this.continuousCaptures.set(captureKey, true);
      
      this.emit('capture-started', {
        backend: this.type,
        sessionId,
        paneId
      });

      this.recordSuccess();
      
      return {
        success: true,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;

      return {
        success: false,
        error: `Failed to start continuous capture: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async stopContinuousCapture(sessionId: string, paneId?: string): Promise<BackendResult<void>> {
    const startTime = performance.now();
    
    try {
      const captureKey = `${sessionId}-${paneId || 'default'}`;
      
      if (!this.continuousCaptures.has(captureKey)) {
        return { 
          success: true,
          metrics: { executionTime: performance.now() - startTime }
        };
      }

      // Note: TmuxSessionManager doesn't have stopContinuousCapture method
      // This would need to be implemented there for full functionality
      this.continuousCaptures.delete(captureKey);
      
      this.emit('capture-stopped', {
        backend: this.type,
        sessionId,
        paneId
      });

      return {
        success: true,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();

      return {
        success: false,
        error: `Failed to stop continuous capture: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async listSessions(context?: ExecutionContext): Promise<BackendResult<TmuxSession[]>> {
    const startTime = performance.now();
    
    try {
      if (!this.sessionManager) {
        throw new Error('Backend not initialized');
      }

      const sessions = this.sessionManager.getSessions();
      
      this.recordSuccess();
      
      return {
        success: true,
        data: sessions,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();
      this.performanceMonitor.errorCount++;

      return {
        success: false,
        error: `Failed to list sessions: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    if (!this.sessionManager) {
      return {
        commandInjectionLatency: [],
        outputCaptureLatency: [],
        averageLatency: Infinity,
        p95Latency: Infinity,
        p99Latency: Infinity,
        totalCommands: 0,
        failedCommands: 0,
        successRate: 0
      };
    }

    return this.sessionManager.getPerformanceMetrics();
  }

  getExtendedMetrics(): Record<string, any> {
    const baseMetrics = super.getExtendedMetrics();
    
    if (!this.sessionManager) {
      return {
        ...baseMetrics,
        sessionManagerInitialized: false
      };
    }

    const enhancedMetrics = this.sessionManager.getEnhancedPerformanceMetrics();
    const securityMetrics = this.sessionManager.getSecurityMetrics();
    
    return {
      ...baseMetrics,
      sessionManagerInitialized: true,
      continuousCaptures: this.continuousCaptures.size,
      commandCount: this.performanceMonitor.commandCount,
      errorCount: this.performanceMonitor.errorCount,
      uptime: Date.now() - this.performanceMonitor.startTime,
      enhanced: enhancedMetrics,
      security: securityMetrics
    };
  }

  async testConnectivity(): Promise<BackendResult<{ canConnect: boolean; canCreateSession: boolean; canExecuteCommand: boolean; averageLatency: number; }>> {
    if (!this.sessionManager) {
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

    // Use the optimized connectivity test from the base class
    return super.testConnectivity();
  }

  async executeBackendSpecific(
    operation: string, 
    parameters: Record<string, any>, 
    context?: ExecutionContext
  ): Promise<BackendResult<any>> {
    if (!this.sessionManager) {
      return { success: false, error: 'Backend not initialized' };
    }

    const startTime = performance.now();

    try {
      switch (operation) {
        case 'getSecurityMetrics':
          return {
            success: true,
            data: this.sessionManager.getSecurityMetrics(),
            metrics: { executionTime: performance.now() - startTime }
          };

        case 'getEnhancedMetrics':
          return {
            success: true,
            data: this.sessionManager.getEnhancedPerformanceMetrics(),
            metrics: { executionTime: performance.now() - startTime }
          };

        case 'isPerformanceTargetMet':
          return {
            success: true,
            data: this.sessionManager.getEnhancedPerformanceMetrics().isTargetMet,
            metrics: { executionTime: performance.now() - startTime }
          };

        case 'getPerformanceSummary':
          // This method exists in TmuxIntegration but not SessionManager
          // We'll calculate it here
          const enhanced = this.sessionManager.getEnhancedPerformanceMetrics();
          return {
            success: true,
            data: {
              averageLatency: enhanced.core.averageLatency,
              targetLatency: enhanced.targetLatency,
              isTargetMet: enhanced.isTargetMet,
              cacheHitRate: enhanced.cache.hitRate || 0,
              connectionPoolHealth: enhanced.connectionPool ? 
                (enhanced.connectionPool.healthyConnections / enhanced.connectionPool.totalConnections) * 100 : 0,
              batchingEfficiency: enhanced.batcher.batchingEfficiency || 0
            },
            metrics: { executionTime: performance.now() - startTime }
          };

        default:
          return {
            success: false,
            error: `Unknown backend-specific operation: ${operation}`,
            metrics: { executionTime: performance.now() - startTime }
          };
      }
    } catch (error) {
      this.recordError();
      return {
        success: false,
        error: `Backend-specific operation failed: ${error.message}`,
        metrics: { executionTime: performance.now() - startTime }
      };
    }
  }

  async reloadConfig(config: Partial<BackendConfig>): Promise<BackendResult<void>> {
    const startTime = performance.now();
    
    try {
      // For tmux backend, some configuration changes require restart
      const oldConfig = this.config;
      this.config = { ...this.config, ...config };

      // Check if critical configuration changed
      const needsRestart = 
        config.socketPath !== undefined && config.socketPath !== oldConfig.socketPath ||
        config.performanceMode !== undefined && config.performanceMode !== oldConfig.performanceMode;

      if (needsRestart && this.sessionManager) {
        // Graceful restart - preserve sessions if possible
        console.warn('Tmux backend configuration change requires restart');
        
        // For now, just update what we can without restart
        // A full implementation would need session persistence
      }

      this.emit('config-reloaded', { backend: this.type, config: this.config });

      return {
        success: true,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      this.recordError();
      return {
        success: false,
        error: `Failed to reload config: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }

  async shutdown(): Promise<BackendResult<void>> {
    const startTime = performance.now();
    
    try {
      if (this.sessionManager) {
        await this.sessionManager.cleanup();
        this.sessionManager = null;
      }

      this.continuousCaptures.clear();
      
      // Call parent shutdown
      await super.shutdown();

      return {
        success: true,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to shutdown: ${error.message}`,
        metrics: {
          executionTime: performance.now() - startTime
        }
      };
    }
  }
}
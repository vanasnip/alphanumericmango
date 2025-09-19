import { EventEmitter } from 'events';
import type { 
  ITerminalBackend, 
  BackendConfig, 
  BackendHealth,
  BackendResult,
  ExecutionContext,
  BackendCapabilities 
} from './ITerminalBackend';
import { BackendFactory, type BackendCreationOptions } from './BackendFactory';
import type { 
  TmuxSession, 
  CommandExecution, 
  PerformanceMetrics 
} from '../types';

/**
 * Backend selection strategy
 */
export type BackendSelectionStrategy = 
  | 'round-robin'
  | 'least-connections'
  | 'performance-based'
  | 'health-based'
  | 'weighted-random'
  | 'primary-fallback';

/**
 * A/B testing configuration
 */
export interface ABTestConfig {
  enabled: boolean;
  testName: string;
  variants: Array<{
    type: string;
    weight: number;
    config?: BackendConfig;
  }>;
  stickySession?: boolean; // Same user always gets same backend
  duration?: number; // Test duration in milliseconds
}

/**
 * Manager configuration
 */
export interface BackendManagerConfig {
  selectionStrategy: BackendSelectionStrategy;
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  fallbackBackends: string[];
  enableABTesting: boolean;
  abTestConfig?: ABTestConfig;
  enableHotSwap: boolean;
  performanceThresholds: {
    maxLatency: number;
    minSuccessRate: number;
    maxErrorRate: number;
  };
}

/**
 * Managed backend instance with metadata
 */
interface ManagedBackend {
  instance: ITerminalBackend;
  type: string;
  createdAt: Date;
  lastUsed: Date;
  connectionCount: number;
  health: BackendHealth;
  weight: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

/**
 * Backend operation metrics
 */
interface OperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  lastOperation: Date;
}

/**
 * Backend manager for handling multiple terminal backends
 * 
 * Provides intelligent backend selection, health monitoring,
 * fallback mechanisms, and A/B testing capabilities.
 */
export class BackendManager extends EventEmitter {
  private config: BackendManagerConfig;
  private factory: BackendFactory;
  private backends: Map<string, ManagedBackend> = new Map();
  private operationMetrics: Map<string, OperationMetrics> = new Map();
  private abTestAssignments: Map<string, string> = new Map(); // userId -> backendType
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: Partial<BackendManagerConfig> = {}) {
    super();
    
    this.config = {
      selectionStrategy: 'primary-fallback',
      healthCheckInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      fallbackBackends: ['tmux'],
      enableABTesting: false,
      enableHotSwap: true,
      performanceThresholds: {
        maxLatency: 100, // 100ms
        minSuccessRate: 0.95, // 95%
        maxErrorRate: 0.05 // 5%
      },
      ...config
    };

    this.factory = BackendFactory.getInstance();
    this.setupEventHandlers();
  }

  /**
   * Initialize the backend manager
   */
  async initialize(): Promise<BackendResult<void>> {
    try {
      // Start with default backend or configured fallbacks
      const initialBackends = this.config.fallbackBackends.length > 0 
        ? this.config.fallbackBackends 
        : [this.factory.getDefaultBackendType()].filter(Boolean);

      if (initialBackends.length === 0) {
        return {
          success: false,
          error: 'No backend types available for initialization'
        };
      }

      // Create initial backends
      for (const backendType of initialBackends) {
        const result = await this.addBackend(backendType);
        if (result.success) {
          break; // Successfully created at least one backend
        }
      }

      if (this.backends.size === 0) {
        return {
          success: false,
          error: 'Failed to create any backend instances'
        };
      }

      // Initialize A/B testing if enabled
      if (this.config.enableABTesting && this.config.abTestConfig) {
        await this.initializeABTesting();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      this.emit('manager-initialized', {
        backendCount: this.backends.size,
        strategy: this.config.selectionStrategy
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize backend manager: ${error.message}`
      };
    }
  }

  /**
   * Add a new backend to the pool
   */
  async addBackend(
    type: string, 
    config?: BackendConfig, 
    weight: number = 1
  ): Promise<BackendResult<string>> {
    try {
      const result = await this.factory.createBackend({ type, config });
      
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const backendId = `${type}-${Date.now()}`;
      const managedBackend: ManagedBackend = {
        instance: result.data,
        type,
        createdAt: new Date(),
        lastUsed: new Date(),
        connectionCount: 0,
        health: await result.data.getHealth(),
        weight,
        isActive: true,
        metadata: {}
      };

      this.backends.set(backendId, managedBackend);
      this.operationMetrics.set(backendId, {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        lastOperation: new Date()
      });

      // Setup event forwarding
      this.setupBackendEventForwarding(backendId, result.data);

      this.emit('backend-added', { 
        backendId, 
        type, 
        weight,
        health: managedBackend.health 
      });

      return { success: true, data: backendId };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add backend: ${error.message}`
      };
    }
  }

  /**
   * Remove a backend from the pool
   */
  async removeBackend(backendId: string): Promise<BackendResult<void>> {
    try {
      const backend = this.backends.get(backendId);
      if (!backend) {
        return { success: false, error: `Backend ${backendId} not found` };
      }

      // Mark as inactive first
      backend.isActive = false;

      // Wait for ongoing operations to complete (simplified)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Shutdown the backend
      await backend.instance.shutdown();

      // Clean up
      this.backends.delete(backendId);
      this.operationMetrics.delete(backendId);

      this.emit('backend-removed', { backendId, type: backend.type });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove backend: ${error.message}`
      };
    }
  }

  /**
   * Select the best backend for an operation
   */
  selectBackend(context?: ExecutionContext): string | null {
    const activeBackends = Array.from(this.backends.entries())
      .filter(([_, backend]) => backend.isActive && backend.health.isHealthy);

    if (activeBackends.length === 0) {
      return null;
    }

    // A/B testing override
    if (this.config.enableABTesting && context?.userId) {
      const assignedBackend = this.abTestAssignments.get(context.userId);
      if (assignedBackend) {
        const assigned = activeBackends.find(([_, b]) => b.type === assignedBackend);
        if (assigned) {
          return assigned[0];
        }
      }
    }

    // Apply selection strategy
    switch (this.config.selectionStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(activeBackends);
      
      case 'least-connections':
        return this.selectLeastConnections(activeBackends);
      
      case 'performance-based':
        return this.selectPerformanceBased(activeBackends);
      
      case 'health-based':
        return this.selectHealthBased(activeBackends);
      
      case 'weighted-random':
        return this.selectWeightedRandom(activeBackends);
      
      case 'primary-fallback':
      default:
        return this.selectPrimaryFallback(activeBackends);
    }
  }

  /**
   * Execute an operation with automatic backend selection and fallback
   */
  async executeWithBackend<T>(
    operation: (backend: ITerminalBackend) => Promise<BackendResult<T>>,
    context?: ExecutionContext,
    maxRetries?: number
  ): Promise<BackendResult<T>> {
    const attempts = maxRetries || this.config.maxRetries;
    let lastError: string = '';

    for (let attempt = 0; attempt < attempts; attempt++) {
      const backendId = this.selectBackend(context);
      
      if (!backendId) {
        return {
          success: false,
          error: 'No healthy backends available'
        };
      }

      const managedBackend = this.backends.get(backendId)!;
      const startTime = performance.now();

      try {
        // Execute the operation
        managedBackend.connectionCount++;
        managedBackend.lastUsed = new Date();
        
        const result = await operation(managedBackend.instance);
        const executionTime = performance.now() - startTime;

        // Update metrics
        this.updateOperationMetrics(backendId, true, executionTime);

        managedBackend.connectionCount--;

        if (result.success) {
          return result;
        } else {
          lastError = result.error || 'Unknown error';
          
          // Mark backend as unhealthy if needed
          if (this.shouldMarkUnhealthy(backendId)) {
            await this.markBackendUnhealthy(backendId, lastError);
          }
        }
      } catch (error) {
        const executionTime = performance.now() - startTime;
        lastError = error.message;
        
        // Update metrics
        this.updateOperationMetrics(backendId, false, executionTime);
        managedBackend.connectionCount--;

        // Mark backend as unhealthy
        await this.markBackendUnhealthy(backendId, lastError);
      }

      // Wait before retry
      if (attempt < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    return {
      success: false,
      error: `All backend attempts failed. Last error: ${lastError}`
    };
  }

  /**
   * Create session through backend manager
   */
  async createSession(name: string, context?: ExecutionContext): Promise<BackendResult<TmuxSession>> {
    return this.executeWithBackend(
      (backend) => backend.createSession(name, context),
      context
    );
  }

  /**
   * Execute command through backend manager
   */
  async executeCommand(
    sessionId: string,
    command: string,
    paneId?: string,
    context?: ExecutionContext
  ): Promise<BackendResult<CommandExecution>> {
    return this.executeWithBackend(
      (backend) => backend.executeCommand(sessionId, command, paneId, context),
      context
    );
  }

  /**
   * List sessions through backend manager
   */
  async listSessions(context?: ExecutionContext): Promise<BackendResult<TmuxSession[]>> {
    return this.executeWithBackend(
      (backend) => backend.listSessions(context),
      context
    );
  }

  /**
   * Get aggregated performance metrics from all backends
   */
  getAggregatedMetrics(): {
    backendCount: number;
    activeBackends: number;
    totalOperations: number;
    successRate: number;
    averageLatency: number;
    backendMetrics: Record<string, OperationMetrics>;
  } {
    const activeBackends = Array.from(this.backends.values())
      .filter(b => b.isActive).length;

    const allMetrics = Array.from(this.operationMetrics.values());
    const totalOperations = allMetrics.reduce((sum, m) => sum + m.totalOperations, 0);
    const successfulOperations = allMetrics.reduce((sum, m) => sum + m.successfulOperations, 0);
    const totalLatency = allMetrics.reduce((sum, m) => sum + (m.averageLatency * m.totalOperations), 0);

    const backendMetrics: Record<string, OperationMetrics> = {};
    for (const [id, metrics] of this.operationMetrics) {
      backendMetrics[id] = { ...metrics };
    }

    return {
      backendCount: this.backends.size,
      activeBackends,
      totalOperations,
      successRate: totalOperations > 0 ? successfulOperations / totalOperations : 1,
      averageLatency: totalOperations > 0 ? totalLatency / totalOperations : 0,
      backendMetrics
    };
  }

  /**
   * Get health status of all backends
   */
  async getBackendHealthStatus(): Promise<Record<string, BackendHealth>> {
    const healthStatus: Record<string, BackendHealth> = {};
    
    for (const [id, backend] of this.backends) {
      try {
        healthStatus[id] = await backend.instance.getHealth();
      } catch (error) {
        healthStatus[id] = {
          isHealthy: false,
          latency: Infinity,
          errorRate: 1.0,
          lastCheck: new Date(),
          consecutiveFailures: 999,
          details: { error: error.message }
        };
      }
    }
    
    return healthStatus;
  }

  /**
   * Hot-swap a backend (replace with new instance)
   */
  async hotSwapBackend(
    backendId: string, 
    newConfig?: BackendConfig
  ): Promise<BackendResult<string>> {
    if (!this.config.enableHotSwap) {
      return { success: false, error: 'Hot-swap is disabled' };
    }

    try {
      const oldBackend = this.backends.get(backendId);
      if (!oldBackend) {
        return { success: false, error: `Backend ${backendId} not found` };
      }

      // Create new backend instance
      const newResult = await this.addBackend(oldBackend.type, newConfig, oldBackend.weight);
      if (!newResult.success) {
        return { success: false, error: `Failed to create replacement: ${newResult.error}` };
      }

      // Mark old backend as inactive
      oldBackend.isActive = false;

      // Schedule cleanup of old backend
      setTimeout(async () => {
        await this.removeBackend(backendId);
      }, 5000); // 5 second grace period

      this.emit('backend-hot-swapped', {
        oldBackendId: backendId,
        newBackendId: newResult.data,
        type: oldBackend.type
      });

      return { success: true, data: newResult.data! };
    } catch (error) {
      return {
        success: false,
        error: `Hot-swap failed: ${error.message}`
      };
    }
  }

  // Selection strategy implementations
  private selectRoundRobin(backends: Array<[string, ManagedBackend]>): string {
    // Simple round-robin based on last used time
    return backends.sort((a, b) => 
      a[1].lastUsed.getTime() - b[1].lastUsed.getTime()
    )[0][0];
  }

  private selectLeastConnections(backends: Array<[string, ManagedBackend]>): string {
    return backends.sort((a, b) => 
      a[1].connectionCount - b[1].connectionCount
    )[0][0];
  }

  private selectPerformanceBased(backends: Array<[string, ManagedBackend]>): string {
    // Select based on performance metrics
    let bestBackend = backends[0];
    let bestScore = 0;

    for (const [id, backend] of backends) {
      const metrics = this.operationMetrics.get(id);
      if (!metrics) continue;

      const score = this.calculatePerformanceScore(metrics, backend.health);
      if (score > bestScore) {
        bestScore = score;
        bestBackend = [id, backend];
      }
    }

    return bestBackend[0];
  }

  private selectHealthBased(backends: Array<[string, ManagedBackend]>): string {
    // Select the healthiest backend
    return backends.sort((a, b) => {
      const scoreA = this.calculateHealthScore(a[1].health);
      const scoreB = this.calculateHealthScore(b[1].health);
      return scoreB - scoreA;
    })[0][0];
  }

  private selectWeightedRandom(backends: Array<[string, ManagedBackend]>): string {
    const totalWeight = backends.reduce((sum, [_, b]) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const [id, backend] of backends) {
      random -= backend.weight;
      if (random <= 0) {
        return id;
      }
    }

    return backends[0][0]; // Fallback
  }

  private selectPrimaryFallback(backends: Array<[string, ManagedBackend]>): string {
    // Use the first healthy backend in fallback order
    const fallbackOrder = this.config.fallbackBackends;
    
    for (const fallbackType of fallbackOrder) {
      const backend = backends.find(([_, b]) => b.type === fallbackType);
      if (backend) {
        return backend[0];
      }
    }

    return backends[0][0]; // Ultimate fallback
  }

  private calculatePerformanceScore(metrics: OperationMetrics, health: BackendHealth): number {
    const latencyScore = Math.max(0, 100 - health.latency);
    const successScore = metrics.totalOperations > 0 
      ? (metrics.successfulOperations / metrics.totalOperations) * 100 
      : 100;
    const healthScore = health.isHealthy ? 100 : 0;

    return (latencyScore + successScore + healthScore) / 3;
  }

  private calculateHealthScore(health: BackendHealth): number {
    if (!health.isHealthy) return 0;
    
    const latencyScore = Math.max(0, 100 - health.latency);
    const errorScore = Math.max(0, 100 - (health.errorRate * 100));
    const failureScore = Math.max(0, 100 - (health.consecutiveFailures * 10));

    return (latencyScore + errorScore + failureScore) / 3;
  }

  private async initializeABTesting(): Promise<void> {
    if (!this.config.abTestConfig) return;

    // Create backends for each variant
    for (const variant of this.config.abTestConfig.variants) {
      await this.addBackend(variant.type, variant.config, variant.weight);
    }

    this.emit('ab-test-initialized', {
      testName: this.config.abTestConfig.testName,
      variants: this.config.abTestConfig.variants.length
    });
  }

  private setupEventHandlers(): void {
    this.factory.on('backend-created', (event) => {
      this.emit('factory-backend-created', event);
    });
  }

  private setupBackendEventForwarding(backendId: string, backend: ITerminalBackend): void {
    backend.on('health-degraded', (event) => {
      this.emit('backend-health-degraded', { ...event, backendId });
    });

    backend.on('health-recovered', (event) => {
      this.emit('backend-health-recovered', { ...event, backendId });
    });

    backend.on('performance-warning', (event) => {
      this.emit('backend-performance-warning', { ...event, backendId });
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      for (const [id, backend] of this.backends) {
        try {
          const health = await backend.instance.performHealthCheck();
          backend.health = health;

          // Check performance thresholds
          if (health.latency > this.config.performanceThresholds.maxLatency) {
            this.emit('performance-threshold-exceeded', {
              backendId: id,
              metric: 'latency',
              value: health.latency,
              threshold: this.config.performanceThresholds.maxLatency
            });
          }
        } catch (error) {
          await this.markBackendUnhealthy(id, error.message);
        }
      }
    }, this.config.healthCheckInterval);
  }

  private updateOperationMetrics(
    backendId: string, 
    success: boolean, 
    latency: number
  ): void {
    const metrics = this.operationMetrics.get(backendId);
    if (!metrics) return;

    metrics.totalOperations++;
    metrics.lastOperation = new Date();

    if (success) {
      metrics.successfulOperations++;
    } else {
      metrics.failedOperations++;
    }

    // Update average latency
    const totalLatency = metrics.averageLatency * (metrics.totalOperations - 1) + latency;
    metrics.averageLatency = totalLatency / metrics.totalOperations;
  }

  private shouldMarkUnhealthy(backendId: string): boolean {
    const metrics = this.operationMetrics.get(backendId);
    if (!metrics) return true;

    const errorRate = metrics.totalOperations > 0 
      ? metrics.failedOperations / metrics.totalOperations 
      : 0;

    return errorRate > this.config.performanceThresholds.maxErrorRate;
  }

  private async markBackendUnhealthy(backendId: string, reason: string): Promise<void> {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    backend.health = {
      ...backend.health,
      isHealthy: false,
      consecutiveFailures: backend.health.consecutiveFailures + 1,
      lastCheck: new Date(),
      details: { ...backend.health.details, reason }
    };

    this.emit('backend-marked-unhealthy', { backendId, reason });
  }

  /**
   * Shutdown the backend manager
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown all backends
    const shutdownPromises = Array.from(this.backends.entries()).map(
      async ([id, backend]) => {
        try {
          await this.removeBackend(id);
        } catch (error) {
          console.error(`Failed to shutdown backend ${id}:`, error);
        }
      }
    );

    await Promise.all(shutdownPromises);
    this.removeAllListeners();
  }
}
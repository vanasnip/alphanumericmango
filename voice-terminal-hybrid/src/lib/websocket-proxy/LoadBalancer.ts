/**
 * CRITICAL SECURITY: Load Balancer for Backend Distribution
 * Manages backend selection, health monitoring, and failover for optimal performance
 */

import { EventEmitter } from 'events';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../tmux/security/AuditLogger.js';
import { ITerminalBackend, BackendHealth, BackendResult } from '../tmux/backends/ITerminalBackend.js';

// Load balancer configuration
export interface LoadBalancerConfig {
  maxBackends: number;
  healthCheckInterval: number;
  failoverThreshold: number;
  auditLogger: AuditLogger;
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'cpu-usage' | 'response-time';
  backendTimeout: number;
  retryAttempts: number;
  circuitBreakerThreshold: number;
}

// Backend instance metadata
export interface BackendInstance {
  id: string;
  backend: ITerminalBackend;
  health: BackendHealth;
  load: BackendLoad;
  connectionCount: number;
  totalRequests: number;
  failedRequests: number;
  lastRequestTime: Date;
  averageResponseTime: number;
  isAvailable: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  lastFailureTime?: Date;
  consecutiveFailures: number;
}

// Backend load metrics
interface BackendLoad {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number;
  responseTime: number;
}

// Load balancer statistics
export interface LoadBalancerStats {
  totalBackends: number;
  healthyBackends: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestDistribution: Map<string, number>;
  healthStatus: Map<string, BackendHealth>;
}

// Backend selection result
interface BackendSelection {
  backend: BackendInstance;
  reason: string;
  alternativeBackends: string[];
}

export class LoadBalancer extends EventEmitter {
  private config: LoadBalancerConfig;
  private backends = new Map<string, BackendInstance>();
  private roundRobinIndex = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private requestDistribution = new Map<string, number>();
  private responseTimeHistory: number[] = [];

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
  }

  /**
   * CRITICAL: Initialize load balancer
   */
  async initialize(): Promise<void> {
    try {
      this.startHealthMonitoring();
      
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_INIT,
        severity: SecuritySeverity.INFO,
        source: 'LoadBalancer',
        description: 'Load balancer initialized',
        metadata: {
          strategy: this.config.loadBalancingStrategy,
          maxBackends: this.config.maxBackends,
          healthCheckInterval: this.config.healthCheckInterval
        },
        outcome: 'success',
        riskScore: 1
      });
      
      console.log('Load balancer initialized');
      
    } catch (error) {
      console.error('Failed to initialize load balancer:', error);
      throw new Error(`Load balancer initialization failed: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Register a backend instance
   */
  async registerBackend(backendId: string, backend: ITerminalBackend): Promise<void> {
    try {
      if (this.backends.size >= this.config.maxBackends) {
        throw new Error('Maximum backend limit reached');
      }

      if (this.backends.has(backendId)) {
        throw new Error(`Backend ${backendId} already registered`);
      }

      // Get initial health status
      const health = await backend.getHealth();
      
      const backendInstance: BackendInstance = {
        id: backendId,
        backend,
        health,
        load: {
          cpuUsage: 0,
          memoryUsage: 0,
          activeConnections: 0,
          requestsPerSecond: 0,
          errorRate: 0,
          responseTime: health.latency
        },
        connectionCount: 0,
        totalRequests: 0,
        failedRequests: 0,
        lastRequestTime: new Date(),
        averageResponseTime: health.latency,
        isAvailable: health.isHealthy,
        circuitBreakerState: 'closed',
        consecutiveFailures: 0
      };

      this.backends.set(backendId, backendInstance);
      this.requestDistribution.set(backendId, 0);

      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'LoadBalancer',
        description: 'Backend registered successfully',
        metadata: {
          backendId,
          backendType: backend.type,
          isHealthy: health.isHealthy,
          latency: health.latency
        },
        outcome: 'success',
        riskScore: 2
      });

      this.emit('backend-registered', backendId, backendInstance);
      
    } catch (error) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.CONFIG_VIOLATION,
        severity: SecuritySeverity.HIGH,
        source: 'LoadBalancer',
        description: 'Backend registration failed',
        metadata: {
          backendId,
          error: error.message
        },
        outcome: 'failure',
        riskScore: 6
      });
      
      throw error;
    }
  }

  /**
   * CRITICAL: Unregister a backend instance
   */
  async unregisterBackend(backendId: string): Promise<void> {
    try {
      const backendInstance = this.backends.get(backendId);
      if (!backendInstance) {
        return;
      }

      // Gracefully shutdown backend if possible
      try {
        await backendInstance.backend.shutdown();
      } catch (error) {
        console.error(`Error shutting down backend ${backendId}:`, error);
      }

      this.backends.delete(backendId);
      this.requestDistribution.delete(backendId);

      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'LoadBalancer',
        description: 'Backend unregistered',
        metadata: {
          backendId,
          totalRequests: backendInstance.totalRequests,
          failedRequests: backendInstance.failedRequests
        },
        outcome: 'success',
        riskScore: 2
      });

      this.emit('backend-unregistered', backendId);
      
    } catch (error) {
      console.error('Failed to unregister backend:', error);
    }
  }

  /**
   * CRITICAL: Get optimal backend for request processing
   */
  async getOptimalBackend(): Promise<ITerminalBackend> {
    const selection = await this.selectBackend();
    
    if (!selection) {
      throw new Error('No healthy backends available');
    }

    // Update request tracking
    this.totalRequests++;
    selection.backend.totalRequests++;
    selection.backend.lastRequestTime = new Date();
    
    const currentCount = this.requestDistribution.get(selection.backend.id) || 0;
    this.requestDistribution.set(selection.backend.id, currentCount + 1);

    await this.config.auditLogger.logEvent({
      eventType: SecurityEventType.COMMAND_EXECUTED,
      severity: SecuritySeverity.INFO,
      source: 'LoadBalancer',
      description: 'Backend selected for request',
      metadata: {
        backendId: selection.backend.id,
        strategy: this.config.loadBalancingStrategy,
        reason: selection.reason,
        load: selection.backend.load,
        alternatives: selection.alternativeBackends
      },
      outcome: 'success',
      riskScore: 1
    });

    return selection.backend.backend;
  }

  /**
   * CRITICAL: Select backend based on configured strategy
   */
  private async selectBackend(): Promise<BackendSelection | null> {
    const availableBackends = Array.from(this.backends.values())
      .filter(backend => this.isBackendAvailable(backend));

    if (availableBackends.length === 0) {
      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.HIGH,
        source: 'LoadBalancer',
        description: 'No healthy backends available',
        metadata: {
          totalBackends: this.backends.size,
          strategy: this.config.loadBalancingStrategy
        },
        outcome: 'failure',
        riskScore: 8
      });
      
      return null;
    }

    let selectedBackend: BackendInstance;
    let reason: string;

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        selectedBackend = this.selectRoundRobin(availableBackends);
        reason = 'Round-robin selection';
        break;

      case 'least-connections':
        selectedBackend = this.selectLeastConnections(availableBackends);
        reason = 'Least connections';
        break;

      case 'cpu-usage':
        selectedBackend = this.selectLowestCPU(availableBackends);
        reason = 'Lowest CPU usage';
        break;

      case 'response-time':
        selectedBackend = this.selectFastestResponse(availableBackends);
        reason = 'Fastest response time';
        break;

      default:
        selectedBackend = availableBackends[0];
        reason = 'Default selection';
    }

    const alternativeBackends = availableBackends
      .filter(b => b.id !== selectedBackend.id)
      .map(b => b.id);

    return {
      backend: selectedBackend,
      reason,
      alternativeBackends
    };
  }

  /**
   * Round-robin backend selection
   */
  private selectRoundRobin(backends: BackendInstance[]): BackendInstance {
    const backend = backends[this.roundRobinIndex % backends.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % backends.length;
    return backend;
  }

  /**
   * Least connections backend selection
   */
  private selectLeastConnections(backends: BackendInstance[]): BackendInstance {
    return backends.reduce((min, current) => 
      current.connectionCount < min.connectionCount ? current : min
    );
  }

  /**
   * Lowest CPU usage backend selection
   */
  private selectLowestCPU(backends: BackendInstance[]): BackendInstance {
    return backends.reduce((min, current) => 
      current.load.cpuUsage < min.load.cpuUsage ? current : min
    );
  }

  /**
   * Fastest response time backend selection
   */
  private selectFastestResponse(backends: BackendInstance[]): BackendInstance {
    return backends.reduce((fastest, current) => 
      current.averageResponseTime < fastest.averageResponseTime ? current : fastest
    );
  }

  /**
   * Check if backend is available for requests
   */
  private isBackendAvailable(backend: BackendInstance): boolean {
    return backend.isAvailable && 
           backend.health.isHealthy && 
           backend.circuitBreakerState !== 'open' &&
           backend.consecutiveFailures < this.config.failoverThreshold;
  }

  /**
   * CRITICAL: Record request success/failure for metrics
   */
  async recordRequestResult(
    backendId: string, 
    success: boolean, 
    responseTime: number,
    error?: string
  ): Promise<void> {
    const backend = this.backends.get(backendId);
    if (!backend) {
      return;
    }

    // Update response time metrics
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }

    // Update backend metrics
    backend.averageResponseTime = this.calculateAverageResponseTime(backend, responseTime);
    backend.load.responseTime = responseTime;

    if (success) {
      this.successfulRequests++;
      backend.consecutiveFailures = 0;
      
      // Close circuit breaker if it was half-open
      if (backend.circuitBreakerState === 'half-open') {
        backend.circuitBreakerState = 'closed';
        this.emit('circuit-breaker-closed', backendId);
      }
    } else {
      this.failedRequests++;
      backend.failedRequests++;
      backend.consecutiveFailures++;
      backend.lastFailureTime = new Date();

      // Update error rate
      backend.load.errorRate = backend.failedRequests / backend.totalRequests;

      // Check circuit breaker
      await this.checkCircuitBreaker(backend);

      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        source: 'LoadBalancer',
        description: 'Backend request failed',
        metadata: {
          backendId,
          consecutiveFailures: backend.consecutiveFailures,
          errorRate: backend.load.errorRate,
          error
        },
        outcome: 'failure',
        riskScore: 5
      });
    }

    this.emit('request-completed', backendId, success, responseTime);
  }

  /**
   * CRITICAL: Check and update circuit breaker state
   */
  private async checkCircuitBreaker(backend: BackendInstance): Promise<void> {
    if (backend.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      if (backend.circuitBreakerState === 'closed') {
        backend.circuitBreakerState = 'open';
        backend.isAvailable = false;
        
        await this.config.auditLogger.logEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.HIGH,
          source: 'LoadBalancer',
          description: 'Circuit breaker opened for backend',
          metadata: {
            backendId: backend.id,
            consecutiveFailures: backend.consecutiveFailures,
            threshold: this.config.circuitBreakerThreshold
          },
          outcome: 'blocked',
          riskScore: 7
        });

        this.emit('circuit-breaker-opened', backend.id);

        // Schedule circuit breaker half-open attempt
        setTimeout(() => {
          if (backend.circuitBreakerState === 'open') {
            backend.circuitBreakerState = 'half-open';
            this.emit('circuit-breaker-half-open', backend.id);
          }
        }, 60000); // 1 minute timeout
      }
    }
  }

  /**
   * Calculate average response time with exponential moving average
   */
  private calculateAverageResponseTime(backend: BackendInstance, newResponseTime: number): number {
    const alpha = 0.1; // Smoothing factor
    return alpha * newResponseTime + (1 - alpha) * backend.averageResponseTime;
  }

  /**
   * CRITICAL: Update backend connection count
   */
  updateBackendConnections(backendId: string, delta: number): void {
    const backend = this.backends.get(backendId);
    if (backend) {
      backend.connectionCount = Math.max(0, backend.connectionCount + delta);
      backend.load.activeConnections = backend.connectionCount;
    }
  }

  /**
   * Get all registered backends
   */
  getBackends(): Map<string, BackendInstance> {
    return new Map(this.backends);
  }

  /**
   * Get backend by ID
   */
  getBackend(backendId: string): BackendInstance | undefined {
    return this.backends.get(backendId);
  }

  /**
   * Get load balancer statistics
   */
  getStats(): LoadBalancerStats {
    const healthyBackends = Array.from(this.backends.values())
      .filter(backend => this.isBackendAvailable(backend)).length;

    const averageResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length
      : 0;

    const healthStatus = new Map<string, BackendHealth>();
    for (const [id, backend] of this.backends) {
      healthStatus.set(id, backend.health);
    }

    return {
      totalBackends: this.backends.size,
      healthyBackends,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime,
      requestDistribution: new Map(this.requestDistribution),
      healthStatus
    };
  }

  /**
   * CRITICAL: Start health monitoring for all backends
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * CRITICAL: Perform health checks on all backends
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.backends.values()).map(async (backend) => {
      try {
        const startTime = performance.now();
        const health = await backend.backend.performHealthCheck();
        const checkTime = performance.now() - startTime;

        // Update backend health
        backend.health = health;
        backend.isAvailable = health.isHealthy;

        // Update load metrics
        const metrics = backend.backend.getPerformanceMetrics();
        backend.load = {
          ...backend.load,
          cpuUsage: this.estimateCPUUsage(metrics),
          memoryUsage: this.estimateMemoryUsage(metrics),
          requestsPerSecond: this.calculateRequestsPerSecond(backend)
        };

        if (!health.isHealthy && backend.circuitBreakerState === 'closed') {
          await this.config.auditLogger.logEvent({
            eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
            severity: SecuritySeverity.MEDIUM,
            source: 'LoadBalancer',
            description: 'Backend health degraded',
            metadata: {
              backendId: backend.id,
              health,
              consecutiveFailures: health.consecutiveFailures
            },
            outcome: 'failure',
            riskScore: 6
          });
        }

        this.emit('health-check-completed', backend.id, health);

      } catch (error) {
        console.error(`Health check failed for backend ${backend.id}:`, error);
        backend.health.isHealthy = false;
        backend.isAvailable = false;
        backend.consecutiveFailures++;
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Estimate CPU usage from performance metrics
   */
  private estimateCPUUsage(metrics: any): number {
    // Simplified CPU estimation based on latency and success rate
    const latencyFactor = Math.min(metrics.averageLatency / 100, 1);
    const errorFactor = 1 - metrics.successRate;
    return Math.min((latencyFactor + errorFactor) * 100, 100);
  }

  /**
   * Estimate memory usage from performance metrics
   */
  private estimateMemoryUsage(metrics: any): number {
    // Simplified memory estimation
    return Math.min(metrics.totalCommands / 1000 * 10, 100);
  }

  /**
   * Calculate requests per second for a backend
   */
  private calculateRequestsPerSecond(backend: BackendInstance): number {
    const now = Date.now();
    const timeDiff = now - backend.lastRequestTime.getTime();
    
    if (timeDiff === 0) return 0;
    
    return (backend.totalRequests / timeDiff) * 1000; // Convert to per second
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * CRITICAL: Shutdown load balancer and all backends
   */
  async shutdown(): Promise<void> {
    try {
      this.stopHealthMonitoring();

      // Shutdown all backends
      const shutdownPromises = Array.from(this.backends.values()).map(async (backend) => {
        try {
          await backend.backend.shutdown();
        } catch (error) {
          console.error(`Error shutting down backend ${backend.id}:`, error);
        }
      });

      await Promise.allSettled(shutdownPromises);

      this.backends.clear();
      this.requestDistribution.clear();
      this.responseTimeHistory = [];
      this.removeAllListeners();

      await this.config.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_SHUTDOWN,
        severity: SecuritySeverity.INFO,
        source: 'LoadBalancer',
        description: 'Load balancer shutdown completed',
        metadata: {
          totalRequestsProcessed: this.totalRequests,
          successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 0
        },
        outcome: 'success',
        riskScore: 1
      });

      console.log('Load balancer shutdown completed');

    } catch (error) {
      console.error('Error during load balancer shutdown:', error);
      throw error;
    }
  }
}
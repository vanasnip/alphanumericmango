/**
 * Health Monitor for TTS Worker Pool
 * Monitors worker health and triggers recovery actions
 */

import { EventEmitter } from 'events';
import { Worker, WorkerState } from './Worker';

export interface HealthCheck {
  workerId: string;
  timestamp: number;
  responseTime: number;
  success: boolean;
  error?: string;
}

export interface HealthMetrics {
  workerId: string;
  healthyChecks: number;
  failedChecks: number;
  consecutiveFailures: number;
  lastHealthyTime: number;
  lastCheckTime: number;
  averageResponseTime: number;
  healthScore: number; // 0-100
}

export interface SystemHealth {
  overallHealth: number; // 0-100
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  averageResponseTime: number;
  worstWorker?: string;
  bestWorker?: string;
}

export class HealthMonitor extends EventEmitter {
  private workers = new Map<string, Worker>();
  private healthMetrics = new Map<string, HealthMetrics>();
  private healthHistory: HealthCheck[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private config: {
    checkIntervalMs: number;
    timeoutMs: number;
    failureThreshold: number;
    recoveryThreshold: number;
    historySize: number;
  };
  
  constructor(checkIntervalMs: number = 5000) {
    super();
    
    this.config = {
      checkIntervalMs,
      timeoutMs: 3000,
      failureThreshold: 3, // Consecutive failures before marking unhealthy
      recoveryThreshold: 2, // Consecutive successes before marking healthy
      historySize: 1000
    };
  }
  
  /**
   * Start health monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      console.warn('Health monitor already running');
      return;
    }
    
    console.log(`Starting health monitor with ${this.config.checkIntervalMs}ms interval`);
    
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkIntervalMs);
    
    this.emit('started');
  }
  
  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    console.log('Health monitor stopped');
    this.emit('stopped');
  }
  
  /**
   * Add worker to monitoring
   */
  addWorker(worker: Worker): void {
    this.workers.set(worker.id, worker);
    
    // Initialize health metrics
    this.healthMetrics.set(worker.id, {
      workerId: worker.id,
      healthyChecks: 0,
      failedChecks: 0,
      consecutiveFailures: 0,
      lastHealthyTime: Date.now(),
      lastCheckTime: Date.now(),
      averageResponseTime: 0,
      healthScore: 100
    });
    
    console.log(`Added worker ${worker.id} to health monitoring`);
    this.emit('workerAdded', worker.id);
  }
  
  /**
   * Remove worker from monitoring
   */
  removeWorker(worker: Worker): void {
    this.workers.delete(worker.id);
    this.healthMetrics.delete(worker.id);
    
    // Remove from history
    this.healthHistory = this.healthHistory.filter(h => h.workerId !== worker.id);
    
    console.log(`Removed worker ${worker.id} from health monitoring`);
    this.emit('workerRemoved', worker.id);
  }
  
  /**
   * Perform health checks on all workers
   */
  private async performHealthChecks(): Promise<void> {
    const checkPromises = Array.from(this.workers.values()).map(worker => 
      this.checkWorkerHealth(worker)
    );
    
    await Promise.allSettled(checkPromises);
    
    // Evaluate overall system health
    const systemHealth = this.calculateSystemHealth();
    this.emit('systemHealthUpdate', systemHealth);
    
    // Trigger alerts if needed
    this.evaluateAlerts(systemHealth);
  }
  
  /**
   * Check health of individual worker
   */
  private async checkWorkerHealth(worker: Worker): Promise<void> {
    const startTime = Date.now();
    const metrics = this.healthMetrics.get(worker.id)!;
    
    try {
      // Perform health check with timeout
      const isHealthy = await this.performHealthCheckWithTimeout(worker);
      const responseTime = Date.now() - startTime;
      
      // Record health check
      const healthCheck: HealthCheck = {
        workerId: worker.id,
        timestamp: startTime,
        responseTime,
        success: isHealthy
      };
      
      this.recordHealthCheck(healthCheck);
      this.updateHealthMetrics(worker.id, healthCheck);
      
      // Evaluate worker state change
      if (isHealthy && metrics.consecutiveFailures >= this.config.failureThreshold) {
        // Worker recovered
        this.handleWorkerRecovery(worker.id);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failed health check
      const healthCheck: HealthCheck = {
        workerId: worker.id,
        timestamp: startTime,
        responseTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.recordHealthCheck(healthCheck);
      this.updateHealthMetrics(worker.id, healthCheck);
      
      // Check if worker should be marked unhealthy
      if (metrics.consecutiveFailures >= this.config.failureThreshold) {
        this.handleWorkerFailure(worker.id, error);
      }
    }
  }
  
  /**
   * Perform health check with timeout
   */
  private async performHealthCheckWithTimeout(worker: Worker): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, this.config.timeoutMs);
      
      worker.healthCheck()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  /**
   * Record health check in history
   */
  private recordHealthCheck(healthCheck: HealthCheck): void {
    this.healthHistory.push(healthCheck);
    
    // Trim history if too large
    if (this.healthHistory.length > this.config.historySize) {
      this.healthHistory = this.healthHistory.slice(-this.config.historySize);
    }
  }
  
  /**
   * Update health metrics for worker
   */
  private updateHealthMetrics(workerId: string, healthCheck: HealthCheck): void {
    const metrics = this.healthMetrics.get(workerId)!;
    
    metrics.lastCheckTime = healthCheck.timestamp;
    
    if (healthCheck.success) {
      metrics.healthyChecks++;
      metrics.consecutiveFailures = 0;
      metrics.lastHealthyTime = healthCheck.timestamp;
    } else {
      metrics.failedChecks++;
      metrics.consecutiveFailures++;
    }
    
    // Update average response time
    const alpha = 0.2; // Exponential moving average factor
    metrics.averageResponseTime = alpha * healthCheck.responseTime + 
                                 (1 - alpha) * metrics.averageResponseTime;
    
    // Calculate health score (0-100)
    metrics.healthScore = this.calculateHealthScore(metrics);
  }
  
  /**
   * Calculate health score for worker
   */
  private calculateHealthScore(metrics: HealthMetrics): number {
    const totalChecks = metrics.healthyChecks + metrics.failedChecks;
    if (totalChecks === 0) return 100;
    
    let score = 100;
    
    // Factor 1: Success rate
    const successRate = metrics.healthyChecks / totalChecks;
    score *= successRate;
    
    // Factor 2: Consecutive failures penalty
    const failurePenalty = Math.min(metrics.consecutiveFailures * 20, 80);
    score = Math.max(score - failurePenalty, 0);
    
    // Factor 3: Response time penalty
    if (metrics.averageResponseTime > 1000) { // 1 second threshold
      const timePenalty = Math.min((metrics.averageResponseTime - 1000) / 100, 20);
      score = Math.max(score - timePenalty, 0);
    }
    
    // Factor 4: Time since last healthy check
    const timeSinceHealthy = Date.now() - metrics.lastHealthyTime;
    if (timeSinceHealthy > 60000) { // 1 minute
      const stalePenalty = Math.min((timeSinceHealthy - 60000) / 10000, 30);
      score = Math.max(score - stalePenalty, 0);
    }
    
    return Math.round(score);
  }
  
  /**
   * Handle worker failure
   */
  private handleWorkerFailure(workerId: string, error: any): void {
    console.error(`Worker ${workerId} marked as unhealthy after ${this.config.failureThreshold} consecutive failures`);
    
    this.emit('workerUnhealthy', workerId, {
      consecutiveFailures: this.healthMetrics.get(workerId)?.consecutiveFailures,
      lastError: error instanceof Error ? error.message : String(error),
      healthScore: this.healthMetrics.get(workerId)?.healthScore
    });
  }
  
  /**
   * Handle worker recovery
   */
  private handleWorkerRecovery(workerId: string): void {
    console.log(`Worker ${workerId} recovered and marked as healthy`);
    
    this.emit('workerHealthy', workerId, {
      healthScore: this.healthMetrics.get(workerId)?.healthScore,
      recoveryTime: Date.now()
    });
  }
  
  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(): SystemHealth {
    const allMetrics = Array.from(this.healthMetrics.values());
    
    if (allMetrics.length === 0) {
      return {
        overallHealth: 0,
        totalWorkers: 0,
        healthyWorkers: 0,
        unhealthyWorkers: 0,
        averageResponseTime: 0
      };
    }
    
    const healthyWorkers = allMetrics.filter(m => m.healthScore >= 70);
    const unhealthyWorkers = allMetrics.filter(m => m.healthScore < 70);
    
    const overallHealth = allMetrics.reduce((sum, m) => sum + m.healthScore, 0) / allMetrics.length;
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length;
    
    // Find best and worst workers
    const sortedByHealth = allMetrics.sort((a, b) => b.healthScore - a.healthScore);
    
    return {
      overallHealth: Math.round(overallHealth),
      totalWorkers: allMetrics.length,
      healthyWorkers: healthyWorkers.length,
      unhealthyWorkers: unhealthyWorkers.length,
      averageResponseTime: Math.round(averageResponseTime),
      bestWorker: sortedByHealth[0]?.workerId,
      worstWorker: sortedByHealth[sortedByHealth.length - 1]?.workerId
    };
  }
  
  /**
   * Evaluate and trigger alerts
   */
  private evaluateAlerts(systemHealth: SystemHealth): void {
    // Critical: More than 50% workers unhealthy
    if (systemHealth.unhealthyWorkers / systemHealth.totalWorkers > 0.5) {
      this.emit('criticalAlert', {
        type: 'worker_failures',
        message: `${systemHealth.unhealthyWorkers}/${systemHealth.totalWorkers} workers unhealthy`,
        severity: 'critical',
        systemHealth
      });
    }
    
    // Warning: Overall health below 70%
    if (systemHealth.overallHealth < 70) {
      this.emit('warningAlert', {
        type: 'degraded_performance',
        message: `System health at ${systemHealth.overallHealth}%`,
        severity: 'warning',
        systemHealth
      });
    }
    
    // Warning: High response times
    if (systemHealth.averageResponseTime > 2000) {
      this.emit('warningAlert', {
        type: 'high_latency',
        message: `Average response time: ${systemHealth.averageResponseTime}ms`,
        severity: 'warning',
        systemHealth
      });
    }
  }
  
  /**
   * Get health metrics for specific worker
   */
  getWorkerHealth(workerId: string): HealthMetrics | null {
    return this.healthMetrics.get(workerId) || null;
  }
  
  /**
   * Get recent health checks for worker
   */
  getWorkerHealthHistory(workerId: string, limit: number = 10): HealthCheck[] {
    return this.healthHistory
      .filter(h => h.workerId === workerId)
      .slice(-limit);
  }
  
  /**
   * Get system health summary
   */
  getSystemHealth(): SystemHealth {
    return this.calculateSystemHealth();
  }
  
  /**
   * Get detailed monitoring report
   */
  getDetailedReport(): any {
    const systemHealth = this.calculateSystemHealth();
    const recentAlerts = this.getRecentAlerts(300000); // Last 5 minutes
    
    return {
      systemHealth,
      workerMetrics: Array.from(this.healthMetrics.values()),
      recentAlerts,
      configuration: this.config,
      monitoring: {
        isRunning: !!this.monitoringInterval,
        totalChecks: this.healthHistory.length,
        oldestCheck: this.healthHistory[0]?.timestamp,
        newestCheck: this.healthHistory[this.healthHistory.length - 1]?.timestamp
      }
    };
  }
  
  /**
   * Get recent alerts
   */
  private getRecentAlerts(timeWindowMs: number): any[] {
    // This would be implemented with an alert history system
    // For now, return empty array
    return [];
  }
  
  /**
   * Force health check on specific worker
   */
  async forceHealthCheck(workerId: string): Promise<HealthCheck> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }
    
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.performHealthCheckWithTimeout(worker);
      const healthCheck: HealthCheck = {
        workerId,
        timestamp: startTime,
        responseTime: Date.now() - startTime,
        success: isHealthy
      };
      
      this.recordHealthCheck(healthCheck);
      this.updateHealthMetrics(workerId, healthCheck);
      
      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        workerId,
        timestamp: startTime,
        responseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.recordHealthCheck(healthCheck);
      this.updateHealthMetrics(workerId, healthCheck);
      
      return healthCheck;
    }
  }
}
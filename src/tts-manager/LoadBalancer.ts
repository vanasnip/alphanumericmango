/**
 * Load Balancer for TTS Worker Pool
 * Implements intelligent request routing and scaling decisions
 */

import { Worker } from './Worker';
import { SynthesisRequest } from './TTSManager';

export interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted' | 'response_time';
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  modelAffinity: boolean;
}

export interface WorkerMetrics {
  workerId: string;
  queueDepth: number;
  averageResponseTime: number;
  successRate: number;
  lastActivity: number;
  modelSpecialty?: string;
}

export interface LoadBalancingDecision {
  selectedWorker: Worker;
  reason: string;
  alternatives: Array<{
    worker: Worker;
    score: number;
    reason: string;
  }>;
}

export class LoadBalancer {
  private config: LoadBalancerConfig;
  private workerMetrics = new Map<string, WorkerMetrics>();
  private roundRobinIndex = 0;
  private requestHistory: Array<{
    workerId: string;
    responseTime: number;
    timestamp: number;
  }> = [];
  
  constructor(config: Partial<LoadBalancerConfig> = {}) {
    this.config = {
      algorithm: 'weighted',
      scaleUpThreshold: 5,
      scaleDownThreshold: 30000,
      modelAffinity: true,
      ...config
    };
  }
  
  /**
   * Select optimal worker for request
   */
  selectWorker(availableWorkers: Worker[], request: SynthesisRequest): Worker | null {
    if (availableWorkers.length === 0) {
      return null;
    }
    
    if (availableWorkers.length === 1) {
      return availableWorkers[0];
    }
    
    // Update worker metrics before selection
    this.updateWorkerMetrics(availableWorkers);
    
    switch (this.config.algorithm) {
      case 'round_robin':
        return this.selectRoundRobin(availableWorkers);
      case 'least_connections':
        return this.selectLeastConnections(availableWorkers);
      case 'response_time':
        return this.selectBestResponseTime(availableWorkers);
      case 'weighted':
      default:
        return this.selectWeighted(availableWorkers, request);
    }
  }
  
  /**
   * Round-robin selection
   */
  private selectRoundRobin(workers: Worker[]): Worker {
    const worker = workers[this.roundRobinIndex % workers.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length;
    return worker;
  }
  
  /**
   * Select worker with least connections (queue depth)
   */
  private selectLeastConnections(workers: Worker[]): Worker {
    return workers.reduce((best, current) => {
      const currentQueue = this.getWorkerMetrics(current.id).queueDepth;
      const bestQueue = this.getWorkerMetrics(best.id).queueDepth;
      return currentQueue < bestQueue ? current : best;
    });
  }
  
  /**
   * Select worker with best average response time
   */
  private selectBestResponseTime(workers: Worker[]): Worker {
    return workers.reduce((best, current) => {
      const currentTime = this.getWorkerMetrics(current.id).averageResponseTime;
      const bestTime = this.getWorkerMetrics(best.id).averageResponseTime;
      return currentTime < bestTime ? current : best;
    });
  }
  
  /**
   * Weighted selection considering multiple factors
   */
  private selectWeighted(workers: Worker[], request: SynthesisRequest): Worker {
    const scores = workers.map(worker => ({
      worker,
      score: this.calculateWorkerScore(worker, request)
    }));
    
    // Sort by score (higher is better)
    scores.sort((a, b) => b.score - a.score);
    
    // Log selection reasoning for debugging
    console.log(`Load balancer selection for request:`, {
      requestVoice: request.voice,
      scores: scores.map(s => ({
        workerId: s.worker.id,
        score: s.score.toFixed(2)
      }))
    });
    
    return scores[0].worker;
  }
  
  /**
   * Calculate weighted score for worker
   */
  private calculateWorkerScore(worker: Worker, request: SynthesisRequest): number {
    const metrics = this.getWorkerMetrics(worker.id);
    let score = 100; // Base score
    
    // Factor 1: Queue depth (lower is better)
    const queuePenalty = metrics.queueDepth * 10;
    score -= queuePenalty;
    
    // Factor 2: Response time (lower is better)
    const responsePenalty = Math.min(metrics.averageResponseTime / 10, 50);
    score -= responsePenalty;
    
    // Factor 3: Success rate (higher is better)
    const successBonus = metrics.successRate * 20;
    score += successBonus;
    
    // Factor 4: Model affinity (if enabled)
    if (this.config.modelAffinity && request.voice && metrics.modelSpecialty) {
      if (metrics.modelSpecialty === request.voice) {
        score += 30; // Strong preference for model match
      } else {
        score -= 10; // Slight penalty for model mismatch
      }
    }
    
    // Factor 5: Priority boost for high-priority requests
    if (request.priority === 'high') {
      // Prefer workers with lower queue depth for high priority
      if (metrics.queueDepth === 0) {
        score += 25;
      } else if (metrics.queueDepth <= 1) {
        score += 10;
      }
    }
    
    // Factor 6: Recent activity (avoid overloading recently active workers)
    const timeSinceActivity = Date.now() - metrics.lastActivity;
    if (timeSinceActivity < 1000) { // Less than 1 second
      score -= 5;
    }
    
    return Math.max(score, 0);
  }
  
  /**
   * Record request completion for metrics
   */
  recordRequest(workerId: string, responseTime: number): void {
    // Update worker metrics
    const metrics = this.getWorkerMetrics(workerId);
    
    // Update average response time with exponential moving average
    const alpha = 0.2;
    metrics.averageResponseTime = alpha * responseTime + (1 - alpha) * metrics.averageResponseTime;
    metrics.lastActivity = Date.now();
    
    // Add to request history
    this.requestHistory.push({
      workerId,
      responseTime,
      timestamp: Date.now()
    });
    
    // Trim history to last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
  }
  
  /**
   * Update worker metrics from actual worker state
   */
  private updateWorkerMetrics(workers: Worker[]): void {
    for (const worker of workers) {
      const stats = worker.getStats();
      const existing = this.workerMetrics.get(worker.id);
      
      this.workerMetrics.set(worker.id, {
        workerId: worker.id,
        queueDepth: worker.getQueueDepth(),
        averageResponseTime: existing?.averageResponseTime || stats.averageLatency || 0,
        successRate: stats.successRate,
        lastActivity: stats.lastActivityTime,
        modelSpecialty: existing?.modelSpecialty
      });
    }
  }
  
  /**
   * Get worker metrics (create if not exists)
   */
  private getWorkerMetrics(workerId: string): WorkerMetrics {
    if (!this.workerMetrics.has(workerId)) {
      this.workerMetrics.set(workerId, {
        workerId,
        queueDepth: 0,
        averageResponseTime: 0,
        successRate: 1.0,
        lastActivity: Date.now()
      });
    }
    
    return this.workerMetrics.get(workerId)!;
  }
  
  /**
   * Set model specialty for worker (for model affinity)
   */
  setWorkerModelSpecialty(workerId: string, modelName: string): void {
    const metrics = this.getWorkerMetrics(workerId);
    metrics.modelSpecialty = modelName;
  }
  
  /**
   * Evaluate if scaling is needed
   */
  evaluateScaling(): { action: 'scale_up' | 'scale_down' | 'no_change'; reason: string } {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(r => now - r.timestamp < 60000); // Last minute
    
    if (recentRequests.length === 0) {
      return { action: 'no_change', reason: 'No recent activity' };
    }
    
    // Calculate average queue depth
    const totalQueueDepth = Array.from(this.workerMetrics.values())
      .reduce((sum, metrics) => sum + metrics.queueDepth, 0);
    
    const avgQueueDepth = totalQueueDepth / this.workerMetrics.size;
    
    // Calculate average response time for recent requests
    const avgResponseTime = recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length;
    
    // Scale up conditions
    if (avgQueueDepth >= this.config.scaleUpThreshold) {
      return { 
        action: 'scale_up', 
        reason: `Average queue depth (${avgQueueDepth.toFixed(1)}) exceeds threshold (${this.config.scaleUpThreshold})` 
      };
    }
    
    if (avgResponseTime > 300) { // 300ms threshold
      return { 
        action: 'scale_up', 
        reason: `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds 300ms` 
      };
    }
    
    // Scale down conditions
    const minIdleTime = Math.min(...Array.from(this.workerMetrics.values())
      .map(m => now - m.lastActivity));
    
    if (avgQueueDepth === 0 && minIdleTime > this.config.scaleDownThreshold) {
      return { 
        action: 'scale_down', 
        reason: `All workers idle for ${(minIdleTime / 1000).toFixed(0)}s` 
      };
    }
    
    return { action: 'no_change', reason: 'Metrics within normal range' };
  }
  
  /**
   * Get load balancer statistics
   */
  getStats(): any {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(r => now - r.timestamp < 60000);
    
    return {
      algorithm: this.config.algorithm,
      totalWorkers: this.workerMetrics.size,
      recentRequestCount: recentRequests.length,
      averageResponseTime: recentRequests.length > 0 
        ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length 
        : 0,
      workerMetrics: Array.from(this.workerMetrics.values()),
      requestHistory: {
        total: this.requestHistory.length,
        recent: recentRequests.length,
        oldestTimestamp: this.requestHistory.length > 0 ? this.requestHistory[0].timestamp : null
      }
    };
  }
  
  /**
   * Remove worker from metrics tracking
   */
  removeWorker(workerId: string): void {
    this.workerMetrics.delete(workerId);
    
    // Remove from request history
    this.requestHistory = this.requestHistory.filter(r => r.workerId !== workerId);
  }
  
  /**
   * Reset metrics and history
   */
  reset(): void {
    this.workerMetrics.clear();
    this.requestHistory = [];
    this.roundRobinIndex = 0;
  }
}
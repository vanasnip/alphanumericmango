/**
 * Comprehensive Backpressure Management System
 * Handles queue-based backpressure for voice processing, API requests, and system resources
 */

export interface BackpressureConfig {
  maxQueueSize: number;
  processingTimeout: number;
  priorityLevels: number;
  memoryThreshold: number;
  cpuThreshold: number;
  enableAdaptive: boolean;
  drainStrategy: 'fifo' | 'lifo' | 'priority';
}

export interface QueueItem<T = any> {
  id: string;
  data: T;
  priority: number;
  timestamp: number;
  timeout: number;
  retries: number;
  maxRetries: number;
}

export interface BackpressureMetrics {
  queueSize: number;
  maxQueueSize: number;
  droppedRequests: number;
  processedRequests: number;
  averageWaitTime: number;
  memoryPressure: number;
  cpuPressure: number;
  adaptiveThrottling: boolean;
}

export interface SystemResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queuePressure: number;
}

export class BackpressureManager {
  private config: BackpressureConfig;
  private queues: Map<number, QueueItem[]> = new Map();
  private processing: Set<string> = new Set();
  private metrics: BackpressureMetrics;
  private resourceMonitor: NodeJS.Timer | null = null;
  private systemMetrics: SystemResourceMetrics;

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      processingTimeout: config.processingTimeout || 30000,
      priorityLevels: config.priorityLevels || 5,
      memoryThreshold: config.memoryThreshold || 0.8, // 80%
      cpuThreshold: config.cpuThreshold || 0.7, // 70%
      enableAdaptive: config.enableAdaptive ?? true,
      drainStrategy: config.drainStrategy || 'priority'
    };

    this.metrics = {
      queueSize: 0,
      maxQueueSize: this.config.maxQueueSize,
      droppedRequests: 0,
      processedRequests: 0,
      averageWaitTime: 0,
      memoryPressure: 0,
      cpuPressure: 0,
      adaptiveThrottling: false
    };

    this.systemMetrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      queuePressure: 0
    };

    // Initialize priority queues
    for (let i = 0; i < this.config.priorityLevels; i++) {
      this.queues.set(i, []);
    }

    this.startResourceMonitoring();
  }

  /**
   * Acquire processing slot with backpressure handling
   */
  async acquire(priority: number = 0, timeout?: number): Promise<void> {
    const item: QueueItem = {
      id: this.generateId(),
      data: null,
      priority: Math.max(0, Math.min(priority, this.config.priorityLevels - 1)),
      timestamp: Date.now(),
      timeout: timeout || this.config.processingTimeout,
      retries: 0,
      maxRetries: 3
    };

    // Check if we should apply backpressure
    if (this.shouldApplyBackpressure()) {
      throw new Error('System under high load, request rejected');
    }

    // Add to appropriate priority queue
    const queue = this.queues.get(item.priority)!;
    queue.push(item);
    this.updateQueueMetrics();

    // Wait for processing slot
    return new Promise((resolve, reject) => {
      const checkSlot = () => {
        if (this.processing.has(item.id)) {
          resolve();
          return;
        }

        if (Date.now() - item.timestamp > item.timeout) {
          this.removeFromQueue(item);
          this.metrics.droppedRequests++;
          reject(new Error('Request timeout'));
          return;
        }

        // Try to process next item
        if (this.canProcessNext()) {
          const nextItem = this.getNextItem();
          if (nextItem && nextItem.id === item.id) {
            this.processing.add(item.id);
            this.removeFromQueue(item);
            resolve();
            return;
          }
        }

        // Check again in 10ms
        setTimeout(checkSlot, 10);
      };

      checkSlot();
    });
  }

  /**
   * Release processing slot
   */
  release(id?: string): void {
    if (id && this.processing.has(id)) {
      this.processing.delete(id);
      this.metrics.processedRequests++;
    } else if (!id && this.processing.size > 0) {
      // Release oldest if no ID specified
      const oldestId = Array.from(this.processing)[0];
      this.processing.delete(oldestId);
      this.metrics.processedRequests++;
    }
  }

  /**
   * Check if system should apply backpressure
   */
  private shouldApplyBackpressure(): boolean {
    // Check queue size
    if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
      return true;
    }

    // Check system resources if adaptive mode is enabled
    if (this.config.enableAdaptive) {
      if (this.systemMetrics.memoryUsage > this.config.memoryThreshold ||
          this.systemMetrics.cpuUsage > this.config.cpuThreshold) {
        this.metrics.adaptiveThrottling = true;
        return true;
      }
    }

    this.metrics.adaptiveThrottling = false;
    return false;
  }

  /**
   * Check if next item can be processed
   */
  private canProcessNext(): boolean {
    // Check processing capacity (simple implementation)
    const maxConcurrent = Math.max(1, Math.floor(this.config.maxQueueSize / 10));
    return this.processing.size < maxConcurrent;
  }

  /**
   * Get next item to process based on strategy
   */
  private getNextItem(): QueueItem | null {
    switch (this.config.drainStrategy) {
      case 'priority':
        return this.getHighestPriorityItem();
      case 'fifo':
        return this.getOldestItem();
      case 'lifo':
        return this.getNewestItem();
      default:
        return this.getHighestPriorityItem();
    }
  }

  /**
   * Get highest priority item
   */
  private getHighestPriorityItem(): QueueItem | null {
    for (let priority = this.config.priorityLevels - 1; priority >= 0; priority--) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return null;
  }

  /**
   * Get oldest item across all queues
   */
  private getOldestItem(): QueueItem | null {
    let oldest: QueueItem | null = null;
    
    for (const queue of this.queues.values()) {
      for (const item of queue) {
        if (!oldest || item.timestamp < oldest.timestamp) {
          oldest = item;
        }
      }
    }
    
    return oldest;
  }

  /**
   * Get newest item across all queues
   */
  private getNewestItem(): QueueItem | null {
    let newest: QueueItem | null = null;
    
    for (const queue of this.queues.values()) {
      for (const item of queue) {
        if (!newest || item.timestamp > newest.timestamp) {
          newest = item;
        }
      }
    }
    
    return newest;
  }

  /**
   * Remove item from appropriate queue
   */
  private removeFromQueue(item: QueueItem): void {
    const queue = this.queues.get(item.priority)!;
    const index = queue.findIndex(queueItem => queueItem.id === item.id);
    if (index !== -1) {
      queue.splice(index, 1);
      this.updateQueueMetrics();
    }
  }

  /**
   * Get total queue size across all priorities
   */
  private getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(): void {
    this.metrics.queueSize = this.getTotalQueueSize();
    
    // Calculate average wait time
    let totalWaitTime = 0;
    let itemCount = 0;
    
    for (const queue of this.queues.values()) {
      for (const item of queue) {
        totalWaitTime += Date.now() - item.timestamp;
        itemCount++;
      }
    }
    
    this.metrics.averageWaitTime = itemCount > 0 ? totalWaitTime / itemCount : 0;
    
    // Calculate queue pressure
    this.systemMetrics.queuePressure = this.metrics.queueSize / this.config.maxQueueSize;
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }

    this.resourceMonitor = setInterval(() => {
      this.updateSystemMetrics();
    }, 1000); // Monitor every second
  }

  /**
   * Update system resource metrics
   */
  private updateSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      this.systemMetrics.memoryUsage = memUsage.heapUsed / totalMem;
      this.metrics.memoryPressure = this.systemMetrics.memoryUsage;

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      const totalCpu = cpuUsage.user + cpuUsage.system;
      this.systemMetrics.cpuUsage = totalCpu / 1000000; // Convert to percentage approximation
      this.metrics.cpuPressure = Math.min(this.systemMetrics.cpuUsage / 100, 1);

      // Active connections (processing slots)
      this.systemMetrics.activeConnections = this.processing.size;

      // Clean up expired items
      this.cleanupExpiredItems();

    } catch (error) {
      console.warn('Error updating system metrics:', error);
    }
  }

  /**
   * Clean up expired items from queues
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    
    for (const queue of this.queues.values()) {
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        if (now - item.timestamp > item.timeout) {
          queue.splice(i, 1);
          this.metrics.droppedRequests++;
        }
      }
    }
    
    this.updateQueueMetrics();
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current backpressure status
   */
  getStatus(): BackpressureMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed system metrics
   */
  getSystemMetrics(): SystemResourceMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Force drain all queues (emergency)
   */
  drainAll(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.processing.clear();
    this.updateQueueMetrics();
    console.log('All queues drained due to emergency condition');
  }

  /**
   * Adjust configuration dynamically
   */
  updateConfig(newConfig: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Backpressure configuration updated:', newConfig);
  }

  /**
   * Shutdown backpressure manager
   */
  shutdown(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
    
    this.drainAll();
    console.log('Backpressure manager shutdown complete');
  }
}

/**
 * Adaptive Backpressure Controller
 * Automatically adjusts backpressure based on system conditions
 */
export class AdaptiveBackpressureController {
  private backpressureManager: BackpressureManager;
  private adaptationInterval: NodeJS.Timer | null = null;
  private learningHistory: number[] = [];

  constructor(backpressureManager: BackpressureManager) {
    this.backpressureManager = backpressureManager;
    this.startAdaptation();
  }

  /**
   * Start adaptive control loop
   */
  private startAdaptation(): void {
    this.adaptationInterval = setInterval(() => {
      this.adaptConfiguration();
    }, 10000); // Adapt every 10 seconds
  }

  /**
   * Adapt configuration based on current metrics
   */
  private adaptConfiguration(): void {
    const metrics = this.backpressureManager.getStatus();
    const systemMetrics = this.backpressureManager.getSystemMetrics();

    // Record performance score
    const performanceScore = this.calculatePerformanceScore(metrics, systemMetrics);
    this.learningHistory.push(performanceScore);
    
    // Keep only recent history
    if (this.learningHistory.length > 100) {
      this.learningHistory.shift();
    }

    // Adapt based on performance trend
    const recentAverage = this.learningHistory.slice(-10).reduce((a, b) => a + b, 0) / 10;
    
    if (recentAverage < 0.7) {
      // Performance degrading, be more aggressive with backpressure
      this.backpressureManager.updateConfig({
        memoryThreshold: Math.max(0.6, 0.8 - 0.1),
        cpuThreshold: Math.max(0.5, 0.7 - 0.1)
      });
    } else if (recentAverage > 0.9) {
      // Performance good, can be more lenient
      this.backpressureManager.updateConfig({
        memoryThreshold: Math.min(0.9, 0.8 + 0.05),
        cpuThreshold: Math.min(0.8, 0.7 + 0.05)
      });
    }
  }

  /**
   * Calculate performance score (0-1, higher is better)
   */
  private calculatePerformanceScore(
    metrics: BackpressureMetrics, 
    systemMetrics: SystemResourceMetrics
  ): number {
    // Factors that contribute to performance score
    const queueScore = 1 - (metrics.queueSize / metrics.maxQueueSize);
    const memoryScore = 1 - systemMetrics.memoryUsage;
    const cpuScore = 1 - systemMetrics.cpuUsage;
    const waitTimeScore = Math.max(0, 1 - (metrics.averageWaitTime / 1000)); // Normalize to seconds
    
    // Weighted average
    return (queueScore * 0.3 + memoryScore * 0.25 + cpuScore * 0.25 + waitTimeScore * 0.2);
  }

  /**
   * Stop adaptive control
   */
  stop(): void {
    if (this.adaptationInterval) {
      clearInterval(this.adaptationInterval);
      this.adaptationInterval = null;
    }
  }
}

export default BackpressureManager;
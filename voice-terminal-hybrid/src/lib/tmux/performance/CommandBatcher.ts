import { EventEmitter } from 'events';
import type { TmuxConnectionPool } from './TmuxConnectionPool';

export interface BatchCommand {
  id: string;
  args: string[];
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout?: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxBatchWait: number; // milliseconds
  maxConcurrentBatches: number;
  adaptiveBatching: boolean;
  performanceThreshold: number; // ms - switch to batching if latency exceeds this
}

export interface BatchMetrics {
  totalBatches: number;
  totalCommands: number;
  averageBatchSize: number;
  averageBatchTime: number;
  batchingEfficiency: number; // percentage improvement over individual commands
  adaptiveSwitches: number;
}

export interface BatchResult {
  commandId: string;
  result?: string;
  error?: Error;
  latency: number;
}

/**
 * Intelligent command batcher that groups rapid sequential commands
 * to reduce overhead and improve throughput.
 */
export class CommandBatcher extends EventEmitter {
  private config: BatchConfig;
  private connectionPool: TmuxConnectionPool;
  private pendingCommands: Map<string, BatchCommand> = new Map();
  private activeBatches = 0;
  private batchTimer?: NodeJS.Timeout;
  private metrics: BatchMetrics;
  private recentLatencies: number[] = [];
  private isBatchingEnabled = true;

  constructor(connectionPool: TmuxConnectionPool, config: Partial<BatchConfig> = {}) {
    super();
    
    this.connectionPool = connectionPool;
    this.config = {
      maxBatchSize: config.maxBatchSize || 10,
      maxBatchWait: config.maxBatchWait || 5, // 5ms
      maxConcurrentBatches: config.maxConcurrentBatches || 3,
      adaptiveBatching: config.adaptiveBatching ?? true,
      performanceThreshold: config.performanceThreshold || 20 // 20ms
    };

    this.metrics = {
      totalBatches: 0,
      totalCommands: 0,
      averageBatchSize: 0,
      averageBatchTime: 0,
      batchingEfficiency: 0,
      adaptiveSwitches: 0
    };
  }

  /**
   * Execute a command with intelligent batching
   */
  async executeCommand(args: string[], timeout?: number): Promise<string> {
    const commandId = `batch_cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    return new Promise<string>((resolve, reject) => {
      const command: BatchCommand = {
        id: commandId,
        args,
        resolve: (result: string) => {
          const latency = performance.now() - startTime;
          this.recordLatency(latency);
          resolve(result);
        },
        reject,
        timestamp: Date.now(),
        timeout
      };

      // Decide whether to batch or execute immediately
      if (this.shouldBatch()) {
        this.addToBatch(command);
      } else {
        this.executeImmediately(command);
      }
    });
  }

  /**
   * Execute multiple commands as an explicit batch
   */
  async executeBatch(commandArgs: string[][]): Promise<BatchResult[]> {
    const batchId = `explicit_batch_${Date.now()}`;
    const startTime = performance.now();

    try {
      const results = await this.connectionPool.executeBatch(commandArgs);
      const batchTime = performance.now() - startTime;
      
      this.updateBatchMetrics(commandArgs.length, batchTime);
      
      return results.map((result, index) => ({
        commandId: `${batchId}_${index}`,
        result,
        latency: batchTime / commandArgs.length
      }));
    } catch (error) {
      return commandArgs.map((_, index) => ({
        commandId: `${batchId}_${index}`,
        error: error as Error,
        latency: performance.now() - startTime
      }));
    }
  }

  private shouldBatch(): boolean {
    if (!this.isBatchingEnabled) {
      return false;
    }

    // Always batch if we have pending commands
    if (this.pendingCommands.size > 0) {
      return true;
    }

    // Check if we're under heavy load
    const poolMetrics = this.connectionPool.getMetrics();
    if (poolMetrics.averageResponseTime > this.config.performanceThreshold) {
      return true;
    }

    // Don't batch if we're at max concurrent batches
    if (this.activeBatches >= this.config.maxConcurrentBatches) {
      return false;
    }

    // Adaptive batching based on recent performance
    if (this.config.adaptiveBatching) {
      return this.adaptiveBatchingDecision();
    }

    return true;
  }

  private adaptiveBatchingDecision(): boolean {
    if (this.recentLatencies.length < 5) {
      return true; // Default to batching with insufficient data
    }

    const recentAverage = this.recentLatencies.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const shouldBatch = recentAverage > this.config.performanceThreshold;

    if (shouldBatch !== this.isBatchingEnabled) {
      this.isBatchingEnabled = shouldBatch;
      this.metrics.adaptiveSwitches++;
      
      this.emit('batching-mode-changed', {
        enabled: this.isBatchingEnabled,
        reason: shouldBatch ? 'performance-degraded' : 'performance-improved',
        averageLatency: recentAverage
      });
    }

    return shouldBatch;
  }

  private addToBatch(command: BatchCommand): void {
    this.pendingCommands.set(command.id, command);

    // Start batch timer if this is the first command
    if (this.pendingCommands.size === 1 && !this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.maxBatchWait);
    }

    // Process immediately if batch is full
    if (this.pendingCommands.size >= this.config.maxBatchSize) {
      this.processBatch();
    }
  }

  private async executeImmediately(command: BatchCommand): Promise<void> {
    try {
      const result = await this.connectionPool.executeCommand(command.args, command.timeout);
      command.resolve(result);
    } catch (error) {
      command.reject(error as Error);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.pendingCommands.size === 0) {
      return;
    }

    const commands = Array.from(this.pendingCommands.values());
    this.pendingCommands.clear();
    this.activeBatches++;

    const batchStartTime = performance.now();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      // Execute all commands in the batch
      const commandArgs = commands.map(cmd => cmd.args);
      const results = await this.connectionPool.executeBatch(commandArgs);

      // Resolve all commands with their results
      commands.forEach((command, index) => {
        try {
          command.resolve(results[index] || '');
        } catch (error) {
          command.reject(error as Error);
        }
      });

      const batchTime = performance.now() - batchStartTime;
      this.updateBatchMetrics(commands.length, batchTime);

      this.emit('batch-completed', {
        batchId,
        commandCount: commands.length,
        batchTime,
        averageCommandTime: batchTime / commands.length
      });

    } catch (error) {
      // Reject all commands in the batch
      commands.forEach(command => {
        command.reject(error as Error);
      });

      this.emit('batch-failed', {
        batchId,
        commandCount: commands.length,
        error: (error as Error).message
      });

    } finally {
      this.activeBatches--;
    }
  }

  private updateBatchMetrics(commandCount: number, batchTime: number): void {
    this.metrics.totalBatches++;
    this.metrics.totalCommands += commandCount;
    
    // Update running averages
    const totalBatches = this.metrics.totalBatches;
    this.metrics.averageBatchSize = this.metrics.totalCommands / totalBatches;
    this.metrics.averageBatchTime = 
      (this.metrics.averageBatchTime * (totalBatches - 1) + batchTime) / totalBatches;

    // Calculate batching efficiency (estimated improvement over individual commands)
    const estimatedIndividualTime = commandCount * 15; // Assume 15ms per individual command
    const actualBatchTime = batchTime;
    const improvement = Math.max(0, (estimatedIndividualTime - actualBatchTime) / estimatedIndividualTime * 100);
    
    this.metrics.batchingEfficiency = 
      (this.metrics.batchingEfficiency * (totalBatches - 1) + improvement) / totalBatches;
  }

  private recordLatency(latency: number): void {
    this.recentLatencies.push(latency);
    
    // Keep only recent measurements for adaptive batching
    if (this.recentLatencies.length > 20) {
      this.recentLatencies = this.recentLatencies.slice(-20);
    }
  }

  /**
   * Force process any pending batches immediately
   */
  async flush(): Promise<void> {
    if (this.pendingCommands.size > 0) {
      await this.processBatch();
    }
  }

  /**
   * Enable or disable batching
   */
  setBatchingEnabled(enabled: boolean): void {
    if (!enabled && this.pendingCommands.size > 0) {
      // Process pending commands immediately when disabling
      this.processBatch();
    }
    
    this.isBatchingEnabled = enabled;
    this.emit('batching-toggled', { enabled });
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current batching metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current batch status
   */
  getStatus(): {
    pendingCommands: number;
    activeBatches: number;
    batchingEnabled: boolean;
    averageLatency: number;
  } {
    const avgLatency = this.recentLatencies.length > 0
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 0;

    return {
      pendingCommands: this.pendingCommands.size,
      activeBatches: this.activeBatches,
      batchingEnabled: this.isBatchingEnabled,
      averageLatency: avgLatency
    };
  }

  /**
   * Reset metrics and state
   */
  reset(): void {
    this.metrics = {
      totalBatches: 0,
      totalCommands: 0,
      averageBatchSize: 0,
      averageBatchTime: 0,
      batchingEfficiency: 0,
      adaptiveSwitches: 0
    };
    
    this.recentLatencies = [];
    this.isBatchingEnabled = true;
    
    this.emit('metrics-reset');
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Process any pending commands
    await this.flush();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.removeAllListeners();
    this.emit('batcher-shutdown');
  }
}
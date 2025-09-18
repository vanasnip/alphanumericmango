/**
 * Retry Queue System
 * Handles failed sync operations with exponential backoff and retry logic
 */

import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import type { SyncOperation, SyncError } from './interfaces.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  jitterEnabled: boolean;
}

export interface QueuedOperation extends SyncOperation {
  operationId: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor: Date;
  lastError?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface RetryStats {
  totalQueued: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageRetries: number;
  oldestPending?: Date;
}

export class RetryQueue {
  private config: RetryConfig;
  private isProcessing = false;
  private processingTimer: NodeJS.Timeout | null = null;

  constructor(
    private knex: Knex,
    config: Partial<RetryConfig> = {}
  ) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 300000, // 5 minutes
      backoffFactor: 2,
      jitterEnabled: true,
      ...config
    };
  }

  /**
   * Start the retry queue processor
   */
  start(): void {
    if (this.processingTimer) {
      return;
    }

    // Process queue every 30 seconds
    this.processingTimer = setInterval(() => {
      this.processQueue().catch(error => {
        console.error('Error processing retry queue:', error);
      });
    }, 30000);

    console.log('Retry queue processor started');
  }

  /**
   * Stop the retry queue processor
   */
  stop(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      console.log('Retry queue processor stopped');
    }
  }

  /**
   * Add operation to retry queue
   */
  async queueOperation(operation: SyncOperation, error?: string): Promise<string> {
    const operationId = uuidv4();
    const scheduledFor = new Date();

    await this.knex('sync_operations_queue').insert({
      operation_id: operationId,
      operation: operation.operation,
      entity_type: operation.entityType,
      entity_id: operation.entityId,
      device_id: operation.deviceId,
      data: JSON.stringify(operation.data),
      version: operation.version,
      created_at: operation.timestamp,
      scheduled_for: scheduledFor,
      retry_count: 0,
      max_retries: this.config.maxRetries,
      status: 'pending',
      error_message: error,
      last_attempt: null,
      completed_at: null
    });

    console.log(`Operation ${operationId} queued for retry`);
    return operationId;
  }

  /**
   * Get pending operations ready for retry
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    const rows = await this.knex('sync_operations_queue')
      .where('status', 'pending')
      .andWhere('scheduled_for', '<=', new Date())
      .andWhere(this.knex.raw('retry_count < max_retries'))
      .orderBy('created_at', 'asc')
      .limit(50); // Process in batches

    return rows.map(row => ({
      operationId: row.operation_id,
      operation: row.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      entityType: row.entity_type,
      entityId: row.entity_id,
      data: JSON.parse(row.data),
      timestamp: row.created_at,
      deviceId: row.device_id,
      version: row.version,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      scheduledFor: row.scheduled_for,
      lastError: row.error_message,
      status: row.status
    }));
  }

  /**
   * Mark operation as processing
   */
  async markAsProcessing(operationId: string): Promise<void> {
    await this.knex('sync_operations_queue')
      .where('operation_id', operationId)
      .update({
        status: 'processing',
        last_attempt: new Date()
      });
  }

  /**
   * Mark operation as completed
   */
  async markAsCompleted(operationId: string): Promise<void> {
    await this.knex('sync_operations_queue')
      .where('operation_id', operationId)
      .update({
        status: 'completed',
        completed_at: new Date()
      });
  }

  /**
   * Mark operation as failed and schedule retry
   */
  async markAsFailed(operationId: string, error: string): Promise<void> {
    const operation = await this.knex('sync_operations_queue')
      .where('operation_id', operationId)
      .first();

    if (!operation) {
      console.error(`Operation ${operationId} not found in queue`);
      return;
    }

    const newRetryCount = operation.retry_count + 1;
    const maxRetries = operation.max_retries;

    if (newRetryCount >= maxRetries) {
      // Permanently failed
      await this.knex('sync_operations_queue')
        .where('operation_id', operationId)
        .update({
          status: 'failed',
          retry_count: newRetryCount,
          error_message: error,
          last_attempt: new Date()
        });

      console.log(`Operation ${operationId} permanently failed after ${newRetryCount} attempts`);
    } else {
      // Schedule for retry with exponential backoff
      const delay = this.calculateRetryDelay(newRetryCount);
      const scheduledFor = new Date(Date.now() + delay);

      await this.knex('sync_operations_queue')
        .where('operation_id', operationId)
        .update({
          status: 'pending',
          retry_count: newRetryCount,
          error_message: error,
          scheduled_for: scheduledFor,
          last_attempt: new Date()
        });

      console.log(`Operation ${operationId} scheduled for retry ${newRetryCount}/${maxRetries} in ${delay}ms`);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, retryCount - 1);
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.config.jitterEnabled) {
      const jitter = Math.random() * 0.1 * delay; // Up to 10% jitter
      delay += jitter;
    }
    
    return Math.floor(delay);
  }

  /**
   * Process the retry queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingOps = await this.getPendingOperations();
      
      if (pendingOps.length === 0) {
        return;
      }

      console.log(`Processing ${pendingOps.length} pending retry operations`);

      for (const operation of pendingOps) {
        try {
          await this.markAsProcessing(operation.operationId);
          
          // Here you would call the actual sync operation
          // For now, we'll simulate success/failure
          const success = await this.executeOperation(operation);
          
          if (success) {
            await this.markAsCompleted(operation.operationId);
          } else {
            await this.markAsFailed(operation.operationId, 'Simulated failure');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.markAsFailed(operation.operationId, errorMessage);
        }
      }
    } catch (error) {
      console.error('Error processing retry queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a queued operation (placeholder)
   */
  private async executeOperation(operation: QueuedOperation): Promise<boolean> {
    // This would be implemented by the sync provider
    // For now, simulate random success/failure for testing
    console.log(`Executing operation ${operation.operationId}: ${operation.operation} ${operation.entityType}/${operation.entityId}`);
    
    // Simulate 80% success rate
    return Math.random() > 0.2;
  }

  /**
   * Get retry queue statistics
   */
  async getStats(): Promise<RetryStats> {
    const [
      totalResult,
      pendingResult,
      processingResult,
      completedResult,
      failedResult,
      avgRetriesResult,
      oldestPendingResult
    ] = await Promise.all([
      this.knex('sync_operations_queue').count('* as count').first(),
      this.knex('sync_operations_queue').where('status', 'pending').count('* as count').first(),
      this.knex('sync_operations_queue').where('status', 'processing').count('* as count').first(),
      this.knex('sync_operations_queue').where('status', 'completed').count('* as count').first(),
      this.knex('sync_operations_queue').where('status', 'failed').count('* as count').first(),
      this.knex('sync_operations_queue').avg('retry_count as avg').first(),
      this.knex('sync_operations_queue')
        .where('status', 'pending')
        .min('created_at as oldest')
        .first()
    ]);

    return {
      totalQueued: totalResult?.count || 0,
      pending: pendingResult?.count || 0,
      processing: processingResult?.count || 0,
      completed: completedResult?.count || 0,
      failed: failedResult?.count || 0,
      averageRetries: Math.round((avgRetriesResult?.avg || 0) * 100) / 100,
      oldestPending: oldestPendingResult?.oldest ? new Date(oldestPendingResult.oldest) : undefined
    };
  }

  /**
   * Clear completed operations older than specified hours
   */
  async clearCompleted(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const deletedCount = await this.knex('sync_operations_queue')
      .where('status', 'completed')
      .andWhere('completed_at', '<', cutoffTime)
      .delete();

    if (deletedCount > 0) {
      console.log(`Cleared ${deletedCount} completed operations older than ${olderThanHours} hours`);
    }

    return deletedCount;
  }

  /**
   * Clear all failed operations (manual cleanup)
   */
  async clearFailed(): Promise<number> {
    const deletedCount = await this.knex('sync_operations_queue')
      .where('status', 'failed')
      .delete();

    if (deletedCount > 0) {
      console.log(`Cleared ${deletedCount} failed operations`);
    }

    return deletedCount;
  }

  /**
   * Retry all failed operations (reset their status to pending)
   */
  async retryAllFailed(): Promise<number> {
    const updatedCount = await this.knex('sync_operations_queue')
      .where('status', 'failed')
      .update({
        status: 'pending',
        retry_count: 0,
        scheduled_for: new Date(),
        error_message: null
      });

    if (updatedCount > 0) {
      console.log(`Reset ${updatedCount} failed operations for retry`);
    }

    return updatedCount;
  }

  /**
   * Get failed operations for manual review
   */
  async getFailedOperations(): Promise<QueuedOperation[]> {
    const rows = await this.knex('sync_operations_queue')
      .where('status', 'failed')
      .orderBy('last_attempt', 'desc');

    return rows.map(row => ({
      operationId: row.operation_id,
      operation: row.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      entityType: row.entity_type,
      entityId: row.entity_id,
      data: JSON.parse(row.data),
      timestamp: row.created_at,
      deviceId: row.device_id,
      version: row.version,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      scheduledFor: row.scheduled_for,
      lastError: row.error_message,
      status: row.status
    }));
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Retry queue configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
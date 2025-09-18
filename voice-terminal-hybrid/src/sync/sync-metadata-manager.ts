/**
 * Sync Metadata Manager
 * Handles local SQLite sync metadata operations
 */

import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import type { 
  SyncMetadata, 
  SyncOperation, 
  SyncStats, 
  SyncConflict,
  DeviceInfo
} from './interfaces.js';
import { DeviceManager } from './device-manager.js';

export interface SyncMetadataRow extends Omit<SyncMetadata, 'lastSync'> {
  id: number;
  last_sync: Date;
  sync_version: number;
  device_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface SyncOperationRow {
  id: number;
  operation_id: string;
  operation: string;
  entity_type: string;
  entity_id: string;
  device_id: string;
  data: string; // JSON string
  version: number;
  created_at: Date;
  scheduled_for: Date;
  retry_count: number;
  max_retries: number;
  status: string;
  error_message?: string;
  last_attempt?: Date;
  completed_at?: Date;
}

export interface SyncConflictRow {
  id: number;
  conflict_id: string;
  entity_type: string;
  entity_id: string;
  device_id: string;
  local_data: string; // JSON string
  remote_data: string; // JSON string
  local_timestamp: Date;
  remote_timestamp: Date;
  resolution?: string;
  status: string;
  created_at: Date;
  resolved_at?: Date;
  resolution_notes?: string;
}

export class SyncMetadataManager {
  private knex: Knex;
  private deviceManager: DeviceManager;

  constructor(knex: Knex) {
    this.knex = knex;
    this.deviceManager = DeviceManager.getInstance();
  }

  /**
   * Initialize the metadata manager
   */
  async initialize(): Promise<void> {
    await this.deviceManager.initialize();
    
    // Ensure sync tables exist (migration should handle this)
    await this.ensureSyncTables();
  }

  /**
   * Update sync metadata for an entity
   */
  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const existingMetadata = await this.getSyncMetadata(
      metadata.entityType,
      metadata.entityId
    );

    const metadataData = {
      entity_type: metadata.entityType,
      entity_id: metadata.entityId,
      device_id: metadata.deviceId,
      last_sync: metadata.lastSync,
      sync_version: metadata.syncVersion,
      checksum: metadata.checksum,
      conflict_resolution: metadata.conflictResolution || 'newest',
      updated_at: new Date()
    };

    if (existingMetadata) {
      await this.knex('sync_metadata')
        .where({
          entity_type: metadata.entityType,
          entity_id: metadata.entityId,
          device_id: metadata.deviceId
        })
        .update(metadataData);
    } else {
      await this.knex('sync_metadata').insert({
        ...metadataData,
        created_at: new Date()
      });
    }
  }

  /**
   * Get sync metadata for a specific entity
   */
  async getSyncMetadata(
    entityType: string, 
    entityId: string
  ): Promise<SyncMetadata | null> {
    const deviceId = await this.deviceManager.getDeviceId();
    
    const row = await this.knex('sync_metadata')
      .where({
        entity_type: entityType,
        entity_id: entityId,
        device_id: deviceId
      })
      .first() as SyncMetadataRow | undefined;

    if (!row) {
      return null;
    }

    return {
      entityType: row.entity_type,
      entityId: row.entity_id,
      lastSync: row.last_sync,
      syncVersion: row.sync_version,
      deviceId: row.device_id,
      checksum: row.checksum,
      conflictResolution: row.conflict_resolution as 'local' | 'remote' | 'newest'
    };
  }

  /**
   * Get all sync metadata for an entity type
   */
  async getAllSyncMetadata(entityType: string): Promise<SyncMetadata[]> {
    const deviceId = await this.deviceManager.getDeviceId();
    
    const rows = await this.knex('sync_metadata')
      .where({
        entity_type: entityType,
        device_id: deviceId
      })
      .orderBy('last_sync', 'desc') as SyncMetadataRow[];

    return rows.map(row => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      lastSync: row.last_sync,
      syncVersion: row.sync_version,
      deviceId: row.device_id,
      checksum: row.checksum,
      conflictResolution: row.conflict_resolution as 'local' | 'remote' | 'newest'
    }));
  }

  /**
   * Queue a sync operation for retry
   */
  async queueOperation(operation: SyncOperation): Promise<void> {
    const operationId = uuidv4();
    
    await this.knex('sync_operations_queue').insert({
      operation_id: operationId,
      operation: operation.operation,
      entity_type: operation.entityType,
      entity_id: operation.entityId,
      device_id: operation.deviceId,
      data: JSON.stringify(operation.data),
      version: operation.version,
      created_at: operation.timestamp,
      scheduled_for: new Date(),
      retry_count: 0,
      max_retries: 3,
      status: 'pending'
    });
  }

  /**
   * Get pending operations from queue
   */
  async getPendingOperations(): Promise<SyncOperation[]> {
    const deviceId = await this.deviceManager.getDeviceId();
    
    const rows = await this.knex('sync_operations_queue')
      .where({
        device_id: deviceId,
        status: 'pending'
      })
      .andWhere('scheduled_for', '<=', new Date())
      .andWhere('retry_count', '<', this.knex.ref('max_retries'))
      .orderBy('created_at', 'asc') as SyncOperationRow[];

    return rows.map(row => ({
      operation: row.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      entityType: row.entity_type,
      entityId: row.entity_id,
      data: JSON.parse(row.data),
      timestamp: row.created_at,
      deviceId: row.device_id,
      version: row.version
    }));
  }

  /**
   * Update operation status in queue
   */
  async updateOperationStatus(
    operationId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      last_attempt: new Date()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date();
    } else if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
      updateData.retry_count = this.knex.raw('retry_count + 1');
      
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, 3), 60000); // Max 1 minute
      updateData.scheduled_for = new Date(Date.now() + retryDelay);
      updateData.status = 'pending'; // Allow retry
    }

    await this.knex('sync_operations_queue')
      .where('operation_id', operationId)
      .update(updateData);
  }

  /**
   * Remove completed operations from queue
   */
  async cleanupCompletedOperations(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const deletedCount = await this.knex('sync_operations_queue')
      .where('status', 'completed')
      .andWhere('completed_at', '<', cutoffTime)
      .delete();

    return deletedCount;
  }

  /**
   * Record a sync conflict
   */
  async recordConflict(conflict: SyncConflict): Promise<string> {
    const conflictId = uuidv4();
    
    await this.knex('sync_conflicts').insert({
      conflict_id: conflictId,
      entity_type: conflict.entityType,
      entity_id: conflict.entityId,
      device_id: conflict.deviceId || await this.deviceManager.getDeviceId(),
      local_data: JSON.stringify(conflict.localData),
      remote_data: JSON.stringify(conflict.remoteData),
      local_timestamp: conflict.localTimestamp,
      remote_timestamp: conflict.remoteTimestamp,
      resolution: conflict.resolution,
      status: 'unresolved',
      created_at: new Date()
    });

    return conflictId;
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'newest',
    notes?: string
  ): Promise<void> {
    await this.knex('sync_conflicts')
      .where('conflict_id', conflictId)
      .update({
        resolution,
        status: 'resolved',
        resolved_at: new Date(),
        resolution_notes: notes
      });
  }

  /**
   * Get unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const deviceId = await this.deviceManager.getDeviceId();
    
    const rows = await this.knex('sync_conflicts')
      .where({
        device_id: deviceId,
        status: 'unresolved'
      })
      .orderBy('created_at', 'desc') as SyncConflictRow[];

    return rows.map(row => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      localData: JSON.parse(row.local_data),
      remoteData: JSON.parse(row.remote_data),
      localTimestamp: row.local_timestamp,
      remoteTimestamp: row.remote_timestamp,
      resolution: row.resolution as 'local' | 'remote' | 'newest' | 'manual'
    }));
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    const deviceId = await this.deviceManager.getDeviceId();
    
    // Get total records count
    const totalRecords = await this.getTotalRecordsCount();
    
    // Get last sync time
    const lastSyncResult = await this.knex('sync_metadata')
      .where('device_id', deviceId)
      .max('last_sync as last_sync')
      .first();
    
    // Get pending operations count
    const pendingOpsResult = await this.knex('sync_operations_queue')
      .where({
        device_id: deviceId,
        status: 'pending'
      })
      .count('* as count')
      .first();
    
    // Get resolved conflicts count
    const resolvedConflictsResult = await this.knex('sync_conflicts')
      .where({
        device_id: deviceId,
        status: 'resolved'
      })
      .count('* as count')
      .first();
    
    // Get sync history
    const historyRows = await this.knex('sync_history')
      .where('device_id', deviceId)
      .orderBy('started_at', 'desc')
      .limit(10)
      .select('started_at', 'operation', 'records_processed', 'duration_ms', 'success');

    const syncHistory = historyRows.map(row => ({
      timestamp: row.started_at,
      operation: row.operation,
      recordsProcessed: row.records_processed,
      duration: row.duration_ms,
      success: row.success
    }));

    return {
      totalRecords: totalRecords,
      lastSyncTime: lastSyncResult?.last_sync || null,
      pendingOperations: pendingOpsResult?.count || 0,
      conflictsResolved: resolvedConflictsResult?.count || 0,
      syncHistory
    };
  }

  /**
   * Record sync operation in history
   */
  async recordSyncHistory(
    operation: string,
    startTime: Date,
    endTime: Date,
    recordsProcessed: number,
    conflictsFound: number,
    errorsCount: number,
    success: boolean,
    entityTypes: string[],
    errorSummary?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const deviceId = await this.deviceManager.getDeviceId();
    const syncId = uuidv4();
    
    await this.knex('sync_history').insert({
      sync_id: syncId,
      device_id: deviceId,
      operation,
      started_at: startTime,
      completed_at: endTime,
      duration_ms: endTime.getTime() - startTime.getTime(),
      records_processed: recordsProcessed,
      conflicts_found: conflictsFound,
      errors_count: errorsCount,
      success,
      entity_types: JSON.stringify(entityTypes),
      error_summary: errorSummary,
      metadata: metadata ? JSON.stringify(metadata) : null
    });
  }

  /**
   * Get total records count across all synced entities
   */
  private async getTotalRecordsCount(): Promise<number> {
    // This should be updated based on actual entity tables
    let total = 0;
    
    // Count notifications if table exists
    const hasNotifications = await this.knex.schema.hasTable('notifications');
    if (hasNotifications) {
      const notificationsResult = await this.knex('notifications').count('* as count').first();
      total += notificationsResult?.count || 0;
    }
    
    // Add other entity counts here as needed
    // const hasProjects = await this.knex.schema.hasTable('projects');
    // if (hasProjects) {
    //   const projectsResult = await this.knex('projects').count('* as count').first();
    //   total += projectsResult?.count || 0;
    // }
    
    return total;
  }

  /**
   * Ensure sync tables exist (fallback if migration hasn't run)
   */
  private async ensureSyncTables(): Promise<void> {
    const tables = [
      'sync_metadata',
      'sync_operations_queue',
      'sync_conflicts',
      'sync_stats',
      'sync_history'
    ];

    for (const tableName of tables) {
      const exists = await this.knex.schema.hasTable(tableName);
      if (!exists) {
        console.warn(`Sync table ${tableName} does not exist. Please run migrations.`);
      }
    }
  }
}
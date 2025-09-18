/**
 * Core interfaces for the progressive cloud sync system
 * Provides abstraction for different sync providers (Supabase, Firebase, etc.)
 */

export interface SyncConfig {
  readonly url: string;
  readonly apiKey: string;
  readonly batchSize?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly autoSync?: boolean;
  readonly syncInterval?: number;
}

export interface SyncMetadata {
  readonly entityType: string;
  readonly entityId: string;
  readonly lastSync: Date;
  readonly syncVersion: number;
  readonly deviceId: string;
  readonly checksum?: string;
  readonly conflictResolution?: 'local' | 'remote' | 'newest';
}

export interface SyncOperation {
  readonly operation: 'CREATE' | 'UPDATE' | 'DELETE';
  readonly entityType: string;
  readonly entityId: string;
  readonly data: Record<string, any>;
  readonly timestamp: Date;
  readonly deviceId: string;
  readonly version: number;
}

export interface SyncResult {
  readonly success: boolean;
  readonly operation: string;
  readonly recordsProcessed: number;
  readonly conflicts: SyncConflict[];
  readonly errors: SyncError[];
  readonly duration: number;
}

export interface SyncConflict {
  readonly entityType: string;
  readonly entityId: string;
  readonly localData: Record<string, any>;
  readonly remoteData: Record<string, any>;
  readonly localTimestamp: Date;
  readonly remoteTimestamp: Date;
  readonly resolution: 'local' | 'remote' | 'newest' | 'manual';
}

export interface SyncError {
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly error: string;
  readonly retryable: boolean;
  readonly timestamp: Date;
}

export interface SyncProgress {
  readonly phase: 'connecting' | 'syncing' | 'resolving' | 'complete';
  readonly current: number;
  readonly total: number;
  readonly percentage: number;
  readonly message: string;
  readonly entityType?: string;
}

export interface DeviceInfo {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly platform: string;
  readonly lastSync: Date;
  readonly syncVersion: number;
  readonly isActive: boolean;
}

export interface SyncStats {
  readonly totalRecords: number;
  readonly lastSyncTime: Date | null;
  readonly pendingOperations: number;
  readonly conflictsResolved: number;
  readonly syncHistory: Array<{
    timestamp: Date;
    operation: string;
    recordsProcessed: number;
    duration: number;
    success: boolean;
  }>;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;
export type ConflictResolver = (conflict: SyncConflict) => Promise<'local' | 'remote' | 'newest'>;

/**
 * Main interface for sync providers
 * Implements the contract for cloud synchronization
 */
export interface ISyncProvider {
  readonly name: string;
  readonly isConnected: boolean;
  readonly config: SyncConfig;

  /**
   * Initialize the sync provider and validate connection
   */
  initialize(): Promise<void>;

  /**
   * Validate connection and credentials
   */
  validateConnection(): Promise<boolean>;

  /**
   * Set up cloud schema and tables if they don't exist
   */
  setupCloudSchema(): Promise<void>;

  /**
   * One-way backup from local to cloud
   * Use for initial backup or device migration
   */
  seed(
    entityTypes?: string[], 
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;

  /**
   * Pull from cloud to local (for new devices)
   * Overwrites local data with cloud data
   */
  hydrate(
    entityTypes?: string[], 
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;

  /**
   * Two-way sync with conflict resolution
   * The main sync operation for regular use
   */
  sync(
    entityTypes?: string[],
    conflictResolver?: ConflictResolver,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;

  /**
   * Push local changes to cloud
   */
  pushChanges(
    operations: SyncOperation[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;

  /**
   * Pull remote changes from cloud
   */
  pullChanges(
    since?: Date,
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncOperation[]>;

  /**
   * Get sync statistics and status
   */
  getSyncStats(): Promise<SyncStats>;

  /**
   * Get device information
   */
  getDeviceInfo(): Promise<DeviceInfo>;

  /**
   * Register current device
   */
  registerDevice(deviceName?: string): Promise<DeviceInfo>;

  /**
   * Deregister device (cleanup on device removal)
   */
  deregisterDevice(deviceId?: string): Promise<void>;

  /**
   * Get all registered devices
   */
  getRegisteredDevices(): Promise<DeviceInfo[]>;

  /**
   * Clean up resources and close connections
   */
  cleanup(): Promise<void>;
}

/**
 * Local sync manager interface
 * Handles local SQLite sync metadata and operations
 */
export interface ISyncManager {
  /**
   * Initialize sync manager and create metadata tables
   */
  initialize(): Promise<void>;

  /**
   * Set the active sync provider
   */
  setProvider(provider: ISyncProvider): void;

  /**
   * Get current sync provider
   */
  getProvider(): ISyncProvider | null;

  /**
   * Track sync metadata for an entity
   */
  updateSyncMetadata(metadata: SyncMetadata): Promise<void>;

  /**
   * Get sync metadata for an entity
   */
  getSyncMetadata(entityType: string, entityId: string): Promise<SyncMetadata | null>;

  /**
   * Get all sync metadata for an entity type
   */
  getAllSyncMetadata(entityType: string): Promise<SyncMetadata[]>;

  /**
   * Queue sync operation for retry
   */
  queueOperation(operation: SyncOperation): Promise<void>;

  /**
   * Get pending operations from queue
   */
  getPendingOperations(): Promise<SyncOperation[]>;

  /**
   * Remove operation from queue
   */
  removeFromQueue(operationId: string): Promise<void>;

  /**
   * Get local device information
   */
  getLocalDevice(): Promise<DeviceInfo>;

  /**
   * Start auto-sync if enabled
   */
  startAutoSync(): void;

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void;

  /**
   * Perform manual sync
   */
  performSync(
    entityTypes?: string[],
    conflictResolver?: ConflictResolver,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult>;
}

/**
 * Sync event types for event-driven updates
 */
export interface SyncEvent {
  readonly type: 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_error' | 'conflict_detected';
  readonly timestamp: Date;
  readonly data: any;
}

export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Default conflict resolution strategies
 */
export const ConflictResolutionStrategies = {
  NEWEST_WINS: async (conflict: SyncConflict): Promise<'local' | 'remote' | 'newest'> => {
    return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
  },
  
  LOCAL_WINS: async (): Promise<'local'> => 'local',
  
  REMOTE_WINS: async (): Promise<'remote'> => 'remote',
  
  MANUAL: async (): Promise<'newest'> => 'newest'
} as const;
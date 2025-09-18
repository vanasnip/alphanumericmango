/**
 * Main Sync Manager
 * Coordinates sync operations between local SQLite and cloud providers
 */

import type { Knex } from 'knex';
import type {
  ISyncManager,
  ISyncProvider,
  SyncMetadata,
  SyncOperation,
  SyncResult,
  ConflictResolver,
  SyncProgressCallback,
  DeviceInfo,
  SyncEvent,
  SyncEventListener
} from './interfaces.js';
import { SyncMetadataManager } from './sync-metadata-manager.js';
import { DeviceManager } from './device-manager.js';
import { ConflictResolverFactory } from './conflict-resolver.js';
import { SupabaseProvider } from './supabase-provider.js';

export interface SyncManagerConfig {
  autoSyncEnabled?: boolean;
  autoSyncInterval?: number; // minutes
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number; // milliseconds
}

export class SyncManager implements ISyncManager {
  private static instance: SyncManager;
  private provider: ISyncProvider | null = null;
  private metadataManager: SyncMetadataManager;
  private deviceManager: DeviceManager;
  private config: SyncManagerConfig;
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, SyncEventListener[]> = new Map();
  private isInitialized = false;
  private isSyncing = false;

  private constructor(
    private knex: Knex,
    config: SyncManagerConfig = {}
  ) {
    this.config = {
      autoSyncEnabled: false,
      autoSyncInterval: 30, // 30 minutes
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 5000,
      ...config
    };
    
    this.metadataManager = new SyncMetadataManager(knex);
    this.deviceManager = DeviceManager.getInstance();
  }

  static getInstance(knex?: Knex, config?: SyncManagerConfig): SyncManager {
    if (!SyncManager.instance) {
      if (!knex) {
        throw new Error('Knex instance required for first initialization');
      }
      SyncManager.instance = new SyncManager(knex, config);
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.deviceManager.initialize();
    await this.metadataManager.initialize();
    
    // Process any pending operations from previous sessions
    await this.processPendingOperations();
    
    this.isInitialized = true;
    
    if (this.config.autoSyncEnabled) {
      this.startAutoSync();
    }

    this.emitEvent({
      type: 'sync_started',
      timestamp: new Date(),
      data: { message: 'Sync manager initialized' }
    });
  }

  /**
   * Set the active sync provider
   */
  setProvider(provider: ISyncProvider): void {
    this.provider = provider;
  }

  /**
   * Get current sync provider
   */
  getProvider(): ISyncProvider | null {
    return this.provider;
  }

  /**
   * Create Supabase provider with configuration
   */
  async createSupabaseProvider(url: string, apiKey: string, authToken?: string): Promise<SupabaseProvider> {
    const provider = new SupabaseProvider({
      url,
      apiKey,
      authToken,
      batchSize: this.config.batchSize,
      retryAttempts: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    }, this.knex);

    await provider.initialize();
    this.setProvider(provider);
    
    return provider;
  }

  /**
   * Track sync metadata for an entity
   */
  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    return this.metadataManager.updateSyncMetadata(metadata);
  }

  /**
   * Get sync metadata for an entity
   */
  async getSyncMetadata(entityType: string, entityId: string): Promise<SyncMetadata | null> {
    return this.metadataManager.getSyncMetadata(entityType, entityId);
  }

  /**
   * Get all sync metadata for an entity type
   */
  async getAllSyncMetadata(entityType: string): Promise<SyncMetadata[]> {
    return this.metadataManager.getAllSyncMetadata(entityType);
  }

  /**
   * Queue sync operation for retry
   */
  async queueOperation(operation: SyncOperation): Promise<void> {
    await this.metadataManager.queueOperation(operation);
    
    this.emitEvent({
      type: 'sync_progress',
      timestamp: new Date(),
      data: { 
        message: `Operation queued: ${operation.operation} ${operation.entityType}`,
        operation 
      }
    });
  }

  /**
   * Get pending operations from queue
   */
  async getPendingOperations(): Promise<SyncOperation[]> {
    return this.metadataManager.getPendingOperations();
  }

  /**
   * Remove operation from queue
   */
  async removeFromQueue(operationId: string): Promise<void> {
    // This would need to be implemented in the metadata manager
    // For now, we'll mark it as completed
    console.log(`Removing operation ${operationId} from queue`);
  }

  /**
   * Get local device information
   */
  async getLocalDevice(): Promise<DeviceInfo> {
    return this.deviceManager.getDeviceInfo();
  }

  /**
   * Start auto-sync if enabled
   */
  startAutoSync(): void {
    if (this.autoSyncTimer) {
      this.stopAutoSync();
    }

    if (!this.config.autoSyncEnabled) {
      return;
    }

    const intervalMs = (this.config.autoSyncInterval || 30) * 60 * 1000;
    
    this.autoSyncTimer = setInterval(async () => {
      if (!this.isSyncing && this.provider?.isConnected) {
        try {
          await this.performSync(undefined, undefined, (progress) => {
            this.emitEvent({
              type: 'sync_progress',
              timestamp: new Date(),
              data: { progress, auto: true }
            });
          });
        } catch (error) {
          this.emitEvent({
            type: 'sync_error',
            timestamp: new Date(),
            data: { error: error instanceof Error ? error.message : 'Auto-sync failed', auto: true }
          });
        }
      }
    }, intervalMs);

    console.log(`Auto-sync started with ${this.config.autoSyncInterval} minute interval`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Perform manual sync
   */
  async performSync(
    entityTypes?: string[],
    conflictResolver?: ConflictResolver,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this.provider) {
      throw new Error('No sync provider configured');
    }

    if (!this.provider.isConnected) {
      throw new Error('Sync provider is not connected');
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    
    try {
      this.emitEvent({
        type: 'sync_started',
        timestamp: new Date(),
        data: { entityTypes, manual: true }
      });

      // Use default conflict resolver if none provided
      const resolver = conflictResolver || this.createDefaultConflictResolver();

      const result = await this.provider.sync(entityTypes, resolver, onProgress);

      this.emitEvent({
        type: 'sync_completed',
        timestamp: new Date(),
        data: { result }
      });

      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      
      this.emitEvent({
        type: 'sync_error',
        timestamp: new Date(),
        data: { error: errorMessage }
      });
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform seed operation (backup local to cloud)
   */
  async seed(
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this.provider) {
      throw new Error('No sync provider configured');
    }

    this.emitEvent({
      type: 'sync_started',
      timestamp: new Date(),
      data: { operation: 'seed', entityTypes }
    });

    try {
      const result = await this.provider.seed(entityTypes, onProgress);
      
      this.emitEvent({
        type: 'sync_completed',
        timestamp: new Date(),
        data: { operation: 'seed', result }
      });
      
      return result;
    } catch (error) {
      this.emitEvent({
        type: 'sync_error',
        timestamp: new Date(),
        data: { operation: 'seed', error: error instanceof Error ? error.message : 'Seed failed' }
      });
      throw error;
    }
  }

  /**
   * Perform hydrate operation (restore from cloud to local)
   */
  async hydrate(
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this.provider) {
      throw new Error('No sync provider configured');
    }

    this.emitEvent({
      type: 'sync_started',
      timestamp: new Date(),
      data: { operation: 'hydrate', entityTypes }
    });

    try {
      const result = await this.provider.hydrate(entityTypes, onProgress);
      
      this.emitEvent({
        type: 'sync_completed',
        timestamp: new Date(),
        data: { operation: 'hydrate', result }
      });
      
      return result;
    } catch (error) {
      this.emitEvent({
        type: 'sync_error',
        timestamp: new Date(),
        data: { operation: 'hydrate', error: error instanceof Error ? error.message : 'Hydrate failed' }
      });
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    return this.metadataManager.getSyncStats();
  }

  /**
   * Process pending operations from queue
   */
  async processPendingOperations(): Promise<void> {
    if (!this.provider?.isConnected) {
      return;
    }

    const pendingOps = await this.getPendingOperations();
    
    if (pendingOps.length === 0) {
      return;
    }

    console.log(`Processing ${pendingOps.length} pending operations`);

    // Process operations in batches
    const batchSize = this.config.batchSize || 50;
    
    for (let i = 0; i < pendingOps.length; i += batchSize) {
      const batch = pendingOps.slice(i, i + batchSize);
      
      try {
        await this.provider.pushChanges(batch, (progress) => {
          this.emitEvent({
            type: 'sync_progress',
            timestamp: new Date(),
            data: { 
              message: `Processing pending operations: ${progress.current}/${progress.total}`,
              progress
            }
          });
        });
      } catch (error) {
        console.error('Error processing pending operations batch:', error);
        // Individual operation failures should be handled by the provider
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, listener: SyncEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, listener: SyncEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit sync event
   */
  private emitEvent(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in sync event listener for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Create default conflict resolver based on entity type
   */
  private createDefaultConflictResolver(): ConflictResolver {
    return async (conflict) => {
      switch (conflict.entityType) {
        case 'notifications':
          const notificationResolver = ConflictResolverFactory.createNotificationResolver();
          const notificationResult = await notificationResolver.resolveConflict(conflict);
          return notificationResult.resolution === 'merged' ? 'newest' : notificationResult.resolution;
          
        case 'projects':
          const projectResolver = ConflictResolverFactory.createProjectResolver();
          const projectResult = await projectResolver.resolveConflict(conflict);
          return projectResult.resolution === 'merged' ? 'newest' : projectResult.resolution;
          
        case 'user_settings':
          const settingsResolver = ConflictResolverFactory.createSettingsResolver();
          const settingsResult = await settingsResolver.resolveConflict(conflict);
          return settingsResult.resolution === 'merged' ? 'newest' : settingsResult.resolution;
          
        default:
          // Default to newest wins
          return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
      }
    };
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-sync if interval changed
    if (newConfig.autoSyncInterval && this.autoSyncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  /**
   * Get current sync configuration
   */
  getConfig(): SyncManagerConfig {
    return { ...this.config };
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    
    if (this.provider) {
      await this.provider.cleanup();
    }
    
    this.eventListeners.clear();
    this.isInitialized = false;
  }
}
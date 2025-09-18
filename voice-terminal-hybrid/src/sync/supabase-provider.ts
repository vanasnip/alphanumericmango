/**
 * Supabase Cloud Sync Provider
 * Implements ISyncProvider for Supabase backend integration
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { 
  ISyncProvider,
  SyncConfig,
  SyncResult,
  SyncOperation,
  SyncProgress,
  SyncProgressCallback,
  ConflictResolver,
  SyncConflict,
  SyncStats,
  DeviceInfo,
  SyncError
} from './interfaces.js';
import { DeviceManager } from './device-manager.js';
import { SyncMetadataManager } from './sync-metadata-manager.js';
import type { Knex } from 'knex';

export interface SupabaseConfig extends SyncConfig {
  readonly authToken?: string;
  readonly userId?: string;
}

export class SupabaseProvider implements ISyncProvider {
  readonly name = 'Supabase';
  private supabase: SupabaseClient;
  private deviceManager: DeviceManager;
  private metadataManager: SyncMetadataManager;
  private _isConnected = false;
  private currentUser: User | null = null;

  constructor(
    public readonly config: SupabaseConfig,
    private knex: Knex
  ) {
    this.supabase = createClient(config.url, config.apiKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    
    this.deviceManager = DeviceManager.getInstance();
    this.metadataManager = new SyncMetadataManager(knex);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Initialize the Supabase provider
   */
  async initialize(): Promise<void> {
    await this.deviceManager.initialize();
    await this.metadataManager.initialize();
    
    // Try to restore existing session or authenticate
    if (this.config.authToken) {
      await this.authenticateWithToken(this.config.authToken);
    }
    
    await this.validateConnection();
  }

  /**
   * Validate connection to Supabase
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Test basic connection
      const { data, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.warn('Supabase connection validation failed:', error.message);
        this._isConnected = false;
        return false;
      }

      this.currentUser = data.session?.user || null;
      this._isConnected = !!this.currentUser;
      
      if (this._isConnected) {
        // Test database access
        const { error: dbError } = await this.supabase
          .from('sync.devices')
          .select('device_id')
          .limit(1);
        
        if (dbError) {
          console.warn('Supabase database access failed:', dbError.message);
          this._isConnected = false;
          return false;
        }
      }
      
      return this._isConnected;
    } catch (error) {
      console.error('Supabase connection validation error:', error);
      this._isConnected = false;
      return false;
    }
  }

  /**
   * Set up cloud schema and tables
   */
  async setupCloudSchema(): Promise<void> {
    if (!this._isConnected) {
      throw new Error('Not connected to Supabase');
    }

    // The schema should be set up via SQL migration (supabase-schema.sql)
    // This method can perform any additional setup if needed
    
    // Ensure device is registered
    await this.registerDevice();
  }

  /**
   * Authenticate with token
   */
  private async authenticateWithToken(token: string): Promise<void> {
    const { data, error } = await this.supabase.auth.setSession({
      access_token: token,
      refresh_token: token // This might need adjustment based on your auth setup
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    this.currentUser = data.user;
  }

  /**
   * One-way backup from local to cloud
   */
  async seed(
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const startTime = new Date();
    const result: SyncResult = {
      success: true,
      operation: 'seed',
      recordsProcessed: 0,
      conflicts: [],
      errors: [],
      duration: 0
    };

    try {
      onProgress?.({
        phase: 'connecting',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Connecting to Supabase...'
      });

      // Get all local data for specified entity types
      const typesToSync = entityTypes || ['notifications', 'projects', 'user_settings'];
      let totalRecords = 0;
      let processedRecords = 0;

      // Count total records first
      for (const entityType of typesToSync) {
        const count = await this.getLocalRecordCount(entityType);
        totalRecords += count;
      }

      onProgress?.({
        phase: 'syncing',
        current: 0,
        total: totalRecords,
        percentage: 0,
        message: `Starting seed operation for ${totalRecords} records...`
      });

      // Process each entity type
      for (const entityType of typesToSync) {
        const records = await this.getLocalRecords(entityType);
        
        for (const record of records) {
          try {
            await this.pushRecordToCloud(entityType, record);
            processedRecords++;
            
            onProgress?.({
              phase: 'syncing',
              current: processedRecords,
              total: totalRecords,
              percentage: Math.round((processedRecords / totalRecords) * 100),
              message: `Seeding ${entityType}: ${processedRecords}/${totalRecords}`,
              entityType
            });
          } catch (error) {
            result.errors.push({
              entityType,
              entityId: record.id,
              operation: 'seed',
              error: error instanceof Error ? error.message : 'Unknown error',
              retryable: true,
              timestamp: new Date()
            });
          }
        }
      }

      result.recordsProcessed = processedRecords;
      result.success = result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push({
        entityType: 'system',
        entityId: 'seed',
        operation: 'seed',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        timestamp: new Date()
      });
    } finally {
      const endTime = new Date();
      result.duration = endTime.getTime() - startTime.getTime();
      
      // Record sync history
      await this.metadataManager.recordSyncHistory(
        'seed',
        startTime,
        endTime,
        result.recordsProcessed,
        result.conflicts.length,
        result.errors.length,
        result.success,
        entityTypes || [],
        result.errors.length > 0 ? 'Errors occurred during seed operation' : undefined
      );

      onProgress?.({
        phase: 'complete',
        current: result.recordsProcessed,
        total: result.recordsProcessed,
        percentage: 100,
        message: result.success ? 'Seed completed successfully' : 'Seed completed with errors'
      });
    }

    return result;
  }

  /**
   * Pull from cloud to local (for new devices)
   */
  async hydrate(
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const startTime = new Date();
    const result: SyncResult = {
      success: true,
      operation: 'hydrate',
      recordsProcessed: 0,
      conflicts: [],
      errors: [],
      duration: 0
    };

    try {
      onProgress?.({
        phase: 'connecting',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Connecting to Supabase...'
      });

      const typesToSync = entityTypes || ['notifications', 'projects', 'user_settings'];
      let totalRecords = 0;
      let processedRecords = 0;

      // Count total cloud records
      for (const entityType of typesToSync) {
        const count = await this.getCloudRecordCount(entityType);
        totalRecords += count;
      }

      onProgress?.({
        phase: 'syncing',
        current: 0,
        total: totalRecords,
        percentage: 0,
        message: `Starting hydrate operation for ${totalRecords} records...`
      });

      // Process each entity type
      for (const entityType of typesToSync) {
        const records = await this.getCloudRecords(entityType);
        
        for (const record of records) {
          try {
            await this.saveRecordToLocal(entityType, record);
            processedRecords++;
            
            onProgress?.({
              phase: 'syncing',
              current: processedRecords,
              total: totalRecords,
              percentage: Math.round((processedRecords / totalRecords) * 100),
              message: `Hydrating ${entityType}: ${processedRecords}/${totalRecords}`,
              entityType
            });
          } catch (error) {
            result.errors.push({
              entityType,
              entityId: record.id,
              operation: 'hydrate',
              error: error instanceof Error ? error.message : 'Unknown error',
              retryable: true,
              timestamp: new Date()
            });
          }
        }
      }

      result.recordsProcessed = processedRecords;
      result.success = result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push({
        entityType: 'system',
        entityId: 'hydrate',
        operation: 'hydrate',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        timestamp: new Date()
      });
    } finally {
      const endTime = new Date();
      result.duration = endTime.getTime() - startTime.getTime();
      
      await this.metadataManager.recordSyncHistory(
        'hydrate',
        startTime,
        endTime,
        result.recordsProcessed,
        result.conflicts.length,
        result.errors.length,
        result.success,
        entityTypes || []
      );

      onProgress?.({
        phase: 'complete',
        current: result.recordsProcessed,
        total: result.recordsProcessed,
        percentage: 100,
        message: result.success ? 'Hydrate completed successfully' : 'Hydrate completed with errors'
      });
    }

    return result;
  }

  /**
   * Two-way sync with conflict resolution
   */
  async sync(
    entityTypes?: string[],
    conflictResolver?: ConflictResolver,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const startTime = new Date();
    const result: SyncResult = {
      success: true,
      operation: 'sync',
      recordsProcessed: 0,
      conflicts: [],
      errors: [],
      duration: 0
    };

    try {
      // First, push local changes
      const pushResult = await this.pushLocalChanges(entityTypes, onProgress);
      result.recordsProcessed += pushResult.recordsProcessed;
      result.errors.push(...pushResult.errors);
      result.conflicts.push(...pushResult.conflicts);

      // Then, pull remote changes
      const pullResult = await this.pullRemoteChanges(entityTypes, conflictResolver, onProgress);
      result.recordsProcessed += pullResult.recordsProcessed;
      result.errors.push(...pullResult.errors);
      result.conflicts.push(...pullResult.conflicts);

      result.success = result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push({
        entityType: 'system',
        entityId: 'sync',
        operation: 'sync',
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
        timestamp: new Date()
      });
    } finally {
      const endTime = new Date();
      result.duration = endTime.getTime() - startTime.getTime();
      
      await this.metadataManager.recordSyncHistory(
        'sync',
        startTime,
        endTime,
        result.recordsProcessed,
        result.conflicts.length,
        result.errors.length,
        result.success,
        entityTypes || []
      );
    }

    return result;
  }

  /**
   * Push local changes to cloud
   */
  async pushChanges(
    operations: SyncOperation[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    // Implementation for pushing specific operations
    // This would be called by the sync queue processor
    return { success: true, operation: 'push', recordsProcessed: 0, conflicts: [], errors: [], duration: 0 };
  }

  /**
   * Pull remote changes from cloud
   */
  async pullChanges(
    since?: Date,
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncOperation[]> {
    // Implementation for pulling changes since a specific date
    return [];
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    return this.metadataManager.getSyncStats();
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    return this.deviceManager.getDeviceInfo();
  }

  /**
   * Register current device with Supabase
   */
  async registerDevice(deviceName?: string): Promise<DeviceInfo> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const deviceInfo = await this.deviceManager.getDeviceInfo();
    
    if (deviceName) {
      await this.deviceManager.updateDeviceName(deviceName);
    }

    // Insert or update device in Supabase
    const { error } = await this.supabase
      .from('sync.devices')
      .upsert({
        device_id: deviceInfo.deviceId,
        device_name: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        user_id: this.currentUser.id,
        last_sync: new Date().toISOString(),
        sync_version: deviceInfo.syncVersion,
        is_active: true
      });

    if (error) {
      throw new Error(`Failed to register device: ${error.message}`);
    }

    return deviceInfo;
  }

  /**
   * Deregister device
   */
  async deregisterDevice(deviceId?: string): Promise<void> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const targetDeviceId = deviceId || await this.deviceManager.getDeviceId();
    
    const { error } = await this.supabase
      .from('sync.devices')
      .update({ is_active: false })
      .eq('device_id', targetDeviceId)
      .eq('user_id', this.currentUser.id);

    if (error) {
      throw new Error(`Failed to deregister device: ${error.message}`);
    }
  }

  /**
   * Get all registered devices
   */
  async getRegisteredDevices(): Promise<DeviceInfo[]> {
    if (!this._isConnected || !this.currentUser) {
      throw new Error('Not connected to Supabase or not authenticated');
    }

    const { data, error } = await this.supabase
      .from('sync.devices')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get registered devices: ${error.message}`);
    }

    return (data || []).map(device => ({
      deviceId: device.device_id,
      deviceName: device.device_name,
      platform: device.platform,
      lastSync: new Date(device.last_sync),
      syncVersion: device.sync_version,
      isActive: device.is_active
    }));
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clean up any resources, close connections
    this._isConnected = false;
    this.currentUser = null;
  }

  // Private helper methods

  private async getLocalRecordCount(entityType: string): Promise<number> {
    if (entityType === 'notifications') {
      const result = await this.knex('notifications').count('* as count').first();
      return result?.count || 0;
    }
    // Add other entity types as needed
    return 0;
  }

  private async getLocalRecords(entityType: string): Promise<any[]> {
    if (entityType === 'notifications') {
      return this.knex('notifications').select('*');
    }
    // Add other entity types as needed
    return [];
  }

  private async getCloudRecordCount(entityType: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(`sync.${entityType}`)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.currentUser?.id);

    if (error) {
      throw new Error(`Failed to count cloud records: ${error.message}`);
    }

    return count || 0;
  }

  private async getCloudRecords(entityType: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from(`sync.${entityType}`)
      .select('*')
      .eq('user_id', this.currentUser?.id);

    if (error) {
      throw new Error(`Failed to get cloud records: ${error.message}`);
    }

    return data || [];
  }

  private async pushRecordToCloud(entityType: string, record: any): Promise<void> {
    const { error } = await this.supabase
      .from(`sync.${entityType}`)
      .upsert({
        ...record,
        user_id: this.currentUser?.id,
        device_id: await this.deviceManager.getDeviceId(),
        sync_version: 1,
        last_synced: new Date().toISOString(),
        sync_status: 'synced'
      });

    if (error) {
      throw new Error(`Failed to push record to cloud: ${error.message}`);
    }
  }

  private async saveRecordToLocal(entityType: string, record: any): Promise<void> {
    if (entityType === 'notifications') {
      await this.knex('notifications').insert({
        ...record,
        sync_version: record.sync_version || 1,
        last_synced: new Date(),
        sync_status: 'synced',
        sync_device_id: record.device_id
      }).onConflict('id').merge();
    }
    // Add other entity types as needed
  }

  private async pushLocalChanges(
    entityTypes?: string[],
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    // Implementation for pushing local changes
    return { success: true, operation: 'push', recordsProcessed: 0, conflicts: [], errors: [], duration: 0 };
  }

  private async pullRemoteChanges(
    entityTypes?: string[],
    conflictResolver?: ConflictResolver,
    onProgress?: SyncProgressCallback
  ): Promise<SyncResult> {
    // Implementation for pulling remote changes
    return { success: true, operation: 'pull', recordsProcessed: 0, conflicts: [], errors: [], duration: 0 };
  }
}
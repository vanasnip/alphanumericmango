/**
 * Integration Example
 * Shows how to integrate the sync system with the voice-terminal-hybrid application
 */

import type { Knex } from 'knex';
import { 
  createSyncManager, 
  SyncManager, 
  isSyncAvailable, 
  getSyncConfig 
} from './index.js';

/**
 * Example integration with the main application
 */
export class AppSyncIntegration {
  private syncManager: SyncManager | null = null;
  private isInitialized = false;

  constructor(private knex: Knex) {}

  /**
   * Initialize sync system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create sync manager with configuration
      this.syncManager = await createSyncManager(this.knex, {
        autoSyncEnabled: process.env.SYNC_AUTO_ENABLED === 'true',
        autoSyncInterval: parseInt(process.env.SYNC_INTERVAL_MINUTES || '30'),
        batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '50'),
        maxRetries: parseInt(process.env.SYNC_MAX_RETRIES || '3')
      });

      // Set up event listeners
      this.setupEventListeners();

      // Initialize cloud provider if available
      if (isSyncAvailable()) {
        await this.initializeCloudSync();
      } else {
        console.log('Cloud sync not available - running in offline mode');
      }

      this.isInitialized = true;
      console.log('Sync system initialized successfully');

    } catch (error) {
      console.error('Failed to initialize sync system:', error);
      // App continues to work without sync
    }
  }

  /**
   * Initialize cloud sync provider
   */
  private async initializeCloudSync(): Promise<void> {
    if (!this.syncManager) return;

    try {
      const config = getSyncConfig();
      
      if (config.available && config.url && config.apiKey) {
        const provider = await this.syncManager.createSupabaseProvider(
          config.url,
          config.apiKey
        );

        console.log('Cloud sync provider initialized');
        
        // Optionally perform initial sync
        if (process.env.SYNC_ON_STARTUP === 'true') {
          this.performBackgroundSync();
        }
      }
    } catch (error) {
      console.error('Failed to initialize cloud sync:', error);
    }
  }

  /**
   * Set up sync event listeners
   */
  private setupEventListeners(): void {
    if (!this.syncManager) return;

    this.syncManager.addEventListener('sync_started', (event) => {
      console.log('🔄 Sync started:', event.data);
      // Update UI to show sync in progress
      this.notifyUI('sync_started', event.data);
    });

    this.syncManager.addEventListener('sync_progress', (event) => {
      console.log('📊 Sync progress:', event.data.progress?.percentage + '%');
      // Update progress bar in UI
      this.notifyUI('sync_progress', event.data);
    });

    this.syncManager.addEventListener('sync_completed', (event) => {
      console.log('✅ Sync completed:', event.data.result);
      // Show success notification
      this.notifyUI('sync_completed', event.data);
    });

    this.syncManager.addEventListener('sync_error', (event) => {
      console.error('❌ Sync error:', event.data.error);
      // Show error notification
      this.notifyUI('sync_error', event.data);
    });

    this.syncManager.addEventListener('conflict_detected', (event) => {
      console.warn('⚠️ Conflict detected:', event.data);
      // Show conflict resolution UI
      this.notifyUI('conflict_detected', event.data);
    });
  }

  /**
   * Notify UI of sync events (placeholder)
   */
  private notifyUI(eventType: string, data: any): void {
    // This would integrate with your UI framework
    // For example, dispatch custom events or update a reactive store
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-event', {
        detail: { type: eventType, data }
      }));
    }
  }

  /**
   * Perform background sync
   */
  async performBackgroundSync(): Promise<void> {
    if (!this.syncManager?.getProvider()?.isConnected) {
      return;
    }

    try {
      await this.syncManager.performSync(
        ['notifications', 'projects', 'user_settings'],
        undefined,
        (progress) => {
          // Optional: throttle progress updates for background sync
          if (progress.percentage % 10 === 0) {
            console.log(`Background sync: ${progress.percentage}%`);
          }
        }
      );
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  /**
   * Seed data to cloud (for backup)
   */
  async backup(): Promise<boolean> {
    if (!this.syncManager?.getProvider()?.isConnected) {
      throw new Error('Cloud sync not available');
    }

    try {
      const result = await this.syncManager.seed(
        ['notifications', 'projects', 'user_settings'],
        (progress) => {
          console.log(`Backup progress: ${progress.percentage}% - ${progress.message}`);
        }
      );

      console.log(`Backup completed: ${result.recordsProcessed} records`);
      return result.success;
    } catch (error) {
      console.error('Backup failed:', error);
      return false;
    }
  }

  /**
   * Restore data from cloud (for new device)
   */
  async restore(): Promise<boolean> {
    if (!this.syncManager?.getProvider()?.isConnected) {
      throw new Error('Cloud sync not available');
    }

    try {
      const result = await this.syncManager.hydrate(
        ['notifications', 'projects', 'user_settings'],
        (progress) => {
          console.log(`Restore progress: ${progress.percentage}% - ${progress.message}`);
        }
      );

      console.log(`Restore completed: ${result.recordsProcessed} records`);
      return result.success;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }

  /**
   * Get sync status for UI
   */
  async getSyncStatus(): Promise<{
    available: boolean;
    connected: boolean;
    lastSync: Date | null;
    pendingOperations: number;
    deviceInfo?: any;
  }> {
    const available = isSyncAvailable();
    
    if (!available || !this.syncManager) {
      return {
        available: false,
        connected: false,
        lastSync: null,
        pendingOperations: 0
      };
    }

    const provider = this.syncManager.getProvider();
    const connected = provider?.isConnected || false;
    
    let stats, deviceInfo;
    
    try {
      stats = await this.syncManager.getSyncStats();
      deviceInfo = await this.syncManager.getLocalDevice();
    } catch (error) {
      console.error('Error getting sync status:', error);
    }

    return {
      available,
      connected,
      lastSync: stats?.lastSyncTime || null,
      pendingOperations: stats?.pendingOperations || 0,
      deviceInfo
    };
  }

  /**
   * Enable auto-sync
   */
  enableAutoSync(intervalMinutes: number = 30): void {
    if (!this.syncManager) return;

    this.syncManager.updateConfig({
      autoSyncEnabled: true,
      autoSyncInterval: intervalMinutes
    });

    this.syncManager.startAutoSync();
    console.log(`Auto-sync enabled with ${intervalMinutes} minute interval`);
  }

  /**
   * Disable auto-sync
   */
  disableAutoSync(): void {
    if (!this.syncManager) return;

    this.syncManager.stopAutoSync();
    this.syncManager.updateConfig({ autoSyncEnabled: false });
    console.log('Auto-sync disabled');
  }

  /**
   * Manual sync trigger
   */
  async sync(): Promise<boolean> {
    if (!this.syncManager?.getProvider()?.isConnected) {
      throw new Error('Cloud sync not available');
    }

    try {
      const result = await this.syncManager.performSync();
      return result.success;
    } catch (error) {
      console.error('Manual sync failed:', error);
      return false;
    }
  }

  /**
   * Get sync manager instance
   */
  getSyncManager(): SyncManager | null {
    return this.syncManager;
  }

  /**
   * Cleanup on app shutdown
   */
  async cleanup(): Promise<void> {
    if (this.syncManager) {
      await this.syncManager.cleanup();
      this.syncManager = null;
    }
    this.isInitialized = false;
  }
}

/**
 * Example usage in main application
 */
export async function setupAppSync(knex: Knex): Promise<AppSyncIntegration> {
  const syncIntegration = new AppSyncIntegration(knex);
  await syncIntegration.initialize();
  return syncIntegration;
}

/**
 * Example notification handler integration
 */
export function createNotificationSyncHandler(syncManager: SyncManager) {
  return {
    async onCreate(notification: any) {
      // Trigger sync when notification is created
      await syncManager.queueOperation({
        operation: 'CREATE',
        entityType: 'notifications',
        entityId: notification.id,
        data: notification,
        timestamp: new Date(),
        deviceId: await syncManager.getLocalDevice().then(d => d.deviceId),
        version: 1
      });
    },

    async onUpdate(notification: any) {
      // Trigger sync when notification is updated
      await syncManager.queueOperation({
        operation: 'UPDATE',
        entityType: 'notifications',
        entityId: notification.id,
        data: notification,
        timestamp: new Date(),
        deviceId: await syncManager.getLocalDevice().then(d => d.deviceId),
        version: notification.sync_version + 1
      });
    },

    async onDelete(notificationId: string) {
      // Trigger sync when notification is deleted
      await syncManager.queueOperation({
        operation: 'DELETE',
        entityType: 'notifications',
        entityId: notificationId,
        data: {},
        timestamp: new Date(),
        deviceId: await syncManager.getLocalDevice().then(d => d.deviceId),
        version: 1
      });
    }
  };
}

/**
 * Example UI integration for Svelte
 */
export const createSyncStore = (syncIntegration: AppSyncIntegration) => {
  // This would integrate with Svelte stores or other reactive systems
  return {
    async getStatus() {
      return await syncIntegration.getSyncStatus();
    },

    async backup() {
      return await syncIntegration.backup();
    },

    async restore() {
      return await syncIntegration.restore();
    },

    async sync() {
      return await syncIntegration.sync();
    },

    enableAutoSync: (interval: number) => syncIntegration.enableAutoSync(interval),
    disableAutoSync: () => syncIntegration.disableAutoSync()
  };
};
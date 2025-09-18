/**
 * Progressive Cloud Sync System
 * 
 * A comprehensive sync system for the voice-terminal-hybrid application that provides:
 * - Local SQLite as primary source of truth
 * - Optional Supabase cloud integration
 * - Conflict resolution strategies
 * - Offline-first operation with retry mechanisms
 * - Device management and multi-device sync
 * 
 * @example Basic Usage
 * ```typescript
 * import { SyncManager } from './sync';
 * 
 * const syncManager = SyncManager.getInstance(knex);
 * await syncManager.initialize();
 * 
 * // Optional: Configure Supabase provider
 * if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
 *   await syncManager.createSupabaseProvider(
 *     process.env.SUPABASE_URL,
 *     process.env.SUPABASE_ANON_KEY,
 *     authToken
 *   );
 * }
 * 
 * // Perform operations
 * await syncManager.seed(); // Backup to cloud
 * await syncManager.sync(); // Two-way sync
 * ```
 */

// Core interfaces
export type {
  ISyncProvider,
  ISyncManager,
  SyncConfig,
  SyncMetadata,
  SyncOperation,
  SyncResult,
  SyncProgress,
  SyncProgressCallback,
  SyncConflict,
  SyncError,
  SyncStats,
  DeviceInfo,
  SyncEvent,
  SyncEventListener,
  ConflictResolver
} from './interfaces.js';

// Main sync manager
export { SyncManager } from './sync-manager.js';
export type { SyncManagerConfig } from './sync-manager.js';

// Providers
export { SupabaseProvider } from './supabase-provider.js';
export type { SupabaseConfig } from './supabase-provider.js';

// Device management
export { DeviceManager, DeviceUtils } from './device-manager.js';
export type { LocalDeviceConfig } from './device-manager.js';

// Conflict resolution
export { 
  ConflictResolver, 
  ConflictResolverFactory, 
  ConflictResolvers 
} from './conflict-resolver.js';
export type { 
  ConflictResolutionOptions, 
  ResolvedConflict 
} from './conflict-resolver.js';

// Metadata management
export { SyncMetadataManager } from './sync-metadata-manager.js';

// Retry mechanisms
export { RetryQueue } from './retry-queue.js';
export type { 
  RetryConfig, 
  QueuedOperation, 
  RetryStats 
} from './retry-queue.js';

// Predefined conflict resolution strategies
export { ConflictResolutionStrategies } from './interfaces.js';

/**
 * Factory function to create and initialize a sync manager
 */
export async function createSyncManager(
  knex: any, 
  config?: any
): Promise<SyncManager> {
  const syncManager = SyncManager.getInstance(knex, config);
  await syncManager.initialize();
  return syncManager;
}

/**
 * Utility function to create Supabase provider with validation
 */
export async function createSupabaseProvider(
  knex: any,
  config: {
    url: string;
    apiKey: string;
    authToken?: string;
  }
): Promise<SupabaseProvider> {
  const provider = new SupabaseProvider(config, knex);
  await provider.initialize();
  
  if (!await provider.validateConnection()) {
    throw new Error('Failed to validate Supabase connection');
  }
  
  return provider;
}

/**
 * Check if sync is available (environment variables set)
 */
export function isSyncAvailable(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/**
 * Get sync environment configuration
 */
export function getSyncConfig(): {
  url?: string;
  apiKey?: string;
  available: boolean;
} {
  return {
    url: process.env.SUPABASE_URL,
    apiKey: process.env.SUPABASE_ANON_KEY,
    available: isSyncAvailable()
  };
}

/**
 * Default export for convenience
 */
export default {
  SyncManager,
  SupabaseProvider,
  DeviceManager,
  ConflictResolver,
  ConflictResolverFactory,
  RetryQueue,
  createSyncManager,
  createSupabaseProvider,
  isSyncAvailable,
  getSyncConfig
};

/**
 * Version information
 */
export const SYNC_VERSION = '1.0.0';
export const SYNC_SCHEMA_VERSION = 1;
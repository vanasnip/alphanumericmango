# Progressive Cloud Sync System

A comprehensive synchronization system for the voice-terminal-hybrid application that provides seamless data sync between local SQLite and cloud providers while maintaining offline-first operation.

## Features

- **Local-First Architecture**: SQLite is always the primary source of truth
- **Optional Cloud Integration**: Activate sync only when credentials are provided
- **Multiple Provider Support**: Designed for extensibility (Supabase included)
- **Intelligent Conflict Resolution**: Multiple strategies for handling data conflicts
- **Offline Queue**: Retry failed operations with exponential backoff
- **Device Management**: Track and manage multiple devices per user
- **Real-time Progress**: Progress callbacks for UI integration

## Quick Start

### 1. Basic Setup

```typescript
import { createSyncManager } from './sync';
import { knex } from '../database/connection';

// Initialize sync manager
const syncManager = await createSyncManager(knex, {
  autoSyncEnabled: false,
  autoSyncInterval: 30, // minutes
  batchSize: 50,
  maxRetries: 3
});
```

### 2. Optional Supabase Integration

Add environment variables to activate cloud sync:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

```typescript
// Check if sync is available
if (isSyncAvailable()) {
  const provider = await syncManager.createSupabaseProvider(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    authToken // Optional authentication token
  );
}
```

### 3. Database Migration

Run the sync metadata migration:

```bash
npm run db:migrate
```

This creates the necessary sync tables in your SQLite database.

### 4. Cloud Schema Setup

Apply the Supabase schema to your cloud database:

```sql
-- Execute the contents of src/sync/supabase-schema.sql
-- in your Supabase SQL editor
```

## Sync Operations

### Seed (Backup)
One-way backup from local to cloud:

```typescript
const result = await syncManager.seed(['notifications', 'projects'], (progress) => {
  console.log(`${progress.percentage}% - ${progress.message}`);
});

console.log(`Seeded ${result.recordsProcessed} records`);
```

### Hydrate (Restore)
Pull from cloud to local (for new devices):

```typescript
const result = await syncManager.hydrate(['notifications'], (progress) => {
  console.log(`${progress.percentage}% - ${progress.message}`);
});

console.log(`Restored ${result.recordsProcessed} records`);
```

### Sync (Two-way)
Intelligent two-way synchronization:

```typescript
const result = await syncManager.sync(['notifications'], undefined, (progress) => {
  console.log(`${progress.percentage}% - ${progress.message}`);
});

console.log(`Synced ${result.recordsProcessed} records with ${result.conflicts.length} conflicts`);
```

## Conflict Resolution

### Built-in Strategies

```typescript
import { ConflictResolvers } from './sync';

// Newest timestamp wins
const resolver = ConflictResolvers.newestWins;

// Local changes always win
const resolver = ConflictResolvers.localWins;

// Remote changes always win
const resolver = ConflictResolvers.remoteWins;

// Custom notification resolver
const resolver = ConflictResolvers.notificationResolver;
```

### Custom Resolver

```typescript
const customResolver = async (conflict) => {
  // Custom logic based on your business rules
  if (conflict.entityType === 'notifications') {
    // Prefer read status from local
    if (conflict.localData.status === 'read') {
      return 'local';
    }
  }
  
  // Default to newest
  return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
};

await syncManager.sync(undefined, customResolver);
```

### Factory Resolvers

```typescript
import { ConflictResolverFactory } from './sync';

// Pre-configured resolvers for different entity types
const notificationResolver = ConflictResolverFactory.createNotificationResolver();
const projectResolver = ConflictResolverFactory.createProjectResolver();
const settingsResolver = ConflictResolverFactory.createSettingsResolver();
```

## Device Management

### Device Registration

```typescript
const deviceInfo = await syncManager.getLocalDevice();
console.log(`Device: ${deviceInfo.deviceName} (${deviceInfo.deviceId})`);

// Register with cloud
if (syncManager.getProvider()) {
  await syncManager.getProvider().registerDevice("My Laptop");
}
```

### Multi-Device Sync

```typescript
// Get all registered devices
const devices = await provider.getRegisteredDevices();
console.log(`Found ${devices.length} registered devices`);

// Deregister a device
await provider.deregisterDevice(deviceId);
```

## Event Handling

### Sync Events

```typescript
syncManager.addEventListener('sync_started', (event) => {
  console.log('Sync started:', event.data);
});

syncManager.addEventListener('sync_progress', (event) => {
  console.log('Progress:', event.data.progress);
});

syncManager.addEventListener('sync_completed', (event) => {
  console.log('Sync completed:', event.data.result);
});

syncManager.addEventListener('sync_error', (event) => {
  console.error('Sync error:', event.data.error);
});

syncManager.addEventListener('conflict_detected', (event) => {
  console.log('Conflict detected:', event.data);
});
```

## Auto-Sync

### Enable Auto-Sync

```typescript
syncManager.updateConfig({
  autoSyncEnabled: true,
  autoSyncInterval: 15 // 15 minutes
});

syncManager.startAutoSync();
```

### Disable Auto-Sync

```typescript
syncManager.stopAutoSync();
```

## Retry Queue

### Queue Statistics

```typescript
import { RetryQueue } from './sync';

const retryQueue = new RetryQueue(knex);
const stats = await retryQueue.getStats();

console.log(`Pending: ${stats.pending}, Failed: ${stats.failed}`);
```

### Manual Queue Management

```typescript
// Clear completed operations
await retryQueue.clearCompleted(24); // older than 24 hours

// Retry all failed operations
await retryQueue.retryAllFailed();

// Clear all failed operations
await retryQueue.clearFailed();
```

## Monitoring & Statistics

### Sync Statistics

```typescript
const stats = await syncManager.getSyncStats();

console.log(`Total records: ${stats.totalRecords}`);
console.log(`Last sync: ${stats.lastSyncTime}`);
console.log(`Pending operations: ${stats.pendingOperations}`);
console.log(`Conflicts resolved: ${stats.conflictsResolved}`);

// Recent sync history
stats.syncHistory.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.operation} - ${entry.recordsProcessed} records`);
});
```

### Provider Status

```typescript
const provider = syncManager.getProvider();

if (provider) {
  console.log(`Provider: ${provider.name}`);
  console.log(`Connected: ${provider.isConnected}`);
  
  const connectionValid = await provider.validateConnection();
  console.log(`Connection valid: ${connectionValid}`);
}
```

## Environment Variables

Required for Supabase integration:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional: Auto-sync settings
SYNC_AUTO_ENABLED=true
SYNC_INTERVAL_MINUTES=30
SYNC_BATCH_SIZE=50
SYNC_MAX_RETRIES=3
```

## Error Handling

### Common Errors

```typescript
try {
  await syncManager.sync();
} catch (error) {
  if (error.message.includes('Not connected')) {
    // Handle connection issues
    console.log('Sync provider not connected');
  } else if (error.message.includes('Authentication')) {
    // Handle auth issues
    console.log('Authentication failed');
  } else {
    // Handle other errors
    console.error('Sync failed:', error);
  }
}
```

### Graceful Degradation

```typescript
// The app works perfectly without sync
const syncAvailable = isSyncAvailable();

if (syncAvailable) {
  // Enable sync features in UI
  console.log('Cloud sync available');
} else {
  // Hide sync features, app continues normally
  console.log('Running in offline-only mode');
}
```

## Migration Guide

### From No Sync to Sync

1. **Run Migration**: `npm run db:migrate`
2. **Set Environment Variables**: Add Supabase credentials
3. **Initialize Sync**: Create sync manager in your app
4. **Seed Initial Data**: Run `syncManager.seed()` once
5. **Enable Auto-Sync**: Configure as needed

### Schema Changes

When adding new entity types to sync:

1. **Update Local Schema**: Add sync columns to your tables
2. **Update Cloud Schema**: Add corresponding tables to Supabase
3. **Update Providers**: Modify sync logic for new entities
4. **Test Thoroughly**: Ensure conflict resolution works correctly

## Performance Considerations

### Batch Sizes

```typescript
// Adjust based on your data size
syncManager.updateConfig({
  batchSize: 100 // Larger batches for better performance
});
```

### Selective Sync

```typescript
// Only sync specific entity types
await syncManager.sync(['notifications']); // Skip other entities
```

### Debounced Sync

```typescript
let syncTimeout;

function triggerSync() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncManager.performSync().catch(console.error);
  }, 5000); // Wait 5 seconds after last change
}
```

## Security Considerations

1. **Authentication**: Always use proper authentication tokens
2. **Row Level Security**: Supabase RLS policies protect user data
3. **Device IDs**: Unique device identification prevents conflicts
4. **Encryption**: Consider encrypting sensitive data before sync
5. **Access Control**: Limit sync permissions appropriately

## Troubleshooting

### Common Issues

1. **Sync Not Working**: Check environment variables and connection
2. **Conflicts**: Review conflict resolution strategies
3. **Performance**: Adjust batch sizes and sync intervals
4. **Storage**: Monitor device storage for large sync queues

### Debug Mode

```typescript
// Enable verbose logging
console.log('Sync config:', syncManager.getConfig());
console.log('Device info:', await syncManager.getLocalDevice());
console.log('Sync stats:', await syncManager.getSyncStats());
```

### Health Check

```typescript
async function healthCheck() {
  const provider = syncManager.getProvider();
  
  if (!provider) {
    return { status: 'no-provider', message: 'No sync provider configured' };
  }
  
  if (!provider.isConnected) {
    return { status: 'disconnected', message: 'Provider not connected' };
  }
  
  const isValid = await provider.validateConnection();
  if (!isValid) {
    return { status: 'invalid', message: 'Connection validation failed' };
  }
  
  return { status: 'healthy', message: 'Sync system operational' };
}
```

## Contributing

When adding new features:

1. **Follow Interfaces**: Implement required interfaces fully
2. **Add Tests**: Include comprehensive test coverage
3. **Update Documentation**: Keep this README current
4. **Consider Backward Compatibility**: Don't break existing sync data

## License

This sync system is part of the voice-terminal-hybrid project and follows the same license terms.
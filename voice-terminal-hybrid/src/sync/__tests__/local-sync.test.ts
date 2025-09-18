/**
 * Local Sync Tests
 * Tests local-only operation without cloud synchronization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createMockNotification, createMockUser, createMockProject } from '../../test/mock-data';
import { LocalSyncManager } from '../local-sync-manager';

describe('Local Sync Operations', () => {
  let testDb: TestDatabase;
  let syncManager: LocalSyncManager;
  let projectId: string;
  let userId: string;

  beforeEach(() => {
    testDb = createTestDatabase('local-sync-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    projectId = seededData.projectId;
    userId = seededData.userId;

    syncManager = new LocalSyncManager(testDb.db);
  });

  afterEach(() => {
    syncManager.cleanup();
    testDb.cleanup();
  });

  describe('Local State Management', () => {
    it('should track local changes for notifications', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create notification
      const stmt = testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, body, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(notification.id, notification.project_id, notification.user_id, notification.body, notification.status);

      // Track as local change
      syncManager.trackLocalChange('notifications', notification.id, 'insert');

      const changes = syncManager.getPendingChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].table_name).toBe('notifications');
      expect(changes[0].record_id).toBe(notification.id);
      expect(changes[0].operation).toBe('insert');
      expect(changes[0].sync_status).toBe('pending');
    });

    it('should track updates to existing records', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create notification
      testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, body, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(notification.id, notification.project_id, notification.user_id, notification.body, 'pending');

      // Update notification
      testDb.db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('sent', notification.id);
      
      // Track update
      syncManager.trackLocalChange('notifications', notification.id, 'update');

      const changes = syncManager.getPendingChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('update');
    });

    it('should track deletions', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create and then delete notification
      testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, body, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(notification.id, notification.project_id, notification.user_id, notification.body, 'pending');

      testDb.db.prepare('DELETE FROM notifications WHERE id = ?').run(notification.id);
      
      // Track deletion
      syncManager.trackLocalChange('notifications', notification.id, 'delete');

      const changes = syncManager.getPendingChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('delete');
    });

    it('should handle multiple changes to same record', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Track multiple operations on same record
      syncManager.trackLocalChange('notifications', notification.id, 'insert');
      syncManager.trackLocalChange('notifications', notification.id, 'update');
      syncManager.trackLocalChange('notifications', notification.id, 'update');

      const changes = syncManager.getPendingChanges();
      
      // Should consolidate into single change with latest operation
      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('update');
    });

    it('should handle insert followed by delete', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Track insert then delete
      syncManager.trackLocalChange('notifications', notification.id, 'insert');
      syncManager.trackLocalChange('notifications', notification.id, 'delete');

      const changes = syncManager.getPendingChanges();
      
      // Should remove the change entirely since record was created and deleted locally
      expect(changes).toHaveLength(0);
    });
  });

  describe('Change Queue Management', () => {
    it('should queue changes in chronological order', () => {
      const notifications = Array.from({ length: 5 }, () => createMockNotification(projectId, userId));
      
      // Track changes with small delays to ensure order
      notifications.forEach((notif, index) => {
        setTimeout(() => {
          syncManager.trackLocalChange('notifications', notif.id, 'insert');
        }, index * 10);
      });

      // Wait for all changes to be tracked
      setTimeout(() => {
        const changes = syncManager.getPendingChanges();
        expect(changes).toHaveLength(5);
        
        // Verify chronological order
        for (let i = 1; i < changes.length; i++) {
          expect(new Date(changes[i].created_at).getTime())
            .toBeGreaterThanOrEqual(new Date(changes[i-1].created_at).getTime());
        }
      }, 100);
    });

    it('should limit queue size and remove oldest entries', () => {
      const maxQueueSize = 1000;
      syncManager.setMaxQueueSize(maxQueueSize);

      // Add more changes than max queue size
      for (let i = 0; i < maxQueueSize + 100; i++) {
        const notif = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notif.id, 'insert');
      }

      const changes = syncManager.getPendingChanges();
      expect(changes.length).toBeLessThanOrEqual(maxQueueSize);
    });

    it('should persist queue across restarts', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Track change
      syncManager.trackLocalChange('notifications', notification.id, 'insert');
      expect(syncManager.getPendingChanges()).toHaveLength(1);

      // Simulate restart by creating new sync manager
      const newSyncManager = new LocalSyncManager(testDb.db);
      expect(newSyncManager.getPendingChanges()).toHaveLength(1);
      
      newSyncManager.cleanup();
    });

    it('should batch process large queues efficiently', () => {
      const batchSize = 100;
      const notifications = Array.from({ length: 500 }, () => createMockNotification(projectId, userId));
      
      // Track all changes
      notifications.forEach(notif => {
        syncManager.trackLocalChange('notifications', notif.id, 'insert');
      });

      const startTime = Date.now();
      const batches = syncManager.getBatchedChanges(batchSize);
      const processingTime = Date.now() - startTime;

      expect(batches).toHaveLength(5); // 500 / 100 = 5 batches
      expect(batches[0]).toHaveLength(batchSize);
      expect(processingTime).toBeLessThan(1000); // Should process quickly
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicting changes to same record', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create notification
      testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, body, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        notification.id, 
        notification.project_id, 
        notification.user_id, 
        notification.body, 
        'pending',
        new Date().toISOString()
      );

      // Simulate two different local changes
      syncManager.trackLocalChange('notifications', notification.id, 'update', { 
        field: 'status', 
        old_value: 'pending', 
        new_value: 'sent' 
      });

      syncManager.trackLocalChange('notifications', notification.id, 'update', { 
        field: 'status', 
        old_value: 'pending', 
        new_value: 'failed' 
      });

      const conflicts = syncManager.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].record_id).toBe(notification.id);
      expect(conflicts[0].conflict_type).toBe('concurrent_update');
    });

    it('should resolve conflicts using last-write-wins strategy', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Track conflicting changes
      syncManager.trackLocalChange('notifications', notification.id, 'update', { timestamp: '2023-01-01T10:00:00Z' });
      syncManager.trackLocalChange('notifications', notification.id, 'update', { timestamp: '2023-01-01T11:00:00Z' });

      syncManager.resolveConflicts('last_write_wins');

      const changes = syncManager.getPendingChanges();
      expect(changes).toHaveLength(1);
      
      // Should keep the later change
      const changeData = JSON.parse(changes[0].change_data || '{}');
      expect(changeData.timestamp).toBe('2023-01-01T11:00:00Z');
    });

    it('should handle complex multi-field conflicts', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Simulate complex conflict scenario
      syncManager.trackLocalChange('notifications', notification.id, 'update', {
        fields: {
          status: { old: 'pending', new: 'sent' },
          sent_at: { old: null, new: '2023-01-01T10:00:00Z' }
        }
      });

      syncManager.trackLocalChange('notifications', notification.id, 'update', {
        fields: {
          status: { old: 'pending', new: 'failed' },
          error_message: { old: null, new: 'Network error' }
        }
      });

      const conflicts = syncManager.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflict_details).toContain('status');
    });
  });

  describe('Data Validation', () => {
    it('should validate data integrity before syncing', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create notification with missing required field
      testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, status)
        VALUES (?, ?, ?, ?)
      `).run(notification.id, notification.project_id, notification.user_id, 'pending');
      // Note: Missing required 'body' field

      syncManager.trackLocalChange('notifications', notification.id, 'insert');

      const validationResults = syncManager.validatePendingChanges();
      expect(validationResults.valid).toBe(false);
      expect(validationResults.errors).toHaveLength(1);
      expect(validationResults.errors[0]).toContain('body');
    });

    it('should validate foreign key constraints', () => {
      const notification = createMockNotification('nonexistent-project', userId);
      
      syncManager.trackLocalChange('notifications', notification.id, 'insert');

      const validationResults = syncManager.validatePendingChanges();
      expect(validationResults.valid).toBe(false);
      expect(validationResults.errors[0]).toContain('project');
    });

    it('should validate data types and constraints', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Create notification with invalid data
      testDb.db.prepare(`
        INSERT INTO notifications (id, project_id, user_id, body, priority)
        VALUES (?, ?, ?, ?, ?)
      `).run(notification.id, notification.project_id, notification.user_id, notification.body, 'invalid_priority');

      syncManager.trackLocalChange('notifications', notification.id, 'insert');

      const validationResults = syncManager.validatePendingChanges();
      expect(validationResults.valid).toBe(false);
      expect(validationResults.errors[0]).toContain('priority');
    });
  });

  describe('Performance Optimization', () => {
    it('should efficiently handle large datasets', () => {
      const recordCount = 10000;
      
      const startTime = Date.now();
      
      // Create large number of changes
      for (let i = 0; i < recordCount; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }
      
      const trackingTime = Date.now() - startTime;
      expect(trackingTime).toBeLessThan(5000); // Should complete within 5 seconds

      const queryStartTime = Date.now();
      const changes = syncManager.getPendingChanges();
      const queryTime = Date.now() - queryStartTime;
      
      expect(changes).toHaveLength(recordCount);
      expect(queryTime).toBeLessThan(1000); // Query should be fast
    });

    it('should use database indexes effectively', () => {
      // Create test data
      for (let i = 0; i < 1000; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }

      const startTime = Date.now();
      
      // Query by status (should use index)
      const pendingChanges = syncManager.getPendingChangesByStatus('pending');
      
      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(100); // Should be very fast with index
      expect(pendingChanges.length).toBeGreaterThan(0);
    });

    it('should compress large change payloads', () => {
      const largeData = {
        large_field: 'x'.repeat(10000),
        array_field: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` }))
      };

      const notification = createMockNotification(projectId, userId);
      syncManager.trackLocalChange('notifications', notification.id, 'insert', largeData);

      const changes = syncManager.getPendingChanges();
      const storedData = changes[0].change_data;
      
      // Should compress large payloads
      expect(storedData.length).toBeLessThan(JSON.stringify(largeData).length);
    });
  });

  describe('Recovery and Cleanup', () => {
    it('should recover from corrupted change queue', () => {
      // Add valid changes
      for (let i = 0; i < 10; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }

      // Simulate corruption by manually inserting invalid data
      testDb.db.prepare(`
        INSERT INTO sync_changes (table_name, record_id, operation, change_data, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('notifications', 'invalid-id', 'invalid-op', 'corrupted-json', new Date().toISOString());

      // Should recover gracefully
      const changes = syncManager.getPendingChanges();
      expect(changes).toHaveLength(10); // Should skip corrupted entry

      const cleanupResult = syncManager.cleanupCorruptedEntries();
      expect(cleanupResult.removedCount).toBe(1);
    });

    it('should cleanup completed sync operations', () => {
      // Add changes and mark some as completed
      for (let i = 0; i < 20; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }

      // Mark first 10 as completed
      const changes = syncManager.getPendingChanges();
      changes.slice(0, 10).forEach(change => {
        syncManager.markChangeAsCompleted(change.id);
      });

      expect(syncManager.getPendingChanges()).toHaveLength(10);

      // Cleanup completed changes
      const cleanupResult = syncManager.cleanupCompletedChanges();
      expect(cleanupResult.removedCount).toBe(10);
    });

    it('should maintain referential integrity during cleanup', () => {
      const notification = createMockNotification(projectId, userId);
      
      // Track change and create dependent records
      syncManager.trackLocalChange('notifications', notification.id, 'insert');
      
      testDb.db.prepare(`
        INSERT INTO events (notification_id, event_type, event_data, created_at)
        VALUES (?, 'test', '{}', ?)
      `).run(notification.id, new Date().toISOString());

      // Cleanup should respect referential integrity
      const cleanupResult = syncManager.cleanupWithReferentialIntegrity();
      expect(cleanupResult.errors).toHaveLength(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track sync statistics', () => {
      // Generate test data
      for (let i = 0; i < 50; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }

      // Mark some as completed
      const changes = syncManager.getPendingChanges();
      changes.slice(0, 20).forEach(change => {
        syncManager.markChangeAsCompleted(change.id);
      });

      const stats = syncManager.getStatistics();
      expect(stats.totalChanges).toBe(50);
      expect(stats.pendingChanges).toBe(30);
      expect(stats.completedChanges).toBe(20);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track performance metrics', () => {
      const startTime = Date.now();
      
      // Perform operations
      for (let i = 0; i < 100; i++) {
        const notification = createMockNotification(projectId, userId);
        syncManager.trackLocalChange('notifications', notification.id, 'insert');
      }

      const metrics = syncManager.getPerformanceMetrics();
      expect(metrics.operationsPerSecond).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.peakMemoryUsage).toBeGreaterThan(0);
    });

    it('should provide health check information', () => {
      const health = syncManager.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.queueSize).toBeGreaterThanOrEqual(0);
      expect(health.lastSyncAttempt).toBeDefined();
      expect(health.errors).toHaveLength(0);
    });
  });
});
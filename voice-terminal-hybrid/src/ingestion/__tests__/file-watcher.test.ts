/**
 * File Watcher Ingestion Tests
 * Tests file-based notification ingestion and JSON processing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createMockNotification, createInvalidPayloads } from '../../test/mock-data';
import { NotificationFileWatcher } from '../file-watcher';

describe('File Watcher Ingestion', () => {
  let testDb: TestDatabase;
  let fileWatcher: NotificationFileWatcher;
  let watchDir: string;
  let projectId: string;
  let userId: string;

  beforeAll(() => {
    testDb = createTestDatabase('file-watcher-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    projectId = seededData.projectId;
    userId = seededData.userId;

    // Create temporary directory for file watching
    watchDir = join(tmpdir(), `file-watcher-test-${Date.now()}`);
    mkdirSync(watchDir, { recursive: true });

    fileWatcher = new NotificationFileWatcher(testDb.db, watchDir);
  });

  afterAll(async () => {
    await fileWatcher.stop();
    if (existsSync(watchDir)) {
      rmSync(watchDir, { recursive: true, force: true });
    }
    testDb.cleanup();
  });

  beforeEach(async () => {
    await fileWatcher.start();
  });

  afterEach(async () => {
    await fileWatcher.stop();
    
    // Clean up any remaining files
    const files = require('fs').readdirSync(watchDir);
    files.forEach((file: string) => {
      const filePath = join(watchDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });
  });

  describe('File Detection', () => {
    it('should detect new JSON files', async () => {
      const notification = createMockNotification(projectId, userId);
      const filePath = join(watchDir, 'test-notification.json');

      const fileData = {
        user_id: notification.user_id,
        body: notification.body,
        subject: notification.subject,
        channel: notification.channel,
        priority: notification.priority
      };

      writeFileSync(filePath, JSON.stringify(fileData, null, 2));

      // Wait for file processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was created
      const notifications = testDb.db.prepare('SELECT * FROM notifications WHERE body = ?').all(notification.body);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toBe(notification.user_id);
    });

    it('should only process JSON files', async () => {
      const textFilePath = join(watchDir, 'not-json.txt');
      const xmlFilePath = join(watchDir, 'not-json.xml');

      writeFileSync(textFilePath, 'This is not a JSON file');
      writeFileSync(xmlFilePath, '<xml>This is XML</xml>');

      // Wait for potential processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify no notifications were created
      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);

      // Files should still exist (not processed)
      expect(existsSync(textFilePath)).toBe(true);
      expect(existsSync(xmlFilePath)).toBe(true);
    });

    it('should ignore hidden files and temporary files', async () => {
      const hiddenFile = join(watchDir, '.hidden-file.json');
      const tempFile = join(watchDir, 'temp-file.tmp');
      const swapFile = join(watchDir, 'file.json.swp');

      const validData = { user_id: userId, body: 'test' };

      writeFileSync(hiddenFile, JSON.stringify(validData));
      writeFileSync(tempFile, JSON.stringify(validData));
      writeFileSync(swapFile, JSON.stringify(validData));

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);
    });

    it('should handle nested directory structures', async () => {
      const subDir = join(watchDir, 'subdirectory');
      mkdirSync(subDir, { recursive: true });

      const notification = createMockNotification(projectId, userId);
      const filePath = join(subDir, 'nested-notification.json');

      const fileData = {
        user_id: notification.user_id,
        body: notification.body
      };

      writeFileSync(filePath, JSON.stringify(fileData));

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifications = testDb.db.prepare('SELECT * FROM notifications WHERE body = ?').all(notification.body);
      expect(notifications).toHaveLength(1);
    });
  });

  describe('JSON Parsing and Validation', () => {
    it('should parse valid JSON files correctly', async () => {
      const notification = {
        user_id: userId,
        body: 'Valid JSON notification',
        subject: 'Test Subject',
        channel: 'email',
        priority: 'high',
        data: {
          custom_field: 'custom_value',
          timestamp: Date.now()
        }
      };

      const filePath = join(watchDir, 'valid-notification.json');
      writeFileSync(filePath, JSON.stringify(notification, null, 2));

      await new Promise(resolve => setTimeout(resolve, 100));

      const created = testDb.db.prepare('SELECT * FROM notifications WHERE body = ?').get(notification.body);
      expect(created).toBeTruthy();
      expect(created.subject).toBe(notification.subject);
      expect(created.channel).toBe(notification.channel);
      expect(created.priority).toBe(notification.priority);
      expect(JSON.parse(created.data)).toEqual(notification.data);
    });

    it('should handle malformed JSON gracefully', async () => {
      const filePath = join(watchDir, 'malformed.json');
      writeFileSync(filePath, '{ invalid json }');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not create any notifications
      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);

      // File should be moved to error directory
      const errorDir = join(watchDir, 'errors');
      expect(existsSync(errorDir)).toBe(true);
      expect(existsSync(join(errorDir, 'malformed.json'))).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidPayloads = [
        {}, // Missing required fields
        { user_id: userId }, // Missing body
        { body: 'test' }, // Missing user_id
        { user_id: '', body: 'test' }, // Empty user_id
        { user_id: userId, body: '' } // Empty body
      ];

      for (let i = 0; i < invalidPayloads.length; i++) {
        const filePath = join(watchDir, `invalid-${i}.json`);
        writeFileSync(filePath, JSON.stringify(invalidPayloads[i]));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not create any notifications
      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);

      // All files should be moved to error directory
      const errorDir = join(watchDir, 'errors');
      expect(existsSync(errorDir)).toBe(true);
      
      for (let i = 0; i < invalidPayloads.length; i++) {
        expect(existsSync(join(errorDir, `invalid-${i}.json`))).toBe(true);
      }
    });

    it('should validate field types and constraints', async () => {
      const invalidData = [
        { user_id: 123, body: 'test' }, // Invalid user_id type
        { user_id: userId, body: null }, // Invalid body type
        { user_id: userId, body: 'test', priority: 'invalid' }, // Invalid priority
        { user_id: userId, body: 'test', channel: 'invalid' } // Invalid channel
      ];

      for (let i = 0; i < invalidData.length; i++) {
        const filePath = join(watchDir, `type-invalid-${i}.json`);
        writeFileSync(filePath, JSON.stringify(invalidData[i]));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);
    });

    it('should handle large JSON files', async () => {
      const largeData = {
        user_id: userId,
        body: 'A'.repeat(5000), // 5KB body
        data: {
          large_field: 'B'.repeat(10000) // 10KB data field
        }
      };

      const filePath = join(watchDir, 'large-file.json');
      writeFileSync(filePath, JSON.stringify(largeData));

      await new Promise(resolve => setTimeout(resolve, 200));

      const notifications = testDb.db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(userId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].body.length).toBe(5000);
    });

    it('should reject excessively large files', async () => {
      const hugeData = {
        user_id: userId,
        body: 'test',
        data: {
          huge_field: 'X'.repeat(10 * 1024 * 1024) // 10MB field
        }
      };

      const filePath = join(watchDir, 'huge-file.json');
      writeFileSync(filePath, JSON.stringify(hugeData));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not create notification due to size limit
      const notifications = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(notifications).toHaveLength(0);

      // File should be moved to error directory
      const errorDir = join(watchDir, 'errors');
      expect(existsSync(join(errorDir, 'huge-file.json'))).toBe(true);
    });
  });

  describe('File Processing Workflow', () => {
    it('should move processed files to processed directory', async () => {
      const notification = {
        user_id: userId,
        body: 'Successfully processed notification'
      };

      const filePath = join(watchDir, 'to-process.json');
      writeFileSync(filePath, JSON.stringify(notification));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Original file should be moved
      expect(existsSync(filePath)).toBe(false);

      // Should be in processed directory
      const processedDir = join(watchDir, 'processed');
      expect(existsSync(processedDir)).toBe(true);
      expect(existsSync(join(processedDir, 'to-process.json'))).toBe(true);

      // Notification should be created
      const notifications = testDb.db.prepare('SELECT * FROM notifications WHERE body = ?').all(notification.body);
      expect(notifications).toHaveLength(1);
    });

    it('should move failed files to error directory with error log', async () => {
      const invalidData = { invalid: 'data' };
      const filePath = join(watchDir, 'invalid-data.json');
      writeFileSync(filePath, JSON.stringify(invalidData));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Original file should be moved to errors
      expect(existsSync(filePath)).toBe(false);
      
      const errorDir = join(watchDir, 'errors');
      expect(existsSync(join(errorDir, 'invalid-data.json'))).toBe(true);

      // Error log should be created
      expect(existsSync(join(errorDir, 'invalid-data.json.error'))).toBe(true);
      
      const errorLog = require('fs').readFileSync(join(errorDir, 'invalid-data.json.error'), 'utf8');
      expect(errorLog).toContain('validation');
    });

    it('should handle concurrent file processing', async () => {
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        user_id: userId,
        body: `Concurrent notification ${i}`,
        data: { index: i }
      }));

      // Write all files simultaneously
      notifications.forEach((notif, i) => {
        const filePath = join(watchDir, `concurrent-${i}.json`);
        writeFileSync(filePath, JSON.stringify(notif));
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // All notifications should be created
      const created = testDb.db.prepare('SELECT * FROM notifications ORDER BY created_at').all();
      expect(created).toHaveLength(10);

      // All files should be processed
      notifications.forEach((_, i) => {
        expect(existsSync(join(watchDir, `concurrent-${i}.json`))).toBe(false);
      });
    });

    it('should handle file system errors gracefully', async () => {
      const notification = { user_id: userId, body: 'test' };
      const filePath = join(watchDir, 'readonly-test.json');
      
      writeFileSync(filePath, JSON.stringify(notification));
      
      // Make directory read-only to simulate permission error
      const processedDir = join(watchDir, 'processed');
      mkdirSync(processedDir, { recursive: true });
      require('fs').chmodSync(processedDir, 0o444); // Read-only

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle gracefully without crashing
      expect(fileWatcher.isRunning()).toBe(true);

      // Restore permissions for cleanup
      require('fs').chmodSync(processedDir, 0o755);
    });
  });

  describe('Batch File Processing', () => {
    it('should process array of notifications in single file', async () => {
      const notifications = [
        { user_id: userId, body: 'Batch notification 1' },
        { user_id: userId, body: 'Batch notification 2' },
        { user_id: userId, body: 'Batch notification 3' }
      ];

      const filePath = join(watchDir, 'batch-notifications.json');
      writeFileSync(filePath, JSON.stringify(notifications));

      await new Promise(resolve => setTimeout(resolve, 150));

      const created = testDb.db.prepare('SELECT * FROM notifications ORDER BY created_at').all();
      expect(created).toHaveLength(3);
      expect(created.map(n => n.body)).toEqual([
        'Batch notification 1',
        'Batch notification 2', 
        'Batch notification 3'
      ]);
    });

    it('should handle mixed valid and invalid notifications in batch', async () => {
      const mixedBatch = [
        { user_id: userId, body: 'Valid notification 1' },
        { user_id: '', body: 'Invalid notification' }, // Invalid user_id
        { user_id: userId, body: 'Valid notification 2' },
        { invalid: 'data' } // Missing required fields
      ];

      const filePath = join(watchDir, 'mixed-batch.json');
      writeFileSync(filePath, JSON.stringify(mixedBatch));

      await new Promise(resolve => setTimeout(resolve, 150));

      // Only valid notifications should be created
      const created = testDb.db.prepare('SELECT * FROM notifications ORDER BY created_at').all();
      expect(created).toHaveLength(2);
      expect(created.map(n => n.body)).toEqual([
        'Valid notification 1',
        'Valid notification 2'
      ]);

      // File should be moved to processed (partial success)
      const processedDir = join(watchDir, 'processed');
      expect(existsSync(join(processedDir, 'mixed-batch.json'))).toBe(true);
    });

    it('should enforce batch size limits', async () => {
      const largeBatch = Array.from({ length: 150 }, (_, i) => ({
        user_id: userId,
        body: `Large batch notification ${i}`
      }));

      const filePath = join(watchDir, 'large-batch.json');
      writeFileSync(filePath, JSON.stringify(largeBatch));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should reject entire batch if over limit
      const created = testDb.db.prepare('SELECT * FROM notifications').all();
      expect(created).toHaveLength(0);

      // File should be moved to errors
      const errorDir = join(watchDir, 'errors');
      expect(existsSync(join(errorDir, 'large-batch.json'))).toBe(true);
    });
  });

  describe('Error Recovery and Monitoring', () => {
    it('should create detailed error logs', async () => {
      const invalidData = {
        user_id: 'nonexistent-user',
        body: 'This will fail foreign key constraint'
      };

      const filePath = join(watchDir, 'fk-error.json');
      writeFileSync(filePath, JSON.stringify(invalidData));

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorLogPath = join(watchDir, 'errors', 'fk-error.json.error');
      expect(existsSync(errorLogPath)).toBe(true);

      const errorLog = require('fs').readFileSync(errorLogPath, 'utf8');
      const errorData = JSON.parse(errorLog);
      
      expect(errorData.timestamp).toBeDefined();
      expect(errorData.error).toBeDefined();
      expect(errorData.file_path).toBeDefined();
      expect(errorData.file_content).toBeDefined();
    });

    it('should track processing statistics', async () => {
      // Process successful files
      for (let i = 0; i < 5; i++) {
        const filePath = join(watchDir, `success-${i}.json`);
        writeFileSync(filePath, JSON.stringify({ user_id: userId, body: `Success ${i}` }));
      }

      // Process failed files
      for (let i = 0; i < 3; i++) {
        const filePath = join(watchDir, `failure-${i}.json`);
        writeFileSync(filePath, JSON.stringify({ invalid: 'data' }));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = fileWatcher.getStatistics();
      expect(stats.filesProcessed).toBe(8);
      expect(stats.filesSuccessful).toBe(5);
      expect(stats.filesFailed).toBe(3);
      expect(stats.notificationsCreated).toBe(5);
    });
  });
});
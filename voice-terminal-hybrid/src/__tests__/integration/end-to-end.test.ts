/**
 * End-to-End Integration Tests
 * Tests complete notification flow from ingestion to delivery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createMockNotification, createMockUser, createMockProject } from '../../test/mock-data';
import { NotificationWebhookServer } from '../../ingestion/webhook-server';
import { NotificationWebSocketServer } from '../../ingestion/websocket-server';
import { NotificationFileWatcher } from '../../ingestion/file-watcher';
import { LocalSyncManager } from '../../sync/local-sync-manager';
import request from 'supertest';
import WebSocket from 'ws';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('End-to-End Integration Tests', () => {
  let testDb: TestDatabase;
  let webhookServer: NotificationWebhookServer;
  let wsServer: NotificationWebSocketServer;
  let fileWatcher: NotificationFileWatcher;
  let syncManager: LocalSyncManager;
  let webhookApp: any;
  let wsPort: number;
  let watchDir: string;
  let projectId: string;
  let userId: string;
  let validApiKey: string;

  beforeAll(async () => {
    // Setup database
    testDb = createTestDatabase('e2e-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    projectId = seededData.projectId;
    userId = seededData.userId;
    validApiKey = 'test-api-key-123';

    // Setup servers and services
    webhookApp = createNotificationWebhookServer(testDb.db);
    
    wsServer = new NotificationWebSocketServer(testDb.db);
    wsPort = await wsServer.start(0);

    watchDir = join(tmpdir(), `e2e-test-${Date.now()}`);
    mkdirSync(watchDir, { recursive: true });
    fileWatcher = new NotificationFileWatcher(testDb.db, watchDir);
    await fileWatcher.start();

    syncManager = new LocalSyncManager(testDb.db);
  });

  afterAll(async () => {
    await wsServer.stop();
    await fileWatcher.stop();
    syncManager.cleanup();
    
    if (watchDir) {
      rmSync(watchDir, { recursive: true, force: true });
    }
    
    testDb.cleanup();
  });

  beforeEach(() => {
    // Clear notifications for clean test state
    testDb.db.prepare('DELETE FROM notifications').run();
    testDb.db.prepare('DELETE FROM events').run();
    syncManager.reset();
  });

  describe('Multi-Channel Notification Ingestion', () => {
    it('should handle notifications from webhook, websocket, and file sources', async () => {
      const baseNotification = {
        user_id: userId,
        body: 'Multi-channel test notification',
        priority: 'high'
      };

      // 1. Webhook ingestion
      const webhookResponse = await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({ ...baseNotification, subject: 'Webhook notification' });

      expect(webhookResponse.status).toBe(201);
      expect(webhookResponse.body.notification_id).toBeDefined();

      // 2. WebSocket ingestion
      const ws = new WebSocket(`ws://localhost:${wsPort}?api_key=${validApiKey}`);
      
      const wsResponse = await new Promise<any>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'notification',
            data: { ...baseNotification, subject: 'WebSocket notification' }
          }));
        });

        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
          ws.close();
        });
      });

      expect(wsResponse.success).toBe(true);
      expect(wsResponse.notification_id).toBeDefined();

      // 3. File ingestion
      const fileNotification = { ...baseNotification, subject: 'File notification' };
      const filePath = join(watchDir, 'test-notification.json');
      writeFileSync(filePath, JSON.stringify(fileNotification));

      // Wait for file processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all notifications were created
      const notifications = testDb.db.prepare(`
        SELECT * FROM notifications 
        WHERE body = ? 
        ORDER BY created_at
      `).all(baseNotification.body);

      expect(notifications).toHaveLength(3);
      expect(notifications[0].subject).toBe('Webhook notification');
      expect(notifications[1].subject).toBe('WebSocket notification');
      expect(notifications[2].subject).toBe('File notification');

      // Verify events were logged for each source
      const events = testDb.db.prepare('SELECT * FROM events ORDER BY created_at').all();
      expect(events).toHaveLength(3);
      
      const eventSources = events.map(e => JSON.parse(e.event_data).source);
      expect(eventSources).toContain('webhook');
      expect(eventSources).toContain('websocket');
      expect(eventSources).toContain('file_watcher');
    });

    it('should maintain data consistency across all ingestion channels', async () => {
      const testData = {
        user_id: userId,
        body: 'Consistency test',
        channel: 'email',
        priority: 'critical',
        data: {
          test_field: 'test_value',
          timestamp: new Date().toISOString()
        }
      };

      // Send through webhook
      await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(testData);

      // Send through websocket
      const ws = new WebSocket(`ws://localhost:${wsPort}?api_key=${validApiKey}`);
      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'notification',
            data: testData
          }));
        });
        ws.on('message', () => {
          ws.close();
          resolve();
        });
      });

      // Send through file
      const filePath = join(watchDir, 'consistency-test.json');
      writeFileSync(filePath, JSON.stringify(testData));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all have identical core data
      const notifications = testDb.db.prepare(`
        SELECT * FROM notifications 
        WHERE body = ? AND channel = ? AND priority = ?
      `).all(testData.body, testData.channel, testData.priority);

      expect(notifications).toHaveLength(3);
      
      notifications.forEach(notif => {
        expect(notif.user_id).toBe(userId);
        expect(notif.body).toBe(testData.body);
        expect(notif.channel).toBe(testData.channel);
        expect(notif.priority).toBe(testData.priority);
        expect(JSON.parse(notif.data)).toEqual(testData.data);
      });
    });
  });

  describe('High Volume Processing', () => {
    it('should handle concurrent high-volume ingestion', async () => {
      const notificationCount = 500;
      const batchSize = 50;
      
      // Create notifications across all channels simultaneously
      const promises: Promise<any>[] = [];

      // Webhook batch
      for (let i = 0; i < batchSize; i++) {
        promises.push(
          request(webhookApp)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send({
              user_id: userId,
              body: `Webhook high volume ${i}`,
              priority: i % 10 === 0 ? 'high' : 'normal'
            })
        );
      }

      // WebSocket batch
      const ws = new WebSocket(`ws://localhost:${wsPort}?api_key=${validApiKey}`);
      const wsPromise = new Promise<void>((resolve) => {
        let responses = 0;
        
        ws.on('open', () => {
          for (let i = 0; i < batchSize; i++) {
            ws.send(JSON.stringify({
              type: 'notification',
              data: {
                user_id: userId,
                body: `WebSocket high volume ${i}`,
                priority: i % 10 === 0 ? 'high' : 'normal'
              }
            }));
          }
        });

        ws.on('message', () => {
          responses++;
          if (responses === batchSize) {
            ws.close();
            resolve();
          }
        });
      });
      promises.push(wsPromise);

      // File batch
      for (let i = 0; i < batchSize; i++) {
        const filePath = join(watchDir, `high-volume-${i}.json`);
        writeFileSync(filePath, JSON.stringify({
          user_id: userId,
          body: `File high volume ${i}`,
          priority: i % 10 === 0 ? 'high' : 'normal'
        }));
      }

      // Wait for all processing
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for file processing

      // Verify all notifications were processed
      const totalNotifications = testDb.db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
      expect(totalNotifications).toBe(batchSize * 3); // 3 channels

      // Verify no data corruption
      const corruptedData = testDb.db.prepare(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE body IS NULL OR user_id IS NULL OR priority NOT IN ('low', 'normal', 'high', 'critical')
      `).get().count;
      expect(corruptedData).toBe(0);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let requestCount = 0;
      
      const loadTest = async () => {
        while (Date.now() - startTime < duration) {
          const promises = [];
          
          // Send batch of requests
          for (let i = 0; i < 10; i++) {
            promises.push(
              request(webhookApp)
                .post('/webhook/notifications')
                .set('X-API-Key', validApiKey)
                .send({
                  user_id: userId,
                  body: `Load test ${requestCount++}`,
                  priority: 'normal'
                })
            );
          }
          
          await Promise.all(promises);
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
        }
      };

      await loadTest();

      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      const requestsPerSecond = requestCount / (actualDuration / 1000);

      console.log(`Processed ${requestCount} requests in ${actualDuration}ms (${requestsPerSecond.toFixed(2)} req/s)`);

      // Verify performance metrics
      expect(requestsPerSecond).toBeGreaterThan(10); // At least 10 requests per second
      expect(requestCount).toBeGreaterThan(100); // Processed substantial number of requests

      // Verify all requests were processed successfully
      const processedCount = testDb.db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
      expect(processedCount).toBe(requestCount);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle partial system failures', async () => {
      // Test scenario: Database becomes temporarily unavailable
      
      // Send successful requests first
      await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({ user_id: userId, body: 'Before failure' });

      // Simulate database failure
      testDb.db.close();

      // Requests during failure should be handled gracefully
      const failedResponse = await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({ user_id: userId, body: 'During failure' });

      expect(failedResponse.status).toBe(500);
      expect(failedResponse.body.error).toContain('database');

      // Restore database
      testDb = createTestDatabase('e2e-test-recovery');
      setupNotificationSchema(testDb.db);
      seedTestData(testDb.db);

      // Subsequent requests should work
      const recoveryResponse = await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({ user_id: userId, body: 'After recovery' });

      expect(recoveryResponse.status).toBe(201);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const batchPayload = [
        { user_id: userId, body: 'Valid notification 1' },
        { user_id: 'nonexistent-user', body: 'Invalid notification' },
        { user_id: userId, body: 'Valid notification 2' },
        { invalid: 'format' },
        { user_id: userId, body: 'Valid notification 3' }
      ];

      // Send through webhook batch
      const response = await request(webhookApp)
        .post('/webhook/notifications/batch')
        .set('X-API-Key', validApiKey)
        .send(batchPayload);

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(3);
      expect(response.body.failed).toBe(2);
      expect(response.body.errors).toHaveLength(2);

      // Verify only valid notifications were created
      const notifications = testDb.db.prepare(`
        SELECT * FROM notifications 
        WHERE body LIKE 'Valid notification%'
      `).all();
      expect(notifications).toHaveLength(3);
    });
  });

  describe('Data Validation and Security', () => {
    it('should validate and sanitize data across all channels', async () => {
      const maliciousPayload = {
        user_id: userId,
        body: '<script>alert("xss")</script>Malicious content',
        subject: '"><img src=x onerror=alert("xss")>',
        data: {
          malicious_field: '../../etc/passwd',
          script_injection: '<script>window.location="http://evil.com"</script>'
        }
      };

      // Test webhook
      const webhookResponse = await request(webhookApp)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(maliciousPayload);

      expect(webhookResponse.status).toBe(201);

      // Test websocket
      const ws = new WebSocket(`ws://localhost:${wsPort}?api_key=${validApiKey}`);
      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'notification',
            data: maliciousPayload
          }));
        });
        ws.on('message', () => {
          ws.close();
          resolve();
        });
      });

      // Test file
      const filePath = join(watchDir, 'malicious.json');
      writeFileSync(filePath, JSON.stringify(maliciousPayload));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all malicious content was sanitized
      const notifications = testDb.db.prepare(`
        SELECT * FROM notifications 
        WHERE body LIKE '%Malicious content%'
      `).all();

      expect(notifications).toHaveLength(3);
      notifications.forEach(notif => {
        expect(notif.body).not.toContain('<script>');
        expect(notif.subject).not.toContain('<img');
        expect(notif.subject).not.toContain('onerror');
      });
    });

    it('should enforce rate limits consistently across channels', async () => {
      const payload = { user_id: userId, body: 'Rate limit test' };
      
      // Send rapid requests through webhook
      const webhookPromises = [];
      for (let i = 0; i < 70; i++) {
        webhookPromises.push(
          request(webhookApp)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send(payload)
        );
      }

      const webhookResponses = await Promise.all(webhookPromises);
      const webhookRateLimited = webhookResponses.filter(r => r.status === 429);
      expect(webhookRateLimited.length).toBeGreaterThan(0);

      // WebSocket should also be rate limited
      const ws = new WebSocket(`ws://localhost:${wsPort}?api_key=${validApiKey}`);
      let wsRateLimited = false;

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          for (let i = 0; i < 50; i++) {
            ws.send(JSON.stringify({
              type: 'notification',
              data: payload
            }));
          }
        });

        let responses = 0;
        ws.on('message', (data) => {
          const response = JSON.parse(data.toString());
          if (response.error && response.error.includes('rate limit')) {
            wsRateLimited = true;
          }
          responses++;
          if (responses >= 50 || wsRateLimited) {
            ws.close();
            resolve();
          }
        });
      });

      expect(wsRateLimited).toBe(true);
    });
  });

  describe('Monitoring and Observability', () => {
    it('should track comprehensive metrics across all components', async () => {
      // Generate activity across all channels
      const testCount = 20;
      
      for (let i = 0; i < testCount; i++) {
        // Webhook
        await request(webhookApp)
          .post('/webhook/notifications')
          .set('X-API-Key', validApiKey)
          .send({ user_id: userId, body: `Metrics test webhook ${i}` });

        // File
        const filePath = join(watchDir, `metrics-${i}.json`);
        writeFileSync(filePath, JSON.stringify({
          user_id: userId,
          body: `Metrics test file ${i}`
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify metrics are tracked
      const totalNotifications = testDb.db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
      expect(totalNotifications).toBeGreaterThanOrEqual(testCount * 2);

      const events = testDb.db.prepare('SELECT COUNT(*) as count FROM events').get().count;
      expect(events).toBeGreaterThanOrEqual(testCount * 2);

      // Check file watcher statistics
      const fileStats = fileWatcher.getStatistics();
      expect(fileStats.filesProcessed).toBeGreaterThanOrEqual(testCount);
      expect(fileStats.notificationsCreated).toBeGreaterThanOrEqual(testCount);

      // Check WebSocket server statistics
      const wsStats = wsServer.getStatistics();
      expect(wsStats.totalMessages).toBeGreaterThan(0);
    });

    it('should provide health status for all components', () => {
      // Check database health
      const dbHealthy = testDb.db.prepare('SELECT 1').get();
      expect(dbHealthy).toBeTruthy();

      // Check file watcher health
      expect(fileWatcher.isRunning()).toBe(true);

      // Check sync manager health
      const syncHealth = syncManager.getHealthStatus();
      expect(syncHealth.status).toBe('healthy');

      // Check WebSocket server
      expect(wsServer.getConnectionCount()).toBeGreaterThanOrEqual(0);
    });
  });
});
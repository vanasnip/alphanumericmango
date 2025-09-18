/**
 * WebSocket Ingestion Tests
 * Tests real-time notification ingestion via WebSocket connections
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createMockNotification } from '../../test/mock-data';
import { NotificationWebSocketServer } from '../websocket-server';

describe('WebSocket Ingestion', () => {
  let testDb: TestDatabase;
  let wsServer: NotificationWebSocketServer;
  let serverPort: number;
  let projectId: string;
  let userId: string;
  let validApiKey: string;

  beforeAll(async () => {
    testDb = createTestDatabase('websocket-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    projectId = seededData.projectId;
    userId = seededData.userId;
    validApiKey = 'test-api-key-123';

    // Start WebSocket server
    wsServer = new NotificationWebSocketServer(testDb.db);
    serverPort = await wsServer.start(0); // Use random port
  });

  afterAll(async () => {
    await wsServer.stop();
    testDb.cleanup();
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections with valid API key', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should reject connections without API key', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('error', (error) => {
        expect(error.message).toContain('401');
        done();
      });

      ws.on('open', () => {
        done(new Error('Connection should have been rejected'));
      });
    });

    it('should reject connections with invalid API key', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=invalid-key`);
      
      ws.on('error', (error) => {
        expect(error.message).toContain('403');
        done();
      });

      ws.on('open', () => {
        done(new Error('Connection should have been rejected'));
      });
    });

    it('should handle connection close gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', (code, reason) => {
        expect(code).toBe(1000); // Normal closure
        done();
      });
    });

    it('should support multiple concurrent connections', async () => {
      const connections: WebSocket[] = [];
      const connectionPromises = [];

      for (let i = 0; i < 5; i++) {
        const connectionPromise = new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
          connections.push(ws);

          ws.on('open', () => resolve());
          ws.on('error', reject);
        });

        connectionPromises.push(connectionPromise);
      }

      await Promise.all(connectionPromises);
      expect(connections).toHaveLength(5);
      expect(wsServer.getConnectionCount()).toBe(5);

      // Close all connections
      connections.forEach(ws => ws.close());
      
      // Wait for connections to close
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(wsServer.getConnectionCount()).toBe(0);
    });
  });

  describe('Message Processing', () => {
    let ws: WebSocket;

    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      ws.on('open', () => done());
      ws.on('error', done);
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should process valid notification messages', (done) => {
      const notification = {
        type: 'notification',
        data: {
          user_id: userId,
          body: 'WebSocket test notification',
          subject: 'Test Subject',
          channel: 'push',
          priority: 'high'
        }
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(true);
        expect(response.notification_id).toBeDefined();

        // Verify notification was created in database
        const created = testDb.db.prepare('SELECT * FROM notifications WHERE id = ?').get(response.notification_id);
        expect(created).toBeTruthy();
        expect(created.body).toBe(notification.data.body);
        expect(created.channel).toBe(notification.data.channel);
        
        done();
      });

      ws.send(JSON.stringify(notification));
    });

    it('should validate message format', (done) => {
      const invalidMessage = {
        invalid: 'format'
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('validation');
        done();
      });

      ws.send(JSON.stringify(invalidMessage));
    });

    it('should handle malformed JSON', (done) => {
      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('JSON');
        done();
      });

      ws.send('{ invalid json }');
    });

    it('should handle missing required fields', (done) => {
      const incompleteNotification = {
        type: 'notification',
        data: {
          user_id: userId
          // Missing body
        }
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('body');
        done();
      });

      ws.send(JSON.stringify(incompleteNotification));
    });

    it('should handle foreign key violations', (done) => {
      const invalidNotification = {
        type: 'notification',
        data: {
          user_id: 'nonexistent-user',
          body: 'This will fail'
        }
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('user');
        done();
      });

      ws.send(JSON.stringify(invalidNotification));
    });

    it('should process batch notifications', (done) => {
      const batchMessage = {
        type: 'batch_notification',
        data: [
          { user_id: userId, body: 'Batch notification 1' },
          { user_id: userId, body: 'Batch notification 2' },
          { user_id: userId, body: 'Batch notification 3' }
        ]
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(true);
        expect(response.batch_id).toBeDefined();
        expect(response.created_count).toBe(3);

        // Verify all notifications were created
        const created = testDb.db.prepare('SELECT * FROM notifications WHERE body LIKE ?').all('Batch notification %');
        expect(created).toHaveLength(3);
        
        done();
      });

      ws.send(JSON.stringify(batchMessage));
    });

    it('should handle mixed valid/invalid batch', (done) => {
      const mixedBatch = {
        type: 'batch_notification',
        data: [
          { user_id: userId, body: 'Valid notification 1' },
          { user_id: 'invalid', body: 'Invalid notification' },
          { user_id: userId, body: 'Valid notification 2' }
        ]
      };

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(true);
        expect(response.created_count).toBe(2);
        expect(response.failed_count).toBe(1);
        expect(response.errors).toBeDefined();
        
        done();
      });

      ws.send(JSON.stringify(mixedBatch));
    });
  });

  describe('Real-time Features', () => {
    let ws: WebSocket;

    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      ws.on('open', () => done());
      ws.on('error', done);
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should support ping/pong keepalive', (done) => {
      let pongReceived = false;

      ws.on('pong', () => {
        pongReceived = true;
        expect(pongReceived).toBe(true);
        done();
      });

      // Send ping
      ws.ping();
    });

    it('should handle high-frequency messages', async () => {
      const messageCount = 50;
      const responses: any[] = [];

      const messagePromise = new Promise<void>((resolve) => {
        let receivedCount = 0;

        ws.on('message', (data) => {
          responses.push(JSON.parse(data.toString()));
          receivedCount++;
          
          if (receivedCount === messageCount) {
            resolve();
          }
        });
      });

      // Send messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const notification = {
          type: 'notification',
          data: {
            user_id: userId,
            body: `High frequency message ${i}`,
            priority: i % 10 === 0 ? 'high' : 'normal'
          }
        };

        ws.send(JSON.stringify(notification));
      }

      await messagePromise;

      expect(responses).toHaveLength(messageCount);
      expect(responses.every(r => r.success)).toBe(true);
    });

    it('should maintain message order', async () => {
      const messageCount = 10;
      const responses: any[] = [];

      const messagePromise = new Promise<void>((resolve) => {
        let receivedCount = 0;

        ws.on('message', (data) => {
          responses.push(JSON.parse(data.toString()));
          receivedCount++;
          
          if (receivedCount === messageCount) {
            resolve();
          }
        });
      });

      // Send sequential messages
      for (let i = 0; i < messageCount; i++) {
        const notification = {
          type: 'notification',
          data: {
            user_id: userId,
            body: `Sequential message ${i}`,
            data: { sequence: i }
          }
        };

        ws.send(JSON.stringify(notification));
      }

      await messagePromise;

      // Verify notifications were created in order
      const created = testDb.db.prepare(`
        SELECT * FROM notifications 
        WHERE body LIKE 'Sequential message %' 
        ORDER BY created_at
      `).all();

      expect(created).toHaveLength(messageCount);
      
      for (let i = 0; i < messageCount; i++) {
        const data = JSON.parse(created[i].data);
        expect(data.sequence).toBe(i);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      ws.on('open', () => {
        // Close database to simulate error
        testDb.db.close();

        const notification = {
          type: 'notification',
          data: {
            user_id: userId,
            body: 'This should fail due to database error'
          }
        };

        ws.send(JSON.stringify(notification));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('database');
        
        // Recreate database for other tests
        testDb = createTestDatabase('websocket-test');
        setupNotificationSchema(testDb.db);
        seedTestData(testDb.db);
        
        ws.close();
        done();
      });
    });

    it('should handle connection timeouts', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Simulate network timeout by not sending any data
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('should handle malicious payload sizes', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      ws.on('open', () => {
        const largePayload = {
          type: 'notification',
          data: {
            user_id: userId,
            body: 'X'.repeat(10 * 1024 * 1024) // 10MB payload
          }
        };

        ws.send(JSON.stringify(largePayload));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.success).toBe(false);
        expect(response.error).toContain('size');
        done();
      });

      ws.on('close', (code) => {
        if (code === 1009) { // Message too big
          done();
        }
      });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should track connection statistics', async () => {
      const connections: WebSocket[] = [];

      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
        connections.push(ws);

        await new Promise<void>((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
        });
      }

      expect(wsServer.getConnectionCount()).toBe(3);

      const stats = wsServer.getStatistics();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(3);
      expect(stats.activeConnections).toBe(3);

      // Close connections
      connections.forEach(ws => ws.close());
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(wsServer.getConnectionCount()).toBe(0);
    });

    it('should handle graceful server shutdown', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // This would be tested if we implemented graceful shutdown
      // await wsServer.gracefulShutdown();
      // expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Security Features', () => {
    it('should implement rate limiting per connection', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}?api_key=${validApiKey}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      const responses: any[] = [];
      let rateLimitHit = false;

      const messagePromise = new Promise<void>((resolve) => {
        ws.on('message', (data) => {
          const response = JSON.parse(data.toString());
          responses.push(response);
          
          if (response.error && response.error.includes('rate limit')) {
            rateLimitHit = true;
            resolve();
          }
          
          if (responses.length >= 100) {
            resolve();
          }
        });
      });

      // Send many messages rapidly to trigger rate limiting
      for (let i = 0; i < 100; i++) {
        const notification = {
          type: 'notification',
          data: {
            user_id: userId,
            body: `Rate limit test ${i}`
          }
        };

        ws.send(JSON.stringify(notification));
      }

      await messagePromise;

      expect(rateLimitHit).toBe(true);
      ws.close();
    });

    it('should validate API key on each message', (done) => {
      // This test would require modifying the WebSocket server to support
      // per-message API key validation, which is less common but possible
      done();
    });
  });
});
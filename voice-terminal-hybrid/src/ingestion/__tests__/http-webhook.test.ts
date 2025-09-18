/**
 * HTTP Webhook Ingestion Tests
 * Tests webhook endpoint functionality, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createWebhookPayload, createInvalidPayloads, createLargePayload } from '../../test/mock-data';
import { createNotificationWebhookServer } from '../webhook-server';

describe('HTTP Webhook Ingestion', () => {
  let testDb: TestDatabase;
  let app: express.Application;
  let server: any;
  let projectId: string;
  let userId: string;
  let validApiKey: string;

  beforeAll(async () => {
    testDb = createTestDatabase('webhook-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    projectId = seededData.projectId;
    userId = seededData.userId;
    validApiKey = 'test-api-key-123';

    // Create webhook server
    app = createNotificationWebhookServer(testDb.db);
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    testDb.cleanup();
  });

  describe('Webhook Authentication', () => {
    it('should reject requests without API key', async () => {
      const payload = createWebhookPayload({ 
        user_id: userId, 
        body: 'Test notification' 
      });

      const response = await request(app)
        .post('/webhook/notifications')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('API key required');
    });

    it('should reject requests with invalid API key', async () => {
      const payload = createWebhookPayload({ 
        user_id: userId, 
        body: 'Test notification' 
      });

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', 'invalid-key')
        .send(payload);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const payload = {
        user_id: userId,
        body: 'Test notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should support API key in Authorization header', async () => {
      const payload = {
        user_id: userId,
        body: 'Test notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle malformed Authorization header', async () => {
      const payload = {
        user_id: userId,
        body: 'Test notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('Authorization', 'InvalidFormat')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('API key required');
    });
  });

  describe('Payload Validation', () => {
    it('should validate required fields', async () => {
      const invalidPayloads = createInvalidPayloads();

      for (const payload of invalidPayloads.slice(0, 5)) { // Test first 5 invalid payloads
        const response = await request(app)
          .post('/webhook/notifications')
          .set('X-API-Key', validApiKey)
          .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      }
    });

    it('should validate field types', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({
          user_id: 123, // Should be string
          body: 'test',
          project_id: projectId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation');
    });

    it('should validate enum values', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({
          user_id: userId,
          body: 'test',
          project_id: projectId,
          channel: 'invalid_channel'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channel');
    });

    it('should validate priority values', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({
          user_id: userId,
          body: 'test',
          project_id: projectId,
          priority: 'invalid_priority'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('priority');
    });

    it('should handle XSS attempts in payload', async () => {
      const maliciousPayload = {
        user_id: userId,
        body: '<script>alert("xss")</script>',
        subject: '"><img src=x onerror=alert("xss")>',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(maliciousPayload);

      // Should create notification but sanitize content
      expect(response.status).toBe(201);
      
      // Verify XSS content was sanitized
      const notification = testDb.db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1').get();
      expect(notification.body).not.toContain('<script>');
      expect(notification.subject).not.toContain('<img');
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousPayload = {
        user_id: "'; DROP TABLE notifications; --",
        body: 'test',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(maliciousPayload);

      expect(response.status).toBe(400); // Should be rejected due to validation

      // Verify table still exists
      const tableCheck = testDb.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'
      `).get();
      expect(tableCheck).toBeTruthy();
    });
  });

  describe('Content-Type Handling', () => {
    it('should accept application/json', async () => {
      const payload = {
        user_id: userId,
        body: 'Test notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expect(response.status).toBe(201);
    });

    it('should reject non-JSON content types', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .set('Content-Type', 'text/plain')
        .send('plain text data');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('JSON');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('JSON');
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('body');
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting per API key', async () => {
      const payload = {
        user_id: userId,
        body: 'Rate limit test',
        project_id: projectId
      };

      // Send multiple requests rapidly
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/webhook/notifications')
          .set('X-API-Key', validApiKey)
          .send(payload)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should succeed
      const successfulRequests = responses.filter(r => r.status === 201);
      expect(successfulRequests.length).toBeGreaterThan(0);

      // Some requests should be rate limited
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should provide rate limit headers', async () => {
      const payload = {
        user_id: userId,
        body: 'Rate limit header test',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Payload Size Limits', () => {
    it('should reject payloads exceeding size limit', async () => {
      const largePayload = createLargePayload(2 * 1024 * 1024); // 2MB

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('size');
    });

    it('should accept payloads within size limit', async () => {
      const moderatePayload = createLargePayload(1024); // 1KB

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(moderatePayload);

      expect(response.status).toBe(201);
    });
  });

  describe('Success Responses', () => {
    it('should create notification and return success response', async () => {
      const payload = {
        user_id: userId,
        body: 'Success test notification',
        subject: 'Test Subject',
        channel: 'email',
        priority: 'high',
        project_id: projectId,
        data: {
          custom_field: 'custom_value',
          timestamp: Date.now()
        }
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.notification_id).toBeDefined();

      // Verify notification was created in database
      const notification = testDb.db.prepare('SELECT * FROM notifications WHERE id = ?').get(response.body.notification_id);
      expect(notification).toBeTruthy();
      expect(notification.user_id).toBe(userId);
      expect(notification.body).toBe(payload.body);
      expect(notification.subject).toBe(payload.subject);
      expect(notification.channel).toBe(payload.channel);
      expect(notification.priority).toBe(payload.priority);
      expect(JSON.parse(notification.data)).toEqual(payload.data);
    });

    it('should handle optional fields correctly', async () => {
      const minimalPayload = {
        user_id: userId,
        body: 'Minimal notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(minimalPayload);

      expect(response.status).toBe(201);

      const notification = testDb.db.prepare('SELECT * FROM notifications WHERE id = ?').get(response.body.notification_id);
      expect(notification.channel).toBe('in_app'); // Default value
      expect(notification.priority).toBe('normal'); // Default value
      expect(notification.status).toBe('pending'); // Default value
    });

    it('should handle scheduled notifications', async () => {
      const scheduledTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const payload = {
        user_id: userId,
        body: 'Scheduled notification',
        project_id: projectId,
        scheduled_at: scheduledTime
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.status).toBe(201);

      const notification = testDb.db.prepare('SELECT * FROM notifications WHERE id = ?').get(response.body.notification_id);
      expect(notification.scheduled_at).toBe(scheduledTime);
      expect(notification.status).toBe('pending');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close the database to simulate connection error
      testDb.db.close();

      const payload = {
        user_id: userId,
        body: 'Error test notification',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('database');

      // Recreate database for other tests
      testDb = createTestDatabase('webhook-test');
      setupNotificationSchema(testDb.db);
      seedTestData(testDb.db);
    });

    it('should handle foreign key constraint violations', async () => {
      const payload = {
        user_id: 'nonexistent-user',
        body: 'Foreign key test',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('user');
    });

    it('should provide helpful error messages', async () => {
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const payload = {
        user_id: userId,
        body: 'Security headers test',
        project_id: projectId
      };

      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/webhook/notifications')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-API-Key, Content-Type');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('X-API-Key');
    });
  });
});
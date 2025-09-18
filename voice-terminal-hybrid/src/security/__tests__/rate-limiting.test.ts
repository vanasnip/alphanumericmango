/**
 * Rate Limiting Security Tests
 * Tests effectiveness of rate limiting across different attack vectors
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestDatabase, setupNotificationSchema, seedTestData, type TestDatabase } from '../../test/test-database';
import { createNotificationWebhookServer } from '../../ingestion/webhook-server';
import { RateLimitManager } from '../rate-limit-manager';

describe('Rate Limiting Security', () => {
  let testDb: TestDatabase;
  let app: express.Application;
  let rateLimiter: RateLimitManager;
  let validApiKey: string;

  beforeAll(() => {
    testDb = createTestDatabase('rate-limit-test');
    setupNotificationSchema(testDb.db);
    const seededData = seedTestData(testDb.db);
    validApiKey = 'test-api-key-123';

    rateLimiter = new RateLimitManager();
    app = createNotificationWebhookServer(testDb.db);
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      
      // Send requests within limit (assuming 60 requests per minute)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/webhook/notifications')
          .set('X-API-Key', validApiKey)
          .send(payload);
        
        expect(response.status).toBe(201);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      const requests = [];
      
      // Send many requests rapidly
      for (let i = 0; i < 70; i++) {
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send(payload)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some should succeed, some should be rate limited
      const successfulRequests = responses.filter(r => r.status === 201);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
      expect(successfulRequests.length + rateLimitedRequests.length).toBe(70);
    });

    it('should provide rate limit headers', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      
      const response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should reset rate limit after time window', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      
      // Use up the rate limit
      const requests = [];
      for (let i = 0; i < 70; i++) {
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send(payload)
        );
      }

      await Promise.all(requests);
      
      // Should be rate limited now
      let response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);
      expect(response.status).toBe(429);

      // Wait for rate limit window to reset (simulate with faster reset for testing)
      rateLimiter.resetWindow(validApiKey);
      
      // Should work again
      response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', validApiKey)
        .send(payload);
      expect(response.status).toBe(201);
    });
  });

  describe('Per-API Key Rate Limiting', () => {
    it('should track rate limits separately per API key', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      const apiKey1 = 'api-key-1';
      const apiKey2 = 'api-key-2';

      // Use up limit for first API key
      const requests1 = [];
      for (let i = 0; i < 70; i++) {
        requests1.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', apiKey1)
            .send(payload)
        );
      }

      await Promise.all(requests1);

      // First API key should be rate limited
      let response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', apiKey1)
        .send(payload);
      expect(response.status).toBe(429);

      // Second API key should still work
      response = await request(app)
        .post('/webhook/notifications')
        .set('X-API-Key', apiKey2)
        .send(payload);
      expect(response.status).toBe(201);
    });

    it('should handle invalid API keys in rate limiting', async () => {
      const payload = { user_id: 'test-user', body: 'Test notification' };
      
      // Requests with invalid API key should still be rate limited by IP
      const requests = [];
      for (let i = 0; i < 70; i++) {
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', 'invalid-key')
            .send(payload)
        );
      }

      const responses = await Promise.all(requests);
      
      // All should be unauthorized (401/403) but some might be rate limited (429)
      const unauthorizedRequests = responses.filter(r => r.status === 401 || r.status === 403);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      expect(unauthorizedRequests.length + rateLimitedRequests.length).toBe(70);
    });

    it('should implement sliding window rate limiting', () => {
      const windowSize = 60000; // 1 minute
      const maxRequests = 60;
      
      const apiKey = 'sliding-window-test';
      const now = Date.now();
      
      // Simulate requests spread across time
      for (let i = 0; i < 40; i++) {
        const timestamp = now + (i * 1000); // 1 second apart
        rateLimiter.recordRequest(apiKey, timestamp);
      }
      
      // Should still allow more requests
      expect(rateLimiter.isAllowed(apiKey, now + 40000)).toBe(true);
      
      // Add more requests to exceed limit
      for (let i = 0; i < 30; i++) {
        const timestamp = now + 40000 + (i * 100); // Rapid requests
        rateLimiter.recordRequest(apiKey, timestamp);
      }
      
      // Should now be rate limited
      expect(rateLimiter.isAllowed(apiKey, now + 45000)).toBe(false);
    });
  });

  describe('DDoS Protection', () => {
    it('should detect and block burst attacks', async () => {
      const payload = { user_id: 'test-user', body: 'Burst attack' };
      
      // Simulate burst attack - many requests in very short time
      const startTime = Date.now();
      const burstRequests = [];
      
      for (let i = 0; i < 100; i++) {
        burstRequests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send(payload)
        );
      }

      const responses = await Promise.all(burstRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Attack should be detected quickly
      expect(duration).toBeLessThan(5000);
      
      // Most requests should be blocked
      const blockedRequests = responses.filter(r => r.status === 429);
      expect(blockedRequests.length).toBeGreaterThan(50);
    });

    it('should implement progressive delay for repeated violations', () => {
      const apiKey = 'progressive-delay-test';
      
      // First violation - short delay
      rateLimiter.recordViolation(apiKey);
      let delay1 = rateLimiter.getRequiredDelay(apiKey);
      expect(delay1).toBeGreaterThan(0);
      expect(delay1).toBeLessThan(5000);
      
      // Second violation - longer delay
      rateLimiter.recordViolation(apiKey);
      let delay2 = rateLimiter.getRequiredDelay(apiKey);
      expect(delay2).toBeGreaterThan(delay1);
      
      // Third violation - even longer delay
      rateLimiter.recordViolation(apiKey);
      let delay3 = rateLimiter.getRequiredDelay(apiKey);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should implement IP-based rate limiting as fallback', async () => {
      const payload = { user_id: 'test-user', body: 'IP rate limit test' };
      
      // Make requests without API key to trigger IP-based limiting
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .send(payload)
        );
      }

      const responses = await Promise.all(requests);
      
      // Should eventually hit IP-based rate limit
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should handle distributed attacks from multiple IPs', () => {
      const attackerIPs = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4'];
      const apiKey = 'distributed-attack-test';
      
      // Simulate coordinated attack from multiple IPs
      attackerIPs.forEach(ip => {
        for (let i = 0; i < 30; i++) {
          rateLimiter.recordRequest(`${apiKey}:${ip}`, Date.now() + i * 100);
        }
      });
      
      // Should detect coordinated attack pattern
      const attackDetected = rateLimiter.detectDistributedAttack(apiKey, attackerIPs);
      expect(attackDetected).toBe(true);
      
      // Should apply stricter limits for detected coordinated attacks
      const strictLimit = rateLimiter.getStrictLimit(apiKey);
      expect(strictLimit).toBeLessThan(rateLimiter.getNormalLimit(apiKey));
    });
  });

  describe('Advanced Rate Limiting Strategies', () => {
    it('should implement token bucket algorithm', () => {
      const bucketSize = 100;
      const refillRate = 10; // tokens per second
      const apiKey = 'token-bucket-test';
      
      const bucket = rateLimiter.createTokenBucket(apiKey, bucketSize, refillRate);
      
      // Should start with full bucket
      expect(bucket.getTokenCount()).toBe(bucketSize);
      
      // Consume tokens
      for (let i = 0; i < 50; i++) {
        expect(bucket.consumeToken()).toBe(true);
      }
      
      expect(bucket.getTokenCount()).toBe(50);
      
      // Try to consume more than available
      for (let i = 0; i < 60; i++) {
        bucket.consumeToken();
      }
      
      expect(bucket.getTokenCount()).toBe(0);
      expect(bucket.consumeToken()).toBe(false);
      
      // Wait for refill
      setTimeout(() => {
        expect(bucket.getTokenCount()).toBeGreaterThan(0);
      }, 1100); // Just over 1 second
    });

    it('should implement leaky bucket algorithm', () => {
      const bucketSize = 50;
      const leakRate = 5; // requests per second
      const apiKey = 'leaky-bucket-test';
      
      const bucket = rateLimiter.createLeakyBucket(apiKey, bucketSize, leakRate);
      
      // Add requests rapidly
      for (let i = 0; i < 60; i++) {
        const accepted = bucket.addRequest(Date.now() + i * 10);
        if (i < bucketSize) {
          expect(accepted).toBe(true);
        } else {
          expect(accepted).toBe(false); // Bucket overflow
        }
      }
      
      // Wait for leak
      setTimeout(() => {
        // Should have leaked some requests
        const accepted = bucket.addRequest(Date.now() + 2000);
        expect(accepted).toBe(true);
      }, 1100);
    });

    it('should implement adaptive rate limiting based on system load', () => {
      const apiKey = 'adaptive-test';
      
      // Normal system load
      rateLimiter.setSystemLoad(0.3); // 30% load
      let limit = rateLimiter.getAdaptiveLimit(apiKey);
      expect(limit).toBe(rateLimiter.getNormalLimit(apiKey));
      
      // High system load
      rateLimiter.setSystemLoad(0.8); // 80% load
      limit = rateLimiter.getAdaptiveLimit(apiKey);
      expect(limit).toBeLessThan(rateLimiter.getNormalLimit(apiKey));
      
      // Critical system load
      rateLimiter.setSystemLoad(0.95); // 95% load
      limit = rateLimiter.getAdaptiveLimit(apiKey);
      expect(limit).toBeLessThan(rateLimiter.getNormalLimit(apiKey) * 0.5);
    });

    it('should implement priority-based rate limiting', () => {
      const highPriorityKey = 'high-priority-api';
      const lowPriorityKey = 'low-priority-api';
      
      rateLimiter.setApiKeyPriority(highPriorityKey, 'high');
      rateLimiter.setApiKeyPriority(lowPriorityKey, 'low');
      
      // During normal conditions, both should have normal limits
      let highLimit = rateLimiter.getPriorityAdjustedLimit(highPriorityKey);
      let lowLimit = rateLimiter.getPriorityAdjustedLimit(lowPriorityKey);
      expect(highLimit).toBeGreaterThanOrEqual(lowLimit);
      
      // During congestion, low priority should be throttled more
      rateLimiter.setCongestionLevel(0.8);
      highLimit = rateLimiter.getPriorityAdjustedLimit(highPriorityKey);
      lowLimit = rateLimiter.getPriorityAdjustedLimit(lowPriorityKey);
      expect(highLimit).toBeGreaterThan(lowLimit);
    });
  });

  describe('Rate Limiting Bypass Attempts', () => {
    it('should prevent rate limit bypass through header manipulation', async () => {
      const payload = { user_id: 'test-user', body: 'Header manipulation test' };
      
      // Try various header manipulation techniques
      const bypassAttempts = [
        { 'X-Forwarded-For': '192.168.1.100' },
        { 'X-Real-IP': '10.0.0.100' },
        { 'X-Client-IP': '172.16.0.100' },
        { 'CF-Connecting-IP': '203.0.113.100' },
        { 'X-Rate-Limit-Reset': '0' }
      ];

      for (const headers of bypassAttempts) {
        const requests = [];
        for (let i = 0; i < 70; i++) {
          requests.push(
            request(app)
              .post('/webhook/notifications')
              .set('X-API-Key', validApiKey)
              .set(headers)
              .send(payload)
          );
        }

        const responses = await Promise.all(requests);
        const rateLimitedRequests = responses.filter(r => r.status === 429);
        
        // Should still be rate limited despite header manipulation
        expect(rateLimitedRequests.length).toBeGreaterThan(0);
      }
    });

    it('should prevent rate limit bypass through API key rotation', async () => {
      const payload = { user_id: 'test-user', body: 'API key rotation test' };
      const apiKeys = ['key1', 'key2', 'key3', 'key4', 'key5'];
      
      // Try to bypass by rotating through multiple API keys from same client
      const requests = [];
      for (let i = 0; i < 100; i++) {
        const apiKey = apiKeys[i % apiKeys.length];
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', apiKey)
            .send(payload)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      // Should detect pattern and apply rate limiting
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    it('should detect and prevent distributed rate limit bypass', () => {
      const baseApiKey = 'distributed-bypass-test';
      const variations = [
        baseApiKey,
        baseApiKey.toUpperCase(),
        baseApiKey + ' ',
        ' ' + baseApiKey,
        baseApiKey.split('').join('-')
      ];
      
      // Try to use similar API keys to bypass limits
      variations.forEach(key => {
        for (let i = 0; i < 30; i++) {
          rateLimiter.recordRequest(key, Date.now() + i * 100);
        }
      });
      
      // Should detect similar key pattern
      const bypassDetected = rateLimiter.detectBypassAttempt(baseApiKey, variations);
      expect(bypassDetected).toBe(true);
    });

    it('should prevent timing-based bypass attempts', async () => {
      const payload = { user_id: 'test-user', body: 'Timing bypass test' };
      
      // Try to bypass by spacing requests just under the time window
      const requests = [];
      for (let i = 0; i < 50; i++) {
        // Wait slightly between requests to try to reset window
        await new Promise(resolve => setTimeout(resolve, 50));
        
        requests.push(
          request(app)
            .post('/webhook/notifications')
            .set('X-API-Key', validApiKey)
            .send(payload)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      // Should still catch the pattern despite timing attempts
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Monitoring and Analytics', () => {
    it('should track rate limiting statistics', () => {
      const stats = rateLimiter.getStatistics();
      
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('topViolators');
      expect(stats).toHaveProperty('averageRequestRate');
      expect(stats).toHaveProperty('peakRequestRate');
    });

    it('should generate rate limiting reports', () => {
      const report = rateLimiter.generateReport('24h');
      
      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('totalRequests');
      expect(report).toHaveProperty('violationsByApiKey');
      expect(report).toHaveProperty('violationsByIP');
      expect(report).toHaveProperty('patterns');
      expect(report).toHaveProperty('recommendations');
    });

    it('should provide real-time rate limiting metrics', () => {
      const metrics = rateLimiter.getRealTimeMetrics();
      
      expect(metrics).toHaveProperty('currentRequestRate');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('queueDepth');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('errorRate');
    });

    it('should alert on rate limiting anomalies', () => {
      // Simulate unusual traffic pattern
      const apiKey = 'anomaly-test';
      const baselineRate = 10; // requests per minute
      
      // Establish baseline
      for (let i = 0; i < 60; i++) {
        if (i % 6 === 0) { // 10 requests per minute
          rateLimiter.recordRequest(apiKey, Date.now() + i * 1000);
        }
      }
      
      // Sudden spike
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordRequest(apiKey, Date.now() + 60000 + i * 100);
      }
      
      const anomalies = rateLimiter.detectAnomalies(apiKey);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('traffic_spike');
      expect(anomalies[0].magnitude).toBeGreaterThan(5); // 5x baseline
    });
  });
});
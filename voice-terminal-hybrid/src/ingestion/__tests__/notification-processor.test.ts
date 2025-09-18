/**
 * Tests for NotificationProcessor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationProcessor } from '../processors/notification-processor.js';
import { createSilentLogger } from '../config/logger.js';
import type { BaseNotification, IngestionSource } from '../types/index.js';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let processedNotifications: Array<{ notification: BaseNotification; source: IngestionSource }> = [];
  let processingErrors: Array<{ error: any; payload: any; source: IngestionSource }> = [];

  beforeEach(() => {
    processedNotifications = [];
    processingErrors = [];
    
    processor = new NotificationProcessor({
      logger: createSilentLogger(),
      onNotificationProcessed: async (notification, source) => {
        processedNotifications.push({ notification, source });
      },
      onProcessingError: async (error, payload, source) => {
        processingErrors.push({ error, payload, source });
      }
    });
  });

  describe('Basic Notification Processing', () => {
    it('should process valid notification successfully', async () => {
      const payload = {
        title: 'Test Notification',
        source: 'test',
        content: 'This is a test notification',
        priority: 2
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.notification?.title).toBe('Test Notification');
      expect(result.notification?.source).toBe('test');
      expect(result.notification?.priority).toBe(2);
      expect(result.notification?.id).toBeDefined();
      expect(result.notification?.timestamp).toBeInstanceOf(Date);
      
      expect(processedNotifications).toHaveLength(1);
      expect(processedNotifications[0].source).toBe('webhook');
    });

    it('should generate ID and timestamp for minimal notification', async () => {
      const payload = {
        title: 'Minimal Notification',
        source: 'test'
      };

      const result = await processor.processNotification(payload, 'file');

      expect(result.success).toBe(true);
      expect(result.notification?.id).toBeDefined();
      expect(result.notification?.timestamp).toBeInstanceOf(Date);
      expect(result.notification?.priority).toBe(3); // Default priority
    });

    it('should add ingestion metadata', async () => {
      const payload = {
        title: 'Metadata Test',
        source: 'test'
      };

      const result = await processor.processNotification(payload, 'unix-socket');

      expect(result.success).toBe(true);
      expect(result.notification?.metadata).toBeDefined();
      expect(result.notification?.metadata?.ingestionSource).toBe('unix-socket');
      expect(result.notification?.metadata?.processedAt).toBeDefined();
    });

    it('should enrich tags with ingestion source', async () => {
      const payload = {
        title: 'Tag Test',
        source: 'test',
        tags: ['custom-tag']
      };

      const result = await processor.processNotification(payload, 'websocket');

      expect(result.success).toBe(true);
      expect(result.notification?.tags).toContain('custom-tag');
      expect(result.notification?.tags).toContain('ingestion:websocket');
      expect(result.notification?.tags).toContain(expect.stringMatching(/^hour:\d+$/));
      expect(result.notification?.tags).toContain(expect.stringMatching(/^day:(mon|tue|wed|thu|fri|sat|sun)$/));
    });
  });

  describe('Validation', () => {
    it('should reject notification without title', async () => {
      const payload = {
        source: 'test',
        content: 'Missing title'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMATION_FAILED');
      expect(processingErrors).toHaveLength(0); // Transformation failures don't trigger error callback
    });

    it('should reject notification without source', async () => {
      const payload = {
        title: 'Missing Source'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMATION_FAILED');
    });

    it('should validate priority range', async () => {
      const payload = {
        title: 'Priority Test',
        source: 'test',
        priority: 10 // Invalid - should be 1-5
      };

      const result = await processor.processNotification(payload, 'webhook');

      // Should be processed but priority clamped to valid range
      expect(result.success).toBe(true);
      expect(result.notification?.priority).toBe(5); // Clamped to max
    });

    it('should limit tag count', async () => {
      const manyTags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
      const payload = {
        title: 'Many Tags',
        source: 'test',
        tags: manyTags
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.tags?.length).toBeLessThanOrEqual(20);
    });
  });

  describe('GitHub Transformer', () => {
    it('should transform GitHub push webhook', async () => {
      const payload = {
        repository: { full_name: 'user/repo' },
        sender: { login: 'johndoe' },
        commits: [
          {
            id: 'abc123',
            message: 'Fix critical bug',
            author: { name: 'John Doe' }
          }
        ],
        ref: 'refs/heads/main'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.source).toBe('github');
      expect(result.notification?.title).toContain('main');
      expect(result.notification?.title).toContain('user/repo');
      expect(result.notification?.content).toContain('Fix critical bug');
      expect(result.notification?.tags).toContain('github');
      expect(result.notification?.tags).toContain('push');
    });

    it('should transform GitHub pull request webhook', async () => {
      const payload = {
        action: 'opened',
        repository: { full_name: 'user/repo' },
        sender: { login: 'contributor' },
        pull_request: {
          number: 42,
          title: 'Add awesome feature',
          body: 'This PR adds an awesome new feature',
          html_url: 'https://github.com/user/repo/pull/42'
        }
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.source).toBe('github');
      expect(result.notification?.title).toContain('Pull Request #42');
      expect(result.notification?.title).toContain('opened');
      expect(result.notification?.actions).toBeDefined();
      expect(result.notification?.actions?.[0]?.url).toBe('https://github.com/user/repo/pull/42');
    });

    it('should handle GitHub workflow events with appropriate priority', async () => {
      const failedWorkflow = {
        workflow_run: {
          name: 'CI',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/user/repo/actions/runs/123'
        },
        repository: { full_name: 'user/repo' },
        sender: { login: 'github-actions' }
      };

      const result = await processor.processNotification(failedWorkflow, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.source).toBe('github');
      expect(result.notification?.priority).toBe(1); // High priority for failures
      expect(result.notification?.tags).toContain('workflow');
    });
  });

  describe('Email Transformer', () => {
    it('should transform direct email format', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Important Update',
        body: 'Please review the attached document.'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.source).toBe('email');
      expect(result.notification?.title).toContain('Important Update');
      expect(result.notification?.content).toContain('sender@example.com');
      expect(result.notification?.content).toContain('recipient@example.com');
      expect(result.notification?.tags).toContain('email');
    });

    it('should transform SendGrid webhook', async () => {
      const payload = [
        {
          email: 'user@example.com',
          event: 'bounce',
          reason: 'Invalid email address',
          sg_event_id: 'sg_event_123',
          timestamp: 1234567890
        }
      ];

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.source).toBe('email');
      expect(result.notification?.title).toContain('bounced');
      expect(result.notification?.priority).toBe(2); // High priority for bounces
      expect(result.notification?.tags).toContain('sendgrid');
      expect(result.notification?.tags).toContain('bounce');
    });
  });

  describe('Generic Transformer', () => {
    it('should handle generic object with common fields', async () => {
      const payload = {
        message: 'System alert',
        type: 'warning',
        service: 'database',
        level: 'high'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.title).toContain('System alert');
      expect(result.notification?.source).toBe('unknown'); // Generic fallback
    });

    it('should extract URL actions from generic payload', async () => {
      const payload = {
        title: 'Check this out',
        source: 'app',
        url: 'https://example.com/details'
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.actions).toBeDefined();
      expect(result.notification?.actions?.[0]?.url).toBe('https://example.com/details');
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors gracefully', async () => {
      const payload = null;

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TRANSFORMATION_FAILED');
    });

    it('should sanitize XSS attempts', async () => {
      const payload = {
        title: '<script>alert("xss")</script>Malicious Title',
        source: 'test',
        content: '<img src=x onerror=alert(1)>',
        tags: ['<script>evil</script>']
      };

      const result = await processor.processNotification(payload, 'webhook');

      expect(result.success).toBe(true);
      expect(result.notification?.title).not.toContain('<script>');
      expect(result.notification?.title).toContain('&lt;script&gt;');
      expect(result.notification?.content).not.toContain('onerror=');
      expect(result.notification?.tags?.[0]).not.toContain('<script>');
    });
  });

  describe('Utility Methods', () => {
    it('should provide processing statistics', () => {
      const stats = processor.getStats();
      
      expect(stats.transformers).toBeDefined();
      expect(stats.transformers.length).toBeGreaterThan(0);
      expect(stats.transformers[0]).toHaveProperty('name');
      expect(stats.transformers[0]).toHaveProperty('priority');
    });

    it('should validate payloads without processing', () => {
      const validPayload = { title: 'Test', source: 'test' };
      const invalidPayload = { content: 'Missing required fields' };

      const validResult = processor.validatePayload(validPayload);
      const invalidResult = processor.validatePayload(invalidPayload);

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.suggestions.length).toBeGreaterThan(0);
    });

    it('should test transformations without processing', async () => {
      const githubPayload = {
        repository: { full_name: 'test/repo' },
        sender: { login: 'user' }
      };

      const result = await processor.testTransformation(githubPayload);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.selected).toBeDefined();
      expect(result.selected?.name).toBe('github');
    });
  });
});
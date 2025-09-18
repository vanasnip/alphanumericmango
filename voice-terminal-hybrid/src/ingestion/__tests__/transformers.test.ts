/**
 * Tests for notification transformers
 */

import { describe, it, expect } from 'vitest';
import { GitHubTransformer, EmailTransformer, GenericTransformer, TransformerRegistry } from '../transformers/index.js';

describe('GitHubTransformer', () => {
  const transformer = new GitHubTransformer();

  describe('Detection', () => {
    it('should detect GitHub webhook headers', () => {
      const payload = {
        headers: { 'x-github-event': 'push' },
        body: {}
      };

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should detect GitHub payload structure', () => {
      const payload = {
        repository: { full_name: 'user/repo' },
        sender: { login: 'user' }
      };

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should detect GitHub API responses', () => {
      const payload = {
        html_url: 'https://github.com/user/repo/issues/1'
      };

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should not detect non-GitHub payloads', () => {
      const payload = {
        title: 'Regular notification',
        source: 'other'
      };

      expect(transformer.detect(payload)).toBe(false);
    });
  });

  describe('Transformation', () => {
    it('should transform push events', () => {
      const payload = {
        repository: { full_name: 'user/awesome-repo' },
        sender: { login: 'johndoe' },
        commits: [
          {
            id: 'abc123def456',
            message: 'Fix critical security vulnerability\\nDetailed explanation...',
            author: { name: 'John Doe' }
          },
          {
            id: 'def456ghi789',
            message: 'Update documentation',
            author: { name: 'Jane Smith' }
          }
        ],
        ref: 'refs/heads/main'
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('2 new commits');
      expect(result.data?.title).toContain('main');
      expect(result.data?.title).toContain('user/awesome-repo');
      expect(result.data?.source).toBe('github');
      expect(result.data?.priority).toBe(4);
      expect(result.data?.tags).toContain('github');
      expect(result.data?.tags).toContain('push');
      expect(result.data?.content).toContain('abc123');
      expect(result.data?.content).toContain('Fix critical security vulnerability');
      expect(result.confidence).toBe(0.95);
    });

    it('should transform pull request events', () => {
      const payload = {
        action: 'opened',
        repository: { full_name: 'company/product' },
        sender: { login: 'contributor' },
        pull_request: {
          number: 42,
          title: 'Add awesome new feature',
          body: 'This PR adds a really awesome feature that will make users happy.',
          html_url: 'https://github.com/company/product/pull/42',
          additions: 150,
          deletions: 25
        }
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('Pull Request #42');
      expect(result.data?.title).toContain('opened');
      expect(result.data?.priority).toBe(2);
      expect(result.data?.actions).toBeDefined();
      expect(result.data?.actions?.[0]?.url).toBe('https://github.com/company/product/pull/42');
      expect(result.data?.content).toContain('+150 -25');
    });

    it('should transform workflow events with correct priority', () => {
      const failurePayload = {
        workflow_run: {
          name: 'CI Pipeline',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/user/repo/actions/runs/123',
          event: 'push',
          head_branch: 'feature-branch',
          head_sha: 'abc123def456'
        },
        repository: { full_name: 'user/repo' },
        sender: { login: 'github-actions' }
      };

      const result = transformer.transform(failurePayload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('CI Pipeline');
      expect(result.data?.title).toContain('failure');
      expect(result.data?.priority).toBe(1); // High priority for failures
      expect(result.data?.tags).toContain('workflow');
      expect(result.data?.content).toContain('feature-branch');
    });

    it('should transform release events', () => {
      const payload = {
        action: 'published',
        repository: { full_name: 'user/project' },
        sender: { login: 'maintainer' },
        release: {
          tag_name: 'v2.1.0',
          name: 'Version 2.1.0 - Major Update',
          body: 'This release includes:\\n- New feature A\\n- Bug fix B\\n- Performance improvements',
          html_url: 'https://github.com/user/project/releases/tag/v2.1.0'
        }
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('Version 2.1.0 - Major Update');
      expect(result.data?.title).toContain('published');
      expect(result.data?.priority).toBe(1); // High priority for releases
      expect(result.data?.tags).toContain('release');
      expect(result.data?.actions?.[0]?.url).toBe('https://github.com/user/project/releases/tag/v2.1.0');
    });
  });
});

describe('EmailTransformer', () => {
  const transformer = new EmailTransformer();

  describe('Detection', () => {
    it('should detect direct email fields', () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email'
      };

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should detect SendGrid webhook format', () => {
      const payload = [
        {
          email: 'user@example.com',
          event: 'delivered',
          timestamp: 1234567890
        }
      ];

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should detect Mailgun webhook format', () => {
      const payload = {
        'event-data': {
          event: 'delivered',
          recipient: 'user@example.com'
        }
      };

      expect(transformer.detect(payload)).toBe(true);
    });

    it('should detect Amazon SES format', () => {
      const payload = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'bounce',
          mail: { destination: ['user@example.com'] }
        })
      };

      expect(transformer.detect(payload)).toBe(true);
    });
  });

  describe('Transformation', () => {
    it('should transform direct email', () => {
      const payload = {
        from: 'alerts@service.com',
        to: 'admin@company.com',
        subject: 'Server Alert: High CPU Usage',
        body: 'CPU usage has exceeded 90% for the past 5 minutes on server web-01.',
        priority: 'urgent'
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('Server Alert: High CPU Usage');
      expect(result.data?.source).toBe('email');
      expect(result.data?.priority).toBe(1); // Urgent priority
      expect(result.data?.content).toContain('alerts@service.com');
      expect(result.data?.content).toContain('admin@company.com');
      expect(result.data?.tags).toContain('email');
    });

    it('should transform SendGrid bounce event', () => {
      const payload = [
        {
          email: 'bounce@invalid-domain.com',
          event: 'bounce',
          reason: '550 5.1.1 The email account that you tried to reach does not exist',
          sg_event_id: 'sg_event_id_12345',
          timestamp: 1234567890
        }
      ];

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('bounced');
      expect(result.data?.title).toContain('bounce@invalid-domain.com');
      expect(result.data?.priority).toBe(2); // High priority for bounces
      expect(result.data?.tags).toContain('sendgrid');
      expect(result.data?.tags).toContain('bounce');
      expect(result.data?.content).toContain('550 5.1.1');
    });

    it('should transform Mailgun delivery event', () => {
      const payload = {
        'event-data': {
          event: 'delivered',
          recipient: 'success@example.com',
          timestamp: 1234567890,
          'delivery-status': {
            code: 250,
            description: 'Message delivered'
          }
        }
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.title).toContain('delivered');
      expect(result.data?.title).toContain('success@example.com');
      expect(result.data?.priority).toBe(4); // Low priority for successful delivery
      expect(result.data?.tags).toContain('mailgun');
    });
  });
});

describe('GenericTransformer', () => {
  const transformer = new GenericTransformer();

  describe('Detection', () => {
    it('should detect any object', () => {
      expect(transformer.detect({})).toBe(true);
      expect(transformer.detect({ anything: 'goes' })).toBe(true);
      expect(transformer.detect(null)).toBe(false);
      expect(transformer.detect('string')).toBe(false);
    });
  });

  describe('Transformation', () => {
    it('should extract title from various fields', () => {
      const testCases = [
        { title: 'Direct title', expected: 'Direct title' },
        { subject: 'Email subject', expected: 'Email subject' },
        { message: 'Log message', expected: 'Log message' },
        { data: { title: 'Nested title' }, expected: 'Nested title' }
      ];

      testCases.forEach(({ title: field, subject, message, data, expected }) => {
        const payload = { title: field, subject, message, data };
        const result = transformer.transform(payload);
        
        if (result.success) {
          expect(result.data?.title).toBe(expected);
        }
      });
    });

    it('should extract source from various fields', () => {
      const testCases = [
        { source: 'app', expected: 'app' },
        { from: 'sender', expected: 'sender' },
        { service: 'api', expected: 'api' },
        { url: 'https://example.com/webhook', expected: 'example.com' }
      ];

      testCases.forEach(({ source, from, service, url, expected }) => {
        const payload = { 
          title: 'Test',
          source, 
          from, 
          service, 
          url 
        };
        
        const result = transformer.transform(payload);
        
        if (result.success) {
          expect(result.data?.source).toBe(expected);
        }
      });
    });

    it('should auto-generate tags based on content', () => {
      const payload = {
        title: 'System Error Alert',
        source: 'monitoring',
        error: true,
        warning: false,
        success: false
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.tags).toContain('error');
      expect(result.data?.tags).not.toContain('warning');
    });

    it('should extract actions from URLs', () => {
      const payload = {
        title: 'Check this out',
        source: 'app',
        url: 'https://dashboard.example.com/alerts/123'
      };

      const result = transformer.transform(payload);

      expect(result.success).toBe(true);
      expect(result.data?.actions).toBeDefined();
      expect(result.data?.actions?.[0]?.type).toBe('url');
      expect(result.data?.actions?.[0]?.url).toBe('https://dashboard.example.com/alerts/123');
    });

    it('should handle priority conversion', () => {
      const testCases = [
        { priority: 1, expected: 1 },
        { priority: '3', expected: 3 },
        { priority: 10, expected: 5 }, // Clamped to max
        { priority: 0, expected: 1 }, // Clamped to min
        { importance: 'high', expected: undefined }, // Can't convert string
      ];

      testCases.forEach(({ priority, importance, expected }) => {
        const payload = {
          title: 'Priority test',
          source: 'test',
          priority,
          importance
        };

        const result = transformer.transform(payload);

        if (result.success) {
          expect(result.data?.priority).toBe(expected);
        }
      });
    });

    it('should fail for payloads without title or source', () => {
      const invalidPayloads = [
        {}, // Empty object
        { content: 'Has content but no title/source' },
        { title: 'Has title but no source' },
        { source: 'Has source but no title' }
      ];

      invalidPayloads.forEach(payload => {
        const result = transformer.transform(payload);
        
        if (!result.success) {
          expect(result.confidence).toBe(0.1);
        }
      });
    });
  });
});

describe('TransformerRegistry', () => {
  it('should register transformers and sort by priority', () => {
    const registry = new TransformerRegistry();
    
    const lowPriority = new GenericTransformer(); // priority 10
    const highPriority = new GitHubTransformer(); // priority 90
    
    registry.register(lowPriority);
    registry.register(highPriority);
    
    const all = registry.getAll();
    expect(all[0].priority).toBeGreaterThan(all[1].priority);
  });

  it('should find best transformer for payload', () => {
    const registry = new TransformerRegistry();
    registry.register(new GitHubTransformer());
    registry.register(new GenericTransformer());
    
    const githubPayload = {
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' }
    };
    
    const best = registry.findBest(githubPayload);
    expect(best?.name).toBe('github');
  });

  it('should transform with best available transformer', () => {
    const registry = new TransformerRegistry();
    registry.register(new GitHubTransformer());
    registry.register(new EmailTransformer());
    registry.register(new GenericTransformer());
    
    const emailPayload = {
      from: 'test@example.com',
      subject: 'Test Email'
    };
    
    const result = registry.transform(emailPayload);
    expect(result.success).toBe(true);
    expect(result.data?.source).toBe('email');
  });

  it('should provide transformation suggestions', () => {
    const registry = new TransformerRegistry();
    registry.register(new GitHubTransformer());
    registry.register(new GenericTransformer());
    
    const githubPayload = {
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' }
    };
    
    const suggestions = registry.getSuggestions(githubPayload);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].name).toBe('github');
    expect(suggestions[0].confidence).toBeGreaterThan(0.5);
  });
});
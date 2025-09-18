/**
 * Mock Data Generators for Testing
 * Provides realistic test data for various scenarios
 */

import { nanoid } from 'nanoid';

export interface MockProject {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  webhook_url?: string;
  api_key?: string;
  is_active: boolean;
}

export interface MockUser {
  id: string;
  external_id: string;
  email?: string;
  phone?: string;
  display_name?: string;
  preferences: object;
  is_active: boolean;
}

export interface MockNotification {
  id: string;
  project_id: string;
  user_id: string;
  template_id?: string;
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
  status: 'pending' | 'sent' | 'read' | 'failed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'critical';
  subject?: string;
  body: string;
  data: object;
  scheduled_at?: string;
  retry_count: number;
  max_retries: number;
}

export interface MockTemplate {
  id: string;
  name: string;
  code: string;
  project_id: string;
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
  subject?: string;
  body: string;
  variables: string[];
  metadata: object;
  is_active: boolean;
}

export const createMockProject = (overrides: Partial<MockProject> = {}): MockProject => ({
  id: nanoid(),
  name: `Test Project ${Math.floor(Math.random() * 1000)}`,
  identifier: `test-project-${nanoid(8)}`,
  description: 'A test project for notifications',
  webhook_url: 'https://webhook.example.com/notifications',
  api_key: `api-${nanoid(32)}`,
  is_active: true,
  ...overrides
});

export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: nanoid(),
  external_id: `user-${nanoid(12)}`,
  email: `user${Math.floor(Math.random() * 10000)}@example.com`,
  phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
  display_name: `Test User ${Math.floor(Math.random() * 1000)}`,
  preferences: {
    theme: 'light',
    notifications: true,
    timezone: 'UTC'
  },
  is_active: true,
  ...overrides
});

export const createMockTemplate = (projectId: string, overrides: Partial<MockTemplate> = {}): MockTemplate => ({
  id: nanoid(),
  name: `Template ${Math.floor(Math.random() * 1000)}`,
  code: `template-${nanoid(8)}`,
  project_id: projectId,
  channel: 'email',
  subject: 'Test Subject {{name}}',
  body: 'Hello {{name}}, this is a test notification.',
  variables: ['name'],
  metadata: {
    version: '1.0',
    category: 'test'
  },
  is_active: true,
  ...overrides
});

export const createMockNotification = (
  projectId: string, 
  userId: string, 
  overrides: Partial<MockNotification> = {}
): MockNotification => ({
  id: nanoid(),
  project_id: projectId,
  user_id: userId,
  template_id: nanoid(),
  channel: 'email',
  status: 'pending',
  priority: 'normal',
  subject: 'Test Notification',
  body: 'This is a test notification body.',
  data: {
    user_name: 'Test User',
    action: 'test'
  },
  retry_count: 0,
  max_retries: 3,
  ...overrides
});

export const createBulkMockData = (count: number) => {
  const projects = Array.from({ length: Math.min(count, 5) }, () => createMockProject());
  const users = Array.from({ length: count }, () => createMockUser());
  const templates = projects.flatMap(project => 
    Array.from({ length: 3 }, () => createMockTemplate(project.id))
  );
  const notifications = users.flatMap(user => 
    projects.flatMap(project =>
      Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () =>
        createMockNotification(project.id, user.id)
      )
    )
  );

  return { projects, users, templates, notifications };
};

export const createWebhookPayload = (notification: MockNotification) => ({
  id: notification.id,
  event: 'notification.created',
  data: {
    notification: {
      id: notification.id,
      user_id: notification.user_id,
      channel: notification.channel,
      subject: notification.subject,
      body: notification.body,
      priority: notification.priority,
      created_at: new Date().toISOString()
    }
  },
  timestamp: new Date().toISOString()
});

export const createInvalidPayloads = () => [
  // Missing required fields
  {},
  { user_id: 'test' },
  { body: 'test' },
  
  // Invalid field types
  { user_id: 123, body: 'test' },
  { user_id: 'test', body: null },
  { user_id: 'test', body: 'test', priority: 'invalid' },
  
  // Invalid field values
  { user_id: '', body: 'test' },
  { user_id: 'test', body: '' },
  { user_id: 'test', body: 'test', channel: 'invalid' },
  
  // Malicious payloads
  { user_id: '<script>alert("xss")</script>', body: 'test' },
  { user_id: 'test', body: 'test'; DROP TABLE notifications; --' },
  { user_id: 'test', body: 'test', data: { '../../../etc/passwd': 'test' } }
];

export const createLargePayload = (size: number) => ({
  user_id: `user-${nanoid()}`,
  body: 'A'.repeat(size),
  data: {
    large_field: 'B'.repeat(size)
  }
});

export const createHighVolumeData = (notificationCount: number) => {
  const project = createMockProject();
  const users = Array.from({ length: Math.ceil(notificationCount / 100) }, () => createMockUser());
  
  const notifications = [];
  for (let i = 0; i < notificationCount; i++) {
    const user = users[i % users.length];
    notifications.push(createMockNotification(project.id, user.id, {
      id: `notif-${i.toString().padStart(6, '0')}`,
      priority: i % 10 === 0 ? 'high' : 'normal'
    }));
  }
  
  return { project, users, notifications };
};
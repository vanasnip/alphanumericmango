/**
 * Test Database Utilities
 * Provides SQLite test database setup and management
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { nanoid } from 'nanoid';

export interface TestDatabase {
  db: Database.Database;
  path: string;
  cleanup: () => void;
}

export const createTestDatabase = (name?: string): TestDatabase => {
  const testDbName = name || `test-${nanoid()}.db`;
  const testDbPath = join(process.env.TEST_DB_PATH || '/tmp', testDbName);
  
  // Ensure clean state
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }
  
  const db = new Database(testDbPath);
  
  // Enable foreign keys and WAL mode for better performance
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  return {
    db,
    path: testDbPath,
    cleanup: () => {
      try {
        db.close();
        if (existsSync(testDbPath)) {
          unlinkSync(testDbPath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup test database: ${error}`);
      }
    }
  };
};

export const setupNotificationSchema = (db: Database.Database): void => {
  // Create tables for notification system
  const schema = `
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      identifier TEXT UNIQUE NOT NULL,
      description TEXT,
      webhook_url TEXT,
      api_key TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      external_id TEXT UNIQUE NOT NULL,
      email TEXT,
      phone TEXT,
      display_name TEXT,
      preferences TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Notification templates table
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
      subject TEXT,
      body TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Main notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
      channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'read', 'failed', 'archived')),
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
      subject TEXT,
      body TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      scheduled_at TEXT,
      sent_at TEXT,
      read_at TEXT,
      failed_at TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Notification batches table
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT,
      total_notifications INTEGER DEFAULT 0,
      sent_notifications INTEGER DEFAULT 0,
      failed_notifications INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      metadata TEXT DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Batch notifications relationship
    CREATE TABLE IF NOT EXISTS batch_notifications (
      batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
      notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
      PRIMARY KEY (batch_id, notification_id)
    );

    -- Notification events/audit log
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- User notification preferences
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
      is_enabled INTEGER DEFAULT 1,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      frequency_limit INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, project_id, channel)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_priority_status ON notifications(priority, status);
    CREATE INDEX IF NOT EXISTS idx_events_notification_id ON events(notification_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
    CREATE INDEX IF NOT EXISTS idx_templates_code ON templates(code);
    CREATE INDEX IF NOT EXISTS idx_batches_project_id ON batches(project_id);

    -- Triggers for updated_at timestamps
    CREATE TRIGGER IF NOT EXISTS update_projects_updated_at 
      AFTER UPDATE ON projects 
      BEGIN 
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;

    CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
      AFTER UPDATE ON users 
      BEGIN 
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;

    CREATE TRIGGER IF NOT EXISTS update_templates_updated_at 
      AFTER UPDATE ON templates 
      BEGIN 
        UPDATE templates SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;

    CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at 
      AFTER UPDATE ON notifications 
      BEGIN 
        UPDATE notifications SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;

    CREATE TRIGGER IF NOT EXISTS update_batches_updated_at 
      AFTER UPDATE ON batches 
      BEGIN 
        UPDATE batches SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;

    CREATE TRIGGER IF NOT EXISTS update_user_preferences_updated_at 
      AFTER UPDATE ON user_preferences 
      BEGIN 
        UPDATE user_preferences SET updated_at = datetime('now') WHERE id = NEW.id; 
      END;
  `;

  // Execute schema
  db.exec(schema);
};

export const seedTestData = (db: Database.Database) => {
  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, identifier, description, webhook_url, api_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, external_id, email, display_name, preferences)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTemplate = db.prepare(`
    INSERT INTO templates (id, name, code, project_id, channel, subject, body, variables)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sample data
  const projectId = 'test-project-001';
  const userId = 'test-user-001';
  const templateId = 'test-template-001';

  insertProject.run(
    projectId,
    'Test Project',
    'test-project',
    'A test project for notifications',
    'https://webhook.example.com',
    'test-api-key-123'
  );

  insertUser.run(
    userId,
    'user-external-001',
    'test@example.com',
    'Test User',
    JSON.stringify({ theme: 'dark', notifications: true })
  );

  insertTemplate.run(
    templateId,
    'Welcome Template',
    'welcome',
    projectId,
    'email',
    'Welcome {{name}}!',
    'Hello {{name}}, welcome to our platform!',
    JSON.stringify(['name'])
  );

  return { projectId, userId, templateId };
};
-- Initial Voice Terminal Notification System Schema
-- Migration Version: 001
-- Description: Create all initial tables and indexes

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Projects table (for cross-project notifications)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    name TEXT NOT NULL,
    identifier TEXT UNIQUE NOT NULL,
    description TEXT,
    webhook_url TEXT,
    api_key TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Users table (recipients of notifications)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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

-- Notification batches table (for bulk operations)
CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
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
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority_status ON notifications(priority, status);
CREATE INDEX IF NOT EXISTS idx_events_notification_id ON events(notification_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS idx_templates_code ON templates(code);
CREATE INDEX IF NOT EXISTS idx_batches_project_id ON batches(project_id);

-- Triggers to automatically update the updated_at column
CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_templates_updated_at
    AFTER UPDATE ON templates
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at
    AFTER UPDATE ON notifications
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE notifications SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_batches_updated_at
    AFTER UPDATE ON batches
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE batches SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_preferences_updated_at
    AFTER UPDATE ON user_preferences
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE user_preferences SET updated_at = datetime('now') WHERE id = NEW.id;
END;
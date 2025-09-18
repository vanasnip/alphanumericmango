-- Notification System Database Schema
-- PostgreSQL 15+

-- Create notifications schema
CREATE SCHEMA IF NOT EXISTS notifications;

-- Enum types for notification status and priority
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'read', 'failed', 'archived');
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'push', 'webhook');

-- Projects table (for cross-project notifications)
CREATE TABLE IF NOT EXISTS notifications.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    webhook_url TEXT,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (recipients of notifications)
CREATE TABLE IF NOT EXISTS notifications.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    display_name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notifications.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    project_id UUID REFERENCES notifications.projects(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Main notifications table
CREATE TABLE IF NOT EXISTS notifications.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES notifications.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES notifications.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES notifications.templates(id) ON DELETE SET NULL,
    channel notification_channel NOT NULL,
    status notification_status DEFAULT 'pending',
    priority notification_priority DEFAULT 'normal',
    subject VARCHAR(500),
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification batches table (for bulk operations)
CREATE TABLE IF NOT EXISTS notifications.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES notifications.projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    total_notifications INTEGER DEFAULT 0,
    sent_notifications INTEGER DEFAULT 0,
    failed_notifications INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batch notifications relationship
CREATE TABLE IF NOT EXISTS notifications.batch_notifications (
    batch_id UUID REFERENCES notifications.batches(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications.notifications(id) ON DELETE CASCADE,
    PRIMARY KEY (batch_id, notification_id)
);

-- Notification events/audit log
CREATE TABLE IF NOT EXISTS notifications.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications.notifications(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notifications.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES notifications.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES notifications.projects(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    frequency_limit INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id, channel)
);

-- Indexes for performance
CREATE INDEX idx_notifications_status ON notifications.notifications(status);
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_project_id ON notifications.notifications(project_id);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at DESC);
CREATE INDEX idx_notifications_scheduled_at ON notifications.notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_notifications_priority_status ON notifications.notifications(priority, status);
CREATE INDEX idx_events_notification_id ON notifications.events(notification_id);
CREATE INDEX idx_events_created_at ON notifications.events(created_at DESC);
CREATE INDEX idx_users_external_id ON notifications.users(external_id);
CREATE INDEX idx_templates_code ON notifications.templates(code);
CREATE INDEX idx_batches_project_id ON notifications.batches(project_id);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON notifications.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON notifications.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON notifications.templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications.notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON notifications.batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON notifications.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Supabase Cloud Schema for Voice Terminal Hybrid Sync
-- This schema mirrors the local SQLite structure and adds sync-specific metadata

-- Enable Row Level Security globally
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create sync schema
CREATE SCHEMA IF NOT EXISTS sync;

-- Device management table
CREATE TABLE IF NOT EXISTS sync.devices (
    device_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    sync_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync metadata for tracking entity synchronization
CREATE TABLE IF NOT EXISTS sync.sync_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    device_id TEXT NOT NULL REFERENCES sync.devices(device_id) ON DELETE CASCADE,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    sync_version INTEGER DEFAULT 1,
    checksum TEXT,
    conflict_resolution TEXT DEFAULT 'newest' CHECK (conflict_resolution IN ('local', 'remote', 'newest')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, device_id)
);

-- Sync operations log for tracking changes
CREATE TABLE IF NOT EXISTS sync.operations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    device_id TEXT NOT NULL REFERENCES sync.devices(device_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB,
    version INTEGER DEFAULT 1,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloud mirror of local notifications table
CREATE TABLE IF NOT EXISTS sync.notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    priority TEXT DEFAULT 'normal',
    category TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES sync.devices(device_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    -- Sync metadata
    sync_version INTEGER DEFAULT 1,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Cloud mirror of local projects table (if applicable)
CREATE TABLE IF NOT EXISTS sync.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES sync.devices(device_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Sync metadata
    sync_version INTEGER DEFAULT 1,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Cloud mirror of local user settings
CREATE TABLE IF NOT EXISTS sync.user_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES sync.devices(device_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Sync metadata
    sync_version INTEGER DEFAULT 1,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
    UNIQUE(key, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON sync.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON sync.devices(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync.sync_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_device ON sync.sync_metadata(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_sync ON sync.sync_metadata(last_sync);

CREATE INDEX IF NOT EXISTS idx_operations_log_entity ON sync.operations_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_device ON sync.operations_log(device_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_timestamp ON sync.operations_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_operations_log_processed ON sync.operations_log(processed) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON sync.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON sync.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sync_status ON sync.notifications(sync_status);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON sync.notifications(updated_at);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON sync.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_sync_status ON sync.projects(sync_status);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON sync.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_sync_status ON sync.user_settings(sync_status);

-- Row Level Security (RLS) Policies
-- Users can only access their own data

-- Devices table policies
ALTER TABLE sync.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON sync.devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON sync.devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON sync.devices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON sync.devices
    FOR DELETE USING (auth.uid() = user_id);

-- Sync metadata policies
ALTER TABLE sync.sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync metadata for their devices" ON sync.sync_metadata
    FOR SELECT USING (
        device_id IN (
            SELECT device_id FROM sync.devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sync metadata for their devices" ON sync.sync_metadata
    FOR INSERT WITH CHECK (
        device_id IN (
            SELECT device_id FROM sync.devices WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sync metadata for their devices" ON sync.sync_metadata
    FOR UPDATE USING (
        device_id IN (
            SELECT device_id FROM sync.devices WHERE user_id = auth.uid()
        )
    );

-- Operations log policies
ALTER TABLE sync.operations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own operations" ON sync.operations_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own operations" ON sync.operations_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications table policies
ALTER TABLE sync.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON sync.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications" ON sync.notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON sync.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON sync.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Projects table policies
ALTER TABLE sync.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON sync.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON sync.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON sync.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON sync.projects
    FOR DELETE USING (auth.uid() = user_id);

-- User settings table policies
ALTER TABLE sync.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON sync.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON sync.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON sync.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON sync.user_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for sync operations

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION sync.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at timestamps
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON sync.devices
    FOR EACH ROW EXECUTE FUNCTION sync.update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at BEFORE UPDATE ON sync.sync_metadata
    FOR EACH ROW EXECUTE FUNCTION sync.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON sync.notifications
    FOR EACH ROW EXECUTE FUNCTION sync.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON sync.projects
    FOR EACH ROW EXECUTE FUNCTION sync.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON sync.user_settings
    FOR EACH ROW EXECUTE FUNCTION sync.update_updated_at_column();

-- Function to get device sync statistics
CREATE OR REPLACE FUNCTION sync.get_device_stats(device_uuid TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_records', (
            SELECT COUNT(*) FROM sync.notifications WHERE device_id = device_uuid
        ) + (
            SELECT COUNT(*) FROM sync.projects WHERE device_id = device_uuid
        ) + (
            SELECT COUNT(*) FROM sync.user_settings WHERE device_id = device_uuid
        ),
        'last_sync', (
            SELECT MAX(last_sync) FROM sync.devices WHERE device_id = device_uuid
        ),
        'pending_operations', (
            SELECT COUNT(*) FROM sync.operations_log 
            WHERE device_id = device_uuid AND processed = false
        ),
        'sync_conflicts', (
            SELECT COUNT(*) FROM sync.notifications 
            WHERE device_id = device_uuid AND sync_status = 'conflict'
        ) + (
            SELECT COUNT(*) FROM sync.projects 
            WHERE device_id = device_uuid AND sync_status = 'conflict'
        ) + (
            SELECT COUNT(*) FROM sync.user_settings 
            WHERE device_id = device_uuid AND sync_status = 'conflict'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old operations log entries
CREATE OR REPLACE FUNCTION sync.cleanup_old_operations(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sync.operations_log 
    WHERE processed = true 
    AND created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to cleanup old operations (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sync-operations', '0 2 * * *', 'SELECT sync.cleanup_old_operations(30);');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA sync TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA sync TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sync TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sync TO authenticated;
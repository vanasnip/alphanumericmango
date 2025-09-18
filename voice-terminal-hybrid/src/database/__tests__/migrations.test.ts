import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrationSystem } from '../migrations/migration-system';
import { query, closePool, execute } from '../connection';

describe('SQLite Database Migrations', () => {
  beforeAll(async () => {
    // Reset database and run migrations
    migrationSystem.reset();
    await migrationSystem.migrate();
  });

  afterAll(async () => {
    // Clean up after tests
    migrationSystem.reset();
    await closePool();
  });

  describe('Migration System', () => {
    it('should track migration status', () => {
      const status = migrationSystem.getStatus();
      expect(status.applied).toHaveLength(1);
      expect(status.pending).toHaveLength(0);
      expect(status.total).toBe(1);
      expect(status.applied[0].version).toBe(1);
      expect(status.applied[0].name).toBe('initial_schema');
    });

    it('should not re-apply already applied migrations', async () => {
      const statusBefore = migrationSystem.getStatus();
      await migrationSystem.migrate();
      const statusAfter = migrationSystem.getStatus();
      
      expect(statusAfter.applied).toHaveLength(statusBefore.applied.length);
    });
  });

  describe('Tables Creation', () => {
    const expectedTables = [
      'projects',
      'users',
      'templates',
      'notifications',
      'batches',
      'batch_notifications',
      'events',
      'user_preferences',
      'migrations',
    ];

    expectedTables.forEach(tableName => {
      it(`should create ${tableName} table`, () => {
        const result = query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `, { params: [tableName] });
        
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe(tableName);
      });
    });
  });

  describe('Table Columns', () => {
    it('should create projects table with correct columns', () => {
      const result = query(`PRAGMA table_info(projects)`);
      
      const columns = result.map((row: any) => row.name);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('identifier');
      expect(columns).toContain('webhook_url');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create notifications table with correct columns', () => {
      const result = query(`PRAGMA table_info(notifications)`);
      
      const columns = result.map((row: any) => row.name);
      expect(columns).toContain('id');
      expect(columns).toContain('project_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('status');
      expect(columns).toContain('priority');
      expect(columns).toContain('channel');
      expect(columns).toContain('body');
    });
  });

  describe('Check Constraints (SQLite Enums)', () => {
    it('should enforce status check constraint', () => {
      // Insert valid status
      execute(`
        INSERT INTO users (external_id) VALUES ('test-user')
      `);
      const user = query(`SELECT id FROM users WHERE external_id = 'test-user'`)[0];

      execute(`
        INSERT INTO projects (name, identifier) VALUES ('Test Project', 'test-project')
      `);
      const project = query(`SELECT id FROM projects WHERE identifier = 'test-project'`)[0];

      execute(`
        INSERT INTO notifications (project_id, user_id, channel, status, body) 
        VALUES (?, ?, 'in_app', 'pending', 'Test notification')
      `, { params: [project.id, user.id] });

      // This should succeed
      const notifications = query(`SELECT * FROM notifications WHERE status = 'pending'`);
      expect(notifications).toHaveLength(1);

      // Invalid status should fail
      expect(() => {
        execute(`
          INSERT INTO notifications (project_id, user_id, channel, status, body) 
          VALUES (?, ?, 'in_app', 'invalid_status', 'Test notification')
        `, { params: [project.id, user.id] });
      }).toThrow();
    });

    it('should enforce channel check constraint', () => {
      const user = query(`SELECT id FROM users WHERE external_id = 'test-user'`)[0];
      const project = query(`SELECT id FROM projects WHERE identifier = 'test-project'`)[0];

      // Valid channel should succeed
      execute(`
        INSERT INTO notifications (project_id, user_id, channel, body) 
        VALUES (?, ?, 'email', 'Test notification')
      `, { params: [project.id, user.id] });

      // Invalid channel should fail
      expect(() => {
        execute(`
          INSERT INTO notifications (project_id, user_id, channel, body) 
          VALUES (?, ?, 'invalid_channel', 'Test notification')
        `, { params: [project.id, user.id] });
      }).toThrow();
    });
  });

  describe('Indexes', () => {
    it('should create indexes on notifications table', () => {
      const result = query(`PRAGMA index_list(notifications)`);
      
      const indexNames = result.map((row: any) => row.name);
      expect(indexNames).toContain('idx_notifications_status');
      expect(indexNames).toContain('idx_notifications_user_id');
      expect(indexNames).toContain('idx_notifications_project_id');
    });
  });

  describe('Foreign Keys', () => {
    it('should enforce foreign key constraints', () => {
      expect(() => {
        execute(`
          INSERT INTO notifications (project_id, user_id, channel, body) 
          VALUES ('non-existent-id', 'non-existent-user', 'in_app', 'Test')
        `);
      }).toThrow();
    });
  });

  describe('Triggers', () => {
    it('should automatically update updated_at on project update', () => {
      // Get the initial updated_at
      const initial = query(`
        SELECT updated_at FROM projects WHERE identifier = 'test-project'
      `);
      const initialTime = initial[0].updated_at;
      
      // Wait a moment
      const waitTime = new Promise(resolve => setTimeout(resolve, 10));
      
      // Update the project
      execute(`
        UPDATE projects 
        SET name = 'Updated Project' 
        WHERE identifier = 'test-project'
      `);
      
      // Get the new updated_at
      const updated = query(`
        SELECT updated_at FROM projects WHERE identifier = 'test-project'
      `);
      const updatedTime = updated[0].updated_at;
      
      // Verify updated_at changed
      expect(updatedTime).not.toBe(initialTime);
    });
  });

  describe('JSON Columns', () => {
    it('should store and retrieve JSON data', () => {
      const testData = { setting1: 'value1', setting2: 42 };
      
      execute(`
        UPDATE users 
        SET preferences = ? 
        WHERE external_id = 'test-user'
      `, { params: [JSON.stringify(testData)] });
      
      const result = query(`
        SELECT preferences FROM users WHERE external_id = 'test-user'
      `);
      
      const retrievedData = JSON.parse(result[0].preferences);
      expect(retrievedData).toEqual(testData);
    });
  });
});
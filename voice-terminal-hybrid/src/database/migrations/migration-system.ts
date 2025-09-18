import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, execute, queryOne } from '../sqlite/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Migration {
  version: number;
  name: string;
  sql: string;
  applied_at?: string;
}

export class MigrationSystem {
  private migrationsPath: string;

  constructor(migrationsPath: string = join(__dirname, 'sql')) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration tracking table
   */
  private initializeMigrationTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `;
    execute(sql);
  }

  /**
   * Get all migration files sorted by version
   */
  private getMigrationFiles(): Migration[] {
    if (!existsSync(this.migrationsPath)) {
      console.warn(`Migration directory does not exist: ${this.migrationsPath}`);
      return [];
    }

    const files = readdirSync(this.migrationsPath)
      .filter(file => extname(file) === '.sql')
      .sort();

    return files.map(file => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration file name: ${file}. Expected format: 001_migration_name.sql`);
      }

      const version = parseInt(match[1], 10);
      const name = match[2];
      const sql = readFileSync(join(this.migrationsPath, file), 'utf-8');

      return { version, name, sql };
    });
  }

  /**
   * Get applied migrations from database
   */
  private getAppliedMigrations(): Migration[] {
    try {
      const sql = 'SELECT version, name, applied_at FROM migrations ORDER BY version';
      return getDatabase().prepare(sql).all() as Migration[];
    } catch (error) {
      // Table doesn't exist yet
      return [];
    }
  }

  /**
   * Get pending migrations
   */
  private getPendingMigrations(): Migration[] {
    const allMigrations = this.getMigrationFiles();
    const appliedMigrations = this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    return allMigrations.filter(migration => !appliedVersions.has(migration.version));
  }

  /**
   * Apply a single migration
   */
  private applyMigration(migration: Migration): void {
    const db = getDatabase();
    
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    try {
      // Execute migration in a transaction
      const transaction = db.transaction(() => {
        // Execute the migration SQL
        db.exec(migration.sql);
        
        // Record the migration
        const insertSql = `
          INSERT INTO migrations (version, name) 
          VALUES (?, ?)
        `;
        db.prepare(insertSql).run(migration.version, migration.name);
      });

      transaction();
      console.log(`✓ Migration ${migration.version} applied successfully`);
    } catch (error) {
      console.error(`✗ Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  public async migrate(): Promise<void> {
    console.log('Starting database migration...');
    
    this.initializeMigrationTable();
    const pendingMigrations = this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to apply');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      this.applyMigration(migration);
    }

    console.log('Migration completed successfully');
  }

  /**
   * Get migration status
   */
  public getStatus(): {
    applied: Migration[];
    pending: Migration[];
    total: number;
  } {
    this.initializeMigrationTable();
    
    const applied = this.getAppliedMigrations();
    const pending = this.getPendingMigrations();
    const total = this.getMigrationFiles().length;

    return { applied, pending, total };
  }

  /**
   * Reset database (for testing)
   */
  public reset(): void {
    const db = getDatabase();
    
    console.log('Resetting database...');
    
    // Get all table names
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    // Drop all tables
    for (const table of tables) {
      db.prepare(`DROP TABLE IF EXISTS ${table.name}`).run();
    }

    console.log('Database reset complete');
  }
}

// Singleton instance
export const migrationSystem = new MigrationSystem();
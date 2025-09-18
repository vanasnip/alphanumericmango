import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { getDatabaseConfig, getDatabaseDirectory } from '../config/database.config';

let db: Database.Database | null = null;

export const getDatabase = (): Database.Database => {
  if (!db) {
    const config = getDatabaseConfig();
    
    // Ensure directory exists (unless using :memory: for tests)
    if (config.database !== ':memory:') {
      const dbDir = dirname(config.database);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }
    }

    // Create database connection
    db = new Database(config.database, {
      readonly: config.readonly,
      fileMustExist: config.fileMustExist,
      timeout: config.timeout,
      verbose: config.verbose ? console.log : undefined,
    });

    // Configure SQLite for better performance and reliability
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = memory');
    db.pragma('mmap_size = 268435456'); // 256MB

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Error handling
    db.on?.('open', () => {
      console.log('SQLite database connection opened');
    });

    db.on?.('close', () => {
      console.log('SQLite database connection closed');
    });
  }

  return db;
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
    console.log('SQLite database closed');
  }
};

export const testConnection = (): boolean => {
  try {
    const database = getDatabase();
    const result = database.prepare("SELECT datetime('now') as now").get();
    console.log('SQLite connection test successful:', result);
    return true;
  } catch (error) {
    console.error('SQLite connection test failed:', error);
    return false;
  }
};

export interface QueryOptions {
  params?: any[];
  transaction?: boolean;
}

export const query = <T = any>(
  sql: string,
  options: QueryOptions = {}
): T[] => {
  const database = getDatabase();
  const { params = [] } = options;

  try {
    const stmt = database.prepare(sql);
    const result = stmt.all(...params) as T[];
    return result;
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
};

export const queryOne = <T = any>(
  sql: string,
  options: QueryOptions = {}
): T | null => {
  const database = getDatabase();
  const { params = [] } = options;

  try {
    const stmt = database.prepare(sql);
    const result = stmt.get(...params) as T | undefined;
    return result || null;
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
};

export const execute = (
  sql: string,
  options: QueryOptions = {}
): Database.RunResult => {
  const database = getDatabase();
  const { params = [] } = options;

  try {
    const stmt = database.prepare(sql);
    const result = stmt.run(...params);
    return result;
  } catch (error) {
    console.error('SQLite execute error:', error);
    throw error;
  }
};

export const transaction = <T>(
  callback: (db: Database.Database) => T
): T => {
  const database = getDatabase();
  
  const transactionFn = database.transaction(callback);
  return transactionFn(database);
};

// Utility function to generate UUIDs (SQLite doesn't have built-in UUID generation)
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Helper function to initialize database directory
export const initializeDatabaseDirectory = (): void => {
  const dbDir = getDatabaseDirectory();
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }
};

// Helper function to backup database
export const backupDatabase = (backupPath: string): void => {
  const database = getDatabase();
  database.backup(backupPath);
  console.log(`Database backed up to: ${backupPath}`);
};
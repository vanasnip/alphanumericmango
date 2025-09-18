import dotenv from 'dotenv';
import { join } from 'path';
import { homedir } from 'os';

dotenv.config();

export interface SQLiteConfig {
  database: string;
  readonly: boolean;
  fileMustExist: boolean;
  timeout: number;
  verbose?: boolean;
}

export const getDatabaseConfig = (): SQLiteConfig => {
  const isTest = process.env.NODE_ENV === 'test';
  const customPath = process.env.SQLITE_DB_PATH;
  
  // Default location: ~/.voice-terminal/db/notifications.db
  const defaultPath = join(homedir(), '.voice-terminal', 'db', 'notifications.db');
  
  // Use in-memory database for tests
  const testPath = ':memory:';
  
  const config: SQLiteConfig = {
    database: isTest ? testPath : (customPath || defaultPath),
    readonly: false,
    fileMustExist: false,
    timeout: parseInt(process.env.DB_TIMEOUT || '10000', 10),
    verbose: process.env.NODE_ENV === 'development' && process.env.DB_VERBOSE === 'true',
  };

  return config;
};

export const getDefaultDatabasePath = (): string => {
  return join(homedir(), '.voice-terminal', 'db', 'notifications.db');
};

export const getDatabaseDirectory = (): string => {
  return join(homedir(), '.voice-terminal', 'db');
};
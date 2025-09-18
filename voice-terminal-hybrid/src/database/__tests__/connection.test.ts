import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPool, query, transaction, testConnection, closePool, queryOne } from '../connection';
import Database from 'better-sqlite3';

describe('SQLite Database Connection', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = getPool();
  });

  afterAll(async () => {
    await closePool();
  });

  describe('getPool (Database)', () => {
    it('should return a Database instance', () => {
      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(Database);
    });

    it('should return the same database instance on multiple calls', () => {
      const db1 = getPool();
      const db2 = getPool();
      expect(db1).toBe(db2);
    });
  });

  describe('testConnection', () => {
    it('should successfully connect to the database', () => {
      const result = testConnection();
      expect(result).toBe(true);
    });
  });

  describe('query', () => {
    it('should execute a simple query', () => {
      const result = query('SELECT 1 as number');
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });

    it('should execute a query with parameters', () => {
      const result = query('SELECT ? as value', { params: ['test'] });
      expect(result[0].value).toBe('test');
    });

    it('should handle query errors', () => {
      expect(() => query('SELECT * FROM non_existent_table')).toThrow();
    });
  });

  describe('queryOne', () => {
    it('should return single result', () => {
      const result = queryOne('SELECT 1 as number');
      expect(result).toBeDefined();
      expect(result?.number).toBe(1);
    });

    it('should return null for no results', () => {
      const result = queryOne('SELECT 1 WHERE 0');
      expect(result).toBeNull();
    });
  });

  describe('transaction', () => {
    it('should commit successful transactions', () => {
      const result = transaction((db: Database.Database) => {
        const stmt = db.prepare('SELECT 1 as number');
        const res = stmt.get() as { number: number };
        return res.number;
      });
      
      expect(result).toBe(1);
    });

    it('should rollback failed transactions', () => {
      expect(() => {
        transaction((db: Database.Database) => {
          db.prepare('SELECT 1').get();
          throw new Error('Transaction error');
        });
      }).toThrow('Transaction error');
    });

    it('should handle multiple operations in transaction', () => {
      const result = transaction((db: Database.Database) => {
        const stmt1 = db.prepare('SELECT 1 as a');
        const stmt2 = db.prepare('SELECT 2 as b');
        const res1 = stmt1.get() as { a: number };
        const res2 = stmt2.get() as { b: number };
        return {
          a: res1.a,
          b: res2.b,
        };
      });
      
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('Database Configuration', () => {
    it('should have WAL mode enabled', () => {
      const result = query('PRAGMA journal_mode');
      expect(result[0].journal_mode).toBe('wal');
    });

    it('should have foreign keys enabled', () => {
      const result = query('PRAGMA foreign_keys');
      expect(result[0].foreign_keys).toBe(1);
    });
  });
});
// Re-export SQLite database functions for backward compatibility
export {
  getDatabase as getPool,
  query,
  queryOne,
  execute,
  transaction,
  closeDatabase as closePool,
  testConnection,
  generateUUID,
  initializeDatabaseDirectory,
  backupDatabase
} from './sqlite/database';

// For backward compatibility with existing code that expects PostgreSQL-style results
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Wrapper function to match PostgreSQL query interface
export const pgCompatQuery = async <T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const { query } = await import('./sqlite/database');
  const rows = query<T>(text, { params });
  return {
    rows,
    rowCount: rows.length
  };
};
import { Pool } from 'pg';
import { getPool, query } from '../connection';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: CheckResult;
    schema: CheckResult;
    tables: CheckResult;
    connections: CheckResult;
    performance: CheckResult;
  };
  metrics: DatabaseMetrics;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration?: number;
}

interface DatabaseMetrics {
  connectionCount: number;
  maxConnections: number;
  databaseSize: string;
  tableCount: number;
  notificationCount?: number;
  oldestUnprocessedNotification?: Date;
  avgQueryTime?: number;
}

export class DatabaseHealthCheck {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        database: await this.checkDatabaseConnection(),
        schema: await this.checkSchemaExists(),
        tables: await this.checkTablesExist(),
        connections: await this.checkConnectionPool(),
        performance: await this.checkPerformance(),
      },
      metrics: await this.collectMetrics(),
    };

    // Determine overall status
    const checks = Object.values(result.checks);
    if (checks.some(c => c.status === 'fail')) {
      result.status = 'unhealthy';
    } else if (checks.some(c => c.status === 'warning')) {
      result.status = 'degraded';
    }

    console.log(`Health check completed in ${Date.now() - startTime}ms - Status: ${result.status}`);
    return result;
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<CheckResult> {
    const startTime = Date.now();
    try {
      const result = await query('SELECT NOW() as current_time, version() as version');
      const duration = Date.now() - startTime;
      
      return {
        name: 'Database Connection',
        status: 'pass',
        message: `Connected successfully. Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`,
        duration,
      };
    } catch (error) {
      return {
        name: 'Database Connection',
        status: 'fail',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if notifications schema exists
   */
  private async checkSchemaExists(): Promise<CheckResult> {
    try {
      const result = await query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'notifications'
      `);

      if (result.rows.length > 0) {
        return {
          name: 'Schema Check',
          status: 'pass',
          message: 'Notifications schema exists',
        };
      } else {
        return {
          name: 'Schema Check',
          status: 'fail',
          message: 'Notifications schema not found',
        };
      }
    } catch (error) {
      return {
        name: 'Schema Check',
        status: 'fail',
        message: `Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if all required tables exist
   */
  private async checkTablesExist(): Promise<CheckResult> {
    const requiredTables = [
      'projects',
      'users',
      'templates',
      'notifications',
      'batches',
      'batch_notifications',
      'events',
      'user_preferences',
    ];

    try {
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'notifications'
      `);

      const existingTables = result.rows.map(row => row.table_name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length === 0) {
        return {
          name: 'Tables Check',
          status: 'pass',
          message: `All ${requiredTables.length} required tables exist`,
        };
      } else {
        return {
          name: 'Tables Check',
          status: 'fail',
          message: `Missing tables: ${missingTables.join(', ')}`,
        };
      }
    } catch (error) {
      return {
        name: 'Tables Check',
        status: 'fail',
        message: `Table check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check connection pool health
   */
  private async checkConnectionPool(): Promise<CheckResult> {
    try {
      const poolStats = this.pool as any;
      const totalCount = poolStats.totalCount || 0;
      const idleCount = poolStats.idleCount || 0;
      const waitingCount = poolStats.waitingCount || 0;

      const result = await query(`
        SELECT count(*) as connection_count, 
               max_connections 
        FROM pg_stat_activity, 
             (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s
        GROUP BY max_connections
      `);

      const connectionCount = parseInt(result.rows[0]?.connection_count || '0');
      const maxConnections = parseInt(result.rows[0]?.max_connections || '100');
      const usagePercentage = (connectionCount / maxConnections) * 100;

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = `Connections: ${connectionCount}/${maxConnections} (${usagePercentage.toFixed(1)}%)`;

      if (usagePercentage > 90) {
        status = 'fail';
        message += ' - Critical: Connection limit nearly reached';
      } else if (usagePercentage > 75) {
        status = 'warning';
        message += ' - Warning: High connection usage';
      }

      if (waitingCount > 0) {
        status = 'warning';
        message += ` - ${waitingCount} connections waiting`;
      }

      return {
        name: 'Connection Pool',
        status,
        message,
      };
    } catch (error) {
      return {
        name: 'Connection Pool',
        status: 'warning',
        message: `Pool check partial: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check database performance
   */
  private async checkPerformance(): Promise<CheckResult> {
    try {
      // Test query performance
      const testQueries = [
        'SELECT 1',
        'SELECT COUNT(*) FROM notifications.notifications WHERE status = \'pending\'',
        'SELECT COUNT(*) FROM notifications.events WHERE created_at > NOW() - INTERVAL \'1 day\'',
      ];

      const durations: number[] = [];
      
      for (const testQuery of testQueries) {
        const startTime = Date.now();
        try {
          await query(testQuery);
          durations.push(Date.now() - startTime);
        } catch {
          // Ignore errors for non-existent tables
        }
      }

      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = `Average query time: ${avgDuration.toFixed(2)}ms`;

      if (avgDuration > 1000) {
        status = 'fail';
        message += ' - Critical: Very slow query performance';
      } else if (avgDuration > 100) {
        status = 'warning';
        message += ' - Warning: Slow query performance';
      }

      return {
        name: 'Performance',
        status,
        message,
        duration: avgDuration,
      };
    } catch (error) {
      return {
        name: 'Performance',
        status: 'warning',
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Collect database metrics
   */
  private async collectMetrics(): Promise<DatabaseMetrics> {
    const metrics: DatabaseMetrics = {
      connectionCount: 0,
      maxConnections: 100,
      databaseSize: '0 MB',
      tableCount: 0,
    };

    try {
      // Connection metrics
      const connResult = await query(`
        SELECT count(*) as connection_count, 
               max_connections 
        FROM pg_stat_activity, 
             (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s
        GROUP BY max_connections
      `);
      
      if (connResult.rows.length > 0) {
        metrics.connectionCount = parseInt(connResult.rows[0].connection_count);
        metrics.maxConnections = parseInt(connResult.rows[0].max_connections);
      }

      // Database size
      const sizeResult = await query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      metrics.databaseSize = sizeResult.rows[0]?.size || '0 MB';

      // Table count
      const tableResult = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'notifications'
      `);
      metrics.tableCount = parseInt(tableResult.rows[0]?.count || '0');

      // Notification metrics (if tables exist)
      try {
        const notifResult = await query(`
          SELECT COUNT(*) as count 
          FROM notifications.notifications
        `);
        metrics.notificationCount = parseInt(notifResult.rows[0].count);

        const oldestResult = await query(`
          SELECT MIN(created_at) as oldest 
          FROM notifications.notifications 
          WHERE status = 'pending'
        `);
        if (oldestResult.rows[0]?.oldest) {
          metrics.oldestUnprocessedNotification = new Date(oldestResult.rows[0].oldest);
        }
      } catch {
        // Tables might not exist yet
      }

    } catch (error) {
      console.error('Error collecting metrics:', error);
    }

    return metrics;
  }

  /**
   * Monitor database continuously
   */
  startMonitoring(intervalSeconds = 60): NodeJS.Timeout {
    console.log(`🔍 Starting database monitoring (checking every ${intervalSeconds} seconds)`);
    
    // Initial check
    this.checkHealth()
      .then(result => this.logHealthStatus(result))
      .catch(console.error);
    
    // Schedule periodic checks
    return setInterval(async () => {
      try {
        const result = await this.checkHealth();
        this.logHealthStatus(result);
        
        // Alert if unhealthy
        if (result.status === 'unhealthy') {
          console.error('🚨 DATABASE UNHEALTHY - Immediate attention required!');
          // Here you could trigger alerts, send emails, etc.
        }
      } catch (error) {
        console.error('Monitoring check failed:', error);
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Log health status
   */
  private logHealthStatus(result: HealthCheckResult): void {
    const statusEmoji = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
    };

    console.log(`\n${statusEmoji[result.status]} Database Health: ${result.status.toUpperCase()}`);
    console.log(`📊 Metrics:`);
    console.log(`  - Connections: ${result.metrics.connectionCount}/${result.metrics.maxConnections}`);
    console.log(`  - Database Size: ${result.metrics.databaseSize}`);
    console.log(`  - Tables: ${result.metrics.tableCount}`);
    
    if (result.metrics.notificationCount !== undefined) {
      console.log(`  - Notifications: ${result.metrics.notificationCount}`);
    }

    // Log any failed or warning checks
    Object.values(result.checks).forEach(check => {
      if (check.status !== 'pass') {
        const emoji = check.status === 'fail' ? '❌' : '⚠️';
        console.log(`${emoji} ${check.name}: ${check.message}`);
      }
    });
  }
}

// Export singleton instance
export const healthCheck = new DatabaseHealthCheck();
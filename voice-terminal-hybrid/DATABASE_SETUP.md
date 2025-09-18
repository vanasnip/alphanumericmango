# PostgreSQL Database Setup for Notification System

## Overview

This document provides comprehensive instructions for setting up and managing the PostgreSQL database for the Voice Terminal Notification System. The database is designed to handle cross-project notifications with support for multiple channels, templates, and user preferences.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm installed
- PostgreSQL client tools (optional, for direct database access)

## Quick Start

### 1. Clone and Setup

```bash
# Copy environment variables
cp .env.example .env

# Edit .env file with your configurations
nano .env

# Install dependencies
npm install --legacy-peer-deps
```

### 2. Start PostgreSQL with Docker

```bash
# Start the database container
docker-compose up -d

# Verify the containers are running
docker-compose ps

# Check database logs
docker-compose logs postgres
```

### 3. Run Migrations

```bash
# Run all pending migrations
npx knex migrate:latest

# Check migration status
npx knex migrate:status

# Rollback if needed
npx knex migrate:rollback
```

## Database Architecture

### Schema Overview

The notification system uses a dedicated `notifications` schema with the following main tables:

- **projects**: Cross-project registration and configuration
- **users**: Notification recipients
- **templates**: Reusable notification templates
- **notifications**: Individual notification records
- **batches**: Bulk notification operations
- **events**: Audit trail and notification history
- **user_preferences**: Per-user, per-project notification settings

### Data Types

Custom PostgreSQL enum types:
- `notification_status`: pending, sent, read, failed, archived
- `notification_priority`: low, normal, high, critical
- `notification_channel`: in_app, email, sms, push, webhook

## Configuration

### Environment Variables

Key configuration in `.env`:

```bash
# Database Connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=voice_terminal_user
POSTGRES_PASSWORD=secure_password_change_me
POSTGRES_DB=voice_terminal_db

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# Notification Settings
NOTIFICATION_RETENTION_DAYS=90
NOTIFICATION_BATCH_SIZE=100
```

### Connection Pooling

The system uses `pg-pool` for efficient connection management:
- Minimum connections: 2
- Maximum connections: 10
- Idle timeout: 30 seconds

## Database Operations

### Health Check

Monitor database health programmatically:

```typescript
import { healthCheck } from './src/database/utils/health-check';

// Single health check
const result = await healthCheck.checkHealth();
console.log('Database status:', result.status);

// Continuous monitoring (every 60 seconds)
const monitor = healthCheck.startMonitoring(60);
```

### Backup and Restore

#### Manual Backup

```bash
# Create backup
./src/database/scripts/backup/backup.sh

# Create backup with custom directory
./src/database/scripts/backup/backup.sh voice_terminal_db ./custom-backups
```

#### Manual Restore

```bash
# Restore from backup
./src/database/scripts/backup/restore.sh ./backups/backup_voice_terminal_db_20250118_120000.sql.gz

# Restore to different database
./src/database/scripts/backup/restore.sh ./backup.sql.gz different_db_name
```

#### Automated Backups

```typescript
import { databaseBackup } from './src/database/scripts/backup/automated-backup';

// Schedule automatic backups every 24 hours
const scheduler = databaseBackup.scheduleBackups(24);

// Manual backup
const result = await databaseBackup.createBackup({
  backupDir: './backups',
  retentionDays: 30
});
```

## Migration Management

### Creating New Migrations

```bash
# Create a new migration file
npx knex migrate:make add_new_feature --knexfile knexfile.ts

# The file will be created in src/database/migrations/
```

### Migration Best Practices

1. Always include both `up` and `down` methods
2. Use transactions for data migrations
3. Test rollbacks before deploying
4. Name migrations with timestamps and descriptive names

Example migration:

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.withSchema('notifications')
    .createTable('new_table', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema('notifications')
    .dropTableIfExists('new_table');
}
```

## Development Tools

### PgAdmin Access

PgAdmin is included for visual database management:

1. Access PgAdmin at http://localhost:5050
2. Login with credentials from `.env`
3. Add server connection:
   - Host: `postgres` (Docker network name)
   - Port: 5432
   - Username/Password: from `.env`

### Direct Database Access

```bash
# Connect via psql
docker exec -it voice-terminal-postgres psql -U voice_terminal_user -d voice_terminal_db

# Run SQL file
docker exec -i voice-terminal-postgres psql -U voice_terminal_user -d voice_terminal_db < query.sql
```

## Testing

### Connection Testing

```typescript
import { testConnection } from './src/database/connection';

const isConnected = await testConnection();
if (isConnected) {
  console.log('Database connection successful');
}
```

### Migration Testing

```bash
# Test environment setup
NODE_ENV=test npx knex migrate:latest

# Run tests
npm test

# Rollback test database
NODE_ENV=test npx knex migrate:rollback --all
```

## Performance Optimization

### Indexes

The schema includes indexes for common query patterns:
- Status-based queries
- User and project lookups
- Time-based queries (created_at, scheduled_at)
- Priority and status combinations

### Query Optimization Tips

1. Use connection pooling for all queries
2. Implement pagination for large result sets
3. Use JSONB indexes for frequently queried JSON fields
4. Monitor slow queries with `pg_stat_statements`

## Troubleshooting

### Common Issues

#### Connection Refused

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart containers
docker-compose restart

# Check logs
docker-compose logs postgres
```

#### Migration Errors

```bash
# Check current migration status
npx knex migrate:status

# Force unlock if stuck
npx knex migrate:unlock

# Rollback and retry
npx knex migrate:rollback
npx knex migrate:latest
```

#### Permission Issues

```sql
-- Grant schema permissions
GRANT ALL ON SCHEMA notifications TO voice_terminal_user;
GRANT ALL ON ALL TABLES IN SCHEMA notifications TO voice_terminal_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA notifications TO voice_terminal_user;
```

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use strong passwords** - Minimum 16 characters, mixed case, numbers, symbols
3. **Enable SSL in production** - Set `DATABASE_SSL=true`
4. **Implement row-level security** for multi-tenant data
5. **Regular backups** - Automate and test restore procedures
6. **Monitor access logs** - Track unusual connection patterns
7. **Keep PostgreSQL updated** - Use latest stable version

## Monitoring and Alerts

### Key Metrics to Monitor

- Connection pool usage (target < 80%)
- Query performance (p95 < 100ms)
- Database size growth rate
- Failed notification count
- Oldest unprocessed notification age

### Setting Up Alerts

Configure alerts for:
- Database connection failures
- High connection pool usage (> 90%)
- Backup failures
- Migration errors
- Slow query performance

## Production Deployment

### Checklist

- [ ] Environment variables configured securely
- [ ] SSL/TLS enabled for database connections
- [ ] Backup strategy implemented and tested
- [ ] Monitoring and alerting configured
- [ ] Connection pool sized appropriately
- [ ] Migrations tested in staging environment
- [ ] Health checks integrated with load balancer
- [ ] Documentation updated for team

### Scaling Considerations

- Use read replicas for query-heavy workloads
- Implement connection pooling at application level
- Consider partitioning for time-series data
- Use materialized views for complex aggregations
- Implement caching layer for frequently accessed data

## Support and Maintenance

### Regular Maintenance Tasks

- Weekly: Review slow query logs
- Monthly: Analyze index usage and optimize
- Quarterly: Review and archive old notifications
- Annually: Major version upgrades

### Getting Help

- Check logs: `docker-compose logs postgres`
- Database health: Run health check utility
- Migration status: `npx knex migrate:status`
- GitHub Issues: Report bugs and request features

## License

This database setup is part of the Voice Terminal Notification System and follows the project's licensing terms.
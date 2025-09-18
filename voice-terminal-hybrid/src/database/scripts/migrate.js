#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * This script runs pending database migrations.
 */

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Import migration system
    const { migrationSystem } = await import('../migrations/migration-system.js');

    // Run migrations
    await migrationSystem.migrate();

    console.log('✅ Migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
}

export { runMigrations };
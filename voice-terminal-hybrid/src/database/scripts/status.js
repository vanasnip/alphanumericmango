#!/usr/bin/env node

/**
 * Database Status Script
 * 
 * This script shows the current migration status of the database.
 */

async function showStatus() {
  console.log('📊 Checking database migration status...');

  try {
    // Import migration system
    const { migrationSystem } = await import('../migrations/migration-system.js');
    const { testConnection } = await import('../sqlite/database.js');

    // Test connection first
    const connectionOk = testConnection();
    if (!connectionOk) {
      console.log('❌ Database connection failed');
      return;
    }

    // Get migration status
    const status = migrationSystem.getStatus();

    console.log('\n=== Migration Status ===');
    console.log(`Total migrations: ${status.total}`);
    console.log(`Applied: ${status.applied.length}`);
    console.log(`Pending: ${status.pending.length}`);

    if (status.applied.length > 0) {
      console.log('\n📋 Applied Migrations:');
      status.applied.forEach(migration => {
        console.log(`  ✓ ${migration.version.toString().padStart(3, '0')}: ${migration.name} (${migration.applied_at})`);
      });
    }

    if (status.pending.length > 0) {
      console.log('\n⏳ Pending Migrations:');
      status.pending.forEach(migration => {
        console.log(`  ⌛ ${migration.version.toString().padStart(3, '0')}: ${migration.name}`);
      });
    } else {
      console.log('\n✅ All migrations are up to date!');
    }

  } catch (error) {
    console.error('❌ Failed to check status:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await showStatus();
}

export { showStatus };
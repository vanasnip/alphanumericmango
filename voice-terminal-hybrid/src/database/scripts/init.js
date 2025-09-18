#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * This script initializes the SQLite database for the Voice Terminal application.
 * It creates the necessary directory structure and runs initial migrations.
 */

import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

async function initializeDatabase() {
  console.log('🚀 Initializing Voice Terminal Database...');

  try {
    // Create database directory
    const dbDir = join(homedir(), '.voice-terminal', 'db');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      console.log(`✓ Created database directory: ${dbDir}`);
    } else {
      console.log(`✓ Database directory already exists: ${dbDir}`);
    }

    // Import and run migrations
    const { migrationSystem } = await import('../migrations/migration-system.js');
    const { testConnection } = await import('../sqlite/database.js');

    // Test database connection
    console.log('🔗 Testing database connection...');
    const connectionOk = testConnection();
    if (!connectionOk) {
      throw new Error('Database connection test failed');
    }
    console.log('✓ Database connection successful');

    // Run migrations
    console.log('📦 Running database migrations...');
    await migrationSystem.migrate();

    console.log('🎉 Database initialization completed successfully!');
    console.log(`📍 Database location: ${join(dbDir, 'notifications.db')}`);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await initializeDatabase();
}

export { initializeDatabase };
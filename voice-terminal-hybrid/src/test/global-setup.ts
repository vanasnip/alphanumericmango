/**
 * Global test setup for Vitest
 * Initializes test environment and database connections
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

let testDir: string;

export async function setup() {
  console.log('🚀 Setting up global test environment...');
  
  // Create temporary directory for test databases
  testDir = mkdtempSync(join(tmpdir(), 'voice-terminal-test-'));
  process.env.TEST_DB_PATH = testDir;
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  console.log(`📁 Test database directory: ${testDir}`);
  console.log('✅ Global test environment ready');
}

export async function teardown() {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up test directory
  if (testDir) {
    try {
      rmSync(testDir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up test directory: ${testDir}`);
    } catch (error) {
      console.warn(`⚠️ Failed to clean up test directory: ${error}`);
    }
  }
  
  console.log('✅ Global test cleanup complete');
}
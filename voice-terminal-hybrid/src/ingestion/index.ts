/**
 * Universal notification ingestion system
 * 
 * This module provides a comprehensive notification ingestion system that supports:
 * - HTTP webhooks with rate limiting and authentication
 * - WebSocket real-time streaming
 * - File watching for JSON notifications
 * - Unix socket/named pipe IPC communication
 * - Smart format transformation (GitHub, email, etc.)
 * - Schema validation and sanitization
 */

// Core types
export type * from './types/index.js';

// Schema validation
export * from './schema/index.js';

// Transformers
export * from './transformers/index.js';

// Endpoints
export * from './endpoints/index.js';

// Processors
export * from './processors/index.js';

// Configuration
export * from './config/index.js';

// Main ingestion server
export { NotificationIngestionServer } from './server.js';
/**
 * Default configuration for notification ingestion system
 */

import { join } from 'path';
import { homedir } from 'os';
import type { IngestionConfig } from '../types/index.js';

/**
 * Default ingestion configuration
 */
export const defaultConfig: IngestionConfig = {
  // HTTP server configuration
  port: 3456,
  
  // Optional API key for webhook authentication
  apiKey: undefined,
  
  // IP allowlist for webhook access (empty = allow all)
  ipAllowlist: [],
  
  // Maximum payload size (1MB)
  maxPayloadSize: 1024 * 1024,
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Maximum 100 requests per window per IP
  },
  
  // File watcher configuration
  fileWatcher: {
    directory: join(homedir(), '.voice-terminal', 'notify'),
    pollInterval: 1000 // Check every second (for fallback polling)
  },
  
  // Unix socket configuration
  unixSocket: {
    path: join(homedir(), '.voice-terminal', 'notify.pipe'),
    mode: 0o666 // Read/write for owner and group
  },
  
  // WebSocket configuration
  websocket: {
    enabled: true,
    authRequired: false // Set to true to require API key authentication
  }
};

/**
 * Environment variable names for configuration
 */
export const ENV_VARS = {
  PORT: 'INGESTION_PORT',
  API_KEY: 'INGESTION_API_KEY',
  IP_ALLOWLIST: 'INGESTION_IP_ALLOWLIST',
  MAX_PAYLOAD_SIZE: 'INGESTION_MAX_PAYLOAD_SIZE',
  RATE_LIMIT_WINDOW: 'INGESTION_RATE_LIMIT_WINDOW',
  RATE_LIMIT_MAX: 'INGESTION_RATE_LIMIT_MAX',
  FILE_WATCH_DIR: 'INGESTION_FILE_WATCH_DIR',
  UNIX_SOCKET_PATH: 'INGESTION_UNIX_SOCKET_PATH',
  UNIX_SOCKET_MODE: 'INGESTION_UNIX_SOCKET_MODE',
  WEBSOCKET_ENABLED: 'INGESTION_WEBSOCKET_ENABLED',
  WEBSOCKET_AUTH_REQUIRED: 'INGESTION_WEBSOCKET_AUTH_REQUIRED'
} as const;

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): IngestionConfig {
  const config: IngestionConfig = { ...defaultConfig };

  // Load port
  if (process.env[ENV_VARS.PORT]) {
    const port = parseInt(process.env[ENV_VARS.PORT], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      config.port = port;
    }
  }

  // Load API key
  if (process.env[ENV_VARS.API_KEY]) {
    config.apiKey = process.env[ENV_VARS.API_KEY];
  }

  // Load IP allowlist
  if (process.env[ENV_VARS.IP_ALLOWLIST]) {
    config.ipAllowlist = process.env[ENV_VARS.IP_ALLOWLIST]
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);
  }

  // Load max payload size
  if (process.env[ENV_VARS.MAX_PAYLOAD_SIZE]) {
    const size = parseInt(process.env[ENV_VARS.MAX_PAYLOAD_SIZE], 10);
    if (!isNaN(size) && size > 0) {
      config.maxPayloadSize = size;
    }
  }

  // Load rate limiting
  if (process.env[ENV_VARS.RATE_LIMIT_WINDOW]) {
    const windowMs = parseInt(process.env[ENV_VARS.RATE_LIMIT_WINDOW], 10);
    if (!isNaN(windowMs) && windowMs > 0) {
      config.rateLimit.windowMs = windowMs;
    }
  }

  if (process.env[ENV_VARS.RATE_LIMIT_MAX]) {
    const max = parseInt(process.env[ENV_VARS.RATE_LIMIT_MAX], 10);
    if (!isNaN(max) && max > 0) {
      config.rateLimit.max = max;
    }
  }

  // Load file watcher directory
  if (process.env[ENV_VARS.FILE_WATCH_DIR]) {
    config.fileWatcher.directory = process.env[ENV_VARS.FILE_WATCH_DIR];
  }

  // Load Unix socket configuration
  if (process.env[ENV_VARS.UNIX_SOCKET_PATH]) {
    config.unixSocket.path = process.env[ENV_VARS.UNIX_SOCKET_PATH];
  }

  if (process.env[ENV_VARS.UNIX_SOCKET_MODE]) {
    const mode = parseInt(process.env[ENV_VARS.UNIX_SOCKET_MODE], 8); // Octal
    if (!isNaN(mode)) {
      config.unixSocket.mode = mode;
    }
  }

  // Load WebSocket configuration
  if (process.env[ENV_VARS.WEBSOCKET_ENABLED]) {
    config.websocket.enabled = process.env[ENV_VARS.WEBSOCKET_ENABLED].toLowerCase() === 'true';
  }

  if (process.env[ENV_VARS.WEBSOCKET_AUTH_REQUIRED]) {
    config.websocket.authRequired = process.env[ENV_VARS.WEBSOCKET_AUTH_REQUIRED].toLowerCase() === 'true';
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: IngestionConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate payload size
  if (config.maxPayloadSize < 1024) {
    errors.push(`Max payload size too small: ${config.maxPayloadSize}. Must be at least 1KB.`);
  }

  if (config.maxPayloadSize > 100 * 1024 * 1024) {
    errors.push(`Max payload size too large: ${config.maxPayloadSize}. Should not exceed 100MB.`);
  }

  // Validate rate limiting
  if (config.rateLimit.windowMs < 1000) {
    errors.push(`Rate limit window too small: ${config.rateLimit.windowMs}. Must be at least 1000ms.`);
  }

  if (config.rateLimit.max < 1) {
    errors.push(`Rate limit max too small: ${config.rateLimit.max}. Must be at least 1.`);
  }

  // Validate IP allowlist format
  if (config.ipAllowlist) {
    for (const ip of config.ipAllowlist) {
      if (!isValidIPOrCIDR(ip)) {
        errors.push(`Invalid IP address or CIDR in allowlist: ${ip}`);
      }
    }
  }

  // Validate WebSocket auth requirement
  if (config.websocket.authRequired && !config.apiKey) {
    errors.push('WebSocket authentication is required but no API key is configured.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Basic IP address or CIDR validation
 */
function isValidIPOrCIDR(ip: string): boolean {
  // IPv4 address pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv4 CIDR pattern
  const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  
  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets
    const octets = ip.split('.').map(Number);
    return octets.every(octet => octet >= 0 && octet <= 255);
  }
  
  if (cidrPattern.test(ip)) {
    // Validate IPv4 CIDR
    const [address, prefix] = ip.split('/');
    const octets = address.split('.').map(Number);
    const prefixNum = Number(prefix);
    
    return octets.every(octet => octet >= 0 && octet <= 255) &&
           prefixNum >= 0 && prefixNum <= 32;
  }
  
  // Could add IPv6 validation here if needed
  return false;
}

/**
 * Generate example configuration file content
 */
export function generateExampleConfig(): string {
  return `# Notification Ingestion Configuration
# Copy this to .env and customize as needed

# HTTP server port (default: 3456)
${ENV_VARS.PORT}=3456

# API key for webhook authentication (optional)
# ${ENV_VARS.API_KEY}=your-secret-api-key-here

# IP allowlist for webhook access (comma-separated, optional)
# ${ENV_VARS.IP_ALLOWLIST}=127.0.0.1,192.168.1.0/24

# Maximum payload size in bytes (default: 1MB)
${ENV_VARS.MAX_PAYLOAD_SIZE}=1048576

# Rate limiting configuration
${ENV_VARS.RATE_LIMIT_WINDOW}=900000  # 15 minutes in milliseconds
${ENV_VARS.RATE_LIMIT_MAX}=100        # Max requests per window

# File watcher directory (default: ~/.voice-terminal/notify)
# ${ENV_VARS.FILE_WATCH_DIR}=/custom/path/to/notify

# Unix socket configuration
# ${ENV_VARS.UNIX_SOCKET_PATH}=/custom/path/to/notify.pipe
# ${ENV_VARS.UNIX_SOCKET_MODE}=666

# WebSocket configuration
${ENV_VARS.WEBSOCKET_ENABLED}=true
${ENV_VARS.WEBSOCKET_AUTH_REQUIRED}=false
`;
}
/**
 * Security Configuration for Voice Terminal Hybrid
 * 
 * Centralized security configuration with environment variable support
 */

import { SecurityConfig } from './types.js';

// Environment variable helpers
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvArray = (key: string, defaultValue: string[]): string[] => {
  const value = process.env[key];
  return value ? value.split(',').map(s => s.trim()) : defaultValue;
};

/**
 * Default security configuration
 * All values can be overridden via environment variables
 */
export const createSecurityConfig = (): SecurityConfig => ({
  rateLimit: {
    enabled: getEnvBoolean('SECURITY_RATE_LIMIT_ENABLED', true),
    windowMs: getEnvNumber('SECURITY_RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
    limits: {
      perIp: getEnvNumber('SECURITY_RATE_LIMIT_PER_IP', 100),
      perApiKey: getEnvNumber('SECURITY_RATE_LIMIT_PER_API_KEY', 1000),
      perEndpoint: {
        '/api/notifications': getEnvNumber('SECURITY_RATE_LIMIT_NOTIFICATIONS', 50),
        '/api/notifications/batch': getEnvNumber('SECURITY_RATE_LIMIT_BATCH', 10),
        '/api/templates': getEnvNumber('SECURITY_RATE_LIMIT_TEMPLATES', 20),
        '/health': getEnvNumber('SECURITY_RATE_LIMIT_HEALTH', 200)
      }
    },
    skipSuccessfulRequests: getEnvBoolean('SECURITY_RATE_LIMIT_SKIP_SUCCESS', false),
    skipFailedRequests: getEnvBoolean('SECURITY_RATE_LIMIT_SKIP_FAILED', false),
    standardHeaders: getEnvBoolean('SECURITY_RATE_LIMIT_STANDARD_HEADERS', true),
    legacyHeaders: getEnvBoolean('SECURITY_RATE_LIMIT_LEGACY_HEADERS', false),
    store: getEnvString('SECURITY_RATE_LIMIT_STORE', 'memory') as 'memory' | 'redis',
    redisUrl: getEnvString('SECURITY_RATE_LIMIT_REDIS_URL', 'redis://localhost:6379')
  },

  apiKeys: {
    enabled: getEnvBoolean('SECURITY_API_KEYS_ENABLED', true),
    algorithm: getEnvString('SECURITY_API_KEYS_ALGORITHM', 'bcrypt') as 'bcrypt' | 'argon2',
    saltRounds: getEnvNumber('SECURITY_API_KEYS_SALT_ROUNDS', 12),
    keyLength: getEnvNumber('SECURITY_API_KEYS_LENGTH', 32),
    rotationDays: getEnvNumber('SECURITY_API_KEYS_ROTATION_DAYS', 90),
    scopes: getEnvArray('SECURITY_API_KEYS_SCOPES', [
      'notifications:read',
      'notifications:write',
      'templates:read',
      'templates:write',
      'batches:read',
      'batches:write',
      'admin:read',
      'admin:write'
    ])
  },

  ipAllowlist: {
    enabled: getEnvBoolean('SECURITY_IP_ALLOWLIST_ENABLED', false),
    allowedCidrs: getEnvArray('SECURITY_IP_ALLOWLIST_CIDRS', [
      '127.0.0.1/32',    // localhost
      '::1/128',         // localhost IPv6
      '10.0.0.0/8',      // Private network
      '172.16.0.0/12',   // Private network
      '192.168.0.0/16'   // Private network
    ]),
    allowLocalhost: getEnvBoolean('SECURITY_IP_ALLOWLIST_LOCALHOST', true),
    blockPrivateNetworks: getEnvBoolean('SECURITY_IP_ALLOWLIST_BLOCK_PRIVATE', false),
    autoReload: getEnvBoolean('SECURITY_IP_ALLOWLIST_AUTO_RELOAD', true),
    reloadIntervalMs: getEnvNumber('SECURITY_IP_ALLOWLIST_RELOAD_INTERVAL', 300000) // 5 minutes
  },

  payloadValidation: {
    maxSizeBytes: getEnvNumber('SECURITY_PAYLOAD_MAX_SIZE', 1048576), // 1MB
    allowedContentTypes: getEnvArray('SECURITY_PAYLOAD_CONTENT_TYPES', [
      'application/json',
      'application/x-www-form-urlencoded',
      'text/plain'
    ]),
    sanitization: {
      stripHtml: getEnvBoolean('SECURITY_PAYLOAD_STRIP_HTML', true),
      stripScripts: getEnvBoolean('SECURITY_PAYLOAD_STRIP_SCRIPTS', true),
      removeComments: getEnvBoolean('SECURITY_PAYLOAD_REMOVE_COMMENTS', true),
      validateJson: getEnvBoolean('SECURITY_PAYLOAD_VALIDATE_JSON', true)
    },
    suspicious: {
      patterns: getEnvArray('SECURITY_PAYLOAD_SUSPICIOUS_PATTERNS', [
        '<script',
        'javascript:',
        'data:text/html',
        'eval\\s*\\(',
        'Function\\s*\\(',
        'setTimeout\\s*\\(',
        'setInterval\\s*\\(',
        'document\\.',
        'window\\.',
        'process\\.',
        'require\\s*\\(',
        'import\\s*\\(',
        '__proto__',
        'constructor',
        'prototype'
      ]),
      maxSuspiciousCount: getEnvNumber('SECURITY_PAYLOAD_MAX_SUSPICIOUS', 3)
    }
  },

  transport: {
    https: {
      enabled: getEnvBoolean('SECURITY_HTTPS_ENABLED', true),
      port: getEnvNumber('SECURITY_HTTPS_PORT', 3443),
      certPath: getEnvString('SECURITY_HTTPS_CERT_PATH', ''),
      keyPath: getEnvString('SECURITY_HTTPS_KEY_PATH', ''),
      generateSelfSigned: getEnvBoolean('SECURITY_HTTPS_SELF_SIGNED', true)
    },
    websocket: {
      enabled: getEnvBoolean('SECURITY_WEBSOCKET_ENABLED', true),
      secure: getEnvBoolean('SECURITY_WEBSOCKET_SECURE', true)
    },
    unixSocket: {
      enabled: getEnvBoolean('SECURITY_UNIX_SOCKET_ENABLED', false),
      path: getEnvString('SECURITY_UNIX_SOCKET_PATH', '/tmp/voice-terminal-notifications.sock'),
      permissions: getEnvString('SECURITY_UNIX_SOCKET_PERMISSIONS', '0600')
    },
    headers: {
      hsts: getEnvBoolean('SECURITY_HEADERS_HSTS', true),
      csp: getEnvString('SECURITY_HEADERS_CSP', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"),
      frameOptions: getEnvString('SECURITY_HEADERS_FRAME_OPTIONS', 'DENY'),
      contentTypeOptions: getEnvBoolean('SECURITY_HEADERS_CONTENT_TYPE_OPTIONS', true),
      xssProtection: getEnvBoolean('SECURITY_HEADERS_XSS_PROTECTION', true)
    }
  },

  audit: {
    enabled: getEnvBoolean('SECURITY_AUDIT_ENABLED', true),
    logLevel: getEnvString('SECURITY_AUDIT_LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
    destination: getEnvString('SECURITY_AUDIT_DESTINATION', 'both') as 'file' | 'database' | 'both',
    rotation: {
      enabled: getEnvBoolean('SECURITY_AUDIT_ROTATION_ENABLED', true),
      maxFiles: getEnvNumber('SECURITY_AUDIT_ROTATION_MAX_FILES', 10),
      maxSizeMB: getEnvNumber('SECURITY_AUDIT_ROTATION_MAX_SIZE_MB', 100),
      retentionDays: getEnvNumber('SECURITY_AUDIT_ROTATION_RETENTION_DAYS', 90)
    },
    fields: {
      includeHeaders: getEnvBoolean('SECURITY_AUDIT_INCLUDE_HEADERS', true),
      includePayload: getEnvBoolean('SECURITY_AUDIT_INCLUDE_PAYLOAD', false), // Privacy by default
      includeResponse: getEnvBoolean('SECURITY_AUDIT_INCLUDE_RESPONSE', false),
      maskSensitive: getEnvBoolean('SECURITY_AUDIT_MASK_SENSITIVE', true)
    },
    gdpr: {
      dataRetentionDays: getEnvNumber('SECURITY_AUDIT_GDPR_RETENTION_DAYS', 365),
      allowDataDeletion: getEnvBoolean('SECURITY_AUDIT_GDPR_ALLOW_DELETION', true),
      anonymizeAfterDays: getEnvNumber('SECURITY_AUDIT_GDPR_ANONYMIZE_DAYS', 90)
    }
  }
});

/**
 * Validate security configuration
 */
export const validateSecurityConfig = (config: SecurityConfig): string[] => {
  const errors: string[] = [];

  // Rate limit validation
  if (config.rateLimit.windowMs <= 0) {
    errors.push('Rate limit window must be positive');
  }
  if (config.rateLimit.limits.perIp <= 0) {
    errors.push('Rate limit per IP must be positive');
  }

  // API key validation
  if (config.apiKeys.saltRounds < 10) {
    errors.push('API key salt rounds must be at least 10');
  }
  if (config.apiKeys.keyLength < 16) {
    errors.push('API key length must be at least 16');
  }

  // Payload validation
  if (config.payloadValidation.maxSizeBytes <= 0) {
    errors.push('Max payload size must be positive');
  }
  if (config.payloadValidation.allowedContentTypes.length === 0) {
    errors.push('At least one content type must be allowed');
  }

  // Transport validation
  if (config.transport.https.enabled && config.transport.https.port <= 0) {
    errors.push('HTTPS port must be positive');
  }

  // Audit validation
  if (config.audit.rotation.maxFiles <= 0) {
    errors.push('Audit rotation max files must be positive');
  }
  if (config.audit.rotation.maxSizeMB <= 0) {
    errors.push('Audit rotation max size must be positive');
  }

  return errors;
};

/**
 * Export default configuration instance
 */
export const securityConfig = createSecurityConfig();
/**
 * Security Types for Voice Terminal Hybrid Notification System
 * 
 * Comprehensive type definitions for all security components
 */

export interface SecurityConfig {
  rateLimit: RateLimitConfig;
  apiKeys: ApiKeyConfig;
  ipAllowlist: IpAllowlistConfig;
  payloadValidation: PayloadValidationConfig;
  transport: TransportSecurityConfig;
  audit: AuditConfig;
}

// Rate Limiting Configuration
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number; // Time window in milliseconds
  limits: {
    perIp: number; // Requests per IP per window
    perApiKey: number; // Requests per API key per window
    perEndpoint: Record<string, number>; // Different limits per endpoint
  };
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  store: 'memory' | 'redis';
  redisUrl?: string;
  keyGenerator?: (req: any) => string;
  handler?: (req: any, res: any, next: any, options: any) => void;
}

// API Key Management
export interface ApiKeyConfig {
  enabled: boolean;
  algorithm: 'bcrypt' | 'argon2';
  saltRounds: number;
  keyLength: number;
  rotationDays: number;
  scopes: string[];
}

export interface ApiKey {
  id: string;
  keyHash: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: ApiKey;
  error?: string;
  shouldRotate?: boolean;
}

// IP Allowlisting
export interface IpAllowlistConfig {
  enabled: boolean;
  allowedCidrs: string[];
  allowLocalhost: boolean;
  blockPrivateNetworks: boolean;
  autoReload: boolean;
  reloadIntervalMs: number;
}

export interface IpValidationResult {
  isAllowed: boolean;
  matchedCidr?: string;
  error?: string;
}

// Payload Validation
export interface PayloadValidationConfig {
  maxSizeBytes: number;
  allowedContentTypes: string[];
  sanitization: {
    stripHtml: boolean;
    stripScripts: boolean;
    removeComments: boolean;
    validateJson: boolean;
  };
  suspicious: {
    patterns: string[];
    maxSuspiciousCount: number;
  };
}

export interface PayloadValidationResult {
  isValid: boolean;
  sanitizedPayload?: any;
  violations: string[];
  suspiciousPatterns: string[];
}

// Transport Security
export interface TransportSecurityConfig {
  https: {
    enabled: boolean;
    port: number;
    certPath?: string;
    keyPath?: string;
    generateSelfSigned: boolean;
  };
  websocket: {
    enabled: boolean;
    secure: boolean; // WSS vs WS
  };
  unixSocket: {
    enabled: boolean;
    path: string;
    permissions: string; // Octal permissions (e.g., '0600')
  };
  headers: {
    hsts: boolean;
    csp: string;
    frameOptions: string;
    contentTypeOptions: boolean;
    xssProtection: boolean;
  };
}

// Audit Logging
export interface AuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  destination: 'file' | 'database' | 'both';
  rotation: {
    enabled: boolean;
    maxFiles: number;
    maxSizeMB: number;
    retentionDays: number;
  };
  fields: {
    includeHeaders: boolean;
    includePayload: boolean;
    includeResponse: boolean;
    maskSensitive: boolean;
  };
  gdpr: {
    dataRetentionDays: number;
    allowDataDeletion: boolean;
    anonymizeAfterDays: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  source: 'http' | 'websocket' | 'unix_socket';
  method?: string;
  endpoint?: string;
  ipAddress: string;
  userAgent?: string;
  apiKeyId?: string;
  success: boolean;
  statusCode?: number;
  responseTime: number;
  payloadSize: number;
  error?: string;
  metadata?: Record<string, any>;
}

// Security Context
export interface SecurityContext {
  ipAddress: string;
  userAgent?: string;
  apiKey?: ApiKey;
  rateLimit: {
    remaining: number;
    resetTime: Date;
  };
  transport: 'http' | 'https' | 'ws' | 'wss' | 'unix';
  validated: boolean;
}

// Threat Detection
export interface ThreatPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'block' | 'alert';
  description: string;
}

export interface ThreatDetectionResult {
  threats: Array<{
    pattern: ThreatPattern;
    matches: string[];
    location: 'headers' | 'payload' | 'query' | 'path';
  }>;
  riskScore: number;
  shouldBlock: boolean;
}

// Security Events
export enum SecurityEventType {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  IP_BLOCKED = 'IP_BLOCKED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  THREAT_DETECTED = 'THREAT_DETECTED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  CONFIG_RELOADED = 'CONFIG_RELOADED'
}

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  action: string;
}

// Notification-specific security
export interface NotificationSecurityContext extends SecurityContext {
  projectId?: string;
  templateId?: string;
  batchId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
}

export interface NotificationValidationResult extends PayloadValidationResult {
  projectValidation: {
    projectExists: boolean;
    projectActive: boolean;
    hasPermission: boolean;
  };
  templateValidation?: {
    templateExists: boolean;
    templateActive: boolean;
    variablesValid: boolean;
  };
  userValidation?: {
    userExists: boolean;
    userActive: boolean;
    hasOptedIn: boolean;
  };
}
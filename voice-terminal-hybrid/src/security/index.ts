/**
 * Security Module Index - Voice Terminal Hybrid
 * 
 * Centralized security exports and initialization utilities
 */

// Core security types
export * from './types.js';

// Configuration
export { createSecurityConfig, validateSecurityConfig, securityConfig } from './config.js';

// Security components
export { RateLimiter, createRateLimitMiddleware } from './rate-limiter.js';
export { ApiKeyManager, createApiKeyMiddleware, requireScope } from './api-keys.js';
export { IpAllowlistManager, createIpAllowlistMiddleware } from './ip-allowlist.js';
export { PayloadValidator, createPayloadValidationMiddleware } from './payload-validator.js';
export { TransportSecurityManager, createSecurityHeadersMiddleware, createWebSocketSecurityHandler } from './transport-security.js';
export { AuditLogger, createAuditMiddleware } from './audit-logger.js';

// Main security manager
import { SecurityConfig, SecurityContext } from './types.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiKeyManager } from './api-keys.js';
import { IpAllowlistManager } from './ip-allowlist.js';
import { PayloadValidator } from './payload-validator.js';
import { TransportSecurityManager } from './transport-security.js';
import { AuditLogger } from './audit-logger.js';

/**
 * Main Security Manager that coordinates all security components
 */
export class SecurityManager {
  private config: SecurityConfig;
  private rateLimiter: RateLimiter;
  private apiKeyManager: ApiKeyManager;
  private ipAllowlistManager: IpAllowlistManager;
  private payloadValidator: PayloadValidator;
  private transportSecurity: TransportSecurityManager;
  private auditLogger: AuditLogger;

  constructor(config: SecurityConfig, logDirectory?: string) {
    this.config = config;
    
    // Initialize security components
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.apiKeyManager = new ApiKeyManager(config.apiKeys);
    this.ipAllowlistManager = new IpAllowlistManager(config.ipAllowlist);
    this.payloadValidator = new PayloadValidator(config.payloadValidation);
    this.transportSecurity = new TransportSecurityManager(config.transport);
    this.auditLogger = new AuditLogger(config.audit, logDirectory);
  }

  /**
   * Initialize all security components
   */
  async initialize(): Promise<void> {
    console.log('Initializing Security Manager...');
    
    // Start rate limiter cleanup
    this.rateLimiter.startCleanupInterval();
    
    // Start API key cleanup
    this.apiKeyManager.startCleanupInterval();
    
    console.log('Security Manager initialized successfully');
  }

  /**
   * Create a complete security middleware stack for Express
   */
  createMiddlewareStack() {
    const middlewares = [];

    // 1. Security headers (always first)
    middlewares.push(require('./transport-security.js').createSecurityHeadersMiddleware(this.config.transport));

    // 2. IP allowlist filtering
    if (this.config.ipAllowlist.enabled) {
      middlewares.push(require('./ip-allowlist.js').createIpAllowlistMiddleware(this.ipAllowlistManager));
    }

    // 3. Rate limiting
    if (this.config.rateLimit.enabled) {
      middlewares.push(require('./rate-limiter.js').createRateLimitMiddleware(this.config.rateLimit));
    }

    // 4. API key authentication
    if (this.config.apiKeys.enabled) {
      middlewares.push(require('./api-keys.js').createApiKeyMiddleware(this.apiKeyManager));
    }

    // 5. Payload validation
    middlewares.push(require('./payload-validator.js').createPayloadValidationMiddleware(this.payloadValidator));

    // 6. Audit logging (always last)
    if (this.config.audit.enabled) {
      middlewares.push(require('./audit-logger.js').createAuditMiddleware(this.auditLogger));
    }

    return middlewares;
  }

  /**
   * Validate a complete security context
   */
  async validateSecurityContext(
    ipAddress: string,
    userAgent?: string,
    apiKey?: string,
    payload?: any,
    endpoint?: string
  ): Promise<{
    isValid: boolean;
    context?: SecurityContext;
    violations: string[];
  }> {
    const violations: string[] = [];
    
    try {
      // 1. IP validation
      const ipValidation = await this.ipAllowlistManager.validateIpAddress(ipAddress);
      if (!ipValidation.isAllowed) {
        violations.push(ipValidation.error || 'IP not allowed');
      }

      // 2. API key validation
      let validatedApiKey = undefined;
      if (apiKey) {
        const apiKeyValidation = await this.apiKeyManager.validateApiKey(apiKey);
        if (!apiKeyValidation.isValid) {
          violations.push(apiKeyValidation.error || 'Invalid API key');
        } else {
          validatedApiKey = apiKeyValidation.apiKey;
        }
      }

      // 3. Build security context
      const context: SecurityContext = {
        ipAddress,
        userAgent,
        apiKey: validatedApiKey,
        rateLimit: { remaining: 0, resetTime: new Date() },
        transport: 'http',
        validated: violations.length === 0
      };

      // 4. Rate limit check
      const rateLimitResult = await this.rateLimiter.checkRateLimit(context, endpoint);
      if (!rateLimitResult.allowed) {
        violations.push('Rate limit exceeded');
      }
      context.rateLimit = {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      };

      // 5. Payload validation
      if (payload) {
        const payloadValidation = await this.payloadValidator.validatePayload(
          payload,
          'application/json',
          JSON.stringify(payload).length
        );
        if (!payloadValidation.isValid) {
          violations.push(...payloadValidation.violations);
        }
      }

      const isValid = violations.length === 0;
      context.validated = isValid;

      return {
        isValid,
        context: isValid ? context : undefined,
        violations
      };

    } catch (error) {
      console.error('Security context validation error:', error);
      violations.push('Security validation failed');
      
      return {
        isValid: false,
        violations
      };
    }
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(
    name: string,
    scopes: string[] = ['notifications:read'],
    expiresInDays?: number
  ) {
    return this.apiKeyManager.generateApiKey(name, scopes, expiresInDays);
  }

  /**
   * Get security statistics
   */
  async getSecurityStatistics() {
    const auditStats = await this.auditLogger.getStatistics();
    
    return {
      audit: auditStats,
      rateLimits: {
        // Would get from rate limiter if it exposed stats
        enabled: this.config.rateLimit.enabled,
        windowMs: this.config.rateLimit.windowMs,
        limits: this.config.rateLimit.limits
      },
      apiKeys: {
        totalKeys: this.apiKeyManager.listApiKeys().length,
        activeKeys: this.apiKeyManager.listApiKeys().filter(k => k.isActive).length
      },
      ipAllowlist: {
        enabled: this.config.ipAllowlist.enabled,
        allowedCidrs: this.ipAllowlistManager.getAllowlist().length
      },
      transport: {
        httpsEnabled: this.config.transport.https.enabled,
        certificateInfo: this.transportSecurity.getCertificateInfo()
      }
    };
  }

  /**
   * Update security configuration at runtime
   */
  async updateConfiguration(partialConfig: Partial<SecurityConfig>): Promise<void> {
    // Merge with existing configuration
    this.config = { ...this.config, ...partialConfig };
    
    // Log configuration change
    await this.auditLogger.logSecurityEvent({
      type: require('./types.js').SecurityEventType.CONFIG_RELOADED,
      timestamp: new Date(),
      severity: 'low',
      source: 'security-manager',
      details: { updatedFields: Object.keys(partialConfig) },
      action: 'config_updated'
    });
  }

  /**
   * Cleanup all security components
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up Security Manager...');
    
    await this.rateLimiter.close();
    await this.auditLogger.cleanup();
    this.ipAllowlistManager.cleanup();
    
    console.log('Security Manager cleanup completed');
  }

  // Getters for individual components
  get components() {
    return {
      rateLimiter: this.rateLimiter,
      apiKeyManager: this.apiKeyManager,
      ipAllowlistManager: this.ipAllowlistManager,
      payloadValidator: this.payloadValidator,
      transportSecurity: this.transportSecurity,
      auditLogger: this.auditLogger
    };
  }

  get configuration() {
    return { ...this.config };
  }
}

/**
 * Create a pre-configured security manager with sensible defaults
 */
export function createSecurityManager(
  overrides?: Partial<SecurityConfig>,
  logDirectory?: string
): SecurityManager {
  const { createSecurityConfig } = require('./config.js');
  const baseConfig = createSecurityConfig();
  const config = overrides ? { ...baseConfig, ...overrides } : baseConfig;
  
  return new SecurityManager(config, logDirectory);
}

/**
 * Utility function to check if a request should be rate limited
 */
export async function checkRateLimit(
  securityManager: SecurityManager,
  ipAddress: string,
  apiKeyId?: string,
  endpoint?: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}> {
  const context = {
    ipAddress,
    apiKey: apiKeyId ? { id: apiKeyId } as any : undefined,
    rateLimit: { remaining: 0, resetTime: new Date() },
    transport: 'http' as const,
    validated: false
  };

  return securityManager.components.rateLimiter.checkRateLimit(context, endpoint);
}

/**
 * Utility function to validate notification payload
 */
export async function validateNotificationPayload(
  securityManager: SecurityManager,
  payload: any
): Promise<{
  isValid: boolean;
  sanitizedPayload?: any;
  violations: string[];
}> {
  const result = await securityManager.components.payloadValidator.validateNotificationPayload(payload);
  
  return {
    isValid: result.isValid,
    sanitizedPayload: result.sanitizedPayload,
    violations: result.violations
  };
}
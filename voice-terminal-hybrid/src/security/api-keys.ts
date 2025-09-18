/**
 * API Key Management System for Voice Terminal Hybrid
 * 
 * Provides secure API key generation, validation, rotation, and scope management
 * with support for both bcrypt and argon2 hashing algorithms
 */

import { createHash, randomBytes } from 'crypto';
import { ApiKey, ApiKeyConfig, ApiKeyValidationResult, SecurityEvent, SecurityEventType } from './types.js';

interface HashedApiKey extends Omit<ApiKey, 'keyHash'> {
  keyHash: string;
}

interface ApiKeyWithPlaintext extends ApiKey {
  plainKey: string;
}

export class ApiKeyManager {
  private config: ApiKeyConfig;
  private keys = new Map<string, HashedApiKey>();
  private bcrypt?: any;
  private argon2?: any;

  constructor(config: ApiKeyConfig) {
    this.config = config;
    this.initializeHashingLibraries();
  }

  /**
   * Initialize hashing libraries based on configuration
   */
  private async initializeHashingLibraries(): Promise<void> {
    try {
      if (this.config.algorithm === 'bcrypt') {
        this.bcrypt = await import('bcrypt');
      } else if (this.config.algorithm === 'argon2') {
        this.argon2 = await import('argon2');
      }
    } catch (error) {
      console.error(`Failed to load ${this.config.algorithm} library:`, error);
      throw new Error(`Hashing library ${this.config.algorithm} not available`);
    }
  }

  /**
   * Generate a new API key with specified scopes
   */
  async generateApiKey(
    name: string,
    scopes: string[] = ['notifications:read'],
    expiresInDays?: number,
    metadata?: Record<string, any>
  ): Promise<ApiKeyWithPlaintext> {
    if (!this.isValidScopes(scopes)) {
      throw new Error('Invalid scopes provided');
    }

    // Generate cryptographically secure random key
    const plainKey = this.generateSecureKey();
    const keyHash = await this.hashKey(plainKey);
    
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey: HashedApiKey = {
      id: this.generateKeyId(),
      keyHash,
      name,
      scopes: scopes.filter(scope => this.config.scopes.includes(scope)),
      isActive: true,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: metadata || {}
    };

    // Store in memory (in production, this would be stored in database)
    this.keys.set(apiKey.id, apiKey);

    this.logApiKeyEvent({
      type: SecurityEventType.API_KEY_ROTATED,
      timestamp: new Date(),
      severity: 'low',
      source: 'api-key-manager',
      details: {
        keyId: apiKey.id,
        action: 'generated',
        scopes,
        name
      },
      action: 'generated'
    });

    return {
      ...apiKey,
      plainKey // Only return plain key once during generation
    };
  }

  /**
   * Validate an API key and return key information
   */
  async validateApiKey(plainKey: string): Promise<ApiKeyValidationResult> {
    try {
      // Extract key ID from the plain key (first 8 characters)
      const keyId = plainKey.substring(0, 8);
      const storedKey = this.keys.get(keyId);

      if (!storedKey) {
        this.logApiKeyEvent({
          type: SecurityEventType.INVALID_API_KEY,
          timestamp: new Date(),
          severity: 'medium',
          source: 'api-key-manager',
          details: {
            keyId,
            reason: 'key_not_found'
          },
          action: 'blocked'
        });

        return {
          isValid: false,
          error: 'API key not found'
        };
      }

      // Check if key is active
      if (!storedKey.isActive) {
        this.logApiKeyEvent({
          type: SecurityEventType.INVALID_API_KEY,
          timestamp: new Date(),
          severity: 'medium',
          source: 'api-key-manager',
          details: {
            keyId: storedKey.id,
            reason: 'key_inactive'
          },
          action: 'blocked'
        });

        return {
          isValid: false,
          error: 'API key is inactive'
        };
      }

      // Check if key has expired
      if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
        this.logApiKeyEvent({
          type: SecurityEventType.INVALID_API_KEY,
          timestamp: new Date(),
          severity: 'medium',
          source: 'api-key-manager',
          details: {
            keyId: storedKey.id,
            reason: 'key_expired',
            expiresAt: storedKey.expiresAt
          },
          action: 'blocked'
        });

        return {
          isValid: false,
          error: 'API key has expired'
        };
      }

      // Verify the key hash
      const isValidHash = await this.verifyKey(plainKey, storedKey.keyHash);
      if (!isValidHash) {
        this.logApiKeyEvent({
          type: SecurityEventType.INVALID_API_KEY,
          timestamp: new Date(),
          severity: 'high',
          source: 'api-key-manager',
          details: {
            keyId: storedKey.id,
            reason: 'invalid_hash'
          },
          action: 'blocked'
        });

        return {
          isValid: false,
          error: 'Invalid API key'
        };
      }

      // Update last used timestamp
      storedKey.lastUsedAt = new Date();
      storedKey.updatedAt = new Date();

      // Check if key needs rotation
      const shouldRotate = this.shouldRotateKey(storedKey);

      return {
        isValid: true,
        apiKey: storedKey,
        shouldRotate
      };

    } catch (error) {
      console.error('API key validation error:', error);
      return {
        isValid: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Rotate an existing API key
   */
  async rotateApiKey(keyId: string): Promise<ApiKeyWithPlaintext> {
    const existingKey = this.keys.get(keyId);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Generate new key with same properties
    const newKey = await this.generateApiKey(
      existingKey.name,
      existingKey.scopes,
      existingKey.expiresAt ? Math.ceil((existingKey.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined,
      existingKey.metadata
    );

    // Deactivate old key
    existingKey.isActive = false;
    existingKey.updatedAt = new Date();

    this.logApiKeyEvent({
      type: SecurityEventType.API_KEY_ROTATED,
      timestamp: new Date(),
      severity: 'low',
      source: 'api-key-manager',
      details: {
        oldKeyId: keyId,
        newKeyId: newKey.id,
        action: 'rotated'
      },
      action: 'rotated'
    });

    return newKey;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    key.isActive = false;
    key.updatedAt = new Date();

    this.logApiKeyEvent({
      type: SecurityEventType.API_KEY_ROTATED,
      timestamp: new Date(),
      severity: 'medium',
      source: 'api-key-manager',
      details: {
        keyId,
        action: 'revoked'
      },
      action: 'revoked'
    });
  }

  /**
   * Check if user has required scope
   */
  hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin:write');
  }

  /**
   * List all API keys (without sensitive data)
   */
  listApiKeys(): Array<Omit<ApiKey, 'keyHash'>> {
    return Array.from(this.keys.values()).map(key => {
      const { keyHash, ...publicKey } = key;
      return publicKey;
    });
  }

  /**
   * Get API key by ID (without sensitive data)
   */
  getApiKey(keyId: string): Omit<ApiKey, 'keyHash'> | null {
    const key = this.keys.get(keyId);
    if (!key) return null;
    
    const { keyHash, ...publicKey } = key;
    return publicKey;
  }

  /**
   * Update API key metadata
   */
  async updateApiKey(
    keyId: string,
    updates: {
      name?: string;
      scopes?: string[];
      metadata?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    if (updates.name) key.name = updates.name;
    if (updates.scopes && this.isValidScopes(updates.scopes)) {
      key.scopes = updates.scopes.filter(scope => this.config.scopes.includes(scope));
    }
    if (updates.metadata) key.metadata = { ...key.metadata, ...updates.metadata };
    if (updates.isActive !== undefined) key.isActive = updates.isActive;
    
    key.updatedAt = new Date();
  }

  /**
   * Generate a cryptographically secure API key
   */
  private generateSecureKey(): string {
    const keyId = randomBytes(4).toString('hex'); // 8 character key ID
    const keySecret = randomBytes(this.config.keyLength - 4).toString('hex');
    return keyId + keySecret;
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return randomBytes(4).toString('hex');
  }

  /**
   * Hash an API key using configured algorithm
   */
  private async hashKey(plainKey: string): Promise<string> {
    if (this.config.algorithm === 'bcrypt') {
      return await this.bcrypt.hash(plainKey, this.config.saltRounds);
    } else if (this.config.algorithm === 'argon2') {
      return await this.argon2.hash(plainKey, {
        type: this.argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });
    }
    throw new Error(`Unsupported hashing algorithm: ${this.config.algorithm}`);
  }

  /**
   * Verify an API key against its hash
   */
  private async verifyKey(plainKey: string, hash: string): Promise<boolean> {
    try {
      if (this.config.algorithm === 'bcrypt') {
        return await this.bcrypt.compare(plainKey, hash);
      } else if (this.config.algorithm === 'argon2') {
        return await this.argon2.verify(hash, plainKey);
      }
      return false;
    } catch (error) {
      console.error('Key verification error:', error);
      return false;
    }
  }

  /**
   * Check if an API key should be rotated
   */
  private shouldRotateKey(key: HashedApiKey): boolean {
    if (!key.lastUsedAt) return false;
    
    const daysSinceCreation = (Date.now() - key.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceCreation >= this.config.rotationDays;
  }

  /**
   * Validate that scopes are allowed
   */
  private isValidScopes(scopes: string[]): boolean {
    return scopes.every(scope => this.config.scopes.includes(scope));
  }

  /**
   * Log API key events
   */
  private logApiKeyEvent(event: SecurityEvent): void {
    // This would be handled by the audit logger
    console.log('API Key Event:', event);
  }

  /**
   * Cleanup expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [keyId, key] of this.keys.entries()) {
      if (key.expiresAt && key.expiresAt < now) {
        this.keys.delete(keyId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logApiKeyEvent({
        type: SecurityEventType.API_KEY_ROTATED,
        timestamp: new Date(),
        severity: 'low',
        source: 'api-key-manager',
        details: {
          action: 'cleanup',
          cleanedCount
        },
        action: 'cleanup'
      });
    }

    return cleanedCount;
  }

  /**
   * Start automatic cleanup of expired keys
   */
  startCleanupInterval(): void {
    setInterval(async () => {
      await this.cleanupExpiredKeys();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
}

/**
 * Express middleware for API key authentication
 */
export function createApiKeyMiddleware(apiKeyManager: ApiKeyManager) {
  return async (req: any, res: any, next: any) => {
    // Look for API key in various places
    const apiKey = 
      req.headers['x-api-key'] ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.query.api_key;

    if (!apiKey) {
      // API key is optional - continue without authentication
      return next();
    }

    try {
      const validation = await apiKeyManager.validateApiKey(apiKey);
      
      if (!validation.isValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: validation.error
        });
      }

      // Add API key to request context
      req.apiKey = validation.apiKey;
      
      // Warn if key should be rotated
      if (validation.shouldRotate) {
        res.set('X-API-Key-Rotation-Required', 'true');
      }

      next();
    } catch (error) {
      console.error('API key middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed'
      });
    }
  };
}

/**
 * Middleware to require specific scopes
 */
export function requireScope(requiredScope: string) {
  return (req: any, res: any, next: any) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    const apiKeyManager = new ApiKeyManager({ 
      enabled: true,
      algorithm: 'bcrypt',
      saltRounds: 12,
      keyLength: 32,
      rotationDays: 90,
      scopes: []
    });

    if (!apiKeyManager.hasScope(req.apiKey, requiredScope)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Scope '${requiredScope}' required`
      });
    }

    next();
  };
}
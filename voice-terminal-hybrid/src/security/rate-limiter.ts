/**
 * Advanced Rate Limiting for Voice Terminal Hybrid
 * 
 * Implements tiered rate limiting with multiple strategies:
 * - Per IP address
 * - Per API key
 * - Per endpoint
 * - Sliding window algorithm
 * - Redis or memory store
 */

import { RateLimitConfig, SecurityContext, SecurityEvent, SecurityEventType } from './types.js';
import { createHash } from 'crypto';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private memoryStore = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private redisClient?: any; // Redis client if available

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.initializeStore();
  }

  private async initializeStore(): Promise<void> {
    if (this.config.store === 'redis' && this.config.redisUrl) {
      try {
        // Dynamic import for Redis - only load if needed
        const { createClient } = await import('redis');
        this.redisClient = createClient({ url: this.config.redisUrl });
        await this.redisClient.connect();
        console.log('Rate limiter connected to Redis');
      } catch (error) {
        console.warn('Failed to connect to Redis, falling back to memory store:', error);
        this.config.store = 'memory';
      }
    }
  }

  /**
   * Check if request is allowed under rate limits
   */
  async checkRateLimit(
    context: SecurityContext,
    endpoint?: string
  ): Promise<RateLimitResult> {
    const now = Date.now();
    
    // Determine applicable limit
    const limit = this.getApplicableLimit(context, endpoint);
    
    // Generate keys for different rate limit buckets
    const keys = this.generateKeys(context, endpoint);
    
    // Check each applicable rate limit
    const results = await Promise.all(
      keys.map(key => this.checkIndividualLimit(key, limit, now))
    );
    
    // Find the most restrictive result
    const mostRestrictive = results.reduce((prev, current) => 
      current.remaining < prev.remaining ? current : prev
    );
    
    // Log rate limit events
    if (!mostRestrictive.allowed) {
      this.logRateLimitEvent(context, endpoint, mostRestrictive);
    }
    
    return mostRestrictive;
  }

  /**
   * Generate rate limit keys for different buckets
   */
  private generateKeys(context: SecurityContext, endpoint?: string): string[] {
    const keys: string[] = [];
    
    // IP-based rate limiting
    if (context.ipAddress) {
      keys.push(`ip:${this.hashKey(context.ipAddress)}`);
    }
    
    // API key-based rate limiting
    if (context.apiKey?.id) {
      keys.push(`apikey:${context.apiKey.id}`);
    }
    
    // Endpoint-specific rate limiting
    if (endpoint) {
      keys.push(`endpoint:${endpoint}:ip:${this.hashKey(context.ipAddress)}`);
      if (context.apiKey?.id) {
        keys.push(`endpoint:${endpoint}:apikey:${context.apiKey.id}`);
      }
    }
    
    // Global rate limiting (if no other identifiers)
    if (keys.length === 0) {
      keys.push(`global:${this.hashKey(context.ipAddress || 'anonymous')}`);
    }
    
    return keys;
  }

  /**
   * Get applicable rate limit based on context
   */
  private getApplicableLimit(context: SecurityContext, endpoint?: string): number {
    // Endpoint-specific limits take precedence
    if (endpoint && this.config.limits.perEndpoint[endpoint]) {
      return this.config.limits.perEndpoint[endpoint];
    }
    
    // API key limits if authenticated
    if (context.apiKey) {
      return this.config.limits.perApiKey;
    }
    
    // Default to IP limit
    return this.config.limits.perIp;
  }

  /**
   * Check individual rate limit bucket
   */
  private async checkIndividualLimit(
    key: string,
    limit: number,
    now: number
  ): Promise<RateLimitResult> {
    if (this.config.store === 'redis' && this.redisClient) {
      return this.checkRedisLimit(key, limit, now);
    } else {
      return this.checkMemoryLimit(key, limit, now);
    }
  }

  /**
   * Redis-based rate limiting with sliding window
   */
  private async checkRedisLimit(
    key: string,
    limit: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowMs = this.config.windowMs;
    const resetTime = now + windowMs;
    
    try {
      // Use Redis sorted sets for sliding window
      const pipeline = this.redisClient.multi();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, now - windowMs);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results[1][1] as number;
      
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count - 1);
      
      return {
        allowed,
        remaining,
        resetTime: new Date(resetTime),
        retryAfter: allowed ? undefined : Math.ceil(windowMs / 1000)
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback to memory store
      return this.checkMemoryLimit(key, limit, now);
    }
  }

  /**
   * Memory-based rate limiting
   */
  private checkMemoryLimit(
    key: string,
    limit: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowMs = this.config.windowMs;
    const entry = this.memoryStore.get(key);
    
    if (!entry || now - entry.firstRequest >= windowMs) {
      // New window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now
      };
      this.memoryStore.set(key, newEntry);
      
      return Promise.resolve({
        allowed: true,
        remaining: limit - 1,
        resetTime: new Date(newEntry.resetTime)
      });
    }
    
    // Existing window
    const allowed = entry.count < limit;
    if (allowed) {
      entry.count++;
    }
    
    const remaining = Math.max(0, limit - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000);
    
    return Promise.resolve({
      allowed,
      remaining,
      resetTime: new Date(entry.resetTime),
      retryAfter
    });
  }

  /**
   * Clean up expired entries from memory store
   */
  private cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (now >= entry.resetTime) {
        this.memoryStore.delete(key);
      }
    }
  }

  /**
   * Hash sensitive keys for storage
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Log rate limit events for monitoring
   */
  private logRateLimitEvent(
    context: SecurityContext,
    endpoint: string | undefined,
    result: RateLimitResult
  ): void {
    const event: SecurityEvent = {
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      timestamp: new Date(),
      severity: 'medium',
      source: context.ipAddress,
      details: {
        endpoint,
        apiKeyId: context.apiKey?.id,
        userAgent: context.userAgent,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      },
      action: 'blocked'
    };
    
    // This would be handled by the audit logger
    console.warn('Rate limit exceeded:', event);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    context: SecurityContext,
    endpoint?: string
  ): Promise<RateLimitResult> {
    // Similar to checkRateLimit but doesn't increment counters
    const limit = this.getApplicableLimit(context, endpoint);
    const keys = this.generateKeys(context, endpoint);
    const now = Date.now();
    
    if (this.config.store === 'redis' && this.redisClient) {
      const key = keys[0]; // Use first key for status
      try {
        const count = await this.redisClient.zcard(key);
        const remaining = Math.max(0, limit - count);
        const resetTime = now + this.config.windowMs;
        
        return {
          allowed: count < limit,
          remaining,
          resetTime: new Date(resetTime)
        };
      } catch (error) {
        console.error('Redis rate limit status error:', error);
      }
    }
    
    // Memory store status
    const key = keys[0];
    const entry = this.memoryStore.get(key);
    
    if (!entry) {
      return {
        allowed: true,
        remaining: limit,
        resetTime: new Date(now + this.config.windowMs)
      };
    }
    
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count < limit,
      remaining,
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Reset rate limits for a specific context (admin function)
   */
  async resetRateLimit(context: SecurityContext, endpoint?: string): Promise<void> {
    const keys = this.generateKeys(context, endpoint);
    
    if (this.config.store === 'redis' && this.redisClient) {
      await Promise.all(keys.map(key => this.redisClient.del(key)));
    } else {
      keys.forEach(key => this.memoryStore.delete(key));
    }
  }

  /**
   * Start cleanup interval for memory store
   */
  startCleanupInterval(): void {
    if (this.config.store === 'memory') {
      setInterval(() => {
        this.cleanupMemoryStore();
      }, this.config.windowMs);
    }
  }

  /**
   * Close rate limiter and cleanup resources
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryStore.clear();
  }
}

/**
 * Express middleware factory for rate limiting
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config);
  rateLimiter.startCleanupInterval();

  return async (req: any, res: any, next: any) => {
    if (!config.enabled) {
      return next();
    }

    try {
      const context: SecurityContext = {
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        apiKey: req.apiKey, // Set by API key middleware
        rateLimit: { remaining: 0, resetTime: new Date() },
        transport: req.secure ? 'https' : 'http',
        validated: false
      };

      const endpoint = req.route?.path || req.path;
      const result = await rateLimiter.checkRateLimit(context, endpoint);

      // Set rate limit headers
      if (config.standardHeaders) {
        res.set({
          'RateLimit-Limit': config.limits.perIp.toString(),
          'RateLimit-Remaining': result.remaining.toString(),
          'RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000).toString()
        });
      }

      if (config.legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': config.limits.perIp.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000).toString()
        });
      }

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter
        });
      }

      // Add rate limit info to request context
      context.rateLimit = {
        remaining: result.remaining,
        resetTime: result.resetTime
      };
      req.securityContext = context;

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // In case of error, allow request to proceed (fail open)
      next();
    }
  };
}
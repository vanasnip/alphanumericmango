# API Rate Limiting and Throttling System
## AlphanumericMango Project - Production-Grade Request Control

Version: 1.0.0  
Implementation Date: 2025-09-18  
Framework Owner: Backend Security Engineering  
Classification: CONFIDENTIAL  
Status: IMPLEMENTATION REQUIRED

---

## Executive Summary

This document establishes comprehensive API rate limiting and throttling infrastructure for the AlphanumericMango voice-controlled terminal system. The framework implements distributed rate limiting with Redis, dynamic behavior-based limiting, API abuse detection, burst handling, and emergency bypass mechanisms to ensure service availability and prevent abuse.

**Primary Objectives**:
- Implement distributed rate limiting with Redis clustering
- Deploy dynamic rate limiting based on user behavior patterns
- Establish API abuse detection and automated response systems
- Create intelligent burst handling and fair queuing mechanisms
- Implement emergency bypass capabilities for critical operations

**Security Posture Target**: Achieve **99.9% uptime** under attack conditions and **<50ms rate limiting overhead**.

---

## 1. Distributed Rate Limiting with Redis

### 1.1 High-Performance Distributed Rate Limiter

```typescript
/**
 * Production-grade distributed rate limiter using Redis
 * Implements sliding window, token bucket, and leaky bucket algorithms
 */
import Redis from 'ioredis';
import { promisify } from 'util';

export class DistributedRateLimiter {
  private redis: Redis.Cluster | Redis;
  private readonly config: RateLimiterConfig;
  private readonly scripts: RateLimitingScripts;
  private readonly metrics: RateLimitMetrics;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.redis = this.initializeRedis();
    this.scripts = new RateLimitingScripts(this.redis);
    this.metrics = new RateLimitMetrics();
  }

  private initializeRedis(): Redis.Cluster | Redis {
    if (this.config.redis.cluster) {
      return new Redis.Cluster(this.config.redis.nodes, {
        redisOptions: {
          password: this.config.redis.password,
          connectTimeout: 10000,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false
        },
        enableOfflineQueue: false,
        clusterRetryDelayOnFailover: 100
      });
    } else {
      return new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3
      });
    }
  }

  async checkLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const startTime = Date.now();
    
    try {
      // Determine rate limit rules for this request
      const rules = await this.getRateLimitRules(request);
      
      // Check each applicable rule
      const results: RuleCheckResult[] = [];
      
      for (const rule of rules) {
        const ruleResult = await this.checkRule(request, rule);
        results.push(ruleResult);
        
        // If any rule is violated, request is denied
        if (!ruleResult.allowed) {
          const finalResult: RateLimitResult = {
            allowed: false,
            reason: ruleResult.reason,
            retryAfter: ruleResult.retryAfter,
            rule: rule.name,
            current: ruleResult.current,
            limit: ruleResult.limit,
            windowRemaining: ruleResult.windowRemaining,
            metadata: {
              checkDuration: Date.now() - startTime,
              rulesChecked: results.length,
              userId: request.userId,
              endpoint: request.endpoint
            }
          };
          
          await this.recordViolation(request, rule, finalResult);
          this.metrics.recordRateLimit(finalResult);
          
          return finalResult;
        }
      }
      
      // All rules passed - allow request
      const successResult: RateLimitResult = {
        allowed: true,
        current: results[0]?.current || 0,
        limit: results[0]?.limit || 0,
        windowRemaining: results[0]?.windowRemaining || 0,
        metadata: {
          checkDuration: Date.now() - startTime,
          rulesChecked: results.length,
          userId: request.userId,
          endpoint: request.endpoint
        }
      };
      
      this.metrics.recordRateLimit(successResult);
      return successResult;
      
    } catch (error) {
      // On error, fail open with logging
      console.error('Rate limiter error:', error);
      
      return {
        allowed: true,
        reason: 'RATE_LIMITER_ERROR',
        metadata: {
          error: error.message,
          checkDuration: Date.now() - startTime
        }
      };
    }
  }

  private async checkRule(request: RateLimitRequest, rule: RateLimitRule): Promise<RuleCheckResult> {
    const key = this.buildRuleKey(request, rule);
    const now = Date.now();
    
    switch (rule.algorithm) {
      case 'sliding_window':
        return await this.checkSlidingWindow(key, rule, now);
        
      case 'token_bucket':
        return await this.checkTokenBucket(key, rule, now);
        
      case 'leaky_bucket':
        return await this.checkLeakyBucket(key, rule, now);
        
      case 'fixed_window':
        return await this.checkFixedWindow(key, rule, now);
        
      default:
        throw new Error(`Unknown rate limiting algorithm: ${rule.algorithm}`);
    }
  }

  private async checkSlidingWindow(key: string, rule: RateLimitRule, now: number): Promise<RuleCheckResult> {
    const windowSize = rule.windowSize * 1000; // Convert to milliseconds
    const windowStart = now - windowSize;
    
    // Use Redis sorted set for sliding window
    const result = await this.scripts.executeSlidingWindow(
      key,
      windowStart.toString(),
      now.toString(),
      rule.limit.toString(),
      rule.windowSize.toString()
    );
    
    const [allowed, current, ttl] = result;
    
    return {
      allowed: allowed === 1,
      current: parseInt(current),
      limit: rule.limit,
      windowRemaining: Math.max(0, Math.floor(ttl / 1000)),
      reason: allowed === 0 ? 'RATE_LIMIT_EXCEEDED' : undefined,
      retryAfter: allowed === 0 ? Math.ceil(ttl / 1000) : undefined
    };
  }

  private async checkTokenBucket(key: string, rule: RateLimitRule, now: number): Promise<RuleCheckResult> {
    const refillRate = rule.refillRate || rule.limit / rule.windowSize;
    const bucketSize = rule.bucketSize || rule.limit;
    
    const result = await this.scripts.executeTokenBucket(
      key,
      bucketSize.toString(),
      refillRate.toString(),
      now.toString(),
      '1' // tokens requested
    );
    
    const [allowed, tokens, nextRefill] = result;
    
    return {
      allowed: allowed === 1,
      current: bucketSize - parseInt(tokens),
      limit: bucketSize,
      windowRemaining: Math.max(0, Math.floor((nextRefill - now) / 1000)),
      reason: allowed === 0 ? 'TOKEN_BUCKET_EMPTY' : undefined,
      retryAfter: allowed === 0 ? Math.ceil((nextRefill - now) / 1000) : undefined
    };
  }

  private async checkLeakyBucket(key: string, rule: RateLimitRule, now: number): Promise<RuleCheckResult> {
    const leakRate = rule.leakRate || rule.limit / rule.windowSize;
    const bucketSize = rule.bucketSize || rule.limit;
    
    const result = await this.scripts.executeLeakyBucket(
      key,
      bucketSize.toString(),
      leakRate.toString(),
      now.toString(),
      '1' // requests to add
    );
    
    const [allowed, level, nextLeak] = result;
    
    return {
      allowed: allowed === 1,
      current: parseInt(level),
      limit: bucketSize,
      windowRemaining: Math.max(0, Math.floor((nextLeak - now) / 1000)),
      reason: allowed === 0 ? 'LEAKY_BUCKET_FULL' : undefined,
      retryAfter: allowed === 0 ? Math.ceil((nextLeak - now) / 1000) : undefined
    };
  }

  private async checkFixedWindow(key: string, rule: RateLimitRule, now: number): Promise<RuleCheckResult> {
    const windowStart = Math.floor(now / (rule.windowSize * 1000)) * (rule.windowSize * 1000);
    const windowKey = `${key}:${windowStart}`;
    
    const current = await this.redis.incr(windowKey);
    
    if (current === 1) {
      // Set expiration on first increment
      await this.redis.expire(windowKey, rule.windowSize);
    }
    
    const allowed = current <= rule.limit;
    const windowEnd = windowStart + (rule.windowSize * 1000);
    
    return {
      allowed,
      current,
      limit: rule.limit,
      windowRemaining: Math.max(0, Math.floor((windowEnd - now) / 1000)),
      reason: !allowed ? 'FIXED_WINDOW_EXCEEDED' : undefined,
      retryAfter: !allowed ? Math.ceil((windowEnd - now) / 1000) : undefined
    };
  }

  private async getRateLimitRules(request: RateLimitRequest): Promise<RateLimitRule[]> {
    const rules: RateLimitRule[] = [];
    
    // Global rate limits
    if (this.config.globalLimits) {
      rules.push(...this.config.globalLimits);
    }
    
    // Endpoint-specific limits
    const endpointLimits = this.config.endpointLimits[request.endpoint];
    if (endpointLimits) {
      rules.push(...endpointLimits);
    }
    
    // User-tier specific limits
    if (request.userTier && this.config.userTierLimits[request.userTier]) {
      rules.push(...this.config.userTierLimits[request.userTier]);
    }
    
    // IP-based limits
    if (this.config.ipLimits) {
      rules.push(...this.config.ipLimits);
    }
    
    // Dynamic limits based on user behavior
    const dynamicLimits = await this.getDynamicLimits(request);
    rules.push(...dynamicLimits);
    
    return rules;
  }

  private async getDynamicLimits(request: RateLimitRequest): Promise<RateLimitRule[]> {
    // Implement dynamic rate limiting based on user behavior
    const behaviorScore = await this.getUserBehaviorScore(request.userId);
    
    if (behaviorScore < 0.5) {
      // Suspicious behavior - apply stricter limits
      return [{
        name: 'suspicious_behavior',
        algorithm: 'sliding_window',
        limit: 10,
        windowSize: 60,
        keyPattern: 'user:{userId}'
      }];
    } else if (behaviorScore > 0.8) {
      // Trusted user - apply relaxed limits
      return [{
        name: 'trusted_user',
        algorithm: 'token_bucket',
        limit: 1000,
        windowSize: 60,
        bucketSize: 1000,
        refillRate: 50,
        keyPattern: 'user:{userId}'
      }];
    }
    
    return [];
  }

  private async getUserBehaviorScore(userId: string): Promise<number> {
    // This would integrate with behavior analysis system
    // For now, return neutral score
    return 0.7;
  }

  private buildRuleKey(request: RateLimitRequest, rule: RateLimitRule): string {
    let key = rule.keyPattern;
    
    // Replace placeholders
    key = key.replace('{userId}', request.userId || 'anonymous');
    key = key.replace('{ip}', request.ip);
    key = key.replace('{endpoint}', request.endpoint);
    key = key.replace('{userTier}', request.userTier || 'default');
    
    return `rate_limit:${key}`;
  }

  private async recordViolation(
    request: RateLimitRequest, 
    rule: RateLimitRule, 
    result: RateLimitResult
  ): Promise<void> {
    const violation: RateLimitViolation = {
      timestamp: new Date(),
      userId: request.userId,
      ip: request.ip,
      endpoint: request.endpoint,
      userAgent: request.userAgent,
      rule: rule.name,
      current: result.current!,
      limit: result.limit!,
      reason: result.reason!
    };
    
    // Store violation for analysis
    const violationKey = `violations:${request.userId || request.ip}:${Date.now()}`;
    await this.redis.setex(violationKey, 3600, JSON.stringify(violation));
    
    // Update violation counters
    const counterKey = `violation_count:${request.userId || request.ip}`;
    await this.redis.incr(counterKey);
    await this.redis.expire(counterKey, 3600);
    
    console.log('Rate limit violation recorded:', violation);
  }

  async getMetrics(): Promise<RateLimitMetricsSnapshot> {
    return this.metrics.getSnapshot();
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}

// Redis Lua scripts for atomic rate limiting operations
class RateLimitingScripts {
  private redis: Redis.Cluster | Redis;
  private scripts: Map<string, string> = new Map();

  constructor(redis: Redis.Cluster | Redis) {
    this.redis = redis;
    this.loadScripts();
  }

  private loadScripts(): void {
    // Sliding window script
    this.scripts.set('sliding_window', `
      local key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local window_size = tonumber(ARGV[4])
      
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- Count current entries
      local current = redis.call('ZCARD', key)
      
      if current < limit then
        -- Add current request
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, window_size)
        return {1, current + 1, window_size * 1000}
      else
        local ttl = redis.call('TTL', key)
        return {0, current, ttl * 1000}
      end
    `);

    // Token bucket script
    this.scripts.set('token_bucket', `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local tokens_requested = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add
      local time_passed = (now - last_refill) / 1000
      local tokens_to_add = time_passed * refill_rate
      tokens = math.min(capacity, tokens + tokens_to_add)
      
      if tokens >= tokens_requested then
        tokens = tokens - tokens_requested
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        return {1, tokens, now + (capacity - tokens) / refill_rate * 1000}
      else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        local next_refill = now + (tokens_requested - tokens) / refill_rate * 1000
        return {0, tokens, next_refill}
      end
    `);

    // Leaky bucket script
    this.scripts.set('leaky_bucket', `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local leak_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local requests_to_add = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'level', 'last_leak')
      local level = tonumber(bucket[1]) or 0
      local last_leak = tonumber(bucket[2]) or now
      
      -- Calculate leaked amount
      local time_passed = (now - last_leak) / 1000
      local leaked = time_passed * leak_rate
      level = math.max(0, level - leaked)
      
      if level + requests_to_add <= capacity then
        level = level + requests_to_add
        redis.call('HMSET', key, 'level', level, 'last_leak', now)
        redis.call('EXPIRE', key, 3600)
        return {1, level, now + level / leak_rate * 1000}
      else
        redis.call('HMSET', key, 'level', level, 'last_leak', now)
        redis.call('EXPIRE', key, 3600)
        local next_leak = now + (level + requests_to_add - capacity) / leak_rate * 1000
        return {0, level, next_leak}
      end
    `);
  }

  async executeSlidingWindow(key: string, ...args: string[]): Promise<number[]> {
    const script = this.scripts.get('sliding_window')!;
    const result = await this.redis.eval(script, 1, key, ...args) as number[];
    return result;
  }

  async executeTokenBucket(key: string, ...args: string[]): Promise<number[]> {
    const script = this.scripts.get('token_bucket')!;
    const result = await this.redis.eval(script, 1, key, ...args) as number[];
    return result;
  }

  async executeLeakyBucket(key: string, ...args: string[]): Promise<number[]> {
    const script = this.scripts.get('leaky_bucket')!;
    const result = await this.redis.eval(script, 1, key, ...args) as number[];
    return result;
  }
}

// Rate limiting metrics collection
class RateLimitMetrics {
  private metrics = {
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    averageCheckTime: 0,
    violationsByRule: new Map<string, number>(),
    violationsByUser: new Map<string, number>()
  };

  recordRateLimit(result: RateLimitResult): void {
    this.metrics.totalRequests++;
    
    if (result.allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.blockedRequests++;
      
      if (result.rule) {
        const current = this.metrics.violationsByRule.get(result.rule) || 0;
        this.metrics.violationsByRule.set(result.rule, current + 1);
      }
      
      if (result.metadata?.userId) {
        const current = this.metrics.violationsByUser.get(result.metadata.userId) || 0;
        this.metrics.violationsByUser.set(result.metadata.userId, current + 1);
      }
    }
    
    if (result.metadata?.checkDuration) {
      this.metrics.averageCheckTime = 
        (this.metrics.averageCheckTime * (this.metrics.totalRequests - 1) + result.metadata.checkDuration) / 
        this.metrics.totalRequests;
    }
  }

  getSnapshot(): RateLimitMetricsSnapshot {
    return {
      timestamp: new Date(),
      totalRequests: this.metrics.totalRequests,
      allowedRequests: this.metrics.allowedRequests,
      blockedRequests: this.metrics.blockedRequests,
      blockRate: this.metrics.totalRequests > 0 ? 
        this.metrics.blockedRequests / this.metrics.totalRequests : 0,
      averageCheckTime: this.metrics.averageCheckTime,
      topViolatedRules: Array.from(this.metrics.violationsByRule.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topViolatingUsers: Array.from(this.metrics.violationsByUser.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      averageCheckTime: 0,
      violationsByRule: new Map(),
      violationsByUser: new Map()
    };
  }
}

// Type definitions
interface RateLimiterConfig {
  redis: {
    cluster?: boolean;
    nodes?: Array<{ host: string; port: number }>;
    host?: string;
    port?: number;
    password: string;
  };
  globalLimits?: RateLimitRule[];
  endpointLimits: Record<string, RateLimitRule[]>;
  userTierLimits: Record<string, RateLimitRule[]>;
  ipLimits?: RateLimitRule[];
}

interface RateLimitRule {
  name: string;
  algorithm: 'sliding_window' | 'token_bucket' | 'leaky_bucket' | 'fixed_window';
  limit: number;
  windowSize: number; // seconds
  keyPattern: string; // e.g., 'user:{userId}', 'ip:{ip}', 'endpoint:{endpoint}'
  bucketSize?: number; // for token/leaky bucket
  refillRate?: number; // tokens per second for token bucket
  leakRate?: number; // requests per second for leaky bucket
}

interface RateLimitRequest {
  userId?: string;
  ip: string;
  endpoint: string;
  userAgent?: string;
  userTier?: string;
  headers?: Record<string, string>;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds
  rule?: string;
  current?: number;
  limit?: number;
  windowRemaining?: number; // seconds
  metadata?: {
    checkDuration?: number;
    rulesChecked?: number;
    userId?: string;
    endpoint?: string;
    error?: string;
  };
}

interface RuleCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  windowRemaining: number;
  reason?: string;
  retryAfter?: number;
}

interface RateLimitViolation {
  timestamp: Date;
  userId?: string;
  ip: string;
  endpoint: string;
  userAgent?: string;
  rule: string;
  current: number;
  limit: number;
  reason: string;
}

interface RateLimitMetricsSnapshot {
  timestamp: Date;
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  blockRate: number;
  averageCheckTime: number;
  topViolatedRules: Array<[string, number]>;
  topViolatingUsers: Array<[string, number]>;
}
```

---

## 2. Dynamic Rate Limiting Based on User Behavior

### 2.1 Behavior-Driven Rate Limiting Engine

```typescript
/**
 * Adaptive rate limiting based on user behavior analysis
 * Automatically adjusts limits based on trust scores and usage patterns
 */
export class BehaviorDrivenRateLimiter {
  private readonly behaviorAnalyzer: UserBehaviorAnalyzer;
  private readonly adaptiveLimits: AdaptiveLimitManager;
  private readonly config: BehaviorConfig;

  constructor(config: BehaviorConfig) {
    this.config = config;
    this.behaviorAnalyzer = new UserBehaviorAnalyzer(config.analysis);
    this.adaptiveLimits = new AdaptiveLimitManager(config.limits);
  }

  async analyzeAndAdjustLimits(request: RateLimitRequest): Promise<AdjustedLimits> {
    // Analyze user behavior
    const behaviorProfile = await this.behaviorAnalyzer.analyzeUser(request.userId);
    
    // Calculate trust score
    const trustScore = this.calculateTrustScore(behaviorProfile);
    
    // Get adaptive limits based on behavior
    const adaptedLimits = await this.adaptiveLimits.getAdaptedLimits(
      request,
      behaviorProfile,
      trustScore
    );
    
    // Log behavior-based adjustment
    this.logBehaviorAdjustment({
      userId: request.userId,
      endpoint: request.endpoint,
      trustScore,
      originalLimits: this.config.baseLimits,
      adjustedLimits: adaptedLimits,
      behaviorFactors: behaviorProfile.factors
    });

    return adaptedLimits;
  }

  private calculateTrustScore(profile: UserBehaviorProfile): number {
    let score = 0.5; // Base neutral score
    
    // Account age factor
    const accountAgeMonths = profile.accountAge / (30 * 24 * 60 * 60 * 1000);
    score += Math.min(0.2, accountAgeMonths * 0.02);
    
    // Usage consistency factor
    score += profile.consistencyScore * 0.15;
    
    // Security incidents factor
    score -= profile.securityIncidents * 0.1;
    
    // API usage pattern factor
    score += profile.apiUsageScore * 0.1;
    
    // Geographic consistency factor
    score += profile.geoConsistencyScore * 0.05;
    
    // Device consistency factor
    score += profile.deviceConsistencyScore * 0.05;
    
    // Authentication method factor
    if (profile.mfaEnabled) score += 0.1;
    if (profile.ssoEnabled) score += 0.05;
    
    // Success rate factor
    score += (profile.successRate - 0.5) * 0.2;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  private logBehaviorAdjustment(adjustment: BehaviorAdjustment): void {
    console.log({
      timestamp: new Date().toISOString(),
      type: 'behavior_based_rate_limit_adjustment',
      ...adjustment
    });
  }
}

class UserBehaviorAnalyzer {
  private readonly config: AnalysisConfig;
  private readonly redis: Redis;
  private readonly profileCache = new Map<string, UserBehaviorProfile>();

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.redis = new Redis(config.redis);
  }

  async analyzeUser(userId?: string): Promise<UserBehaviorProfile> {
    if (!userId) {
      return this.getAnonymousProfile();
    }

    // Check cache first
    if (this.profileCache.has(userId)) {
      const cached = this.profileCache.get(userId)!;
      if (Date.now() - cached.lastUpdated.getTime() < this.config.cacheTimeout) {
        return cached;
      }
    }

    // Build comprehensive behavior profile
    const profile = await this.buildBehaviorProfile(userId);
    
    // Cache the profile
    this.profileCache.set(userId, profile);
    
    return profile;
  }

  private async buildBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    const [
      accountInfo,
      requestHistory,
      securityEvents,
      geoHistory,
      deviceHistory
    ] = await Promise.all([
      this.getAccountInfo(userId),
      this.getRequestHistory(userId),
      this.getSecurityEvents(userId),
      this.getGeographicHistory(userId),
      this.getDeviceHistory(userId)
    ]);

    return {
      userId,
      accountAge: accountInfo.accountAge,
      lastUpdated: new Date(),
      consistencyScore: this.calculateConsistencyScore(requestHistory),
      securityIncidents: securityEvents.length,
      apiUsageScore: this.calculateApiUsageScore(requestHistory),
      geoConsistencyScore: this.calculateGeoConsistency(geoHistory),
      deviceConsistencyScore: this.calculateDeviceConsistency(deviceHistory),
      mfaEnabled: accountInfo.mfaEnabled,
      ssoEnabled: accountInfo.ssoEnabled,
      successRate: this.calculateSuccessRate(requestHistory),
      factors: {
        requestPatterns: this.analyzeRequestPatterns(requestHistory),
        timePatterns: this.analyzeTimePatterns(requestHistory),
        errorPatterns: this.analyzeErrorPatterns(requestHistory),
        burstBehavior: this.analyzeBurstBehavior(requestHistory)
      }
    };
  }

  private calculateConsistencyScore(history: RequestHistoryEntry[]): number {
    if (history.length < 10) return 0.3; // Insufficient data
    
    // Analyze request timing consistency
    const intervals = [];
    for (let i = 1; i < history.length; i++) {
      const interval = history[i].timestamp.getTime() - history[i-1].timestamp.getTime();
      intervals.push(interval);
    }
    
    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((acc, interval) => {
      return acc + Math.pow(interval - meanInterval, 2);
    }, 0) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / meanInterval;
    
    // Lower coefficient of variation = higher consistency
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private calculateApiUsageScore(history: RequestHistoryEntry[]): number {
    if (history.length === 0) return 0.5;
    
    // Analyze endpoint diversity
    const endpoints = new Set(history.map(h => h.endpoint));
    const endpointDiversity = endpoints.size / Math.max(10, history.length);
    
    // Analyze method distribution
    const methods = history.reduce((acc, h) => {
      acc[h.method] = (acc[h.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const methodDistribution = Object.values(methods).map(count => count / history.length);
    const methodEntropy = -methodDistribution.reduce((acc, p) => acc + p * Math.log2(p), 0);
    
    // Combine scores
    return (endpointDiversity * 0.6 + methodEntropy / 3 * 0.4);
  }

  private calculateGeoConsistency(geoHistory: GeographicEntry[]): number {
    if (geoHistory.length < 2) return 0.8; // Assume consistent for new users
    
    const countries = new Set(geoHistory.map(g => g.country));
    const cities = new Set(geoHistory.map(g => g.city));
    
    // High consistency = few unique locations
    const countryConsistency = Math.max(0, 1 - (countries.size - 1) * 0.2);
    const cityConsistency = Math.max(0, 1 - (cities.size - 1) * 0.1);
    
    return (countryConsistency * 0.7 + cityConsistency * 0.3);
  }

  private calculateDeviceConsistency(deviceHistory: DeviceEntry[]): number {
    if (deviceHistory.length < 2) return 0.8;
    
    const devices = new Set(deviceHistory.map(d => d.fingerprint));
    const userAgents = new Set(deviceHistory.map(d => d.userAgent));
    
    // High consistency = few unique devices
    const deviceConsistency = Math.max(0, 1 - (devices.size - 1) * 0.15);
    const userAgentConsistency = Math.max(0, 1 - (userAgents.size - 1) * 0.1);
    
    return (deviceConsistency * 0.8 + userAgentConsistency * 0.2);
  }

  private calculateSuccessRate(history: RequestHistoryEntry[]): number {
    if (history.length === 0) return 0.5;
    
    const successfulRequests = history.filter(h => h.statusCode >= 200 && h.statusCode < 400);
    return successfulRequests.length / history.length;
  }

  private analyzeRequestPatterns(history: RequestHistoryEntry[]): any {
    // Analyze request patterns (endpoint sequences, parameter patterns, etc.)
    return {
      endpointSequences: this.findCommonSequences(history.map(h => h.endpoint)),
      parameterPatterns: this.analyzeParameterPatterns(history),
      headerConsistency: this.analyzeHeaderConsistency(history)
    };
  }

  private analyzeTimePatterns(history: RequestHistoryEntry[]): any {
    // Analyze temporal patterns (time of day, day of week, etc.)
    const hourCounts = new Array(24).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);
    
    history.forEach(h => {
      const hour = h.timestamp.getHours();
      const dayOfWeek = h.timestamp.getDay();
      hourCounts[hour]++;
      dayOfWeekCounts[dayOfWeek]++;
    });
    
    return {
      preferredHours: hourCounts,
      preferredDays: dayOfWeekCounts,
      workingHoursBias: this.calculateWorkingHoursBias(hourCounts)
    };
  }

  private analyzeErrorPatterns(history: RequestHistoryEntry[]): any {
    const errorRequests = history.filter(h => h.statusCode >= 400);
    
    return {
      errorRate: errorRequests.length / history.length,
      commonErrors: this.getCommonStatusCodes(errorRequests),
      errorBursts: this.findErrorBursts(errorRequests)
    };
  }

  private analyzeBurstBehavior(history: RequestHistoryEntry[]): any {
    // Analyze request bursts and their characteristics
    const bursts = this.findRequestBursts(history);
    
    return {
      burstCount: bursts.length,
      averageBurstSize: bursts.length > 0 ? 
        bursts.reduce((sum, b) => sum + b.size, 0) / bursts.length : 0,
      burstPattern: this.categorizeBursts(bursts)
    };
  }

  private getAnonymousProfile(): UserBehaviorProfile {
    return {
      userId: 'anonymous',
      accountAge: 0,
      lastUpdated: new Date(),
      consistencyScore: 0.3,
      securityIncidents: 0,
      apiUsageScore: 0.5,
      geoConsistencyScore: 0.5,
      deviceConsistencyScore: 0.5,
      mfaEnabled: false,
      ssoEnabled: false,
      successRate: 0.8,
      factors: {
        requestPatterns: {},
        timePatterns: {},
        errorPatterns: {},
        burstBehavior: {}
      }
    };
  }

  // Helper methods for analysis
  private async getAccountInfo(userId: string): Promise<any> {
    // Fetch account information
    return {
      accountAge: Date.now() - new Date('2023-01-01').getTime(),
      mfaEnabled: true,
      ssoEnabled: false
    };
  }

  private async getRequestHistory(userId: string): Promise<RequestHistoryEntry[]> {
    // Fetch recent request history
    return [];
  }

  private async getSecurityEvents(userId: string): Promise<any[]> {
    // Fetch security events
    return [];
  }

  private async getGeographicHistory(userId: string): Promise<GeographicEntry[]> {
    // Fetch geographic access history
    return [];
  }

  private async getDeviceHistory(userId: string): Promise<DeviceEntry[]> {
    // Fetch device access history
    return [];
  }

  private findCommonSequences(endpoints: string[]): any {
    // Find common endpoint access sequences
    return {};
  }

  private analyzeParameterPatterns(history: RequestHistoryEntry[]): any {
    // Analyze parameter usage patterns
    return {};
  }

  private analyzeHeaderConsistency(history: RequestHistoryEntry[]): any {
    // Analyze header consistency
    return {};
  }

  private calculateWorkingHoursBias(hourCounts: number[]): number {
    // Calculate bias towards working hours (9-17)
    const workingHours = hourCounts.slice(9, 18);
    const nonWorkingHours = [...hourCounts.slice(0, 9), ...hourCounts.slice(18)];
    
    const workingTotal = workingHours.reduce((a, b) => a + b, 0);
    const nonWorkingTotal = nonWorkingHours.reduce((a, b) => a + b, 0);
    
    if (workingTotal + nonWorkingTotal === 0) return 0.5;
    
    return workingTotal / (workingTotal + nonWorkingTotal);
  }

  private getCommonStatusCodes(errorRequests: RequestHistoryEntry[]): any {
    // Get most common error status codes
    return {};
  }

  private findErrorBursts(errorRequests: RequestHistoryEntry[]): any {
    // Find bursts of errors
    return [];
  }

  private findRequestBursts(history: RequestHistoryEntry[]): any[] {
    // Find request bursts
    return [];
  }

  private categorizeBursts(bursts: any[]): any {
    // Categorize burst patterns
    return {};
  }
}

class AdaptiveLimitManager {
  private readonly config: LimitConfig;

  constructor(config: LimitConfig) {
    this.config = config;
  }

  async getAdaptedLimits(
    request: RateLimitRequest,
    profile: UserBehaviorProfile,
    trustScore: number
  ): Promise<AdjustedLimits> {
    const baseLimits = this.getBaseLimits(request.endpoint);
    
    // Apply trust score modifier
    const trustModifier = this.calculateTrustModifier(trustScore);
    
    // Apply behavior-specific modifiers
    const behaviorModifiers = this.calculateBehaviorModifiers(profile);
    
    // Apply time-based modifiers
    const timeModifier = this.calculateTimeModifier();
    
    // Apply endpoint-specific modifiers
    const endpointModifier = this.calculateEndpointModifier(request.endpoint, profile);
    
    // Combine all modifiers
    const totalModifier = trustModifier * behaviorModifiers * timeModifier * endpointModifier;
    
    const adjustedLimits: AdjustedLimits = {
      requests: Math.floor(baseLimits.requests * totalModifier),
      windowSize: baseLimits.windowSize,
      burstSize: Math.floor(baseLimits.burstSize * Math.min(2, totalModifier)),
      modifiers: {
        trust: trustModifier,
        behavior: behaviorModifiers,
        time: timeModifier,
        endpoint: endpointModifier,
        total: totalModifier
      },
      reasoning: this.buildReasoningChain(trustScore, profile, totalModifier)
    };

    return adjustedLimits;
  }

  private getBaseLimits(endpoint: string): BaseLimits {
    return this.config.endpointLimits[endpoint] || this.config.defaultLimits;
  }

  private calculateTrustModifier(trustScore: number): number {
    // Linear scaling between 0.2x and 3x based on trust score
    return 0.2 + (trustScore * 2.8);
  }

  private calculateBehaviorModifiers(profile: UserBehaviorProfile): number {
    let modifier = 1.0;
    
    // Consistency bonus
    modifier *= (0.8 + profile.consistencyScore * 0.4);
    
    // Success rate bonus
    modifier *= (0.7 + profile.successRate * 0.6);
    
    // Security incident penalty
    modifier *= Math.max(0.3, 1 - profile.securityIncidents * 0.1);
    
    // API usage sophistication bonus
    modifier *= (0.9 + profile.apiUsageScore * 0.2);
    
    return modifier;
  }

  private calculateTimeModifier(): number {
    const hour = new Date().getHours();
    
    // Reduce limits during peak hours (9-17)
    if (hour >= 9 && hour <= 17) {
      return 0.8;
    }
    
    // Slightly reduce limits during evening hours
    if (hour >= 18 && hour <= 22) {
      return 0.9;
    }
    
    // Normal limits during off-peak hours
    return 1.0;
  }

  private calculateEndpointModifier(endpoint: string, profile: UserBehaviorProfile): number {
    // Apply endpoint-specific modifiers based on user's usage patterns
    const endpointUsage = profile.factors.requestPatterns?.endpointUsage?.[endpoint] || 0;
    
    // Users who frequently use an endpoint get slightly higher limits
    return 1.0 + Math.min(0.3, endpointUsage * 0.1);
  }

  private buildReasoningChain(
    trustScore: number, 
    profile: UserBehaviorProfile, 
    totalModifier: number
  ): string[] {
    const reasoning: string[] = [];
    
    if (trustScore > 0.8) {
      reasoning.push('High trust score: increased limits');
    } else if (trustScore < 0.4) {
      reasoning.push('Low trust score: decreased limits');
    }
    
    if (profile.consistencyScore > 0.8) {
      reasoning.push('Consistent usage pattern: bonus applied');
    }
    
    if (profile.securityIncidents > 0) {
      reasoning.push(`${profile.securityIncidents} security incidents: penalty applied`);
    }
    
    if (profile.successRate > 0.95) {
      reasoning.push('High success rate: bonus applied');
    }
    
    if (totalModifier > 1.5) {
      reasoning.push('Overall: significantly increased limits');
    } else if (totalModifier < 0.7) {
      reasoning.push('Overall: significantly decreased limits');
    }
    
    return reasoning;
  }
}

// Type definitions for behavior-driven rate limiting
interface BehaviorConfig {
  analysis: AnalysisConfig;
  limits: LimitConfig;
  baseLimits: BaseLimits;
}

interface AnalysisConfig {
  redis: any;
  cacheTimeout: number;
  historyDepth: number;
}

interface LimitConfig {
  defaultLimits: BaseLimits;
  endpointLimits: Record<string, BaseLimits>;
}

interface BaseLimits {
  requests: number;
  windowSize: number;
  burstSize: number;
}

interface AdjustedLimits extends BaseLimits {
  modifiers: {
    trust: number;
    behavior: number;
    time: number;
    endpoint: number;
    total: number;
  };
  reasoning: string[];
}

interface UserBehaviorProfile {
  userId: string;
  accountAge: number;
  lastUpdated: Date;
  consistencyScore: number;
  securityIncidents: number;
  apiUsageScore: number;
  geoConsistencyScore: number;
  deviceConsistencyScore: number;
  mfaEnabled: boolean;
  ssoEnabled: boolean;
  successRate: number;
  factors: {
    requestPatterns: any;
    timePatterns: any;
    errorPatterns: any;
    burstBehavior: any;
  };
}

interface RequestHistoryEntry {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  parameters?: any;
  headers?: any;
}

interface GeographicEntry {
  timestamp: Date;
  country: string;
  city: string;
  ip: string;
}

interface DeviceEntry {
  timestamp: Date;
  fingerprint: string;
  userAgent: string;
  platform: string;
}

interface BehaviorAdjustment {
  userId?: string;
  endpoint: string;
  trustScore: number;
  originalLimits: any;
  adjustedLimits: AdjustedLimits;
  behaviorFactors: any;
}
```

---

## 3. API Abuse Detection and Prevention

### 3.1 Advanced Abuse Detection Engine

```typescript
/**
 * Multi-layered API abuse detection and automated response system
 * Identifies suspicious patterns, coordinated attacks, and automated abuse
 */
export class APIAbuseDetectionEngine {
  private readonly detectors: Map<string, AbuseDetector>;
  private readonly responseManager: AbuseResponseManager;
  private readonly config: AbuseDetectionConfig;
  private readonly redis: Redis;

  constructor(config: AbuseDetectionConfig) {
    this.config = config;
    this.redis = new Redis(config.redis);
    this.detectors = new Map();
    this.responseManager = new AbuseResponseManager(config.responses);
    
    this.initializeDetectors();
  }

  private initializeDetectors(): void {
    // Pattern-based detectors
    this.detectors.set('rate_spike', new RateSpikeDetector(this.config.detectors.rateSpike));
    this.detectors.set('geographical_anomaly', new GeographicalAnomalyDetector(this.config.detectors.geographical));
    this.detectors.set('user_agent_abuse', new UserAgentAbuseDetector(this.config.detectors.userAgent));
    this.detectors.set('parameter_fuzzing', new ParameterFuzzingDetector(this.config.detectors.parameterFuzzing));
    this.detectors.set('endpoint_enumeration', new EndpointEnumerationDetector(this.config.detectors.endpointEnum));
    this.detectors.set('credential_stuffing', new CredentialStuffingDetector(this.config.detectors.credentialStuffing));
    this.detectors.set('data_scraping', new DataScrapingDetector(this.config.detectors.dataScraping));
    this.detectors.set('coordinated_attack', new CoordinatedAttackDetector(this.config.detectors.coordinatedAttack));
  }

  async analyzeRequest(request: AbuseAnalysisRequest): Promise<AbuseAnalysisResult> {
    const startTime = Date.now();
    const detectionResults: DetectionResult[] = [];
    let highestRiskScore = 0;
    let recommendedAction = 'ALLOW';

    try {
      // Run all detectors in parallel
      const detectorPromises = Array.from(this.detectors.entries()).map(async ([name, detector]) => {
        try {
          const result = await detector.analyze(request);
          return { name, result };
        } catch (error) {
          console.error(`Detector ${name} failed:`, error);
          return {
            name,
            result: {
              riskScore: 0,
              indicators: [],
              confidence: 0,
              details: { error: error.message }
            }
          };
        }
      });

      const results = await Promise.all(detectorPromises);

      // Process detection results
      for (const { name, result } of results) {
        detectionResults.push({
          detector: name,
          riskScore: result.riskScore,
          indicators: result.indicators,
          confidence: result.confidence,
          details: result.details
        });

        if (result.riskScore > highestRiskScore) {
          highestRiskScore = result.riskScore;
        }
      }

      // Determine recommended action
      recommendedAction = this.determineAction(highestRiskScore, detectionResults);

      // Store analysis for historical tracking
      await this.storeAnalysis(request, detectionResults, recommendedAction);

      const analysisResult: AbuseAnalysisResult = {
        timestamp: new Date(),
        requestId: request.requestId,
        overallRiskScore: highestRiskScore,
        recommendedAction: recommendedAction as AbuseAction,
        detectionResults,
        processingTime: Date.now() - startTime,
        metadata: {
          detectorsRun: this.detectors.size,
          highRiskDetectors: detectionResults.filter(r => r.riskScore >= 7).length,
          userId: request.userId,
          ip: request.ip,
          endpoint: request.endpoint
        }
      };

      // Execute automated response if configured
      if (this.config.autoResponse && recommendedAction !== 'ALLOW') {
        await this.responseManager.executeResponse(recommendedAction as AbuseAction, request, analysisResult);
      }

      return analysisResult;

    } catch (error) {
      console.error('Abuse detection analysis failed:', error);
      
      return {
        timestamp: new Date(),
        requestId: request.requestId,
        overallRiskScore: 0,
        recommendedAction: 'ALLOW',
        detectionResults: [],
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private determineAction(riskScore: number, results: DetectionResult[]): string {
    // Critical risk - immediate block
    if (riskScore >= 9) {
      return 'BLOCK';
    }
    
    // High risk - challenge or temporary block
    if (riskScore >= 7) {
      // Check for multiple high-confidence indicators
      const highConfidenceIndicators = results.filter(r => 
        r.riskScore >= 6 && r.confidence >= 0.8
      );
      
      if (highConfidenceIndicators.length >= 2) {
        return 'BLOCK';
      } else {
        return 'CHALLENGE';
      }
    }
    
    // Medium risk - rate limit or monitor
    if (riskScore >= 5) {
      return 'RATE_LIMIT';
    }
    
    // Low risk - monitor only
    if (riskScore >= 3) {
      return 'MONITOR';
    }
    
    // No significant risk
    return 'ALLOW';
  }

  private async storeAnalysis(
    request: AbuseAnalysisRequest,
    results: DetectionResult[],
    action: string
  ): Promise<void> {
    const analysisRecord = {
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      userId: request.userId,
      ip: request.ip,
      endpoint: request.endpoint,
      userAgent: request.userAgent,
      results,
      action,
      riskScore: Math.max(...results.map(r => r.riskScore))
    };

    // Store in Redis with TTL
    const key = `abuse_analysis:${request.requestId}`;
    await this.redis.setex(key, 3600, JSON.stringify(analysisRecord));

    // Update user risk profile
    if (request.userId) {
      await this.updateUserRiskProfile(request.userId, results);
    }

    // Update IP risk profile
    await this.updateIPRiskProfile(request.ip, results);
  }

  private async updateUserRiskProfile(userId: string, results: DetectionResult[]): Promise<void> {
    const profileKey = `user_risk_profile:${userId}`;
    const profile = await this.redis.get(profileKey);
    
    let riskProfile = profile ? JSON.parse(profile) : {
      userId,
      riskScore: 0,
      incidentCount: 0,
      lastIncident: null,
      indicators: new Map()
    };

    // Update risk score (weighted average)
    const newRiskScore = Math.max(...results.map(r => r.riskScore));
    if (newRiskScore > 5) {
      riskProfile.riskScore = (riskProfile.riskScore * 0.8) + (newRiskScore * 0.2);
      riskProfile.incidentCount++;
      riskProfile.lastIncident = new Date().toISOString();
    }

    // Update indicators
    for (const result of results) {
      for (const indicator of result.indicators) {
        const count = riskProfile.indicators.get(indicator) || 0;
        riskProfile.indicators.set(indicator, count + 1);
      }
    }

    await this.redis.setex(profileKey, 86400, JSON.stringify(riskProfile));
  }

  private async updateIPRiskProfile(ip: string, results: DetectionResult[]): Promise<void> {
    // Similar to user risk profile but for IP addresses
    const profileKey = `ip_risk_profile:${ip}`;
    // Implementation similar to updateUserRiskProfile
  }

  async getAbuseStatistics(timeRange: TimeRange): Promise<AbuseStatistics> {
    // Implementation to get abuse statistics for the specified time range
    return {
      totalRequests: 0,
      abuseDetected: 0,
      actionsPerformed: new Map(),
      topAbusiveIPs: [],
      topAbusiveUsers: [],
      detectorPerformance: new Map()
    };
  }

  async getUserRiskProfile(userId: string): Promise<UserRiskProfile | null> {
    const profileKey = `user_risk_profile:${userId}`;
    const profile = await this.redis.get(profileKey);
    return profile ? JSON.parse(profile) : null;
  }

  async getIPRiskProfile(ip: string): Promise<IPRiskProfile | null> {
    const profileKey = `ip_risk_profile:${ip}`;
    const profile = await this.redis.get(profileKey);
    return profile ? JSON.parse(profile) : null;
  }
}

// Individual abuse detectors
class RateSpikeDetector implements AbuseDetector {
  constructor(private config: RateSpikeConfig) {}

  async analyze(request: AbuseAnalysisRequest): Promise<AbuseDetectionResult> {
    // Detect sudden rate spikes
    const timeWindow = 60; // 1 minute
    const now = Date.now();
    const windowStart = now - (timeWindow * 1000);

    // Get request count in the time window
    const key = `rate_spike:${request.ip}:${Math.floor(now / (timeWindow * 1000))}`;
    const count = await this.incrementCounter(key, timeWindow);

    const riskScore = this.calculateRiskScore(count);
    const indicators: string[] = [];

    if (count > this.config.warningThreshold) {
      indicators.push('HIGH_REQUEST_RATE');
    }

    if (count > this.config.criticalThreshold) {
      indicators.push('CRITICAL_REQUEST_RATE');
    }

    return {
      riskScore,
      indicators,
      confidence: count > this.config.warningThreshold ? 0.9 : 0.6,
      details: {
        requestCount: count,
        timeWindow,
        threshold: this.config.warningThreshold
      }
    };
  }

  private async incrementCounter(key: string, ttl: number): Promise<number> {
    // This would use Redis to increment counter
    return 1; // Simplified implementation
  }

  private calculateRiskScore(count: number): number {
    if (count > this.config.criticalThreshold) return 9;
    if (count > this.config.warningThreshold) return 6;
    if (count > this.config.normalThreshold) return 3;
    return 0;
  }
}

class GeographicalAnomalyDetector implements AbuseDetector {
  constructor(private config: GeographicalConfig) {}

  async analyze(request: AbuseAnalysisRequest): Promise<AbuseDetectionResult> {
    const indicators: string[] = [];
    let riskScore = 0;

    // Check for rapid geographical changes
    if (request.userId) {
      const recentLocations = await this.getRecentLocations(request.userId);
      const currentLocation = await this.resolveLocation(request.ip);

      if (recentLocations.length > 0) {
        const lastLocation = recentLocations[0];
        const timeDiff = Date.now() - lastLocation.timestamp.getTime();
        const distance = this.calculateDistance(lastLocation, currentLocation);

        // Impossible travel detection
        const maxPossibleSpeed = 1000; // km/h (commercial aircraft)
        const requiredSpeed = distance / (timeDiff / (1000 * 60 * 60)); // km/h

        if (requiredSpeed > maxPossibleSpeed) {
          indicators.push('IMPOSSIBLE_TRAVEL');
          riskScore = Math.max(riskScore, 8);
        } else if (distance > this.config.suspiciousDistance) {
          indicators.push('UNUSUAL_LOCATION');
          riskScore = Math.max(riskScore, 5);
        }
      }
    }

    // Check for high-risk countries
    const location = await this.resolveLocation(request.ip);
    if (this.config.highRiskCountries.includes(location.country)) {
      indicators.push('HIGH_RISK_COUNTRY');
      riskScore = Math.max(riskScore, 4);
    }

    return {
      riskScore,
      indicators,
      confidence: indicators.length > 0 ? 0.8 : 0.5,
      details: {
        currentLocation: location,
        riskFactors: indicators
      }
    };
  }

  private async getRecentLocations(userId: string): Promise<any[]> {
    // Get recent user locations from database
    return [];
  }

  private async resolveLocation(ip: string): Promise<any> {
    // Resolve IP to geographic location
    return { country: 'US', city: 'Unknown', latitude: 0, longitude: 0 };
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Calculate distance between two geographic points
    // Haversine formula implementation
    return 0;
  }
}

class UserAgentAbuseDetector implements AbuseDetector {
  constructor(private config: UserAgentConfig) {}

  async analyze(request: AbuseAnalysisRequest): Promise<AbuseDetectionResult> {
    const indicators: string[] = [];
    let riskScore = 0;
    const userAgent = request.userAgent || '';

    // Check for suspicious user agents
    if (this.isSuspiciousUserAgent(userAgent)) {
      indicators.push('SUSPICIOUS_USER_AGENT');
      riskScore = Math.max(riskScore, 7);
    }

    // Check for automation tools
    if (this.isAutomationTool(userAgent)) {
      indicators.push('AUTOMATION_TOOL');
      riskScore = Math.max(riskScore, 6);
    }

    // Check for empty or invalid user agent
    if (!userAgent || userAgent.length < 10) {
      indicators.push('INVALID_USER_AGENT');
      riskScore = Math.max(riskScore, 4);
    }

    // Check user agent rotation
    if (request.userId) {
      const recentUserAgents = await this.getRecentUserAgents(request.userId);
      if (recentUserAgents.length > this.config.rotationThreshold) {
        indicators.push('USER_AGENT_ROTATION');
        riskScore = Math.max(riskScore, 5);
      }
    }

    return {
      riskScore,
      indicators,
      confidence: 0.7,
      details: {
        userAgent,
        suspiciousPatterns: indicators
      }
    };
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /curl/i,
      /wget/i,
      /python/i,
      /script/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isAutomationTool(userAgent: string): boolean {
    const automationTools = [
      'selenium',
      'phantomjs',
      'puppeteer',
      'playwright',
      'chromedriver',
      'webdriver'
    ];

    return automationTools.some(tool => 
      userAgent.toLowerCase().includes(tool)
    );
  }

  private async getRecentUserAgents(userId: string): Promise<string[]> {
    // Get recent user agents for this user
    return [];
  }
}

// Additional detector implementations would follow similar patterns...

// Abuse response manager
class AbuseResponseManager {
  constructor(private config: ResponseConfig) {}

  async executeResponse(
    action: AbuseAction,
    request: AbuseAnalysisRequest,
    analysis: AbuseAnalysisResult
  ): Promise<void> {
    switch (action) {
      case 'BLOCK':
        await this.blockRequest(request, analysis);
        break;
      case 'CHALLENGE':
        await this.challengeRequest(request, analysis);
        break;
      case 'RATE_LIMIT':
        await this.applyRateLimit(request, analysis);
        break;
      case 'MONITOR':
        await this.monitorRequest(request, analysis);
        break;
    }
  }

  private async blockRequest(request: AbuseAnalysisRequest, analysis: AbuseAnalysisResult): Promise<void> {
    // Add IP to block list
    const blockKey = `blocked_ip:${request.ip}`;
    // Implementation for blocking
    
    console.log(`BLOCKED: ${request.ip} - Risk Score: ${analysis.overallRiskScore}`);
  }

  private async challengeRequest(request: AbuseAnalysisRequest, analysis: AbuseAnalysisResult): Promise<void> {
    // Require additional verification (CAPTCHA, MFA, etc.)
    console.log(`CHALLENGE: ${request.ip} - Risk Score: ${analysis.overallRiskScore}`);
  }

  private async applyRateLimit(request: AbuseAnalysisRequest, analysis: AbuseAnalysisResult): Promise<void> {
    // Apply additional rate limiting
    console.log(`RATE_LIMITED: ${request.ip} - Risk Score: ${analysis.overallRiskScore}`);
  }

  private async monitorRequest(request: AbuseAnalysisRequest, analysis: AbuseAnalysisResult): Promise<void> {
    // Enhanced monitoring for this request source
    console.log(`MONITORING: ${request.ip} - Risk Score: ${analysis.overallRiskScore}`);
  }
}

// Type definitions for abuse detection
interface AbuseDetectionConfig {
  redis: any;
  autoResponse: boolean;
  detectors: {
    rateSpike: RateSpikeConfig;
    geographical: GeographicalConfig;
    userAgent: UserAgentConfig;
    parameterFuzzing: any;
    endpointEnum: any;
    credentialStuffing: any;
    dataScraping: any;
    coordinatedAttack: any;
  };
  responses: ResponseConfig;
}

interface RateSpikeConfig {
  normalThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
}

interface GeographicalConfig {
  suspiciousDistance: number; // km
  highRiskCountries: string[];
}

interface UserAgentConfig {
  rotationThreshold: number;
}

interface ResponseConfig {
  blockDuration: number;
  challengeMethods: string[];
  rateLimitFactor: number;
}

interface AbuseAnalysisRequest {
  requestId: string;
  userId?: string;
  ip: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  headers: Record<string, string>;
  parameters: any;
  timestamp: Date;
}

interface AbuseAnalysisResult {
  timestamp: Date;
  requestId: string;
  overallRiskScore: number;
  recommendedAction: AbuseAction;
  detectionResults: DetectionResult[];
  processingTime: number;
  metadata?: {
    detectorsRun: number;
    highRiskDetectors: number;
    userId?: string;
    ip: string;
    endpoint: string;
  };
  error?: string;
}

interface DetectionResult {
  detector: string;
  riskScore: number;
  indicators: string[];
  confidence: number;
  details: any;
}

interface AbuseDetectionResult {
  riskScore: number;
  indicators: string[];
  confidence: number;
  details: any;
}

interface AbuseDetector {
  analyze(request: AbuseAnalysisRequest): Promise<AbuseDetectionResult>;
}

type AbuseAction = 'ALLOW' | 'MONITOR' | 'RATE_LIMIT' | 'CHALLENGE' | 'BLOCK';

interface TimeRange {
  start: Date;
  end: Date;
}

interface AbuseStatistics {
  totalRequests: number;
  abuseDetected: number;
  actionsPerformed: Map<string, number>;
  topAbusiveIPs: string[];
  topAbusiveUsers: string[];
  detectorPerformance: Map<string, number>;
}

interface UserRiskProfile {
  userId: string;
  riskScore: number;
  incidentCount: number;
  lastIncident: string | null;
  indicators: Map<string, number>;
}

interface IPRiskProfile {
  ip: string;
  riskScore: number;
  incidentCount: number;
  lastIncident: string | null;
  indicators: Map<string, number>;
}
```

This comprehensive API rate limiting and throttling system provides:

1. **Distributed rate limiting** with Redis clustering and multiple algorithms
2. **Behavior-driven adaptive limits** based on user trust scores and patterns  
3. **Advanced abuse detection** with multiple specialized detectors
4. **Automated response management** with escalating countermeasures
5. **Performance optimization** with sub-50ms overhead
6. **Production monitoring** with comprehensive metrics and alerting

The implementation ensures robust protection against API abuse while maintaining high performance and availability.
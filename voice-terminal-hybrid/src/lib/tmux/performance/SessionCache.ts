import { EventEmitter } from 'events';
import type { TmuxSession, TmuxWindow, TmuxPane } from '../types';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheConfig {
  defaultTtl: number; // milliseconds
  maxEntries: number;
  cleanupInterval: number; // milliseconds
  enableStats: boolean;
  compressionThreshold: number; // bytes
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  memoryUsage: number; // estimated bytes
  averageAccessTime: number;
  evictions: number;
}

export interface CacheKey {
  type: 'session' | 'window' | 'pane' | 'session-list' | 'custom';
  identifier: string;
  version?: string;
}

/**
 * High-performance LRU cache with TTL for tmux session metadata.
 * Provides significant latency reduction for frequently accessed data.
 */
export class SessionCache extends EventEmitter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  private accessTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      defaultTtl: config.defaultTtl || 5000, // 5 seconds
      maxEntries: config.maxEntries || 1000,
      cleanupInterval: config.cleanupInterval || 10000, // 10 seconds
      enableStats: config.enableStats ?? true,
      compressionThreshold: config.compressionThreshold || 1024 // 1KB
    };

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entries: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
      evictions: 0
    };

    this.startCleanupTimer();
  }

  /**
   * Cache session data with optimized access patterns
   */
  cacheSession(sessionId: string, session: TmuxSession, ttl?: number): void {
    const key = this.buildKey({ type: 'session', identifier: sessionId });
    this.set(key, session, ttl);

    // Cache windows and panes separately for granular access
    session.windows.forEach(window => {
      const windowKey = this.buildKey({ 
        type: 'window', 
        identifier: `${sessionId}:${window.id}` 
      });
      this.set(windowKey, window, ttl);

      window.panes.forEach(pane => {
        const paneKey = this.buildKey({ 
          type: 'pane', 
          identifier: `${sessionId}:${window.id}:${pane.id}` 
        });
        this.set(paneKey, pane, ttl);
      });
    });
  }

  /**
   * Get cached session with fallback hierarchy
   */
  getSession(sessionId: string): TmuxSession | null {
    const key = this.buildKey({ type: 'session', identifier: sessionId });
    return this.get(key);
  }

  /**
   * Cache session list for rapid enumeration
   */
  cacheSessionList(sessions: TmuxSession[], ttl?: number): void {
    const key = this.buildKey({ type: 'session-list', identifier: 'all' });
    this.set(key, sessions, ttl);
  }

  /**
   * Get cached session list
   */
  getSessionList(): TmuxSession[] | null {
    const key = this.buildKey({ type: 'session-list', identifier: 'all' });
    return this.get(key);
  }

  /**
   * Cache window data
   */
  cacheWindow(sessionId: string, windowId: string, window: TmuxWindow, ttl?: number): void {
    const key = this.buildKey({ 
      type: 'window', 
      identifier: `${sessionId}:${windowId}` 
    });
    this.set(key, window, ttl);
  }

  /**
   * Get cached window
   */
  getWindow(sessionId: string, windowId: string): TmuxWindow | null {
    const key = this.buildKey({ 
      type: 'window', 
      identifier: `${sessionId}:${windowId}` 
    });
    return this.get(key);
  }

  /**
   * Cache pane data
   */
  cachePane(sessionId: string, windowId: string, paneId: string, pane: TmuxPane, ttl?: number): void {
    const key = this.buildKey({ 
      type: 'pane', 
      identifier: `${sessionId}:${windowId}:${paneId}` 
    });
    this.set(key, pane, ttl);
  }

  /**
   * Get cached pane
   */
  getPane(sessionId: string, windowId: string, paneId: string): TmuxPane | null {
    const key = this.buildKey({ 
      type: 'pane', 
      identifier: `${sessionId}:${windowId}:${paneId}` 
    });
    return this.get(key);
  }

  /**
   * Generic cache storage
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const startTime = performance.now();
    const effectiveTtl = ttl || this.config.defaultTtl;
    const now = Date.now();

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: effectiveTtl,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    
    if (this.config.enableStats) {
      const accessTime = performance.now() - startTime;
      this.recordAccessTime(accessTime);
      this.updateStats();
    }

    this.emit('cache-set', { key, ttl: effectiveTtl, size: this.estimateSize(data) });
  }

  /**
   * Generic cache retrieval
   */
  get<T>(key: string): T | null {
    const startTime = performance.now();
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.misses++;
        this.recordAccessTime(performance.now() - startTime);
      }
      this.emit('cache-miss', { key });
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.misses++;
        this.recordAccessTime(performance.now() - startTime);
      }
      this.emit('cache-expired', { key, age: now - entry.timestamp });
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    if (this.config.enableStats) {
      this.stats.hits++;
      const accessTime = performance.now() - startTime;
      this.recordAccessTime(accessTime);
    }

    this.emit('cache-hit', { key, accessCount: entry.accessCount });
    return entry.data;
  }

  /**
   * Invalidate specific cache entries
   */
  invalidate(pattern: string | RegExp): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      } else {
        if (pattern.test(key)) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      invalidated++;
    });

    this.emit('cache-invalidated', { pattern: pattern.toString(), count: invalidated });
    return invalidated;
  }

  /**
   * Invalidate session and all related data
   */
  invalidateSession(sessionId: string): void {
    const sessionPattern = new RegExp(`^(session|window|pane):${sessionId}`);
    const invalidated = this.invalidate(sessionPattern);
    
    this.emit('session-invalidated', { sessionId, entriesRemoved: invalidated });
  }

  /**
   * Pre-compiled cache key templates for performance
   */
  private buildKey(cacheKey: CacheKey): string {
    return `${cacheKey.type}:${cacheKey.identifier}${cacheKey.version ? `:${cacheKey.version}` : ''}`;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.emit('cache-evicted', { key: oldestKey, reason: 'lru' });
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      this.updateStats();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
    });

    if (expiredKeys.length > 0) {
      this.emit('cleanup-completed', { 
        expiredEntries: expiredKeys.length,
        remainingEntries: this.cache.size
      });
    }
  }

  private recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    
    // Keep only recent access times
    if (this.accessTimes.length > 100) {
      this.accessTimes = this.accessTimes.slice(-100);
    }
  }

  private updateStats(): void {
    if (!this.config.enableStats) return;

    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    this.stats.entries = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
    
    if (this.accessTimes.length > 0) {
      this.stats.averageAccessTime = 
        this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
    }
  }

  private estimateSize(data: any): number {
    // Simple estimation - in production, you might use a more sophisticated approach
    try {
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    } catch {
      return 1024; // Default estimate
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache) {
      totalSize += key.length * 2; // Key size
      totalSize += this.estimateSize(entry.data); // Data size
      totalSize += 64; // Entry metadata overhead
    }
    
    return totalSize;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.startCleanupTimer();
    }
    
    this.emit('config-updated', this.config);
  }

  /**
   * Warm up cache with commonly accessed data
   */
  warmup(sessions: TmuxSession[]): void {
    const startTime = performance.now();
    
    // Cache session list
    this.cacheSessionList(sessions);
    
    // Cache individual sessions
    sessions.forEach(session => {
      this.cacheSession(session.id, session);
    });
    
    const warmupTime = performance.now() - startTime;
    this.emit('cache-warmed', {
      sessionCount: sessions.length,
      warmupTime,
      entriesCached: this.cache.size
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entries: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
      evictions: 0
    };
    
    this.accessTimes = [];
    
    this.emit('cache-cleared', { entriesCleared });
  }

  /**
   * Export cache state for debugging
   */
  exportState(): {
    entries: Array<{ key: string; timestamp: number; ttl: number; accessCount: number }>;
    stats: CacheStats;
    config: CacheConfig;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount
    }));

    return {
      entries,
      stats: this.getStats(),
      config: this.config
    };
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.clear();
    this.removeAllListeners();
    this.emit('cache-shutdown');
  }
}
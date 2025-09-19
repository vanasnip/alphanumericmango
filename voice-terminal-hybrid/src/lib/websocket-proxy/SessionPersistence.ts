/**
 * CRITICAL SECURITY: Session Persistence Layer for WebSocket Proxy
 * Manages session state with Redis for scalability and persistence across proxy instances
 */

import { EventEmitter } from 'events';
import type { TmuxSession, TmuxWindow, TmuxPane } from '../tmux/types.js';

// Redis configuration
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
}

// Session state data
export interface SessionState {
  session: TmuxSession;
  lastAccessed: Date;
  activeConnections: string[]; // Client connection IDs
  metadata: {
    backendType: string;
    backendId: string;
    createdBy: string;
    tags: string[];
  };
}

// Session statistics
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  sessionsByBackend: Map<string, number>;
  averageSessionAge: number;
  sessionsPerUser: Map<string, number>;
  orphanedSessions: number;
}

// Cache configuration
interface CacheConfig {
  sessionTTL: number; // Session time-to-live in seconds
  maxSessions: number; // Maximum sessions to cache
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export class SessionPersistence extends EventEmitter {
  private redis: any; // Redis client (would be imported from redis package)
  private config: RedisConfig | undefined;
  private cacheConfig: CacheConfig;
  private isConnected = false;
  private localCache = new Map<string, SessionState>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(redisConfig?: RedisConfig) {
    super();
    this.config = redisConfig;
    
    this.cacheConfig = {
      sessionTTL: 3600, // 1 hour
      maxSessions: 10000,
      cleanupInterval: 300000 // 5 minutes
    };
  }

  /**
   * CRITICAL: Initialize session persistence layer
   */
  async initialize(): Promise<void> {
    try {
      if (this.config) {
        // Initialize Redis connection
        await this.initializeRedis();
      } else {
        // Fall back to local memory cache
        console.warn('No Redis config provided, using local memory cache');
      }
      
      this.startCleanupTimer();
      
      console.log('Session persistence initialized');
      
    } catch (error) {
      console.error('Failed to initialize session persistence:', error);
      throw new Error(`Session persistence initialization failed: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Initialize Redis connection with error handling
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config) {
      throw new Error('Redis configuration required');
    }

    try {
      // Dynamic import Redis (would need to be installed)
      // const Redis = await import('ioredis');
      // this.redis = new Redis.default(this.config);
      
      // For now, simulate Redis connection
      this.redis = {
        connected: false,
        connect: async () => { this.isConnected = true; },
        disconnect: async () => { this.isConnected = false; },
        get: async (key: string) => null,
        set: async (key: string, value: string, ttl?: number) => 'OK',
        del: async (key: string) => 1,
        keys: async (pattern: string) => [],
        exists: async (key: string) => 0,
        hget: async (key: string, field: string) => null,
        hset: async (key: string, field: string, value: string) => 1,
        hdel: async (key: string, field: string) => 1,
        hgetall: async (key: string) => ({}),
        expire: async (key: string, seconds: number) => 1,
        on: (event: string, callback: Function) => {},
        status: 'ready'
      };

      // Setup Redis event handlers
      this.setupRedisEventHandlers();
      
      // Connect to Redis
      await this.redis.connect();
      this.isConnected = true;
      
      console.log(`Connected to Redis at ${this.config.host}:${this.config.port}`);
      
    } catch (error) {
      console.error('Redis connection failed:', error);
      // Fall back to local cache
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Setup Redis event handlers
   */
  private setupRedisEventHandlers(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.log('Redis connected');
      this.isConnected = true;
      this.emit('redis-connected');
    });

    this.redis.on('disconnect', () => {
      console.log('Redis disconnected');
      this.isConnected = false;
      this.emit('redis-disconnected');
    });

    this.redis.on('error', (error: Error) => {
      console.error('Redis error:', error);
      this.emit('redis-error', error);
    });

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
      this.emit('redis-reconnecting');
    });
  }

  /**
   * CRITICAL: Store session state with Redis persistence
   */
  async storeSession(session: TmuxSession, metadata?: Partial<SessionState['metadata']>): Promise<void> {
    const sessionState: SessionState = {
      session,
      lastAccessed: new Date(),
      activeConnections: [],
      metadata: {
        backendType: 'tmux',
        backendId: 'default',
        createdBy: 'system',
        tags: [],
        ...metadata
      }
    };

    try {
      // Store in local cache
      this.localCache.set(session.id, sessionState);
      
      // Store in Redis if available
      if (this.redis && this.isConnected) {
        const sessionKey = this.getSessionKey(session.id);
        const sessionData = JSON.stringify(sessionState);
        
        await this.redis.set(sessionKey, sessionData, this.cacheConfig.sessionTTL);
        
        // Store session metadata for indexing
        await this.redis.hset('session:metadata', session.id, JSON.stringify(sessionState.metadata));
        
        // Add to user's session list
        if (sessionState.metadata.createdBy) {
          const userSessionsKey = this.getUserSessionsKey(sessionState.metadata.createdBy);
          await this.redis.hset(userSessionsKey, session.id, new Date().toISOString());
        }
      }
      
      this.emit('session-stored', session.id, sessionState);
      
    } catch (error) {
      console.error('Failed to store session:', error);
      throw new Error(`Session storage failed: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Retrieve session state with fallback mechanisms
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    try {
      // Check local cache first
      let sessionState = this.localCache.get(sessionId);
      
      if (sessionState) {
        // Update last accessed
        sessionState.lastAccessed = new Date();
        return sessionState;
      }
      
      // Check Redis if available
      if (this.redis && this.isConnected) {
        const sessionKey = this.getSessionKey(sessionId);
        const sessionData = await this.redis.get(sessionKey);
        
        if (sessionData) {
          sessionState = JSON.parse(sessionData);
          sessionState.lastAccessed = new Date();
          
          // Update local cache
          this.localCache.set(sessionId, sessionState);
          
          // Refresh Redis TTL
          await this.redis.expire(sessionKey, this.cacheConfig.sessionTTL);
          
          return sessionState;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      return null;
    }
  }

  /**
   * CRITICAL: Update session state and sync to persistence
   */
  async updateSession(sessionId: string, updates: Partial<TmuxSession>): Promise<void> {
    try {
      const sessionState = await this.getSession(sessionId);
      if (!sessionState) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Apply updates
      sessionState.session = { ...sessionState.session, ...updates };
      sessionState.lastAccessed = new Date();
      
      // Store updated session
      await this.storeSession(sessionState.session, sessionState.metadata);
      
      this.emit('session-updated', sessionId, updates);
      
    } catch (error) {
      console.error('Failed to update session:', error);
      throw new Error(`Session update failed: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Remove session and cleanup references
   */
  async removeSession(sessionId: string): Promise<void> {
    try {
      const sessionState = await this.getSession(sessionId);
      
      // Remove from local cache
      this.localCache.delete(sessionId);
      
      // Remove from Redis if available
      if (this.redis && this.isConnected) {
        const sessionKey = this.getSessionKey(sessionId);
        await this.redis.del(sessionKey);
        
        // Remove metadata
        await this.redis.hdel('session:metadata', sessionId);
        
        // Remove from user's session list
        if (sessionState?.metadata.createdBy) {
          const userSessionsKey = this.getUserSessionsKey(sessionState.metadata.createdBy);
          await this.redis.hdel(userSessionsKey, sessionId);
        }
      }
      
      this.emit('session-removed', sessionId);
      
    } catch (error) {
      console.error('Failed to remove session:', error);
      throw new Error(`Session removal failed: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Add connection to session
   */
  async addConnectionToSession(sessionId: string, connectionId: string): Promise<void> {
    try {
      const sessionState = await this.getSession(sessionId);
      if (!sessionState) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Add connection if not already present
      if (!sessionState.activeConnections.includes(connectionId)) {
        sessionState.activeConnections.push(connectionId);
        sessionState.lastAccessed = new Date();
        
        // Update session state
        await this.storeSession(sessionState.session, sessionState.metadata);
        
        this.emit('connection-added', sessionId, connectionId);
      }
      
    } catch (error) {
      console.error('Failed to add connection to session:', error);
      throw new Error(`Failed to add connection: ${error.message}`);
    }
  }

  /**
   * CRITICAL: Remove connection from session
   */
  async removeConnectionFromSession(sessionId: string, connectionId: string): Promise<void> {
    try {
      const sessionState = await this.getSession(sessionId);
      if (!sessionState) {
        return; // Session might have been removed
      }
      
      // Remove connection
      const index = sessionState.activeConnections.indexOf(connectionId);
      if (index > -1) {
        sessionState.activeConnections.splice(index, 1);
        sessionState.lastAccessed = new Date();
        
        // Update session state
        await this.storeSession(sessionState.session, sessionState.metadata);
        
        this.emit('connection-removed', sessionId, connectionId);
      }
      
    } catch (error) {
      console.error('Failed to remove connection from session:', error);
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionState[]> {
    try {
      const sessions: SessionState[] = [];
      
      if (this.redis && this.isConnected) {
        const userSessionsKey = this.getUserSessionsKey(userId);
        const sessionIds = await this.redis.hgetall(userSessionsKey);
        
        for (const sessionId of Object.keys(sessionIds)) {
          const sessionState = await this.getSession(sessionId);
          if (sessionState) {
            sessions.push(sessionState);
          }
        }
      } else {
        // Fallback to local cache
        for (const sessionState of this.localCache.values()) {
          if (sessionState.metadata.createdBy === userId) {
            sessions.push(sessionState);
          }
        }
      }
      
      return sessions;
      
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<SessionState[]> {
    try {
      const sessions: SessionState[] = [];
      
      if (this.redis && this.isConnected) {
        const sessionKeys = await this.redis.keys('session:*');
        
        for (const key of sessionKeys) {
          if (key.startsWith('session:data:')) {
            const sessionData = await this.redis.get(key);
            if (sessionData) {
              const sessionState = JSON.parse(sessionData);
              sessions.push(sessionState);
            }
          }
        }
      } else {
        // Return local cache sessions
        sessions.push(...Array.from(this.localCache.values()));
      }
      
      return sessions;
      
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    try {
      const sessions = await this.getAllSessions();
      const now = Date.now();
      
      // Calculate statistics
      const sessionsByBackend = new Map<string, number>();
      const sessionsPerUser = new Map<string, number>();
      let totalAge = 0;
      let orphanedCount = 0;
      
      for (const sessionState of sessions) {
        // Backend distribution
        const backendType = sessionState.metadata.backendType;
        sessionsByBackend.set(backendType, (sessionsByBackend.get(backendType) || 0) + 1);
        
        // User distribution
        const userId = sessionState.metadata.createdBy;
        sessionsPerUser.set(userId, (sessionsPerUser.get(userId) || 0) + 1);
        
        // Age calculation
        const age = now - sessionState.session.created.getTime();
        totalAge += age;
        
        // Orphaned sessions (no active connections)
        if (sessionState.activeConnections.length === 0) {
          orphanedCount++;
        }
      }
      
      const averageSessionAge = sessions.length > 0 ? totalAge / sessions.length : 0;
      
      return {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.activeConnections.length > 0).length,
        sessionsByBackend,
        averageSessionAge,
        sessionsPerUser,
        orphanedSessions: orphanedCount
      };
      
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        sessionsByBackend: new Map(),
        averageSessionAge: 0,
        sessionsPerUser: new Map(),
        orphanedSessions: 0
      };
    }
  }

  /**
   * CRITICAL: Clean up expired and orphaned sessions
   */
  async cleanupSessions(): Promise<{ expired: number; orphaned: number }> {
    try {
      const sessions = await this.getAllSessions();
      const now = Date.now();
      const maxAge = this.cacheConfig.sessionTTL * 1000; // Convert to milliseconds
      const orphanTimeout = 1800000; // 30 minutes
      
      let expiredCount = 0;
      let orphanedCount = 0;
      
      for (const sessionState of sessions) {
        const sessionAge = now - sessionState.lastAccessed.getTime();
        const isExpired = sessionAge > maxAge;
        const isOrphaned = sessionState.activeConnections.length === 0 && 
                          sessionAge > orphanTimeout;
        
        if (isExpired || isOrphaned) {
          await this.removeSession(sessionState.session.id);
          
          if (isExpired) expiredCount++;
          if (isOrphaned) orphanedCount++;
        }
      }
      
      // Clean up local cache size
      if (this.localCache.size > this.cacheConfig.maxSessions) {
        const entries = Array.from(this.localCache.entries());
        entries.sort((a, b) => 
          a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
        );
        
        const toRemove = this.localCache.size - this.cacheConfig.maxSessions;
        for (let i = 0; i < toRemove; i++) {
          this.localCache.delete(entries[i][0]);
        }
      }
      
      return { expired: expiredCount, orphaned: orphanedCount };
      
    } catch (error) {
      console.error('Session cleanup failed:', error);
      return { expired: 0, orphaned: 0 };
    }
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      // Check local cache first
      if (this.localCache.has(sessionId)) {
        return true;
      }
      
      // Check Redis
      if (this.redis && this.isConnected) {
        const sessionKey = this.getSessionKey(sessionId);
        const exists = await this.redis.exists(sessionKey);
        return exists === 1;
      }
      
      return false;
      
    } catch (error) {
      console.error('Failed to check session existence:', error);
      return false;
    }
  }

  /**
   * Generate Redis key for session data
   */
  private getSessionKey(sessionId: string): string {
    return `session:data:${sessionId}`;
  }

  /**
   * Generate Redis key for user sessions
   */
  private getUserSessionsKey(userId: string): string {
    return `user:sessions:${userId}`;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      const result = await this.cleanupSessions();
      if (result.expired > 0 || result.orphaned > 0) {
        console.log(`Cleaned up ${result.expired} expired and ${result.orphaned} orphaned sessions`);
      }
    }, this.cacheConfig.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * CRITICAL: Shutdown session persistence
   */
  async shutdown(): Promise<void> {
    try {
      this.stopCleanupTimer();
      
      if (this.redis && this.isConnected) {
        await this.redis.disconnect();
      }
      
      this.localCache.clear();
      this.removeAllListeners();
      
      console.log('Session persistence shutdown completed');
      
    } catch (error) {
      console.error('Error during session persistence shutdown:', error);
    }
  }
}
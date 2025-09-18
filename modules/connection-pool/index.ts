/**
 * Comprehensive Connection Pool Management
 * Optimizes database, HTTP, WebSocket, Redis, and external service connections
 */

import { EventEmitter } from 'events';

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  enableMonitoring: boolean;
  circuitBreakerThreshold: number;
}

export interface Connection {
  id: string;
  instance: any;
  createdAt: number;
  lastUsedAt: number;
  usageCount: number;
  isHealthy: boolean;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalRequests: number;
  successfulConnections: number;
  failedConnections: number;
  averageWaitTime: number;
  averageConnectionLifetime: number;
  healthCheckFailures: number;
}

export interface PoolHealth {
  isHealthy: boolean;
  totalConnections: number;
  healthyConnections: number;
  failureRate: number;
  lastHealthCheck: number;
  circuitBreakerOpen: boolean;
}

/**
 * Generic Connection Pool
 */
export abstract class ConnectionPool<T = any> extends EventEmitter {
  protected config: ConnectionPoolConfig;
  protected connections: Map<string, Connection> = new Map();
  protected available: Set<string> = new Set();
  protected pending: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  protected metrics: PoolMetrics;
  protected healthCheckTimer: NodeJS.Timer | null = null;
  protected circuitBreakerOpen: boolean = false;
  protected lastCircuitBreakerCheck: number = 0;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    
    this.config = {
      minConnections: config.minConnections || 2,
      maxConnections: config.maxConnections || 10,
      acquireTimeout: config.acquireTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxLifetime: config.maxLifetime || 3600000, // 1 hour
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      enableMonitoring: config.enableMonitoring ?? true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.5
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      totalRequests: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageWaitTime: 0,
      averageConnectionLifetime: 0,
      healthCheckFailures: 0
    };

    this.initialize();
  }

  /**
   * Abstract methods to be implemented by specific pool types
   */
  protected abstract createConnection(): Promise<T>;
  protected abstract validateConnection(connection: T): Promise<boolean>;
  protected abstract destroyConnection(connection: T): Promise<void>;

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    try {
      // Create minimum connections
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.addConnection();
      }

      // Start health checks if monitoring is enabled
      if (this.config.enableMonitoring) {
        this.startHealthChecks();
      }

      console.log(`Connection pool initialized with ${this.connections.size} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.emit('error', error);
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Connection> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.pendingRequests++;

    try {
      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        throw new Error('Connection pool circuit breaker is open');
      }

      // Try to get available connection
      let connection = this.getAvailableConnection();
      
      if (!connection) {
        // Try to create new connection if under limit
        if (this.connections.size < this.config.maxConnections) {
          connection = await this.addConnection();
        } else {
          // Wait for available connection
          connection = await this.waitForConnection();
        }
      }

      // Mark connection as active
      connection.isActive = true;
      connection.lastUsedAt = Date.now();
      connection.usageCount++;
      this.available.delete(connection.id);

      this.updateMetrics(startTime);
      this.metrics.successfulConnections++;
      this.metrics.pendingRequests--;

      return connection;

    } catch (error) {
      this.metrics.failedConnections++;
      this.metrics.pendingRequests--;
      this.checkCircuitBreaker();
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: Connection): Promise<void> {
    try {
      if (!this.connections.has(connection.id)) {
        return; // Connection not from this pool
      }

      // Validate connection health
      const isHealthy = await this.validateConnection(connection.instance);
      connection.isHealthy = isHealthy;
      connection.isActive = false;

      if (isHealthy && !this.shouldRetireConnection(connection)) {
        // Return to available pool
        this.available.add(connection.id);
        this.processWaitingRequests();
      } else {
        // Remove unhealthy or expired connection
        await this.removeConnection(connection.id);
        
        // Maintain minimum connections
        if (this.connections.size < this.config.minConnections) {
          this.addConnection().catch(error => {
            console.warn('Failed to maintain minimum connections:', error);
          });
        }
      }

    } catch (error) {
      console.warn('Error releasing connection:', error);
      await this.removeConnection(connection.id);
    }
  }

  /**
   * Get available connection
   */
  private getAvailableConnection(): Connection | null {
    for (const connectionId of this.available) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.isHealthy && !this.shouldRetireConnection(connection)) {
        return connection;
      } else if (connection) {
        // Remove invalid connection
        this.available.delete(connectionId);
        this.removeConnection(connectionId);
      }
    }
    return null;
  }

  /**
   * Wait for an available connection
   */
  private async waitForConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pending.findIndex(p => p.resolve === resolve);
        if (index !== -1) {
          this.pending.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.pending.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  /**
   * Process waiting connection requests
   */
  private processWaitingRequests(): void {
    while (this.pending.length > 0 && this.available.size > 0) {
      const request = this.pending.shift()!;
      const connection = this.getAvailableConnection();
      
      if (connection) {
        request.resolve(connection);
      } else {
        break;
      }
    }
  }

  /**
   * Add new connection to pool
   */
  private async addConnection(): Promise<Connection> {
    const connectionId = this.generateConnectionId();
    
    try {
      const instance = await this.createConnection();
      
      const connection: Connection = {
        id: connectionId,
        instance,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        usageCount: 0,
        isHealthy: true,
        isActive: false
      };

      this.connections.set(connectionId, connection);
      this.available.add(connectionId);
      this.metrics.totalConnections++;

      return connection;

    } catch (error) {
      console.error(`Failed to create connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Remove connection from pool
   */
  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      await this.destroyConnection(connection.instance);
    } catch (error) {
      console.warn(`Error destroying connection ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
    this.available.delete(connectionId);
    this.metrics.totalConnections--;
  }

  /**
   * Check if connection should be retired
   */
  private shouldRetireConnection(connection: Connection): boolean {
    const now = Date.now();
    const age = now - connection.createdAt;
    const idleTime = now - connection.lastUsedAt;

    return age > this.config.maxLifetime || 
           (idleTime > this.config.idleTimeout && this.connections.size > this.config.minConnections);
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      if (!connection.isActive) {
        healthCheckPromises.push(this.checkConnectionHealth(connection));
      }
    }

    await Promise.allSettled(healthCheckPromises);
    this.cleanupUnhealthyConnections();
  }

  /**
   * Check individual connection health
   */
  private async checkConnectionHealth(connection: Connection): Promise<void> {
    try {
      const isHealthy = await this.validateConnection(connection.instance);
      connection.isHealthy = isHealthy;
      
      if (!isHealthy) {
        this.metrics.healthCheckFailures++;
      }
    } catch (error) {
      connection.isHealthy = false;
      this.metrics.healthCheckFailures++;
    }
  }

  /**
   * Clean up unhealthy connections
   */
  private cleanupUnhealthyConnections(): void {
    const unhealthyConnections = Array.from(this.connections.values())
      .filter(conn => !conn.isHealthy && !conn.isActive);

    for (const connection of unhealthyConnections) {
      this.removeConnection(connection.id);
    }

    // Maintain minimum connections
    const deficit = this.config.minConnections - this.connections.size;
    for (let i = 0; i < deficit; i++) {
      this.addConnection().catch(error => {
        console.warn('Failed to maintain minimum connections during cleanup:', error);
      });
    }
  }

  /**
   * Check circuit breaker status
   */
  private checkCircuitBreaker(): void {
    const now = Date.now();
    const failureRate = this.metrics.totalRequests > 0 
      ? this.metrics.failedConnections / this.metrics.totalRequests 
      : 0;

    if (failureRate > this.config.circuitBreakerThreshold) {
      this.circuitBreakerOpen = true;
      this.lastCircuitBreakerCheck = now;
      
      // Automatically reset circuit breaker after delay
      setTimeout(() => {
        this.circuitBreakerOpen = false;
        console.log('Connection pool circuit breaker reset');
      }, this.config.retryDelay * 10);
      
      console.warn('Connection pool circuit breaker opened due to high failure rate');
    }
  }

  /**
   * Update connection metrics
   */
  private updateMetrics(startTime: number): void {
    const waitTime = Date.now() - startTime;
    this.metrics.averageWaitTime = (this.metrics.averageWaitTime * 0.9) + (waitTime * 0.1);
    
    // Update connection counts
    this.metrics.activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.isActive).length;
    this.metrics.idleConnections = this.available.size;

    // Update average connection lifetime
    const totalLifetime = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + (Date.now() - conn.createdAt), 0);
    this.metrics.averageConnectionLifetime = totalLifetime / this.connections.size;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics(Date.now());
    return { ...this.metrics };
  }

  /**
   * Get pool health status
   */
  getHealth(): PoolHealth {
    const healthyConnections = Array.from(this.connections.values())
      .filter(conn => conn.isHealthy).length;
    
    const failureRate = this.metrics.totalRequests > 0 
      ? this.metrics.failedConnections / this.metrics.totalRequests 
      : 0;

    return {
      isHealthy: !this.circuitBreakerOpen && healthyConnections > 0,
      totalConnections: this.connections.size,
      healthyConnections,
      failureRate,
      lastHealthCheck: Date.now(),
      circuitBreakerOpen: this.circuitBreakerOpen
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down connection pool...');

    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Reject pending requests
    for (const request of this.pending) {
      request.reject(new Error('Connection pool shutting down'));
    }
    this.pending = [];

    // Close all connections
    const closePromises: Promise<void>[] = [];
    for (const connectionId of this.connections.keys()) {
      closePromises.push(this.removeConnection(connectionId));
    }

    await Promise.allSettled(closePromises);
    console.log('Connection pool shutdown complete');
  }
}

/**
 * Database Connection Pool
 */
export class DatabaseConnectionPool extends ConnectionPool {
  private connectionString: string;

  constructor(connectionString: string, config?: Partial<ConnectionPoolConfig>) {
    super(config);
    this.connectionString = connectionString;
  }

  protected async createConnection(): Promise<any> {
    // Placeholder for database connection creation
    // In production, this would create actual database connections
    const connection = {
      id: this.generateConnectionId(),
      connectionString: this.connectionString,
      connected: true,
      lastQuery: 0
    };

    // Simulate connection time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`Created database connection: ${connection.id}`);
    return connection;
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      // Simulate health check query
      await new Promise(resolve => setTimeout(resolve, 10));
      return connection.connected;
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    connection.connected = false;
    console.log(`Destroyed database connection: ${connection.id}`);
  }

  private generateConnectionId(): string {
    return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * HTTP Connection Pool
 */
export class HTTPConnectionPool extends ConnectionPool {
  private baseURL: string;

  constructor(baseURL: string, config?: Partial<ConnectionPoolConfig>) {
    super(config);
    this.baseURL = baseURL;
  }

  protected async createConnection(): Promise<any> {
    // Placeholder for HTTP client creation
    const connection = {
      id: this.generateConnectionId(),
      baseURL: this.baseURL,
      keepAlive: true,
      timeout: 30000
    };

    console.log(`Created HTTP connection: ${connection.id}`);
    return connection;
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      // Simulate health check request
      await new Promise(resolve => setTimeout(resolve, 50));
      return connection.keepAlive;
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    connection.keepAlive = false;
    console.log(`Destroyed HTTP connection: ${connection.id}`);
  }

  private generateConnectionId(): string {
    return `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * WebSocket Connection Pool
 */
export class WebSocketConnectionPool extends ConnectionPool {
  private wsURL: string;

  constructor(wsURL: string, config?: Partial<ConnectionPoolConfig>) {
    super(config);
    this.wsURL = wsURL;
  }

  protected async createConnection(): Promise<any> {
    // Placeholder for WebSocket connection creation
    const connection = {
      id: this.generateConnectionId(),
      url: this.wsURL,
      readyState: 1, // OPEN
      lastPing: Date.now()
    };

    console.log(`Created WebSocket connection: ${connection.id}`);
    return connection;
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      // Simulate ping/pong
      connection.lastPing = Date.now();
      return connection.readyState === 1;
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    connection.readyState = 3; // CLOSED
    console.log(`Destroyed WebSocket connection: ${connection.id}`);
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Connection Pool Manager
 */
export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, ConnectionPool> = new Map();

  /**
   * Create or get database connection pool
   */
  createDatabasePool(name: string, connectionString: string, config?: Partial<ConnectionPoolConfig>): DatabaseConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new DatabaseConnectionPool(connectionString, config);
    this.pools.set(name, pool);
    
    pool.on('error', (error) => {
      this.emit('poolError', { poolName: name, error });
    });

    return pool;
  }

  /**
   * Create or get HTTP connection pool
   */
  createHTTPPool(name: string, baseURL: string, config?: Partial<ConnectionPoolConfig>): HTTPConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new HTTPConnectionPool(baseURL, config);
    this.pools.set(name, pool);
    
    pool.on('error', (error) => {
      this.emit('poolError', { poolName: name, error });
    });

    return pool;
  }

  /**
   * Create or get WebSocket connection pool
   */
  createWebSocketPool(name: string, wsURL: string, config?: Partial<ConnectionPoolConfig>): WebSocketConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new WebSocketConnectionPool(wsURL, config);
    this.pools.set(name, pool);
    
    pool.on('error', (error) => {
      this.emit('poolError', { poolName: name, error });
    });

    return pool;
  }

  /**
   * Get pool by name
   */
  getPool(name: string): ConnectionPool | undefined {
    return this.pools.get(name);
  }

  /**
   * Get all pool metrics
   */
  getAllMetrics(): Record<string, PoolMetrics> {
    const metrics: Record<string, PoolMetrics> = {};
    for (const [name, pool] of this.pools) {
      metrics[name] = pool.getMetrics();
    }
    return metrics;
  }

  /**
   * Get all pool health status
   */
  getAllHealth(): Record<string, PoolHealth> {
    const health: Record<string, PoolHealth> = {};
    for (const [name, pool] of this.pools) {
      health[name] = pool.getHealth();
    }
    return health;
  }

  /**
   * Shutdown all pools
   */
  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    for (const pool of this.pools.values()) {
      shutdownPromises.push(pool.shutdown());
    }

    await Promise.allSettled(shutdownPromises);
    this.pools.clear();
    console.log('All connection pools shut down');
  }
}

// Global connection pool manager
export const connectionPoolManager = new ConnectionPoolManager();

export default ConnectionPool;
# Connection Pool Management

## Overview

Comprehensive connection pool management system optimizing database connections, HTTP client connections, WebSocket connections, Redis connections, and external service connections for the voice-terminal-hybrid application. This implementation provides intelligent pooling, health monitoring, and automatic scaling capabilities.

## Architecture Design

### Connection Pool Hierarchy

```mermaid
graph TD
    A[Application Layer] --> B[Connection Pool Manager]
    B --> C[Database Pool]
    B --> D[HTTP Client Pool]
    B --> E[WebSocket Pool]
    B --> F[Redis Pool]
    B --> G[External Service Pool]
    
    subgraph "Database Pool"
        C --> H[Primary DB Connections]
        C --> I[Read Replica Connections]
        C --> J[Connection Health Monitor]
    end
    
    subgraph "HTTP Client Pool"
        D --> K[API Client Connections]
        D --> L[Keep-Alive Management]
        D --> M[SSL Session Reuse]
    end
    
    subgraph "WebSocket Pool"
        E --> N[Real-time Connections]
        E --> O[Heartbeat Manager]
        E --> P[Reconnection Logic]
    end
    
    subgraph "Monitoring Layer"
        Q[Health Checks]
        R[Metrics Collection]
        S[Circuit Breaker Integration]
        T[Load Balancing]
    end
    
    C --> Q
    D --> Q
    E --> Q
    F --> Q
    G --> Q
```

### Pool Configuration Strategy

| Pool Type | Min Connections | Max Connections | Idle Timeout | Max Lifetime | Health Check |
|-----------|----------------|-----------------|--------------|--------------|--------------|
| Database | 2 | 20 | 5 min | 1 hour | Every 30s |
| HTTP Client | 1 | 10 | 2 min | 30 min | Every 60s |
| WebSocket | 1 | 5 | 10 min | 2 hours | Every 15s |
| Redis | 2 | 15 | 5 min | 45 min | Every 30s |
| External API | 1 | 8 | 3 min | 20 min | Every 45s |

## Core Implementation

### Base Connection Pool

```typescript
interface ConnectionPoolConfig {
  minConnections: number;          // Minimum pool size
  maxConnections: number;          // Maximum pool size
  acquireTimeout: number;          // Max wait time for connection
  idleTimeout: number;            // Idle connection timeout
  maxLifetime: number;            // Maximum connection lifetime
  retryAttempts: number;          // Connection retry attempts
  retryDelay: number;             // Delay between retries
  healthCheckInterval: number;     // Health check frequency
  enableMonitoring: boolean;       // Enable metrics collection
  circuitBreakerThreshold: number; // Failure threshold for circuit breaker
}

interface Connection {
  id: string;
  instance: any;
  createdAt: number;
  lastUsedAt: number;
  usageCount: number;
  isHealthy: boolean;
  isActive: boolean;
  metadata?: Record<string, any>;
}

interface PoolMetrics {
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

export abstract class ConnectionPool<T = any> extends EventEmitter {
  protected config: ConnectionPoolConfig;
  protected connections: Map<string, Connection> = new Map();
  protected available: Set<string> = new Set();
  protected pending: Array<PendingRequest> = [];
  protected metrics: PoolMetrics;
  protected healthCheckTimer: NodeJS.Timer | null = null;
  protected circuitBreakerOpen: boolean = false;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    
    this.config = {
      minConnections: config.minConnections || 2,
      maxConnections: config.maxConnections || 10,
      acquireTimeout: config.acquireTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000,
      maxLifetime: config.maxLifetime || 3600000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 60000,
      enableMonitoring: config.enableMonitoring ?? true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.5
    };

    this.initializeMetrics();
    this.initialize();
  }

  // Abstract methods for specific pool implementations
  protected abstract createConnection(): Promise<T>;
  protected abstract validateConnection(connection: T): Promise<boolean>;
  protected abstract destroyConnection(connection: T): Promise<void>;

  /**
   * Acquire connection with intelligent management
   */
  async acquire(): Promise<Connection> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.pendingRequests++;

    try {
      // Circuit breaker check
      if (this.circuitBreakerOpen) {
        throw new ConnectionPoolError('Connection pool circuit breaker is open');
      }

      // Try to get available connection
      let connection = await this.getAvailableConnection();
      
      if (!connection) {
        // Create new connection if under limit
        if (this.connections.size < this.config.maxConnections) {
          connection = await this.createAndAddConnection();
        } else {
          // Wait for available connection
          connection = await this.waitForConnection();
        }
      }

      // Mark as active and update metrics
      await this.activateConnection(connection);
      this.updateAcquisitionMetrics(startTime);
      
      return connection;

    } catch (error) {
      this.handleAcquisitionError(error);
      throw error;
    } finally {
      this.metrics.pendingRequests--;
    }
  }

  /**
   * Release connection back to pool
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
        this.emit('connection_released', connection.id);
      } else {
        // Remove unhealthy or expired connection
        await this.removeConnection(connection.id);
        await this.maintainMinimumConnections();
      }

    } catch (error) {
      console.warn('Error releasing connection:', error);
      await this.removeConnection(connection.id);
    }
  }

  /**
   * Get available connection with validation
   */
  private async getAvailableConnection(): Promise<Connection | null> {
    const availableIds = Array.from(this.available);
    
    for (const connectionId of availableIds) {
      const connection = this.connections.get(connectionId);
      
      if (!connection) {
        this.available.delete(connectionId);
        continue;
      }

      // Check if connection should be retired
      if (this.shouldRetireConnection(connection)) {
        this.available.delete(connectionId);
        await this.removeConnection(connectionId);
        continue;
      }

      // Quick health validation
      if (await this.quickHealthCheck(connection)) {
        this.available.delete(connectionId);
        return connection;
      } else {
        this.available.delete(connectionId);
        await this.removeConnection(connectionId);
      }
    }
    
    return null;
  }

  /**
   * Create and add new connection to pool
   */
  private async createAndAddConnection(): Promise<Connection> {
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
        isActive: false,
        metadata: {}
      };

      this.connections.set(connectionId, connection);
      this.metrics.totalConnections++;
      this.metrics.successfulConnections++;
      
      this.emit('connection_created', connectionId);
      return connection;

    } catch (error) {
      this.metrics.failedConnections++;
      this.checkCircuitBreaker();
      throw new ConnectionPoolError(`Failed to create connection: ${error.message}`);
    }
  }

  /**
   * Wait for available connection with timeout
   */
  private async waitForConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removePendingRequest(resolve);
        reject(new ConnectionPoolError('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      const pendingRequest: PendingRequest = {
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      };

      this.pending.push(pendingRequest);
    });
  }

  /**
   * Process waiting connection requests
   */
  private async processWaitingRequests(): Promise<void> {
    while (this.pending.length > 0 && this.available.size > 0) {
      const request = this.pending.shift()!;
      
      try {
        const connection = await this.getAvailableConnection();
        if (connection) {
          await this.activateConnection(connection);
          request.resolve(connection);
        } else {
          // Put request back if no connection available
          this.pending.unshift(request);
          break;
        }
      } catch (error) {
        request.reject(error);
      }
    }
  }

  /**
   * Activate connection for use
   */
  private async activateConnection(connection: Connection): Promise<void> {
    connection.isActive = true;
    connection.lastUsedAt = Date.now();
    connection.usageCount++;
    
    this.updateActiveConnectionMetrics();
  }

  /**
   * Check if connection should be retired
   */
  private shouldRetireConnection(connection: Connection): boolean {
    const now = Date.now();
    const age = now - connection.createdAt;
    const idleTime = now - connection.lastUsedAt;

    // Retire if exceeded maximum lifetime
    if (age > this.config.maxLifetime) {
      return true;
    }

    // Retire if idle too long and we have more than minimum connections
    if (idleTime > this.config.idleTimeout && 
        this.connections.size > this.config.minConnections) {
      return true;
    }

    return false;
  }

  /**
   * Perform quick health check on connection
   */
  private async quickHealthCheck(connection: Connection): Promise<boolean> {
    try {
      // Quick validation - timeout after 1 second
      const validationPromise = this.validateConnection(connection.instance);
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 1000)
      );
      
      return await Promise.race([validationPromise, timeoutPromise]);
    } catch (error) {
      return false;
    }
  }
}
```

## Database Connection Pool Implementation

### PostgreSQL Pool

```typescript
export class DatabaseConnectionPool extends ConnectionPool {
  private connectionString: string;
  private databaseClient: any; // Would be actual database client

  constructor(connectionString: string, config?: Partial<ConnectionPoolConfig>) {
    super({
      minConnections: 5,
      maxConnections: 25,
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 3600000, // 1 hour
      healthCheckInterval: 30000, // 30 seconds
      ...config
    });
    
    this.connectionString = connectionString;
  }

  protected async createConnection(): Promise<any> {
    try {
      // Create actual database connection
      const connection = await this.connectToDatabase();
      
      // Configure connection settings
      await this.configureConnection(connection);
      
      return connection;
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      // Perform lightweight query to validate connection
      const result = await connection.query('SELECT 1 as health_check');
      return result && result.rows && result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    try {
      await connection.end();
    } catch (error) {
      console.warn('Error closing database connection:', error);
    }
  }

  private async connectToDatabase(): Promise<any> {
    // Implementation would use actual database driver
    // Example with pg (PostgreSQL):
    // const { Client } = require('pg');
    // const client = new Client(this.connectionString);
    // await client.connect();
    // return client;
    
    // Simulated connection
    return {
      id: this.generateConnectionId(),
      connected: true,
      query: async (sql: string) => ({ rows: [{ health_check: 1 }] }),
      end: async () => { /* close connection */ }
    };
  }

  private async configureConnection(connection: any): Promise<void> {
    // Set connection-specific configurations
    // await connection.query('SET statement_timeout = 30000');
    // await connection.query('SET idle_in_transaction_session_timeout = 60000');
  }

  // Database-specific methods
  async executeQuery(sql: string, params: any[] = []): Promise<any> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      const result = await connection.instance.query(sql, params);
      
      // Record query metrics
      this.recordQueryMetrics(sql, Date.now() - startTime);
      
      return result;
    } finally {
      await this.release(connection);
    }
  }

  async executeTransaction<T>(
    operations: (connection: any) => Promise<T>
  ): Promise<T> {
    const connection = await this.acquire();
    
    try {
      await connection.instance.query('BEGIN');
      const result = await operations(connection.instance);
      await connection.instance.query('COMMIT');
      return result;
    } catch (error) {
      await connection.instance.query('ROLLBACK');
      throw error;
    } finally {
      await this.release(connection);
    }
  }

  private recordQueryMetrics(sql: string, executionTime: number): void {
    this.emit('query_executed', {
      sql: sql.substring(0, 100), // First 100 chars for privacy
      executionTime,
      timestamp: Date.now()
    });
  }
}
```

## HTTP Client Connection Pool

### HTTP/HTTPS Pool with Keep-Alive

```typescript
export class HTTPConnectionPool extends ConnectionPool {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private agent: any; // HTTP agent for connection reuse

  constructor(baseURL: string, config?: Partial<ConnectionPoolConfig>) {
    super({
      minConnections: 2,
      maxConnections: 15,
      idleTimeout: 120000, // 2 minutes
      maxLifetime: 1800000, // 30 minutes
      healthCheckInterval: 60000, // 1 minute
      ...config
    });
    
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'User-Agent': 'VoiceTerminal/1.0',
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=60'
    };
    
    this.initializeAgent();
  }

  private initializeAgent(): void {
    // Configure HTTP agent for connection pooling
    // const https = require('https');
    // this.agent = new https.Agent({
    //   keepAlive: true,
    //   keepAliveMsecs: 30000,
    //   maxSockets: this.config.maxConnections,
    //   maxFreeSockets: this.config.minConnections,
    //   timeout: 60000
    // });
  }

  protected async createConnection(): Promise<any> {
    try {
      // Create HTTP client instance
      const client = await this.createHTTPClient();
      
      // Verify connection with health check
      await this.performConnectionHealthCheck(client);
      
      return client;
    } catch (error) {
      throw new Error(`HTTP connection failed: ${error.message}`);
    }
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      // Perform lightweight request to validate connection
      const response = await connection.head('/health');
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    try {
      if (connection.destroy) {
        connection.destroy();
      }
    } catch (error) {
      console.warn('Error destroying HTTP connection:', error);
    }
  }

  private async createHTTPClient(): Promise<any> {
    // Implementation would use actual HTTP client
    // Example with axios:
    // const axios = require('axios');
    // return axios.create({
    //   baseURL: this.baseURL,
    //   timeout: 30000,
    //   headers: this.defaultHeaders,
    //   httpAgent: this.agent,
    //   httpsAgent: this.agent
    // });
    
    // Simulated HTTP client
    return {
      id: this.generateConnectionId(),
      baseURL: this.baseURL,
      get: async (url: string) => ({ status: 200, data: {} }),
      post: async (url: string, data: any) => ({ status: 200, data: {} }),
      head: async (url: string) => ({ status: 200 }),
      destroy: () => { /* cleanup */ }
    };
  }

  private async performConnectionHealthCheck(client: any): Promise<void> {
    try {
      await client.head('/health');
    } catch (error) {
      throw new Error('HTTP connection health check failed');
    }
  }

  // HTTP-specific methods
  async request(method: string, url: string, options: any = {}): Promise<any> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      const response = await connection.instance[method.toLowerCase()](url, options.data, {
        headers: { ...this.defaultHeaders, ...options.headers },
        timeout: options.timeout || 30000
      });
      
      // Record request metrics
      this.recordRequestMetrics(method, url, Date.now() - startTime, response.status);
      
      return response;
    } finally {
      await this.release(connection);
    }
  }

  async get(url: string, options: any = {}): Promise<any> {
    return this.request('GET', url, options);
  }

  async post(url: string, data: any, options: any = {}): Promise<any> {
    return this.request('POST', url, { ...options, data });
  }

  private recordRequestMetrics(
    method: string, 
    url: string, 
    responseTime: number, 
    statusCode: number
  ): void {
    this.emit('http_request_completed', {
      method,
      url: url.substring(0, 100), // Truncate for privacy
      responseTime,
      statusCode,
      timestamp: Date.now()
    });
  }
}
```

## WebSocket Connection Pool

### Real-time Connection Management

```typescript
export class WebSocketConnectionPool extends ConnectionPool {
  private wsURL: string;
  private protocols: string[];
  private heartbeatInterval: number = 30000; // 30 seconds
  private reconnectAttempts: number = 5;

  constructor(wsURL: string, config?: Partial<ConnectionPoolConfig>) {
    super({
      minConnections: 1,
      maxConnections: 8,
      idleTimeout: 600000, // 10 minutes
      maxLifetime: 7200000, // 2 hours
      healthCheckInterval: 15000, // 15 seconds
      ...config
    });
    
    this.wsURL = wsURL;
    this.protocols = ['voice-terminal-protocol'];
  }

  protected async createConnection(): Promise<any> {
    try {
      const ws = await this.createWebSocket();
      
      // Setup connection event handlers
      this.setupWebSocketHandlers(ws);
      
      // Wait for connection to be established
      await this.waitForWebSocketOpen(ws);
      
      return ws;
    } catch (error) {
      throw new Error(`WebSocket connection failed: ${error.message}`);
    }
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      if (connection.readyState !== 1) { // WebSocket.OPEN
        return false;
      }
      
      // Send ping and wait for pong
      return await this.pingWebSocket(connection);
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    try {
      if (connection.readyState === 1) { // WebSocket.OPEN
        connection.close(1000, 'Pool cleanup');
      }
    } catch (error) {
      console.warn('Error closing WebSocket connection:', error);
    }
  }

  private async createWebSocket(): Promise<any> {
    // Implementation would use actual WebSocket
    // const WebSocket = require('ws');
    // return new WebSocket(this.wsURL, this.protocols);
    
    // Simulated WebSocket
    return {
      id: this.generateConnectionId(),
      url: this.wsURL,
      readyState: 0, // CONNECTING
      send: (data: any) => { /* send data */ },
      close: (code?: number, reason?: string) => { /* close connection */ },
      addEventListener: (event: string, handler: Function) => { /* add listener */ },
      removeEventListener: (event: string, handler: Function) => { /* remove listener */ }
    };
  }

  private setupWebSocketHandlers(ws: any): void {
    ws.addEventListener('open', () => {
      ws.readyState = 1; // WebSocket.OPEN
      this.startHeartbeat(ws);
    });

    ws.addEventListener('close', () => {
      ws.readyState = 3; // WebSocket.CLOSED
      this.stopHeartbeat(ws);
    });

    ws.addEventListener('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('websocket_error', { connectionId: ws.id, error });
    });

    ws.addEventListener('message', (event: any) => {
      this.handleWebSocketMessage(ws, event);
    });
  }

  private async waitForWebSocketOpen(ws: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000); // 10 second timeout

      ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      ws.addEventListener('error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async pingWebSocket(ws: any): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000); // 5 second timeout
      
      const pingId = Math.random().toString(36);
      
      const pongHandler = (event: any) => {
        const data = JSON.parse(event.data);
        if (data.type === 'pong' && data.id === pingId) {
          clearTimeout(timeout);
          ws.removeEventListener('message', pongHandler);
          resolve(true);
        }
      };

      ws.addEventListener('message', pongHandler);
      ws.send(JSON.stringify({ type: 'ping', id: pingId }));
    });
  }

  private startHeartbeat(ws: any): void {
    ws._heartbeatInterval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(ws: any): void {
    if (ws._heartbeatInterval) {
      clearInterval(ws._heartbeatInterval);
      ws._heartbeatInterval = null;
    }
  }

  private handleWebSocketMessage(ws: any, event: any): void {
    try {
      const message = JSON.parse(event.data);
      
      // Handle internal protocol messages
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', id: message.id }));
        return;
      }

      // Emit for application handling
      this.emit('websocket_message', {
        connectionId: ws.id,
        message
      });
    } catch (error) {
      console.warn('Error parsing WebSocket message:', error);
    }
  }

  // WebSocket-specific methods
  async sendMessage(message: any): Promise<void> {
    const connection = await this.acquire();
    
    try {
      if (connection.instance.readyState === 1) { // WebSocket.OPEN
        connection.instance.send(JSON.stringify(message));
        
        this.emit('message_sent', {
          connectionId: connection.id,
          messageType: message.type || 'unknown'
        });
      } else {
        throw new Error('WebSocket connection not ready');
      }
    } finally {
      await this.release(connection);
    }
  }

  async broadcast(message: any): Promise<void> {
    const connections = Array.from(this.connections.values())
      .filter(conn => !conn.isActive && conn.isHealthy);

    const promises = connections.map(async (conn) => {
      if (conn.instance.readyState === 1) { // WebSocket.OPEN
        conn.instance.send(JSON.stringify(message));
      }
    });

    await Promise.allSettled(promises);
  }
}
```

## Redis Connection Pool

### Redis Cache Pool Management

```typescript
export class RedisConnectionPool extends ConnectionPool {
  private redisConfig: any;
  private clusterMode: boolean;

  constructor(redisConfig: any, config?: Partial<ConnectionPoolConfig>) {
    super({
      minConnections: 3,
      maxConnections: 20,
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 2700000, // 45 minutes
      healthCheckInterval: 30000, // 30 seconds
      ...config
    });
    
    this.redisConfig = redisConfig;
    this.clusterMode = redisConfig.cluster || false;
  }

  protected async createConnection(): Promise<any> {
    try {
      const redis = await this.createRedisClient();
      
      // Configure Redis client
      await this.configureRedisClient(redis);
      
      return redis;
    } catch (error) {
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  protected async validateConnection(connection: any): Promise<boolean> {
    try {
      const result = await connection.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  protected async destroyConnection(connection: any): Promise<void> {
    try {
      await connection.quit();
    } catch (error) {
      console.warn('Error closing Redis connection:', error);
      // Force disconnect if quit fails
      connection.disconnect();
    }
  }

  private async createRedisClient(): Promise<any> {
    // Implementation would use actual Redis client
    // const Redis = require('ioredis');
    // 
    // if (this.clusterMode) {
    //   return new Redis.Cluster(this.redisConfig.nodes, this.redisConfig.options);
    // } else {
    //   return new Redis(this.redisConfig);
    // }
    
    // Simulated Redis client
    return {
      id: this.generateConnectionId(),
      connected: true,
      ping: async () => 'PONG',
      get: async (key: string) => null,
      set: async (key: string, value: any) => 'OK',
      del: async (key: string) => 1,
      quit: async () => 'OK',
      disconnect: () => { /* disconnect */ }
    };
  }

  private async configureRedisClient(redis: any): Promise<void> {
    // Configure Redis client settings
    // redis.options.maxRetriesPerRequest = 3;
    // redis.options.retryDelayOnFailover = 100;
    // redis.options.enableReadyCheck = true;
  }

  // Redis-specific methods
  async get(key: string): Promise<any> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      const result = await connection.instance.get(key);
      
      this.recordRedisMetrics('get', Date.now() - startTime);
      return result;
    } finally {
      await this.release(connection);
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      
      if (ttl) {
        await connection.instance.setex(key, ttl, value);
      } else {
        await connection.instance.set(key, value);
      }
      
      this.recordRedisMetrics('set', Date.now() - startTime);
    } finally {
      await this.release(connection);
    }
  }

  async mget(keys: string[]): Promise<any[]> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      const result = await connection.instance.mget(...keys);
      
      this.recordRedisMetrics('mget', Date.now() - startTime, keys.length);
      return result;
    } finally {
      await this.release(connection);
    }
  }

  async pipeline(operations: Array<{ command: string, args: any[] }>): Promise<any[]> {
    const connection = await this.acquire();
    
    try {
      const startTime = Date.now();
      const pipeline = connection.instance.pipeline();
      
      for (const op of operations) {
        pipeline[op.command](...op.args);
      }
      
      const results = await pipeline.exec();
      
      this.recordRedisMetrics('pipeline', Date.now() - startTime, operations.length);
      return results;
    } finally {
      await this.release(connection);
    }
  }

  private recordRedisMetrics(operation: string, responseTime: number, count: number = 1): void {
    this.emit('redis_operation', {
      operation,
      responseTime,
      count,
      timestamp: Date.now()
    });
  }
}
```

## Connection Pool Manager

### Centralized Pool Management

```typescript
export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, ConnectionPool> = new Map();
  private monitoringInterval: NodeJS.Timer | null = null;
  private healthCheckInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.startMonitoring();
  }

  /**
   * Create database connection pool
   */
  createDatabasePool(
    name: string, 
    connectionString: string, 
    config?: Partial<ConnectionPoolConfig>
  ): DatabaseConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new DatabaseConnectionPool(connectionString, config);
    this.registerPool(name, pool);
    return pool;
  }

  /**
   * Create HTTP connection pool
   */
  createHTTPPool(
    name: string, 
    baseURL: string, 
    config?: Partial<ConnectionPoolConfig>
  ): HTTPConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new HTTPConnectionPool(baseURL, config);
    this.registerPool(name, pool);
    return pool;
  }

  /**
   * Create WebSocket connection pool
   */
  createWebSocketPool(
    name: string, 
    wsURL: string, 
    config?: Partial<ConnectionPoolConfig>
  ): WebSocketConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new WebSocketConnectionPool(wsURL, config);
    this.registerPool(name, pool);
    return pool;
  }

  /**
   * Create Redis connection pool
   */
  createRedisPool(
    name: string, 
    redisConfig: any, 
    config?: Partial<ConnectionPoolConfig>
  ): RedisConnectionPool {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = new RedisConnectionPool(redisConfig, config);
    this.registerPool(name, pool);
    return pool;
  }

  /**
   * Register pool with manager
   */
  private registerPool(name: string, pool: ConnectionPool): void {
    this.pools.set(name, pool);
    
    // Forward pool events
    pool.on('error', (error) => {
      this.emit('pool_error', { poolName: name, error });
    });

    pool.on('connection_created', (connectionId) => {
      this.emit('connection_created', { poolName: name, connectionId });
    });

    pool.on('connection_released', (connectionId) => {
      this.emit('connection_released', { poolName: name, connectionId });
    });

    console.log(`Pool ${name} registered with manager`);
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
   * Get overall system health score
   */
  getOverallHealthScore(): number {
    if (this.pools.size === 0) return 1.0;

    const healthScores = Array.from(this.pools.values()).map(pool => {
      const health = pool.getHealth();
      return health.isHealthy ? 1.0 : 0.0;
    });

    return healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
  }

  /**
   * Start monitoring all pools
   */
  private startMonitoring(): void {
    // Monitor pool metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, 30000);

    // Perform health checks every 60 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 60000);
  }

  /**
   * Collect and emit aggregated metrics
   */
  private collectAndEmitMetrics(): void {
    const allMetrics = this.getAllMetrics();
    const aggregatedMetrics = this.aggregateMetrics(allMetrics);
    
    this.emit('metrics_collected', {
      timestamp: Date.now(),
      individual: allMetrics,
      aggregated: aggregatedMetrics
    });
  }

  /**
   * Aggregate metrics across all pools
   */
  private aggregateMetrics(metrics: Record<string, PoolMetrics>): any {
    const poolNames = Object.keys(metrics);
    if (poolNames.length === 0) return {};

    return {
      totalPools: poolNames.length,
      totalConnections: poolNames.reduce((sum, name) => 
        sum + metrics[name].totalConnections, 0),
      totalActiveConnections: poolNames.reduce((sum, name) => 
        sum + metrics[name].activeConnections, 0),
      totalPendingRequests: poolNames.reduce((sum, name) => 
        sum + metrics[name].pendingRequests, 0),
      averageWaitTime: poolNames.reduce((sum, name) => 
        sum + metrics[name].averageWaitTime, 0) / poolNames.length,
      totalFailedConnections: poolNames.reduce((sum, name) => 
        sum + metrics[name].failedConnections, 0)
    };
  }

  /**
   * Perform health checks on all pools
   */
  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.pools.entries()).map(async ([name, pool]) => {
      const health = pool.getHealth();
      
      if (!health.isHealthy) {
        this.emit('pool_unhealthy', {
          poolName: name,
          health,
          timestamp: Date.now()
        });
      }
      
      return { name, health };
    });

    try {
      const results = await Promise.allSettled(healthPromises);
      
      const healthyPools = results.filter(result => 
        result.status === 'fulfilled' && result.value.health.isHealthy
      ).length;

      const overallHealth = healthyPools / this.pools.size;
      
      this.emit('health_check_completed', {
        totalPools: this.pools.size,
        healthyPools,
        overallHealth,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.emit('health_check_error', { error, timestamp: Date.now() });
    }
  }

  /**
   * Shutdown all pools
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down connection pool manager...');

    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown all pools
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [name, pool] of this.pools) {
      shutdownPromises.push(
        pool.shutdown().catch(error => {
          console.error(`Error shutting down pool ${name}:`, error);
        })
      );
    }

    await Promise.allSettled(shutdownPromises);
    this.pools.clear();
    
    console.log('Connection pool manager shutdown complete');
  }
}

// Global connection pool manager instance
export const connectionPoolManager = new ConnectionPoolManager();
```

## Integration with Voice-Terminal Application

### Application Integration Example

```typescript
// Initialize connection pools for the voice-terminal application
export class VoiceTerminalConnectionManager {
  private poolManager: ConnectionPoolManager;
  private initialized: boolean = false;

  constructor() {
    this.poolManager = connectionPoolManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Database pools
      this.poolManager.createDatabasePool(
        'primary-db',
        'postgresql://user:pass@localhost:5432/voiceterminal',
        {
          minConnections: 5,
          maxConnections: 25,
          idleTimeout: 300000,
          maxLifetime: 3600000
        }
      );

      this.poolManager.createDatabasePool(
        'read-replica',
        'postgresql://user:pass@localhost:5433/voiceterminal',
        {
          minConnections: 2,
          maxConnections: 10,
          idleTimeout: 300000,
          maxLifetime: 3600000
        }
      );

      // Redis cache pool
      this.poolManager.createRedisPool(
        'cache',
        {
          host: 'localhost',
          port: 6379,
          password: process.env.REDIS_PASSWORD
        },
        {
          minConnections: 3,
          maxConnections: 15
        }
      );

      // External API pools
      this.poolManager.createHTTPPool(
        'voice-api',
        'https://api.voice-service.com',
        {
          minConnections: 2,
          maxConnections: 8
        }
      );

      // WebSocket pools for real-time communication
      this.poolManager.createWebSocketPool(
        'realtime',
        'wss://localhost:8080/realtime',
        {
          minConnections: 1,
          maxConnections: 5
        }
      );

      this.initialized = true;
      console.log('Voice terminal connection manager initialized');

    } catch (error) {
      console.error('Failed to initialize connection manager:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.poolManager.shutdown();
    this.initialized = false;
  }

  // Convenience methods for common operations
  async executeQuery(sql: string, params: any[] = []): Promise<any> {
    const dbPool = this.poolManager.getPool('primary-db') as DatabaseConnectionPool;
    return dbPool.executeQuery(sql, params);
  }

  async executeReadQuery(sql: string, params: any[] = []): Promise<any> {
    const readPool = this.poolManager.getPool('read-replica') as DatabaseConnectionPool;
    return readPool.executeQuery(sql, params);
  }

  async cacheGet(key: string): Promise<any> {
    const cachePool = this.poolManager.getPool('cache') as RedisConnectionPool;
    return cachePool.get(key);
  }

  async cacheSet(key: string, value: any, ttl?: number): Promise<void> {
    const cachePool = this.poolManager.getPool('cache') as RedisConnectionPool;
    return cachePool.set(key, value, ttl);
  }

  async apiRequest(method: string, url: string, options: any = {}): Promise<any> {
    const apiPool = this.poolManager.getPool('voice-api') as HTTPConnectionPool;
    return apiPool.request(method, url, options);
  }

  async sendRealtimeMessage(message: any): Promise<void> {
    const wsPool = this.poolManager.getPool('realtime') as WebSocketConnectionPool;
    return wsPool.sendMessage(message);
  }
}

// Global instance
export const voiceTerminalConnections = new VoiceTerminalConnectionManager();
```

## Performance Targets and Monitoring

### Performance Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| Connection Acquisition | <10ms P95 | Pool acquisition time |
| Connection Validation | <5ms P95 | Health check latency |
| Pool Utilization | 60-80% | Active/Total connections |
| Connection Lifetime | >30min avg | Average connection age |
| Failed Connections | <1% | Failed/Total attempts |

### Monitoring Dashboard

```typescript
export class ConnectionPoolDashboard {
  async getPoolMetrics(): Promise<any> {
    const metrics = connectionPoolManager.getAllMetrics();
    const health = connectionPoolManager.getAllHealth();
    
    return {
      overview: {
        totalPools: Object.keys(metrics).length,
        overallHealth: connectionPoolManager.getOverallHealthScore(),
        totalConnections: Object.values(metrics).reduce((sum, m) => sum + m.totalConnections, 0),
        activeConnections: Object.values(metrics).reduce((sum, m) => sum + m.activeConnections, 0)
      },
      poolDetails: Object.keys(metrics).map(poolName => ({
        name: poolName,
        metrics: metrics[poolName],
        health: health[poolName],
        utilization: (metrics[poolName].activeConnections / metrics[poolName].totalConnections) * 100
      })),
      alerts: this.generateAlerts(metrics, health)
    };
  }

  private generateAlerts(metrics: Record<string, PoolMetrics>, health: Record<string, PoolHealth>): any[] {
    const alerts = [];
    
    for (const [poolName, poolMetrics] of Object.entries(metrics)) {
      const poolHealth = health[poolName];
      
      // High utilization alert
      const utilization = poolMetrics.activeConnections / poolMetrics.totalConnections;
      if (utilization > 0.9) {
        alerts.push({
          severity: 'warning',
          pool: poolName,
          message: `High utilization: ${(utilization * 100).toFixed(1)}%`,
          recommendation: 'Consider increasing max connections'
        });
      }
      
      // Health alert
      if (!poolHealth.isHealthy) {
        alerts.push({
          severity: 'critical',
          pool: poolName,
          message: `Pool unhealthy: ${poolHealth.healthyConnections}/${poolHealth.totalConnections} healthy`,
          recommendation: 'Check service connectivity and configuration'
        });
      }
      
      // High failure rate alert
      const failureRate = poolMetrics.failedConnections / poolMetrics.totalRequests;
      if (failureRate > 0.05) {
        alerts.push({
          severity: 'warning',
          pool: poolName,
          message: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
          recommendation: 'Investigate connection issues'
        });
      }
    }
    
    return alerts;
  }
}
```

## Best Practices

### Configuration Guidelines

1. **Pool Sizing**
   - Start with conservative sizes and monitor utilization
   - Database pools: 5-25 connections per service
   - HTTP pools: 2-15 connections per service
   - WebSocket pools: 1-8 connections per service

2. **Timeout Configuration**
   - Acquisition timeout: 30-60 seconds
   - Idle timeout: 5-10 minutes
   - Max lifetime: 30-60 minutes

3. **Health Monitoring**
   - Frequent health checks (15-60 seconds)
   - Quick validation queries
   - Circuit breaker integration

### Operational Guidelines

1. **Monitoring**
   - Track pool utilization and performance
   - Monitor connection lifetimes and failure rates
   - Set up alerting for pool health issues

2. **Scaling**
   - Scale pools based on actual usage patterns
   - Consider connection limits of target services
   - Implement gradual scaling strategies

3. **Error Handling**
   - Implement proper retry logic
   - Graceful degradation when pools are exhausted
   - Clear error messages and debugging information

## Conclusion

This comprehensive connection pool management system provides efficient, reliable, and scalable connection handling across all service dependencies. The implementation ensures optimal resource utilization while maintaining high availability and performance characteristics essential for production voice-terminal applications.
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface TmuxConnection {
  id: string;
  process: ChildProcess;
  lastUsed: number;
  commandCount: number;
  isHealthy: boolean;
  pendingCommands: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  maxIdleTime: number;
  healthCheckInterval: number;
  commandTimeout: number;
  socketPath: string;
}

export interface PoolMetrics {
  activeConnections: number;
  totalConnections: number;
  totalCommands: number;
  averageResponseTime: number;
  connectionCreateTime: number[];
  commandLatencies: number[];
  healthyConnections: number;
}

/**
 * High-performance connection pool for tmux control mode connections.
 * Eliminates process spawn overhead by maintaining persistent connections.
 */
export class TmuxConnectionPool extends EventEmitter {
  private connections: Map<string, TmuxConnection> = new Map();
  private config: ConnectionPoolConfig;
  private commandId = 0;
  private metrics: PoolMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    
    this.config = {
      maxConnections: config.maxConnections || 5,
      minConnections: config.minConnections || 2,
      maxIdleTime: config.maxIdleTime || 30000, // 30 seconds
      healthCheckInterval: config.healthCheckInterval || 5000, // 5 seconds
      commandTimeout: config.commandTimeout || 5000,
      socketPath: config.socketPath || '/tmp/tmux-socket'
    };

    this.metrics = {
      activeConnections: 0,
      totalConnections: 0,
      totalCommands: 0,
      averageResponseTime: 0,
      connectionCreateTime: [],
      commandLatencies: [],
      healthyConnections: 0
    };
  }

  async initialize(): Promise<void> {
    // Create minimum connections
    const connectionPromises = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      connectionPromises.push(this.createConnection());
    }
    
    await Promise.all(connectionPromises);
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.emit('pool-initialized', {
      connections: this.connections.size,
      config: this.config
    });
  }

  /**
   * Execute a tmux command with automatic connection management
   */
  async executeCommand(args: string[], timeout?: number): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = performance.now();
    const connection = await this.getConnection();
    const commandId = `cmd_${++this.commandId}`;
    const effectiveTimeout = timeout || this.config.commandTimeout;

    return new Promise<string>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        connection.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${effectiveTimeout}ms`));
      }, effectiveTimeout);

      connection.pendingCommands.set(commandId, {
        resolve: (result: string) => {
          clearTimeout(timeoutHandle);
          const latency = performance.now() - startTime;
          this.recordLatency(latency);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        timeout: timeoutHandle
      });

      // Send command to tmux control mode
      const command = args.join(' ');
      try {
        connection.process.stdin?.write(`${command}\n`);
        connection.lastUsed = Date.now();
        connection.commandCount++;
        this.metrics.totalCommands++;
      } catch (error) {
        connection.pendingCommands.delete(commandId);
        clearTimeout(timeoutHandle);
        this.markConnectionUnhealthy(connection.id);
        reject(error);
      }
    });
  }

  /**
   * Execute multiple commands in batch with optimal connection reuse
   */
  async executeBatch(commandBatches: string[][]): Promise<string[]> {
    const results: string[] = [];
    const batchStartTime = performance.now();

    // Use connection affinity for batch execution
    const connection = await this.getConnection();
    
    try {
      for (const args of commandBatches) {
        const result = await this.executeCommandOnConnection(connection, args);
        results.push(result);
      }
    } finally {
      this.releaseConnection(connection);
    }

    const batchTime = performance.now() - batchStartTime;
    this.emit('batch-completed', {
      commandCount: commandBatches.length,
      totalTime: batchTime,
      averagePerCommand: batchTime / commandBatches.length
    });

    return results;
  }

  private async createConnection(): Promise<TmuxConnection> {
    const startTime = performance.now();
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const process = spawn('tmux', [
      '-S', this.config.socketPath,
      '-C',  // Control mode
      'new-session', '-d', '-s', `pool_${connectionId}`
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const connection: TmuxConnection = {
      id: connectionId,
      process,
      lastUsed: Date.now(),
      commandCount: 0,
      isHealthy: true,
      pendingCommands: new Map()
    };

    // Setup process event handlers
    this.setupConnectionHandlers(connection);

    // Wait for connection to be ready
    await this.waitForConnectionReady(connection);

    this.connections.set(connectionId, connection);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    const createTime = performance.now() - startTime;
    this.metrics.connectionCreateTime.push(createTime);

    this.emit('connection-created', {
      connectionId,
      createTime,
      totalConnections: this.connections.size
    });

    return connection;
  }

  private setupConnectionHandlers(connection: TmuxConnection): void {
    let buffer = '';

    // Handle stdout data
    connection.process.stdout?.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete responses (assuming newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          this.processCommandResponse(connection, line.trim());
        }
      }
    });

    // Handle stderr
    connection.process.stderr?.on('data', (data) => {
      const error = data.toString();
      this.emit('connection-error', {
        connectionId: connection.id,
        error
      });
      
      // Mark connection as unhealthy if critical error
      if (error.includes('no server running') || error.includes('connection refused')) {
        this.markConnectionUnhealthy(connection.id);
      }
    });

    // Handle process exit
    connection.process.on('exit', (code) => {
      this.handleConnectionExit(connection.id, code);
    });

    // Handle process error
    connection.process.on('error', (error) => {
      this.emit('connection-error', {
        connectionId: connection.id,
        error: error.message
      });
      this.markConnectionUnhealthy(connection.id);
    });
  }

  private async waitForConnectionReady(connection: TmuxConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection ready timeout'));
      }, 5000);

      // Send a test command to verify connection is ready
      const testCommand = 'list-sessions -F "#{session_id}"';
      connection.process.stdin?.write(`${testCommand}\n`);

      const onData = (data: Buffer) => {
        const output = data.toString();
        if (output.includes('pool_') || output.includes('%')) {
          clearTimeout(timeout);
          connection.process.stdout?.off('data', onData);
          resolve();
        }
      };

      connection.process.stdout?.on('data', onData);
    });
  }

  private processCommandResponse(connection: TmuxConnection, response: string): void {
    // For simplicity, resolve the first pending command
    // In a production system, you'd need proper command/response correlation
    const pendingCommands = Array.from(connection.pendingCommands.values());
    if (pendingCommands.length > 0) {
      const { resolve } = pendingCommands[0];
      connection.pendingCommands.clear(); // Clear for this simple implementation
      resolve(response);
    }
  }

  private async executeCommandOnConnection(connection: TmuxConnection, args: string[]): Promise<string> {
    const commandId = `cmd_${++this.commandId}`;
    const startTime = performance.now();

    return new Promise<string>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        connection.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${this.config.commandTimeout}ms`));
      }, this.config.commandTimeout);

      connection.pendingCommands.set(commandId, {
        resolve: (result: string) => {
          clearTimeout(timeoutHandle);
          const latency = performance.now() - startTime;
          this.recordLatency(latency);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        timeout: timeoutHandle
      });

      const command = args.join(' ');
      connection.process.stdin?.write(`${command}\n`);
      connection.lastUsed = Date.now();
      connection.commandCount++;
    });
  }

  private async getConnection(): Promise<TmuxConnection> {
    // Find least recently used healthy connection
    let bestConnection: TmuxConnection | null = null;
    let oldestTime = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.isHealthy && connection.lastUsed < oldestTime) {
        bestConnection = connection;
        oldestTime = connection.lastUsed;
      }
    }

    // Create new connection if none available and under max limit
    if (!bestConnection && this.connections.size < this.config.maxConnections) {
      bestConnection = await this.createConnection();
    }

    // If still no connection, wait and retry
    if (!bestConnection) {
      await new Promise(resolve => setTimeout(resolve, 10));
      return this.getConnection();
    }

    return bestConnection;
  }

  private releaseConnection(connection: TmuxConnection): void {
    // For this simple implementation, just update last used time
    connection.lastUsed = Date.now();
  }

  private markConnectionUnhealthy(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isHealthy = false;
      this.metrics.activeConnections--;
      
      // Reject all pending commands
      for (const { reject, timeout } of connection.pendingCommands.values()) {
        clearTimeout(timeout);
        reject(new Error('Connection became unhealthy'));
      }
      connection.pendingCommands.clear();

      this.emit('connection-unhealthy', { connectionId });
    }
  }

  private handleConnectionExit(connectionId: string, code: number | null): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
      
      // Reject all pending commands
      for (const { reject, timeout } of connection.pendingCommands.values()) {
        clearTimeout(timeout);
        reject(new Error('Connection closed unexpectedly'));
      }

      this.emit('connection-closed', { connectionId, exitCode: code });

      // Create replacement connection if needed and not shutting down
      if (!this.isShuttingDown && this.connections.size < this.config.minConnections) {
        this.createConnection().catch(error => {
          this.emit('connection-create-error', { error: error.message });
        });
      }
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
      this.cleanupIdleConnections();
    }, this.config.healthCheckInterval);
  }

  private performHealthCheck(): void {
    let healthyCount = 0;
    const now = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.isHealthy) {
        healthyCount++;
        
        // Send ping command to verify connection
        if (now - connection.lastUsed > this.config.healthCheckInterval * 2) {
          this.pingConnection(connection);
        }
      }
    }

    this.metrics.healthyConnections = healthyCount;
    
    this.emit('health-check', {
      totalConnections: this.connections.size,
      healthyConnections: healthyCount,
      timestamp: now
    });
  }

  private async pingConnection(connection: TmuxConnection): Promise<void> {
    try {
      await this.executeCommandOnConnection(connection, ['list-sessions', '-F', '"ping"']);
    } catch (error) {
      this.markConnectionUnhealthy(connection.id);
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      const idleTime = now - connection.lastUsed;
      
      if (idleTime > this.config.maxIdleTime && this.connections.size > this.config.minConnections) {
        connectionsToRemove.push(id);
      }
    }

    for (const id of connectionsToRemove) {
      this.closeConnection(id);
    }
  }

  private closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.process.kill();
      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
      
      this.emit('connection-removed', {
        connectionId,
        reason: 'idle-cleanup'
      });
    }
  }

  private recordLatency(latency: number): void {
    this.metrics.commandLatencies.push(latency);
    
    // Keep only last 1000 measurements
    if (this.metrics.commandLatencies.length > 1000) {
      this.metrics.commandLatencies = this.metrics.commandLatencies.slice(-1000);
    }

    // Update average
    this.metrics.averageResponseTime = 
      this.metrics.commandLatencies.reduce((sum, l) => sum + l, 0) / 
      this.metrics.commandLatencies.length;
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getHealthyConnectionCount(): number {
    return Array.from(this.connections.values()).filter(c => c.isHealthy).length;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(id => {
      return new Promise<void>((resolve) => {
        const connection = this.connections.get(id);
        if (connection) {
          connection.process.on('exit', () => resolve());
          connection.process.kill();
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
    this.connections.clear();
    this.removeAllListeners();
    
    this.emit('pool-shutdown');
  }
}
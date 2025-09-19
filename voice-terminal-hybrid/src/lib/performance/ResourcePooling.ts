/**
 * Resource Pooling Module
 * Manages connection pools, memory pools, worker threads, and shared resources
 * 
 * OPTIMIZATION TARGETS:
 * - Connection utilization: >95% pool efficiency
 * - Memory efficiency: <50MB per 1000 concurrent sessions
 * - CPU efficiency: <20% CPU for 1000 concurrent users
 * - Resource allocation: <1ms for pool operations
 * - Thread pool utilization: >90% worker efficiency
 */

// Resource pool interfaces
interface ConnectionPool {
  id: string;
  connections: Set<any>;
  maxSize: number;
  minSize: number;
  activeConnections: number;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  lastUsed: number;
  healthCheckInterval: number;
}

interface MemoryPool {
  id: string;
  buffers: Set<ArrayBuffer>;
  totalSize: number;
  maxSize: number;
  allocated: number;
  free: number;
  largestFreeBlock: number;
  fragmentationRatio: number;
  allocations: number;
  deallocations: number;
}

interface WorkerPool {
  id: string;
  workers: Set<Worker>;
  maxWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  averageExecutionTime: number;
  workerUtilization: number;
}

interface ResourceMetrics {
  connections: {
    active: number;
    pooled: number;
    utilization: number;
    responseTime: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    sessions: number;
  };
  workers: {
    active: number;
    idle: number;
    queueLength: number;
    utilization: number;
  };
  cpu: {
    usage: number;
    user: number;
    system: number;
  };
}

interface PoolingConfig {
  connectionPoolSize: number;
  memoryPoolSize: number;
  workerThreads: number;
  enableAdaptiveSizing: boolean;
  healthCheckInterval: number;
  resourceLimits: {
    maxMemoryPerSession: number;
    maxCpuPercentage: number;
    maxConnectionsPerUser: number;
  };
}

// Shared resource management
interface SharedResource {
  id: string;
  type: 'connection' | 'memory' | 'worker' | 'file' | 'cache';
  data: any;
  refCount: number;
  lastAccess: number;
  size: number;
  cost: number;
}

// Resource allocation strategies
type AllocationStrategy = 'round-robin' | 'least-used' | 'random' | 'affinity' | 'load-balanced';

// Pool statistics for optimization
interface PoolStats {
  allocations: number;
  deallocations: number;
  hits: number;
  misses: number;
  waits: number;
  averageWaitTime: number;
  peakUsage: number;
  efficiency: number;
}

/**
 * Advanced resource pooling with adaptive sizing and intelligent allocation
 */
export class ResourcePooling {
  private config: PoolingConfig;
  private metrics: ResourceMetrics;
  
  // Connection pools
  private connectionPools = new Map<string, ConnectionPool>();
  private connectionStats = new Map<string, PoolStats>();
  
  // Memory pools
  private memoryPools = new Map<string, MemoryPool>();
  private memoryStats = new Map<string, PoolStats>();
  
  // Worker pools
  private workerPools = new Map<string, WorkerPool>();
  private workerStats = new Map<string, PoolStats>();
  
  // Shared resources
  private sharedResources = new Map<string, SharedResource>();
  private resourceReferences = new Map<string, Set<string>>();
  
  // Resource allocation
  private allocationStrategy: AllocationStrategy = 'load-balanced';
  private resourceAffinities = new Map<string, string>(); // user -> preferred resource
  
  // Background tasks
  private healthCheckInterval: number | null = null;
  private optimizationInterval: number | null = null;
  private cleanupInterval: number | null = null;
  
  // Performance monitoring
  private performanceHistory: ResourceMetrics[] = [];

  constructor(config: Partial<PoolingConfig> = {}) {
    this.config = {
      connectionPoolSize: 50,
      memoryPoolSize: 100 * 1024 * 1024, // 100MB
      workerThreads: 4,
      enableAdaptiveSizing: true,
      healthCheckInterval: 30000,
      resourceLimits: {
        maxMemoryPerSession: 50 * 1024, // 50KB
        maxCpuPercentage: 20,
        maxConnectionsPerUser: 5
      },
      ...config
    };

    this.metrics = {
      connections: { active: 0, pooled: 0, utilization: 0, responseTime: 0 },
      memory: { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, sessions: 0 },
      workers: { active: 0, idle: 0, queueLength: 0, utilization: 0 },
      cpu: { usage: 0, user: 0, system: 0 }
    };
  }

  /**
   * Initialize resource pooling
   */
  async initialize(): Promise<void> {
    console.log('⚡ Initializing Resource Pooling...');
    
    // Initialize connection pools
    await this.initializeConnectionPools();
    
    // Initialize memory pools
    await this.initializeMemoryPools();
    
    // Initialize worker pools
    await this.initializeWorkerPools();
    
    // Start background tasks
    this.startHealthChecking();
    this.startOptimization();
    this.startCleanup();
    
    console.log('✅ Resource Pooling initialized');
  }

  /**
   * Acquire connection from pool
   */
  async acquireConnection(
    poolId: string = 'default',
    userId?: string,
    timeout: number = 5000
  ): Promise<any> {
    const startTime = performance.now();
    
    try {
      const pool = this.connectionPools.get(poolId);
      if (!pool) {
        throw new Error(`Connection pool '${poolId}' not found`);
      }
      
      // Try to get available connection
      let connection = this.getAvailableConnection(pool, userId);
      
      if (!connection) {
        // Wait for available connection or timeout
        connection = await this.waitForConnection(pool, timeout);
      }
      
      if (connection) {
        pool.activeConnections++;
        pool.totalRequests++;
        pool.lastUsed = Date.now();
        
        // Update affinity if user provided
        if (userId) {
          this.updateResourceAffinity(userId, poolId);
        }
        
        // Update statistics
        this.updateConnectionStats(poolId, performance.now() - startTime, true);
        
        return connection;
      }
      
      throw new Error('Connection acquisition timeout');
      
    } catch (error) {
      this.updateConnectionStats(poolId, performance.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(poolId: string, connection: any): Promise<void> {
    const pool = this.connectionPools.get(poolId);
    if (!pool) return;
    
    // Validate connection health
    if (await this.validateConnectionHealth(connection)) {
      pool.connections.add(connection);
      pool.activeConnections = Math.max(0, pool.activeConnections - 1);
      pool.successfulRequests++;
    } else {
      // Remove unhealthy connection
      await this.removeConnection(pool, connection);
    }
    
    // Update metrics
    this.updateConnectionMetrics();
  }

  /**
   * Allocate memory from pool
   */
  async allocateMemory(
    size: number,
    poolId: string = 'default',
    userId?: string
  ): Promise<ArrayBuffer | null> {
    const pool = this.memoryPools.get(poolId);
    if (!pool) {
      throw new Error(`Memory pool '${poolId}' not found`);
    }
    
    // Check resource limits
    if (userId && !this.checkMemoryLimits(userId, size)) {
      throw new Error('Memory allocation exceeds user limits');
    }
    
    // Try to find suitable buffer
    let buffer = this.findSuitableBuffer(pool, size);
    
    if (!buffer) {
      // Try to create new buffer if pool has capacity
      if (pool.allocated + size <= pool.maxSize) {
        buffer = new ArrayBuffer(size);
        pool.totalSize += size;
      } else {
        // Try garbage collection and defragmentation
        await this.defragmentMemoryPool(pool);
        buffer = this.findSuitableBuffer(pool, size);
      }
    }
    
    if (buffer) {
      pool.allocated += size;
      pool.free -= size;
      pool.allocations++;
      
      // Update statistics
      this.updateMemoryStats(poolId, size, true);
      
      return buffer;
    }
    
    this.updateMemoryStats(poolId, size, false);
    return null;
  }

  /**
   * Deallocate memory back to pool
   */
  async deallocateMemory(
    poolId: string,
    buffer: ArrayBuffer,
    size: number
  ): Promise<void> {
    const pool = this.memoryPools.get(poolId);
    if (!pool) return;
    
    pool.buffers.add(buffer);
    pool.allocated -= size;
    pool.free += size;
    pool.deallocations++;
    
    // Update largest free block
    pool.largestFreeBlock = Math.max(pool.largestFreeBlock, size);
    
    // Update fragmentation ratio
    pool.fragmentationRatio = this.calculateFragmentation(pool);
    
    // Update metrics
    this.updateMemoryMetrics();
  }

  /**
   * Execute task using worker pool
   */
  async executeTask<T>(
    task: () => Promise<T>,
    poolId: string = 'default',
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<T> {
    const pool = this.workerPools.get(poolId);
    if (!pool) {
      throw new Error(`Worker pool '${poolId}' not found`);
    }
    
    const startTime = performance.now();
    
    try {
      // Get available worker
      const worker = await this.getAvailableWorker(pool, priority);
      
      if (!worker) {
        throw new Error('No available workers');
      }
      
      pool.activeWorkers++;
      
      // Execute task
      const result = await this.executeTaskOnWorker(worker, task);
      
      // Update statistics
      const executionTime = performance.now() - startTime;
      this.updateWorkerStats(poolId, executionTime, true);
      
      // Release worker
      pool.activeWorkers = Math.max(0, pool.activeWorkers - 1);
      pool.completedTasks++;
      
      return result;
      
    } catch (error) {
      this.updateWorkerStats(poolId, performance.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Get shared resource with reference counting
   */
  async getSharedResource(
    resourceId: string,
    userId: string,
    factory?: () => Promise<any>
  ): Promise<any> {
    let resource = this.sharedResources.get(resourceId);
    
    if (!resource) {
      if (!factory) {
        throw new Error(`Shared resource '${resourceId}' not found and no factory provided`);
      }
      
      // Create new shared resource
      const data = await factory();
      resource = {
        id: resourceId,
        type: 'cache', // Default type
        data,
        refCount: 0,
        lastAccess: Date.now(),
        size: this.calculateResourceSize(data),
        cost: 1
      };
      
      this.sharedResources.set(resourceId, resource);
    }
    
    // Increment reference count
    resource.refCount++;
    resource.lastAccess = Date.now();
    
    // Track user reference
    let userRefs = this.resourceReferences.get(userId);
    if (!userRefs) {
      userRefs = new Set();
      this.resourceReferences.set(userId, userRefs);
    }
    userRefs.add(resourceId);
    
    return resource.data;
  }

  /**
   * Release shared resource
   */
  async releaseSharedResource(resourceId: string, userId: string): Promise<void> {
    const resource = this.sharedResources.get(resourceId);
    if (!resource) return;
    
    // Decrement reference count
    resource.refCount = Math.max(0, resource.refCount - 1);
    
    // Remove user reference
    const userRefs = this.resourceReferences.get(userId);
    if (userRefs) {
      userRefs.delete(resourceId);
      if (userRefs.size === 0) {
        this.resourceReferences.delete(userId);
      }
    }
    
    // Clean up if no more references
    if (resource.refCount === 0) {
      await this.cleanupSharedResource(resource);
      this.sharedResources.delete(resourceId);
    }
  }

  /**
   * Optimize connection pool size
   */
  async optimizeConnections(): Promise<void> {
    console.log('🔧 Optimizing connection pools...');
    
    for (const [poolId, pool] of this.connectionPools) {
      const stats = this.connectionStats.get(poolId);
      if (!stats) continue;
      
      // Calculate optimal pool size based on usage patterns
      const utilization = pool.activeConnections / pool.maxSize;
      const efficiency = stats.hits / Math.max(stats.hits + stats.misses, 1);
      
      if (utilization > 0.9 && efficiency > 0.8) {
        // Pool is highly utilized and efficient - increase size
        const newSize = Math.min(pool.maxSize * 1.25, 200);
        await this.resizeConnectionPool(poolId, newSize);
      } else if (utilization < 0.3 && pool.maxSize > pool.minSize) {
        // Pool is underutilized - decrease size
        const newSize = Math.max(pool.maxSize * 0.8, pool.minSize);
        await this.resizeConnectionPool(poolId, newSize);
      }
    }
  }

  /**
   * Update connection pool size
   */
  updateConnectionPoolSize(newSize: number): void {
    const poolId = 'default';
    this.resizeConnectionPool(poolId, newSize);
    console.log(`🔧 Updated connection pool size to ${newSize}`);
  }

  /**
   * Get connection metrics
   */
  async getConnectionMetrics(): Promise<ResourceMetrics['connections']> {
    return { ...this.metrics.connections };
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics(): Promise<ResourceMetrics['memory']> {
    // Update with current system metrics if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        sessions: this.calculateActiveSessions()
      };
    }
    
    return { ...this.metrics.memory };
  }

  /**
   * Initialize connection pools
   */
  private async initializeConnectionPools(): Promise<void> {
    const defaultPool: ConnectionPool = {
      id: 'default',
      connections: new Set(),
      maxSize: this.config.connectionPoolSize,
      minSize: Math.max(Math.floor(this.config.connectionPoolSize / 4), 5),
      activeConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      lastUsed: Date.now(),
      healthCheckInterval: this.config.healthCheckInterval
    };
    
    this.connectionPools.set('default', defaultPool);
    this.connectionStats.set('default', this.createPoolStats());
    
    // Pre-populate with connections
    await this.populateConnectionPool(defaultPool);
  }

  /**
   * Initialize memory pools
   */
  private async initializeMemoryPools(): Promise<void> {
    const defaultPool: MemoryPool = {
      id: 'default',
      buffers: new Set(),
      totalSize: 0,
      maxSize: this.config.memoryPoolSize,
      allocated: 0,
      free: this.config.memoryPoolSize,
      largestFreeBlock: this.config.memoryPoolSize,
      fragmentationRatio: 0,
      allocations: 0,
      deallocations: 0
    };
    
    this.memoryPools.set('default', defaultPool);
    this.memoryStats.set('default', this.createPoolStats());
  }

  /**
   * Initialize worker pools
   */
  private async initializeWorkerPools(): Promise<void> {
    const defaultPool: WorkerPool = {
      id: 'default',
      workers: new Set(),
      maxWorkers: this.config.workerThreads,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      averageExecutionTime: 0,
      workerUtilization: 0
    };
    
    this.workerPools.set('default', defaultPool);
    this.workerStats.set('default', this.createPoolStats());
    
    // Create worker threads if available
    if (typeof Worker !== 'undefined') {
      await this.populateWorkerPool(defaultPool);
    }
  }

  /**
   * Get available connection from pool
   */
  private getAvailableConnection(pool: ConnectionPool, userId?: string): any {
    // Try affinity-based selection first
    if (userId && this.allocationStrategy === 'affinity') {
      const preferredPoolId = this.resourceAffinities.get(userId);
      if (preferredPoolId && preferredPoolId === pool.id) {
        return this.selectConnectionByStrategy(pool, 'affinity');
      }
    }
    
    return this.selectConnectionByStrategy(pool, this.allocationStrategy);
  }

  /**
   * Select connection based on allocation strategy
   */
  private selectConnectionByStrategy(pool: ConnectionPool, strategy: AllocationStrategy): any {
    const availableConnections = Array.from(pool.connections);
    
    if (availableConnections.length === 0) {
      return null;
    }
    
    switch (strategy) {
      case 'round-robin':
        return availableConnections[pool.totalRequests % availableConnections.length];
      case 'random':
        return availableConnections[Math.floor(Math.random() * availableConnections.length)];
      case 'least-used':
        return this.selectLeastUsedConnection(availableConnections);
      case 'load-balanced':
        return this.selectLoadBalancedConnection(availableConnections);
      default:
        return availableConnections[0];
    }
  }

  /**
   * Wait for available connection
   */
  private async waitForConnection(pool: ConnectionPool, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkAvailable = () => {
        const connection = this.selectConnectionByStrategy(pool, this.allocationStrategy);
        
        if (connection) {
          resolve(connection);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('Connection wait timeout'));
          return;
        }
        
        // Check again in 10ms
        setTimeout(checkAvailable, 10);
      };
      
      checkAvailable();
    });
  }

  /**
   * Validate connection health
   */
  private async validateConnectionHealth(connection: any): Promise<boolean> {
    // In a real implementation, this would ping the connection
    return true; // Assume healthy for simulation
  }

  /**
   * Remove connection from pool
   */
  private async removeConnection(pool: ConnectionPool, connection: any): Promise<void> {
    pool.connections.delete(connection);
    
    // Try to replace with new connection if below minimum
    if (pool.connections.size < pool.minSize) {
      await this.addNewConnection(pool);
    }
  }

  /**
   * Find suitable buffer in memory pool
   */
  private findSuitableBuffer(pool: MemoryPool, size: number): ArrayBuffer | null {
    for (const buffer of pool.buffers) {
      if (buffer.byteLength >= size) {
        pool.buffers.delete(buffer);
        return buffer;
      }
    }
    return null;
  }

  /**
   * Check memory limits for user
   */
  private checkMemoryLimits(userId: string, size: number): boolean {
    // Track per-user memory usage
    const userMemory = this.getUserMemoryUsage(userId);
    return userMemory + size <= this.config.resourceLimits.maxMemoryPerSession;
  }

  /**
   * Get user memory usage
   */
  private getUserMemoryUsage(userId: string): number {
    // In a real implementation, this would track per-user allocations
    return 1024; // Simulated value
  }

  /**
   * Defragment memory pool
   */
  private async defragmentMemoryPool(pool: MemoryPool): Promise<void> {
    // Simple defragmentation - combine adjacent free blocks
    const buffers = Array.from(pool.buffers);
    buffers.sort((a, b) => a.byteLength - b.byteLength);
    
    // In a real implementation, this would merge adjacent blocks
    console.log(`🔧 Defragmented memory pool: ${pool.id}`);
  }

  /**
   * Calculate memory fragmentation
   */
  private calculateFragmentation(pool: MemoryPool): number {
    if (pool.free === 0) return 0;
    return 1 - (pool.largestFreeBlock / pool.free);
  }

  /**
   * Get available worker
   */
  private async getAvailableWorker(pool: WorkerPool, priority: string): Promise<Worker | null> {
    const availableWorkers = Array.from(pool.workers).filter(worker => {
      // Check if worker is available (not processing a task)
      return true; // Simplified check
    });
    
    if (availableWorkers.length > 0) {
      return availableWorkers[0];
    }
    
    // If no workers available and we can create more
    if (pool.workers.size < pool.maxWorkers) {
      return await this.createNewWorker(pool);
    }
    
    return null;
  }

  /**
   * Execute task on worker
   */
  private async executeTaskOnWorker<T>(worker: Worker, task: () => Promise<T>): Promise<T> {
    // In a real implementation, this would send task to worker thread
    // For simulation, execute directly
    return await task();
  }

  /**
   * Calculate resource size
   */
  private calculateResourceSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2;
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }
    return 8;
  }

  /**
   * Update resource affinity
   */
  private updateResourceAffinity(userId: string, resourceId: string): void {
    this.resourceAffinities.set(userId, resourceId);
  }

  /**
   * Cleanup shared resource
   */
  private async cleanupSharedResource(resource: SharedResource): Promise<void> {
    // Cleanup resource data if needed
    if (resource.type === 'connection' && resource.data.close) {
      resource.data.close();
    }
  }

  /**
   * Create pool statistics
   */
  private createPoolStats(): PoolStats {
    return {
      allocations: 0,
      deallocations: 0,
      hits: 0,
      misses: 0,
      waits: 0,
      averageWaitTime: 0,
      peakUsage: 0,
      efficiency: 0
    };
  }

  /**
   * Update connection statistics
   */
  private updateConnectionStats(poolId: string, responseTime: number, success: boolean): void {
    const stats = this.connectionStats.get(poolId);
    if (!stats) return;
    
    if (success) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    stats.efficiency = stats.hits / Math.max(stats.hits + stats.misses, 1);
  }

  /**
   * Update memory statistics
   */
  private updateMemoryStats(poolId: string, size: number, success: boolean): void {
    const stats = this.memoryStats.get(poolId);
    if (!stats) return;
    
    if (success) {
      stats.hits++;
      stats.allocations++;
    } else {
      stats.misses++;
    }
  }

  /**
   * Update worker statistics
   */
  private updateWorkerStats(poolId: string, executionTime: number, success: boolean): void {
    const stats = this.workerStats.get(poolId);
    const pool = this.workerPools.get(poolId);
    if (!stats || !pool) return;
    
    if (success) {
      stats.hits++;
      pool.averageExecutionTime = (pool.averageExecutionTime + executionTime) / 2;
    } else {
      stats.misses++;
    }
    
    pool.workerUtilization = pool.activeWorkers / pool.maxWorkers;
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(): void {
    let totalActive = 0;
    let totalPooled = 0;
    let totalResponseTime = 0;
    let poolCount = 0;
    
    for (const pool of this.connectionPools.values()) {
      totalActive += pool.activeConnections;
      totalPooled += pool.connections.size;
      totalResponseTime += pool.averageResponseTime;
      poolCount++;
    }
    
    this.metrics.connections = {
      active: totalActive,
      pooled: totalPooled,
      utilization: totalPooled > 0 ? totalActive / totalPooled : 0,
      responseTime: poolCount > 0 ? totalResponseTime / poolCount : 0
    };
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    // Memory metrics are updated in getMemoryMetrics()
  }

  /**
   * Calculate active sessions
   */
  private calculateActiveSessions(): number {
    return this.resourceReferences.size;
  }

  /**
   * Select least used connection
   */
  private selectLeastUsedConnection(connections: any[]): any {
    // In a real implementation, track usage per connection
    return connections[0];
  }

  /**
   * Select load balanced connection
   */
  private selectLoadBalancedConnection(connections: any[]): any {
    // In a real implementation, consider current load per connection
    return connections[Math.floor(Math.random() * connections.length)];
  }

  /**
   * Populate connection pool
   */
  private async populateConnectionPool(pool: ConnectionPool): Promise<void> {
    // Create initial connections
    for (let i = 0; i < pool.minSize; i++) {
      await this.addNewConnection(pool);
    }
  }

  /**
   * Add new connection to pool
   */
  private async addNewConnection(pool: ConnectionPool): Promise<void> {
    // In a real implementation, create actual connection
    const connection = { id: `conn-${Date.now()}-${Math.random()}`, created: Date.now() };
    pool.connections.add(connection);
  }

  /**
   * Populate worker pool
   */
  private async populateWorkerPool(pool: WorkerPool): Promise<void> {
    // Create initial workers
    for (let i = 0; i < pool.maxWorkers; i++) {
      const worker = await this.createNewWorker(pool);
      if (worker) {
        pool.workers.add(worker);
      }
    }
  }

  /**
   * Create new worker
   */
  private async createNewWorker(pool: WorkerPool): Promise<Worker | null> {
    try {
      // In a real implementation, create actual Worker
      const worker = { id: `worker-${Date.now()}-${Math.random()}` } as any;
      return worker;
    } catch (error) {
      console.warn('Failed to create worker:', error);
      return null;
    }
  }

  /**
   * Resize connection pool
   */
  private async resizeConnectionPool(poolId: string, newSize: number): Promise<void> {
    const pool = this.connectionPools.get(poolId);
    if (!pool) return;
    
    const oldSize = pool.maxSize;
    pool.maxSize = newSize;
    
    if (newSize > oldSize) {
      // Add more connections
      const connectionsToAdd = Math.min(newSize - pool.connections.size, newSize - oldSize);
      for (let i = 0; i < connectionsToAdd; i++) {
        await this.addNewConnection(pool);
      }
    } else if (newSize < oldSize) {
      // Remove excess connections
      const connectionsToRemove = pool.connections.size - newSize;
      if (connectionsToRemove > 0) {
        const connections = Array.from(pool.connections);
        for (let i = 0; i < connectionsToRemove; i++) {
          pool.connections.delete(connections[i]);
        }
      }
    }
    
    console.log(`🔧 Resized pool '${poolId}' from ${oldSize} to ${newSize}`);
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Start optimization
   */
  private startOptimization(): void {
    this.optimizationInterval = setInterval(() => {
      this.performOptimization();
    }, 60000); // Every minute
  }

  /**
   * Start cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    // Check connection pools
    for (const [poolId, pool] of this.connectionPools) {
      const healthyConnections = new Set();
      
      for (const connection of pool.connections) {
        if (await this.validateConnectionHealth(connection)) {
          healthyConnections.add(connection);
        }
      }
      
      pool.connections = healthyConnections;
    }
  }

  /**
   * Perform optimization
   */
  private async performOptimization(): Promise<void> {
    if (this.config.enableAdaptiveSizing) {
      await this.optimizeConnections();
      await this.optimizeMemoryPools();
      await this.optimizeWorkerPools();
    }
  }

  /**
   * Optimize memory pools
   */
  private async optimizeMemoryPools(): Promise<void> {
    for (const [poolId, pool] of this.memoryPools) {
      // Defragment if fragmentation is high
      if (pool.fragmentationRatio > 0.5) {
        await this.defragmentMemoryPool(pool);
      }
    }
  }

  /**
   * Optimize worker pools
   */
  private async optimizeWorkerPools(): Promise<void> {
    for (const [poolId, pool] of this.workerPools) {
      // Adjust worker count based on utilization
      if (pool.workerUtilization > 0.9 && pool.workers.size < pool.maxWorkers) {
        const worker = await this.createNewWorker(pool);
        if (worker) {
          pool.workers.add(worker);
        }
      } else if (pool.workerUtilization < 0.3 && pool.workers.size > 1) {
        const workers = Array.from(pool.workers);
        pool.workers.delete(workers[workers.length - 1]);
      }
    }
  }

  /**
   * Perform cleanup
   */
  private async performCleanup(): Promise<void> {
    // Clean up old shared resources
    const now = Date.now();
    for (const [resourceId, resource] of this.sharedResources) {
      if (resource.refCount === 0 && now - resource.lastAccess > 300000) { // 5 minutes
        await this.cleanupSharedResource(resource);
        this.sharedResources.delete(resourceId);
      }
    }
    
    // Clean up old performance history
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.splice(0, this.performanceHistory.length - 100);
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    // Clean up all pools
    this.connectionPools.clear();
    this.memoryPools.clear();
    this.workerPools.clear();
    
    // Clean up shared resources
    for (const resource of this.sharedResources.values()) {
      await this.cleanupSharedResource(resource);
    }
    this.sharedResources.clear();
    this.resourceReferences.clear();
    
    console.log('🧹 Resource Pooling destroyed');
  }
}
/**
 * Advanced Performance Optimizer
 * Coordinates system-wide performance optimizations for enterprise-grade performance
 * 
 * TARGET METRICS:
 * - Total end-to-end latency: <65ms (browser <50ms + backend <15ms)
 * - Throughput: 10,000+ commands/second system-wide
 * - Memory efficiency: <50MB per 1000 concurrent sessions
 * - CPU efficiency: <20% CPU for 1000 concurrent users
 * - Network efficiency: <1Mbps per 100 concurrent sessions
 */

import { CacheHierarchy } from './CacheHierarchy.js';
import { NetworkOptimization } from './NetworkOptimization.js';
import { ResourcePooling } from './ResourcePooling.js';
import type { TerminalWebSocketClient } from '../websocket/TerminalWebSocketClient.js';

// Performance monitoring interfaces
export interface PerformanceMetrics {
  latency: {
    browser: number;
    network: number;
    backend: number;
    total: number;
  };
  throughput: {
    commandsPerSecond: number;
    messagesPerSecond: number;
    bytesPerSecond: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    sessions: number;
  };
  cpu: {
    usage: number;
    user: number;
    system: number;
  };
  network: {
    bandwidth: number;
    compression: number;
    connections: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
  };
  connections: {
    active: number;
    pooled: number;
    utilization: number;
  };
}

export interface OptimizationConfig {
  // Latency targets
  targetLatency: {
    browser: number;     // <50ms
    backend: number;     // <15ms
    total: number;       // <65ms
  };
  
  // Throughput targets
  targetThroughput: {
    commandsPerSecond: number;  // 10,000+
    concurrentUsers: number;    // 1,000+
  };
  
  // Resource targets
  targetResources: {
    memoryPerSession: number;   // <50KB
    cpuUsage: number;          // <20%
    networkPerUser: number;    // <10Kbps
  };
  
  // Optimization strategies
  strategies: {
    enablePredictiveOptimization: boolean;
    enableAdaptiveCaching: boolean;
    enableConnectionPooling: boolean;
    enableMessageCompression: boolean;
    enableBinaryProtocol: boolean;
    enableOutputStreaming: boolean;
    enableCommandBatching: boolean;
    enableSmartPrefetching: boolean;
  };
}

export interface OptimizationResult {
  beforeMetrics: PerformanceMetrics;
  afterMetrics: PerformanceMetrics;
  improvements: {
    latencyReduction: number;      // percentage
    throughputIncrease: number;    // percentage
    memoryReduction: number;       // percentage
    cpuReduction: number;          // percentage
    networkReduction: number;      // percentage
  };
  targetsMet: {
    latency: boolean;
    throughput: boolean;
    memory: boolean;
    cpu: boolean;
    network: boolean;
  };
  recommendations: string[];
}

// Predictive optimization patterns
interface UserPattern {
  userId: string;
  commandHistory: string[];
  timingPatterns: number[];
  sessionPreferences: Record<string, any>;
  predictedNextCommands: string[];
  confidence: number;
}

// Adaptive performance tuning
interface PerformanceTuning {
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  connectionPoolSize: number;
  batchSize: number;
  compressionLevel: number;
  prefetchWindow: number;
  adaptationReason: string;
}

/**
 * Main optimization coordinator that manages all performance subsystems
 */
export class AdvancedOptimizer {
  private cacheHierarchy: CacheHierarchy;
  private networkOptimization: NetworkOptimization;
  private resourcePooling: ResourcePooling;
  private config: OptimizationConfig;
  
  // Performance monitoring
  private metricsHistory: PerformanceMetrics[] = [];
  private currentMetrics: PerformanceMetrics;
  private monitoringInterval: number | null = null;
  
  // Predictive optimization
  private userPatterns = new Map<string, UserPattern>();
  private globalCommandPatterns = new Map<string, number>();
  
  // Adaptive tuning
  private currentTuning: PerformanceTuning;
  private tuningHistory: PerformanceTuning[] = [];
  
  // WebSocket clients for monitoring
  private wsClients = new Set<TerminalWebSocketClient>();

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      targetLatency: {
        browser: 50,
        backend: 15,
        total: 65
      },
      targetThroughput: {
        commandsPerSecond: 10000,
        concurrentUsers: 1000
      },
      targetResources: {
        memoryPerSession: 50 * 1024, // 50KB
        cpuUsage: 20,
        networkPerUser: 10 * 1024 // 10Kbps
      },
      strategies: {
        enablePredictiveOptimization: true,
        enableAdaptiveCaching: true,
        enableConnectionPooling: true,
        enableMessageCompression: true,
        enableBinaryProtocol: true,
        enableOutputStreaming: true,
        enableCommandBatching: true,
        enableSmartPrefetching: true
      },
      ...config
    };

    // Initialize subsystems
    this.cacheHierarchy = new CacheHierarchy({
      levels: 3,
      strategies: ['lru', 'lfu', 'ttl'],
      adaptiveSizing: this.config.strategies.enableAdaptiveCaching
    });

    this.networkOptimization = new NetworkOptimization({
      enableCompression: this.config.strategies.enableMessageCompression,
      enableBinaryProtocol: this.config.strategies.enableBinaryProtocol,
      enableStreaming: this.config.strategies.enableOutputStreaming,
      enableBatching: this.config.strategies.enableCommandBatching
    });

    this.resourcePooling = new ResourcePooling({
      connectionPoolSize: 50,
      memoryPoolSize: 100 * 1024 * 1024, // 100MB
      workerThreads: 4,
      enableAdaptiveSizing: true
    });

    // Initialize current metrics
    this.currentMetrics = this.getInitialMetrics();
    
    // Initialize current tuning
    this.currentTuning = {
      cacheStrategy: 'balanced',
      connectionPoolSize: 50,
      batchSize: 10,
      compressionLevel: 6,
      prefetchWindow: 5,
      adaptationReason: 'initial'
    };
  }

  /**
   * Initialize the optimizer and start performance monitoring
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Advanced Performance Optimizer...');
    
    // Initialize subsystems
    await this.cacheHierarchy.initialize();
    await this.networkOptimization.initialize();
    await this.resourcePooling.initialize();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    // Start adaptive optimization
    this.startAdaptiveOptimization();
    
    console.log('✅ Advanced Performance Optimizer initialized');
  }

  /**
   * Register a WebSocket client for optimization
   */
  registerWebSocketClient(client: TerminalWebSocketClient): void {
    this.wsClients.add(client);
    
    // Apply optimizations to the client
    this.optimizeWebSocketClient(client);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterWebSocketClient(client: TerminalWebSocketClient): void {
    this.wsClients.delete(client);
  }

  /**
   * Execute optimized command with all performance enhancements
   */
  async executeOptimizedCommand(
    userId: string,
    sessionId: string,
    command: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    const startTime = performance.now();
    
    // Update user patterns for predictive optimization
    this.updateUserPatterns(userId, command);
    
    // Check cache first (L1 → L2 → L3)
    const cacheKey = `${sessionId}:${command}`;
    const cachedResult = await this.cacheHierarchy.get(cacheKey);
    
    if (cachedResult) {
      const endTime = performance.now();
      this.recordCommandLatency(endTime - startTime, 'cache-hit');
      return cachedResult;
    }
    
    // Predict and prefetch likely next commands
    if (this.config.strategies.enablePredictiveOptimization) {
      this.prefetchPredictedCommands(userId, sessionId);
    }
    
    try {
      // Execute command with optimizations
      let result;
      
      if (this.config.strategies.enableCommandBatching && this.shouldBatchCommand(command)) {
        result = await this.executeBatchedCommand(sessionId, command, options);
      } else {
        result = await this.executeDirectCommand(sessionId, command, options);
      }
      
      // Cache the result with appropriate TTL
      const ttl = this.calculateCacheTTL(command, result);
      await this.cacheHierarchy.set(cacheKey, result, ttl);
      
      const endTime = performance.now();
      this.recordCommandLatency(endTime - startTime, 'cache-miss');
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      this.recordCommandLatency(endTime - startTime, 'error');
      throw error;
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get performance history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Run full optimization analysis and return results
   */
  async runOptimizationAnalysis(): Promise<OptimizationResult> {
    console.log('📊 Running optimization analysis...');
    
    const beforeMetrics = { ...this.currentMetrics };
    
    // Apply all optimizations
    await this.applyOptimizations();
    
    // Wait for metrics to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const afterMetrics = await this.collectMetrics();
    
    const improvements = this.calculateImprovements(beforeMetrics, afterMetrics);
    const targetsMet = this.checkTargetsMet(afterMetrics);
    const recommendations = this.generateRecommendations(afterMetrics, targetsMet);
    
    return {
      beforeMetrics,
      afterMetrics,
      improvements,
      targetsMet,
      recommendations
    };
  }

  /**
   * Start continuous performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.currentMetrics = metrics;
      this.metricsHistory.push(metrics);
      
      // Keep only last 100 metric snapshots
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }
      
      // Check for performance degradation
      this.checkPerformanceDegradation(metrics);
      
    }, 5000); // Collect metrics every 5 seconds
  }

  /**
   * Start adaptive optimization
   */
  private startAdaptiveOptimization(): void {
    setInterval(() => {
      this.adaptOptimizations();
    }, 30000); // Adapt every 30 seconds
  }

  /**
   * Apply all available optimizations
   */
  private async applyOptimizations(): Promise<void> {
    const tasks = [];
    
    if (this.config.strategies.enableAdaptiveCaching) {
      tasks.push(this.optimizeCaching());
    }
    
    if (this.config.strategies.enableConnectionPooling) {
      tasks.push(this.optimizeConnectionPooling());
    }
    
    if (this.config.strategies.enableMessageCompression) {
      tasks.push(this.optimizeNetworkProtocol());
    }
    
    await Promise.all(tasks);
  }

  /**
   * Optimize WebSocket client configuration
   */
  private optimizeWebSocketClient(client: TerminalWebSocketClient): void {
    // Apply network optimizations
    this.networkOptimization.optimizeWebSocketClient(client);
    
    // Set up performance monitoring callbacks
    client.onConnectionStateChanged((state) => {
      this.updateConnectionMetrics(state);
    });
  }

  /**
   * Update user patterns for predictive optimization
   */
  private updateUserPatterns(userId: string, command: string): void {
    if (!this.config.strategies.enablePredictiveOptimization) return;
    
    let pattern = this.userPatterns.get(userId);
    if (!pattern) {
      pattern = {
        userId,
        commandHistory: [],
        timingPatterns: [],
        sessionPreferences: {},
        predictedNextCommands: [],
        confidence: 0
      };
      this.userPatterns.set(userId, pattern);
    }
    
    // Update command history
    pattern.commandHistory.push(command);
    pattern.timingPatterns.push(Date.now());
    
    // Keep only last 50 commands
    if (pattern.commandHistory.length > 50) {
      pattern.commandHistory.shift();
      pattern.timingPatterns.shift();
    }
    
    // Update global patterns
    const count = this.globalCommandPatterns.get(command) || 0;
    this.globalCommandPatterns.set(command, count + 1);
    
    // Generate predictions
    pattern.predictedNextCommands = this.generateCommandPredictions(pattern);
  }

  /**
   * Generate command predictions based on user patterns
   */
  private generateCommandPredictions(pattern: UserPattern): string[] {
    const predictions: string[] = [];
    const history = pattern.commandHistory;
    
    if (history.length < 2) return predictions;
    
    // Simple pattern matching - find commands that often follow the last command
    const lastCommand = history[history.length - 1];
    const sequences = new Map<string, number>();
    
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i] === lastCommand) {
        const nextCommand = history[i + 1];
        sequences.set(nextCommand, (sequences.get(nextCommand) || 0) + 1);
      }
    }
    
    // Sort by frequency and take top 3
    const sortedSequences = Array.from(sequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return sortedSequences.map(([command]) => command);
  }

  /**
   * Prefetch predicted commands
   */
  private async prefetchPredictedCommands(userId: string, sessionId: string): Promise<void> {
    const pattern = this.userPatterns.get(userId);
    if (!pattern || pattern.predictedNextCommands.length === 0) return;
    
    // Prefetch in background without blocking current command
    setTimeout(async () => {
      for (const command of pattern.predictedNextCommands.slice(0, 3)) {
        const cacheKey = `${sessionId}:${command}`;
        if (!(await this.cacheHierarchy.has(cacheKey))) {
          try {
            // Execute command and cache result
            const result = await this.executeDirectCommand(sessionId, command, { prefetch: true });
            await this.cacheHierarchy.set(cacheKey, result, 300000); // 5 minute TTL for prefetched
          } catch (error) {
            // Ignore prefetch errors
          }
        }
      }
    }, 10);
  }

  /**
   * Determine if command should be batched
   */
  private shouldBatchCommand(command: string): boolean {
    // Simple heuristics for batching
    return command.startsWith('echo ') || 
           command.startsWith('ls ') || 
           command.startsWith('pwd') ||
           command.length < 20;
  }

  /**
   * Execute command with batching optimization
   */
  private async executeBatchedCommand(sessionId: string, command: string, options: Record<string, any>): Promise<any> {
    return this.networkOptimization.batchCommand(sessionId, command, options);
  }

  /**
   * Execute command directly
   */
  private async executeDirectCommand(sessionId: string, command: string, options: Record<string, any>): Promise<any> {
    // This would integrate with the actual command execution system
    // For now, simulate execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
    
    return {
      sessionId,
      command,
      output: `Executed: ${command}`,
      timestamp: Date.now(),
      ...options
    };
  }

  /**
   * Calculate appropriate cache TTL for command result
   */
  private calculateCacheTTL(command: string, result: any): number {
    // Dynamic TTL based on command type
    if (command.includes('ls') || command.includes('pwd')) {
      return 60000; // 1 minute for directory listings
    }
    if (command.includes('ps') || command.includes('top')) {
      return 5000; // 5 seconds for process listings
    }
    if (command.includes('echo') || command.includes('cat')) {
      return 300000; // 5 minutes for static content
    }
    
    return 30000; // 30 seconds default
  }

  /**
   * Record command execution latency
   */
  private recordCommandLatency(latency: number, type: 'cache-hit' | 'cache-miss' | 'error'): void {
    // Update current metrics
    this.currentMetrics.latency.browser = latency;
    this.currentMetrics.latency.total = this.currentMetrics.latency.browser + this.currentMetrics.latency.backend;
    
    // Update throughput
    this.currentMetrics.throughput.commandsPerSecond = this.calculateCommandsPerSecond();
  }

  /**
   * Calculate current commands per second
   */
  private calculateCommandsPerSecond(): number {
    const recentHistory = this.metricsHistory.slice(-12); // Last minute
    if (recentHistory.length < 2) return 0;
    
    const totalCommands = recentHistory.reduce((sum, metrics) => sum + (metrics.throughput.commandsPerSecond || 0), 0);
    return totalCommands / recentHistory.length;
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      latency: {
        browser: await this.measureBrowserLatency(),
        network: await this.measureNetworkLatency(),
        backend: await this.measureBackendLatency(),
        total: 0
      },
      throughput: {
        commandsPerSecond: this.calculateCommandsPerSecond(),
        messagesPerSecond: await this.networkOptimization.getMessagesPerSecond(),
        bytesPerSecond: await this.networkOptimization.getBytesPerSecond()
      },
      memory: await this.resourcePooling.getMemoryMetrics(),
      cpu: await this.getCPUMetrics(),
      network: await this.networkOptimization.getNetworkMetrics(),
      cache: await this.cacheHierarchy.getMetrics(),
      connections: await this.resourcePooling.getConnectionMetrics()
    };
    
    metrics.latency.total = metrics.latency.browser + metrics.latency.network + metrics.latency.backend;
    
    return metrics;
  }

  /**
   * Measure browser-side latency
   */
  private async measureBrowserLatency(): Promise<number> {
    // Use performance.measure to get real browser timing
    if (typeof performance !== 'undefined' && performance.now) {
      const start = performance.now();
      // Simulate UI update
      await new Promise(resolve => requestAnimationFrame(resolve));
      return performance.now() - start;
    }
    return 5; // Default estimate
  }

  /**
   * Measure network latency
   */
  private async measureNetworkLatency(): Promise<number> {
    return this.networkOptimization.measureLatency();
  }

  /**
   * Measure backend latency
   */
  private async measureBackendLatency(): Promise<number> {
    // This would measure actual tmux backend response time
    return 8; // Simulated value
  }

  /**
   * Get CPU metrics
   */
  private async getCPUMetrics(): Promise<{ usage: number; user: number; system: number; }> {
    // Use process.cpuUsage() if available
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      const total = usage.user + usage.system;
      return {
        usage: total / 1000000, // Convert to milliseconds
        user: usage.user / 1000000,
        system: usage.system / 1000000
      };
    }
    
    return { usage: 15, user: 10, system: 5 }; // Default values
  }

  /**
   * Calculate performance improvements
   */
  private calculateImprovements(before: PerformanceMetrics, after: PerformanceMetrics): {
    latencyReduction: number;
    throughputIncrease: number;
    memoryReduction: number;
    cpuReduction: number;
    networkReduction: number;
  } {
    return {
      latencyReduction: ((before.latency.total - after.latency.total) / before.latency.total) * 100,
      throughputIncrease: ((after.throughput.commandsPerSecond - before.throughput.commandsPerSecond) / before.throughput.commandsPerSecond) * 100,
      memoryReduction: ((before.memory.heapUsed - after.memory.heapUsed) / before.memory.heapUsed) * 100,
      cpuReduction: ((before.cpu.usage - after.cpu.usage) / before.cpu.usage) * 100,
      networkReduction: ((before.network.bandwidth - after.network.bandwidth) / before.network.bandwidth) * 100
    };
  }

  /**
   * Check if performance targets are met
   */
  private checkTargetsMet(metrics: PerformanceMetrics): {
    latency: boolean;
    throughput: boolean;
    memory: boolean;
    cpu: boolean;
    network: boolean;
  } {
    return {
      latency: metrics.latency.total < this.config.targetLatency.total &&
               metrics.latency.browser < this.config.targetLatency.browser &&
               metrics.latency.backend < this.config.targetLatency.backend,
      throughput: metrics.throughput.commandsPerSecond >= this.config.targetThroughput.commandsPerSecond,
      memory: metrics.memory.heapUsed / metrics.memory.sessions < this.config.targetResources.memoryPerSession,
      cpu: metrics.cpu.usage < this.config.targetResources.cpuUsage,
      network: metrics.network.bandwidth / this.config.targetThroughput.concurrentUsers < this.config.targetResources.networkPerUser
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics, targetsMet: any): string[] {
    const recommendations: string[] = [];
    
    if (!targetsMet.latency) {
      if (metrics.latency.browser > this.config.targetLatency.browser) {
        recommendations.push('🖥️ Browser latency high: Enable aggressive caching and UI virtualization');
      }
      if (metrics.latency.backend > this.config.targetLatency.backend) {
        recommendations.push('⚡ Backend latency high: Increase connection pool size and enable command batching');
      }
    }
    
    if (!targetsMet.throughput) {
      recommendations.push('📈 Throughput below target: Enable binary protocol and increase batch sizes');
    }
    
    if (!targetsMet.memory) {
      recommendations.push('💾 Memory usage high: Implement aggressive cache eviction and session cleanup');
    }
    
    if (!targetsMet.cpu) {
      recommendations.push('🔄 CPU usage high: Optimize worker thread usage and enable lazy loading');
    }
    
    if (!targetsMet.network) {
      recommendations.push('🌐 Network usage high: Increase compression level and enable delta updates');
    }
    
    if (metrics.cache.hitRate < 0.8) {
      recommendations.push('📦 Cache hit rate low: Adjust cache sizing and TTL strategies');
    }
    
    return recommendations;
  }

  /**
   * Optimize caching strategy
   */
  private async optimizeCaching(): Promise<void> {
    await this.cacheHierarchy.optimize();
  }

  /**
   * Optimize connection pooling
   */
  private async optimizeConnectionPooling(): Promise<void> {
    await this.resourcePooling.optimizeConnections();
  }

  /**
   * Optimize network protocol
   */
  private async optimizeNetworkProtocol(): Promise<void> {
    await this.networkOptimization.optimize();
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(state: string): void {
    // Update connection-related metrics based on state changes
  }

  /**
   * Check for performance degradation
   */
  private checkPerformanceDegradation(metrics: PerformanceMetrics): void {
    if (this.metricsHistory.length < 5) return;
    
    const recentAvg = this.metricsHistory.slice(-5).reduce((sum, m) => sum + m.latency.total, 0) / 5;
    const oldAvg = this.metricsHistory.slice(-10, -5).reduce((sum, m) => sum + m.latency.total, 0) / 5;
    
    if (recentAvg > oldAvg * 1.2) { // 20% degradation
      console.warn('⚠️ Performance degradation detected, triggering adaptive optimization');
      this.adaptOptimizations();
    }
  }

  /**
   * Adapt optimizations based on current performance
   */
  private adaptOptimizations(): void {
    const metrics = this.currentMetrics;
    const newTuning = { ...this.currentTuning };
    
    // Adapt cache strategy
    if (metrics.cache.hitRate < 0.7) {
      newTuning.cacheStrategy = 'aggressive';
      newTuning.adaptationReason = 'low cache hit rate';
    } else if (metrics.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
      newTuning.cacheStrategy = 'conservative';
      newTuning.adaptationReason = 'high memory usage';
    }
    
    // Adapt connection pool size
    if (metrics.connections.utilization > 0.9) {
      newTuning.connectionPoolSize = Math.min(newTuning.connectionPoolSize * 1.5, 200);
      newTuning.adaptationReason = 'high connection utilization';
    } else if (metrics.connections.utilization < 0.3) {
      newTuning.connectionPoolSize = Math.max(newTuning.connectionPoolSize * 0.8, 10);
      newTuning.adaptationReason = 'low connection utilization';
    }
    
    // Apply changes if significantly different
    if (this.shouldApplyTuning(newTuning)) {
      this.applyTuning(newTuning);
      this.currentTuning = newTuning;
      this.tuningHistory.push(newTuning);
    }
  }

  /**
   * Determine if new tuning should be applied
   */
  private shouldApplyTuning(newTuning: PerformanceTuning): boolean {
    return newTuning.cacheStrategy !== this.currentTuning.cacheStrategy ||
           Math.abs(newTuning.connectionPoolSize - this.currentTuning.connectionPoolSize) > 5;
  }

  /**
   * Apply new performance tuning
   */
  private applyTuning(tuning: PerformanceTuning): void {
    console.log(`🔧 Applying performance tuning: ${tuning.adaptationReason}`);
    
    // Apply to subsystems
    this.cacheHierarchy.updateStrategy(tuning.cacheStrategy);
    this.resourcePooling.updateConnectionPoolSize(tuning.connectionPoolSize);
    this.networkOptimization.updateBatchSize(tuning.batchSize);
  }

  /**
   * Get initial metrics for baseline
   */
  private getInitialMetrics(): PerformanceMetrics {
    return {
      latency: { browser: 30, network: 20, backend: 10, total: 60 },
      throughput: { commandsPerSecond: 100, messagesPerSecond: 200, bytesPerSecond: 1024 * 100 },
      memory: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 75 * 1024 * 1024, external: 10 * 1024 * 1024, sessions: 10 },
      cpu: { usage: 25, user: 15, system: 10 },
      network: { bandwidth: 1024 * 1024, compression: 0.7, connections: 25 },
      cache: { hitRate: 0.6, missRate: 0.4, evictions: 10 },
      connections: { active: 25, pooled: 50, utilization: 0.5 }
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.cacheHierarchy.destroy();
    await this.networkOptimization.destroy();
    await this.resourcePooling.destroy();
    
    this.wsClients.clear();
    this.userPatterns.clear();
    this.metricsHistory = [];
    
    console.log('🧹 Advanced Performance Optimizer destroyed');
  }
}

// Export singleton instance
export const advancedOptimizer = new AdvancedOptimizer();
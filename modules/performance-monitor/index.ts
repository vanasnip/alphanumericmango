/**
 * Comprehensive Performance Monitoring and Tuning
 * Real-time metrics collection, bottleneck identification, and automated response
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';

export interface PerformanceConfig {
  componentName: string;
  targetLatency: number;
  maxMemoryUsage: number;
  enableAutoTuning: boolean;
  metricsRetentionTime: number;
  alertThresholds: AlertThresholds;
  samplingRate: number;
}

export interface AlertThresholds {
  latencyP95: number;
  latencyP99: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  throughput: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  count: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  bytesPerSecond: number;
  operationsPerSecond: number;
  peakThroughput: number;
  averageThroughput: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  memoryPeak: number;
  cpuUsage: number;
  cpuPeak: number;
  diskIO: number;
  networkIO: number;
  fileDescriptors: number;
  threadCount: number;
}

export interface PerformanceReport {
  componentName: string;
  timestamp: number;
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  resources: ResourceMetrics;
  errors: ErrorMetrics;
  bottlenecks: BottleneckReport[];
  recommendations: PerformanceRecommendation[];
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  recentErrors: ErrorInfo[];
}

export interface ErrorInfo {
  type: string;
  message: string;
  timestamp: number;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface BottleneckReport {
  type: 'memory' | 'cpu' | 'io' | 'latency' | 'throughput';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number; // 0-1 scale
  suggestedAction: string;
  detectedAt: number;
}

export interface PerformanceRecommendation {
  category: 'optimization' | 'scaling' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImprovement: string;
  implementation: string;
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];
  private latencyMeasurements: number[] = [];
  private throughputCounter: number = 0;
  private errorTracker: ErrorInfo[] = [];
  private resourceMonitor: NodeJS.Timer | null = null;
  private bottleneckDetector: NodeJS.Timer | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private lastCleanup: number = 0;
  private isMonitoring: boolean = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    
    this.config = {
      componentName: config.componentName || 'unknown',
      targetLatency: config.targetLatency || 100, // 100ms
      maxMemoryUsage: config.maxMemoryUsage || 512 * 1024 * 1024, // 512MB
      enableAutoTuning: config.enableAutoTuning ?? false,
      metricsRetentionTime: config.metricsRetentionTime || 3600000, // 1 hour
      samplingRate: config.samplingRate || 1.0, // 100% sampling
      alertThresholds: {
        latencyP95: config.alertThresholds?.latencyP95 || 200,
        latencyP99: config.alertThresholds?.latencyP99 || 500,
        memoryUsage: config.alertThresholds?.memoryUsage || 0.8,
        cpuUsage: config.alertThresholds?.cpuUsage || 0.7,
        errorRate: config.alertThresholds?.errorRate || 0.01,
        throughput: config.alertThresholds?.throughput || 100,
        ...config.alertThresholds
      }
    };

    this.setupPerformanceObserver();
    this.start();
  }

  /**
   * Setup Node.js performance observer
   */
  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.recordMetric(`node_${entry.name}`, entry.duration, {
          type: entry.entryType
        });
      }
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startResourceMonitoring();
    this.startBottleneckDetection();
    
    console.log(`Performance monitoring started for ${this.config.componentName}`);
    this.emit('monitoring_started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.stopResourceMonitoring();
    this.stopBottleneckDetection();

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    console.log(`Performance monitoring stopped for ${this.config.componentName}`);
    this.emit('monitoring_stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    if (!this.shouldSample()) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit
    };

    this.metrics.push(metric);
    
    // Special handling for latency metrics
    if (name.includes('latency') || name.includes('duration') || name.includes('time')) {
      this.latencyMeasurements.push(value);
      
      // Keep only recent measurements
      if (this.latencyMeasurements.length > 10000) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-5000);
      }
    }

    // Emit metric event
    this.emit('metric', metric);

    // Clean up old metrics periodically
    this.cleanupOldMetrics();
  }

  /**
   * Record an event
   */
  recordEvent(name: string, metadata?: Record<string, any>): void {
    this.recordMetric(`event_${name}`, 1, {
      event_type: name,
      ...metadata
    });
  }

  /**
   * Record an error
   */
  recordError(error: Error, metadata?: Record<string, any>): void {
    const errorInfo: ErrorInfo = {
      type: error.constructor.name,
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack,
      metadata
    };

    this.errorTracker.push(errorInfo);
    
    // Keep only recent errors
    if (this.errorTracker.length > 1000) {
      this.errorTracker = this.errorTracker.slice(-500);
    }

    this.recordMetric('error_count', 1, {
      error_type: errorInfo.type
    });

    this.emit('error_recorded', errorInfo);
  }

  /**
   * Start latency measurement
   */
  startMeasurement(label: string): string {
    const measurementId = `${label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    performance.mark(`${measurementId}_start`);
    return measurementId;
  }

  /**
   * End latency measurement
   */
  endMeasurement(measurementId: string, tags?: Record<string, string>): number {
    const endMark = `${measurementId}_end`;
    const startMark = `${measurementId}_start`;
    
    performance.mark(endMark);
    performance.measure(measurementId, startMark, endMark);
    
    const entry = performance.getEntriesByName(measurementId)[0];
    const duration = entry ? entry.duration : 0;
    
    this.recordMetric('operation_latency', duration, {
      operation: measurementId.split('_')[0],
      ...tags
    }, 'ms');

    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measurementId);

    return duration;
  }

  /**
   * Record throughput metric
   */
  recordThroughput(): void {
    this.throughputCounter++;
    this.recordMetric('throughput_counter', 1);
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    
    this.recordMetric('memory_heap_used', memUsage.heapUsed, {}, 'bytes');
    this.recordMetric('memory_heap_total', memUsage.heapTotal, {}, 'bytes');
    this.recordMetric('memory_external', memUsage.external, {}, 'bytes');
    this.recordMetric('memory_rss', memUsage.rss, {}, 'bytes');

    // Check if memory usage exceeds threshold
    if (memUsage.heapUsed > this.config.maxMemoryUsage) {
      this.emit('memory_threshold_exceeded', {
        current: memUsage.heapUsed,
        threshold: this.config.maxMemoryUsage
      });
    }
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatencyMetrics(): LatencyMetrics {
    if (this.latencyMeasurements.length === 0) {
      return {
        p50: 0, p95: 0, p99: 0, mean: 0,
        min: 0, max: 0, count: 0
      };
    }

    const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      mean: sorted.reduce((sum, val) => sum + val, 0) / count,
      min: sorted[0],
      max: sorted[count - 1],
      count
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = p * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughputMetrics(): ThroughputMetrics {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // Count operations in the last minute
    const recentMetrics = this.metrics.filter(
      m => m.name === 'throughput_counter' && (now - m.timestamp) < timeWindow
    );

    const operationsPerSecond = recentMetrics.length / (timeWindow / 1000);
    
    // Calculate bytes per second from size metrics
    const sizeMetrics = this.metrics.filter(
      m => m.name.includes('size') && (now - m.timestamp) < timeWindow
    );
    
    const totalBytes = sizeMetrics.reduce((sum, m) => sum + m.value, 0);
    const bytesPerSecond = totalBytes / (timeWindow / 1000);

    return {
      requestsPerSecond: operationsPerSecond,
      bytesPerSecond,
      operationsPerSecond,
      peakThroughput: operationsPerSecond, // Simplified
      averageThroughput: operationsPerSecond
    };
  }

  /**
   * Calculate resource metrics
   */
  private calculateResourceMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Simple CPU usage calculation (percentage approximation)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / 100;

    return {
      memoryUsage: memUsage.heapUsed,
      memoryPeak: memUsage.heapTotal,
      cpuUsage: Math.min(cpuPercent, 1),
      cpuPeak: cpuPercent,
      diskIO: 0, // Would need platform-specific implementation
      networkIO: 0, // Would need platform-specific implementation
      fileDescriptors: 0, // Would need platform-specific implementation
      threadCount: 1 // Node.js main thread
    };
  }

  /**
   * Calculate error metrics
   */
  private calculateErrorMetrics(): ErrorMetrics {
    const now = Date.now();
    const timeWindow = 300000; // 5 minutes
    
    const recentErrors = this.errorTracker.filter(
      e => (now - e.timestamp) < timeWindow
    );

    const errorsByType: Record<string, number> = {};
    for (const error of recentErrors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }

    const totalOperations = this.metrics.filter(
      m => (now - m.timestamp) < timeWindow
    ).length;

    const errorRate = totalOperations > 0 ? recentErrors.length / totalOperations : 0;

    return {
      errorCount: recentErrors.length,
      errorRate,
      errorsByType,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(): BottleneckReport[] {
    const bottlenecks: BottleneckReport[] = [];
    const latency = this.calculateLatencyMetrics();
    const resources = this.calculateResourceMetrics();
    const errors = this.calculateErrorMetrics();

    // Latency bottleneck
    if (latency.p95 > this.config.alertThresholds.latencyP95) {
      bottlenecks.push({
        type: 'latency',
        severity: latency.p95 > this.config.alertThresholds.latencyP99 ? 'critical' : 'high',
        description: `P95 latency (${latency.p95.toFixed(2)}ms) exceeds threshold (${this.config.alertThresholds.latencyP95}ms)`,
        impact: Math.min(latency.p95 / this.config.alertThresholds.latencyP95, 2) / 2,
        suggestedAction: 'Optimize critical path operations, add caching, or scale resources',
        detectedAt: Date.now()
      });
    }

    // Memory bottleneck
    const memoryUsagePercent = resources.memoryUsage / this.config.maxMemoryUsage;
    if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
      bottlenecks.push({
        type: 'memory',
        severity: memoryUsagePercent > 0.9 ? 'critical' : 'high',
        description: `Memory usage (${(memoryUsagePercent * 100).toFixed(1)}%) exceeds threshold (${(this.config.alertThresholds.memoryUsage * 100).toFixed(1)}%)`,
        impact: memoryUsagePercent,
        suggestedAction: 'Optimize memory usage, implement garbage collection tuning, or increase memory allocation',
        detectedAt: Date.now()
      });
    }

    // CPU bottleneck
    if (resources.cpuUsage > this.config.alertThresholds.cpuUsage) {
      bottlenecks.push({
        type: 'cpu',
        severity: resources.cpuUsage > 0.9 ? 'critical' : 'high',
        description: `CPU usage (${(resources.cpuUsage * 100).toFixed(1)}%) exceeds threshold (${(this.config.alertThresholds.cpuUsage * 100).toFixed(1)}%)`,
        impact: resources.cpuUsage,
        suggestedAction: 'Optimize CPU-intensive operations, implement worker threads, or scale horizontally',
        detectedAt: Date.now()
      });
    }

    // Error rate bottleneck
    if (errors.errorRate > this.config.alertThresholds.errorRate) {
      bottlenecks.push({
        type: 'latency', // Errors often cause latency issues
        severity: errors.errorRate > 0.05 ? 'critical' : 'medium',
        description: `Error rate (${(errors.errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.config.alertThresholds.errorRate * 100).toFixed(2)}%)`,
        impact: errors.errorRate / this.config.alertThresholds.errorRate,
        suggestedAction: 'Investigate and fix underlying causes of errors, improve error handling',
        detectedAt: Date.now()
      });
    }

    return bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(bottlenecks: BottleneckReport[]): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case 'latency':
          recommendations.push({
            category: 'optimization',
            priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
            title: 'Implement Response Time Optimization',
            description: 'Add caching layers, optimize database queries, and implement connection pooling',
            expectedImprovement: '30-50% latency reduction',
            implementation: 'Configure Redis cache, optimize SQL queries, implement HTTP/2'
          });
          break;

        case 'memory':
          recommendations.push({
            category: 'optimization',
            priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
            title: 'Memory Usage Optimization',
            description: 'Implement memory pooling, optimize object creation, and tune garbage collection',
            expectedImprovement: '20-40% memory reduction',
            implementation: 'Use object pools, implement lazy loading, configure V8 flags'
          });
          break;

        case 'cpu':
          recommendations.push({
            category: 'scaling',
            priority: 'high',
            title: 'CPU Load Distribution',
            description: 'Implement worker threads for CPU-intensive tasks and consider horizontal scaling',
            expectedImprovement: '25-60% CPU utilization improvement',
            implementation: 'Use cluster module, implement async processing, add more instances'
          });
          break;
      }
    }

    // General recommendations
    if (bottlenecks.length > 0) {
      recommendations.push({
        category: 'monitoring',
        priority: 'medium',
        title: 'Enhanced Monitoring Setup',
        description: 'Implement detailed metrics collection and alerting for proactive performance management',
        expectedImprovement: 'Faster issue detection and resolution',
        implementation: 'Set up APM tools, configure alerts, implement distributed tracing'
      });
    }

    return recommendations;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.checkMemoryUsage();
      this.recordMetric('throughput_rate', this.throughputCounter);
      this.throughputCounter = 0; // Reset counter
    }, 5000); // Monitor every 5 seconds
  }

  /**
   * Stop resource monitoring
   */
  private stopResourceMonitoring(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
  }

  /**
   * Start bottleneck detection
   */
  private startBottleneckDetection(): void {
    this.bottleneckDetector = setInterval(() => {
      const bottlenecks = this.detectBottlenecks();
      if (bottlenecks.length > 0) {
        this.emit('bottlenecks_detected', bottlenecks);
        
        if (this.config.enableAutoTuning) {
          this.applyAutoTuning(bottlenecks);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop bottleneck detection
   */
  private stopBottleneckDetection(): void {
    if (this.bottleneckDetector) {
      clearInterval(this.bottleneckDetector);
      this.bottleneckDetector = null;
    }
  }

  /**
   * Apply automatic tuning based on bottlenecks
   */
  private applyAutoTuning(bottlenecks: BottleneckReport[]): void {
    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case 'memory':
          // Trigger garbage collection
          if (global.gc) {
            global.gc();
            this.recordEvent('auto_tuning_gc_forced');
          }
          break;

        case 'latency':
          // Reduce sampling rate temporarily
          this.config.samplingRate = Math.max(0.1, this.config.samplingRate * 0.8);
          this.recordEvent('auto_tuning_sampling_reduced');
          break;
      }
    }
  }

  /**
   * Check if metric should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    
    // Clean up every 5 minutes
    if (now - this.lastCleanup < 300000) return;
    
    const cutoff = now - this.config.metricsRetentionTime;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.errorTracker = this.errorTracker.filter(e => e.timestamp > cutoff);
    
    this.lastCleanup = now;
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceReport {
    const latency = this.calculateLatencyMetrics();
    const throughput = this.calculateThroughputMetrics();
    const resources = this.calculateResourceMetrics();
    const errors = this.calculateErrorMetrics();
    const bottlenecks = this.detectBottlenecks();
    const recommendations = this.generateRecommendations(bottlenecks);

    return {
      componentName: this.config.componentName,
      timestamp: Date.now(),
      latency,
      throughput,
      resources,
      errors,
      bottlenecks,
      recommendations
    };
  }

  /**
   * Get current system health score (0-1)
   */
  getHealthScore(): number {
    const metrics = this.getMetrics();
    let score = 1.0;

    // Deduct for latency issues
    if (metrics.latency.p95 > this.config.targetLatency) {
      score -= 0.3 * (metrics.latency.p95 / this.config.targetLatency - 1);
    }

    // Deduct for memory pressure
    const memoryUsagePercent = metrics.resources.memoryUsage / this.config.maxMemoryUsage;
    if (memoryUsagePercent > 0.8) {
      score -= 0.2 * (memoryUsagePercent - 0.8) / 0.2;
    }

    // Deduct for errors
    if (metrics.errors.errorRate > 0) {
      score -= 0.3 * Math.min(metrics.errors.errorRate / 0.05, 1);
    }

    // Deduct for critical bottlenecks
    const criticalBottlenecks = metrics.bottlenecks.filter(b => b.severity === 'critical');
    score -= criticalBottlenecks.length * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Add component info
    lines.push(`# HELP performance_health_score Health score for ${this.config.componentName}`);
    lines.push(`# TYPE performance_health_score gauge`);
    lines.push(`performance_health_score{component="${this.config.componentName}"} ${this.getHealthScore()}`);

    // Add latency metrics
    lines.push(`# HELP latency_p95_ms P95 latency in milliseconds`);
    lines.push(`# TYPE latency_p95_ms gauge`);
    lines.push(`latency_p95_ms{component="${this.config.componentName}"} ${metrics.latency.p95}`);

    // Add memory metrics
    lines.push(`# HELP memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE memory_usage_bytes gauge`);
    lines.push(`memory_usage_bytes{component="${this.config.componentName}"} ${metrics.resources.memoryUsage}`);

    // Add error metrics
    lines.push(`# HELP error_rate Error rate (0-1)`);
    lines.push(`# TYPE error_rate gauge`);
    lines.push(`error_rate{component="${this.config.componentName}"} ${metrics.errors.errorRate}`);

    return lines.join('\n') + '\n';
  }
}

/**
 * Global Performance Monitor Manager
 */
export class PerformanceMonitorManager extends EventEmitter {
  private monitors: Map<string, PerformanceMonitor> = new Map();

  /**
   * Create performance monitor
   */
  createMonitor(name: string, config: Partial<PerformanceConfig>): PerformanceMonitor {
    if (this.monitors.has(name)) {
      throw new Error(`Performance monitor ${name} already exists`);
    }

    const monitor = new PerformanceMonitor({
      ...config,
      componentName: name
    });

    this.monitors.set(name, monitor);

    // Forward events
    monitor.on('bottlenecks_detected', (bottlenecks) => {
      this.emit('bottlenecks_detected', { component: name, bottlenecks });
    });

    monitor.on('memory_threshold_exceeded', (data) => {
      this.emit('memory_threshold_exceeded', { component: name, ...data });
    });

    return monitor;
  }

  /**
   * Get monitor by name
   */
  getMonitor(name: string): PerformanceMonitor | undefined {
    return this.monitors.get(name);
  }

  /**
   * Get all performance reports
   */
  getAllReports(): Record<string, PerformanceReport> {
    const reports: Record<string, PerformanceReport> = {};
    for (const [name, monitor] of this.monitors) {
      reports[name] = monitor.getMetrics();
    }
    return reports;
  }

  /**
   * Get overall system health score
   */
  getOverallHealthScore(): number {
    if (this.monitors.size === 0) return 1.0;

    const scores = Array.from(this.monitors.values()).map(m => m.getHealthScore());
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Export all metrics in Prometheus format
   */
  exportAllPrometheusMetrics(): string {
    const lines: string[] = [];
    
    for (const monitor of this.monitors.values()) {
      lines.push(monitor.exportPrometheusMetrics());
    }

    return lines.join('\n');
  }

  /**
   * Shutdown all monitors
   */
  shutdown(): void {
    for (const monitor of this.monitors.values()) {
      monitor.stop();
    }
    this.monitors.clear();
    console.log('All performance monitors shut down');
  }
}

// Global performance monitor manager
export const performanceMonitorManager = new PerformanceMonitorManager();

export default PerformanceMonitor;
/**
 * Health Monitoring System for TTS Voice Engine
 * Comprehensive monitoring, alerting, and diagnostic capabilities
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TTSService } from './tts-service';
import { VoiceTerminalIntegration } from './voice-terminal-integration';
import { MonitoringConfig } from './config';

// Health status types
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

export interface ComponentHealth {
  component: string;
  status: HealthStatus;
  lastCheck: number;
  metrics: Record<string, number>;
  issues: string[];
  uptime: number;
}

export interface SystemHealth {
  overall: HealthStatus;
  timestamp: number;
  components: ComponentHealth[];
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    processUptime: number;
  };
  performance: {
    averageLatency: number;
    requestThroughput: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  comparison: 'greater' | 'less';
}

/**
 * Health Monitor
 * Monitors system health, performance, and generates alerts
 */
export class HealthMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private ttsService?: TTSService;
  private voiceTerminal?: VoiceTerminalIntegration;
  
  private isRunning: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  
  private healthHistory: SystemHealth[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  
  private performanceThresholds: PerformanceThreshold[] = [
    { metric: 'averageLatency', warning: 200, critical: 500, comparison: 'greater' },
    { metric: 'errorRate', warning: 5, critical: 15, comparison: 'greater' },
    { metric: 'memoryUsage', warning: 80, critical: 95, comparison: 'greater' },
    { metric: 'cacheHitRate', warning: 50, critical: 20, comparison: 'less' }
  ];

  constructor(
    config: MonitoringConfig,
    ttsService?: TTSService,
    voiceTerminal?: VoiceTerminalIntegration
  ) {
    super();
    
    this.config = config;
    this.ttsService = ttsService;
    this.voiceTerminal = voiceTerminal;
    
    console.log('Health Monitor initialized');
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Health monitoring already running');
      return;
    }

    console.log(`Starting health monitoring (interval: ${this.config.healthCheckIntervalMs}ms)`);
    
    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    // Perform initial health check
    this.performHealthCheck();
    
    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping health monitoring');
    
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.emit('stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const systemHealth = await this.collectSystemHealth();
      
      // Store health data
      this.healthHistory.push(systemHealth);
      
      // Trim history if needed
      if (this.healthHistory.length > 1000) {
        this.healthHistory = this.healthHistory.slice(-1000);
      }
      
      // Check for alerts
      this.checkAlerts(systemHealth);
      
      // Emit health check event
      this.emit('healthCheck', systemHealth);
      
      // Log if status changed
      const previousHealth = this.healthHistory[this.healthHistory.length - 2];
      if (!previousHealth || previousHealth.overall !== systemHealth.overall) {
        console.log(`System health status: ${systemHealth.overall}`);
      }
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Collect comprehensive system health data
   */
  private async collectSystemHealth(): Promise<SystemHealth> {
    const timestamp = Date.now();
    const components: ComponentHealth[] = [];

    // Check TTS service health
    if (this.ttsService) {
      components.push(await this.checkTTSServiceHealth());
    }

    // Check voice terminal health
    if (this.voiceTerminal) {
      components.push(await this.checkVoiceTerminalHealth());
    }

    // Check system resources
    components.push(await this.checkSystemResourceHealth());

    // Determine overall health status
    const overall = this.determineOverallHealth(components);

    // Collect system metrics
    const systemMetrics = await this.collectSystemMetrics();
    
    // Collect performance metrics
    const performance = await this.collectPerformanceMetrics();

    return {
      overall,
      timestamp,
      components,
      systemMetrics,
      performance
    };
  }

  /**
   * Check TTS service health
   */
  private async checkTTSServiceHealth(): Promise<ComponentHealth> {
    const component = 'tts-service';
    const issues: string[] = [];
    let status: HealthStatus = 'healthy';
    const metrics: Record<string, number> = {};

    try {
      if (!this.ttsService) {
        throw new Error('TTS service not available');
      }

      const ttsHealth = await this.ttsService.getHealthStatus();
      const ttsMetrics = await this.ttsService.getPerformanceMetrics();

      // Map TTS health status
      status = this.mapTTSHealthStatus(ttsHealth.status);
      
      // Collect issues
      issues.push(...ttsHealth.issues);

      // Collect metrics
      metrics.averageLatency = ttsMetrics.averageLatency;
      metrics.errorRate = ttsMetrics.errorRate;
      metrics.totalRequests = ttsMetrics.totalRequests;
      metrics.cacheHitRate = ttsMetrics.cacheHitRate || 0;
      metrics.memoryUsage = ttsHealth.performance?.memoryUsage || 0;

      // Check specific TTS issues
      if (metrics.averageLatency > 300) {
        issues.push(`High latency: ${metrics.averageLatency}ms`);
        status = this.degradeStatus(status, 'degraded');
      }

      if (metrics.errorRate > 10) {
        issues.push(`High error rate: ${metrics.errorRate}%`);
        status = this.degradeStatus(status, 'degraded');
      }

    } catch (error) {
      status = 'unhealthy';
      issues.push(`TTS service error: ${error instanceof Error ? error.message : error}`);
    }

    return {
      component,
      status,
      lastCheck: Date.now(),
      metrics,
      issues,
      uptime: ttsHealth?.uptime || 0
    };
  }

  /**
   * Check voice terminal health
   */
  private async checkVoiceTerminalHealth(): Promise<ComponentHealth> {
    const component = 'voice-terminal';
    const issues: string[] = [];
    let status: HealthStatus = 'healthy';
    const metrics: Record<string, number> = {};

    try {
      if (!this.voiceTerminal) {
        throw new Error('Voice terminal not available');
      }

      const vtHealth = await this.voiceTerminal.getHealthStatus();
      const vtMetrics = await this.voiceTerminal.getPerformanceMetrics();

      // Collect metrics
      metrics.queueLength = vtHealth.voiceTerminal?.queueLength || 0;
      metrics.responsesGenerated = vtMetrics.voiceTerminal?.responsesGenerated || 0;
      metrics.averagePlaybackTime = vtMetrics.voiceTerminal?.averagePlaybackTime || 0;

      // Check voice terminal specific issues
      if (metrics.queueLength > 10) {
        issues.push(`High queue length: ${metrics.queueLength}`);
        status = this.degradeStatus(status, 'degraded');
      }

      // Check underlying TTS health
      if (vtHealth.tts?.status === 'unhealthy') {
        issues.push('Underlying TTS service unhealthy');
        status = this.degradeStatus(status, 'degraded');
      }

    } catch (error) {
      status = 'unhealthy';
      issues.push(`Voice terminal error: ${error instanceof Error ? error.message : error}`);
    }

    return {
      component,
      status,
      lastCheck: Date.now(),
      metrics,
      issues,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Check system resource health
   */
  private async checkSystemResourceHealth(): Promise<ComponentHealth> {
    const component = 'system-resources';
    const issues: string[] = [];
    let status: HealthStatus = 'healthy';
    const metrics: Record<string, number> = {};

    try {
      // CPU usage
      const cpuUsage = await this.getCPUUsage();
      metrics.cpuUsage = cpuUsage;
      
      if (cpuUsage > 90) {
        issues.push(`High CPU usage: ${cpuUsage.toFixed(1)}%`);
        status = this.degradeStatus(status, 'degraded');
      }

      // Memory usage
      const memInfo = this.getMemoryInfo();
      const memoryUsagePercent = (memInfo.used / memInfo.total) * 100;
      metrics.memoryUsage = memoryUsagePercent;
      metrics.memoryUsedMB = memInfo.used / (1024 * 1024);
      metrics.memoryTotalMB = memInfo.total / (1024 * 1024);
      
      if (memoryUsagePercent > 85) {
        issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        status = this.degradeStatus(status, 'degraded');
      }

      // Disk usage (for cache directory)
      const diskUsage = await this.getDiskUsage();
      metrics.diskUsage = diskUsage;
      
      if (diskUsage > 90) {
        issues.push(`High disk usage: ${diskUsage.toFixed(1)}%`);
        status = this.degradeStatus(status, 'degraded');
      }

      // Process uptime
      metrics.processUptime = process.uptime() * 1000;

    } catch (error) {
      status = 'unhealthy';
      issues.push(`System resource check failed: ${error instanceof Error ? error.message : error}`);
    }

    return {
      component,
      status,
      lastCheck: Date.now(),
      metrics,
      issues,
      uptime: process.uptime() * 1000
    };
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics() {
    return {
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: (this.getMemoryInfo().used / this.getMemoryInfo().total) * 100,
      diskUsage: await this.getDiskUsage(),
      processUptime: process.uptime() * 1000
    };
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics() {
    let averageLatency = 0;
    let requestThroughput = 0;
    let errorRate = 0;
    let cacheHitRate = 0;

    try {
      if (this.ttsService) {
        const metrics = await this.ttsService.getPerformanceMetrics();
        averageLatency = metrics.averageLatency;
        errorRate = metrics.errorRate;
        cacheHitRate = metrics.cacheHitRate || 0;
        
        // Calculate throughput from recent history
        requestThroughput = this.calculateRequestThroughput();
      }
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
    }

    return {
      averageLatency,
      requestThroughput,
      errorRate,
      cacheHitRate
    };
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(health: SystemHealth): void {
    if (!this.config.enableAlerts) {
      return;
    }

    // Check overall health
    if (health.overall === 'critical' || health.overall === 'unhealthy') {
      this.createAlert('system', 'high', `System health is ${health.overall}`, health.timestamp);
    }

    // Check performance thresholds
    for (const threshold of this.performanceThresholds) {
      const value = health.performance[threshold.metric as keyof typeof health.performance];
      
      if (typeof value === 'number') {
        const isExceeded = threshold.comparison === 'greater' 
          ? value > threshold.critical 
          : value < threshold.critical;
          
        if (isExceeded) {
          this.createAlert(
            'performance',
            'critical',
            `${threshold.metric} is ${value} (threshold: ${threshold.critical})`,
            health.timestamp
          );
        } else {
          const isWarning = threshold.comparison === 'greater'
            ? value > threshold.warning
            : value < threshold.warning;
            
          if (isWarning) {
            this.createAlert(
              'performance',
              'medium',
              `${threshold.metric} is ${value} (warning: ${threshold.warning})`,
              health.timestamp
            );
          }
        }
      }
    }

    // Check component-specific alerts
    for (const component of health.components) {
      if (component.status === 'unhealthy') {
        this.createAlert(
          component.component,
          'high',
          `Component ${component.component} is unhealthy: ${component.issues.join(', ')}`,
          health.timestamp
        );
      }
    }

    // Auto-resolve old alerts
    this.resolveOldAlerts(health.timestamp);
  }

  /**
   * Create or update an alert
   */
  private createAlert(component: string, severity: Alert['severity'], message: string, timestamp: number): void {
    const alertId = `${component}-${severity}-${this.hashString(message)}`;
    
    // Check if alert already exists
    if (this.activeAlerts.has(alertId)) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: alertId,
      severity,
      component,
      message,
      timestamp
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    console.warn(`ALERT [${severity.toUpperCase()}] ${component}: ${message}`);
    this.emit('alert', alert);
  }

  /**
   * Resolve old alerts that are no longer relevant
   */
  private resolveOldAlerts(currentTimestamp: number): void {
    const maxAge = 300000; // 5 minutes
    
    for (const [alertId, alert] of this.activeAlerts) {
      if (currentTimestamp - alert.timestamp > maxAge) {
        alert.resolved = true;
        alert.resolvedAt = currentTimestamp;
        this.activeAlerts.delete(alertId);
        
        console.log(`Alert resolved: ${alert.message}`);
        this.emit('alertResolved', alert);
      }
    }
  }

  /**
   * Get current system health
   */
  getCurrentHealth(): SystemHealth | null {
    return this.healthHistory[this.healthHistory.length - 1] || null;
  }

  /**
   * Get health history
   */
  getHealthHistory(limit?: number): SystemHealth[] {
    if (limit) {
      return this.healthHistory.slice(-limit);
    }
    return [...this.healthHistory];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  /**
   * Export health data
   */
  async exportHealthData(filePath: string): Promise<void> {
    const data = {
      timestamp: Date.now(),
      currentHealth: this.getCurrentHealth(),
      healthHistory: this.getHealthHistory(100), // Last 100 entries
      activeAlerts: this.getActiveAlerts(),
      alertHistory: this.getAlertHistory(50), // Last 50 alerts
      config: this.config
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Health data exported to: ${filePath}`);
  }

  // Helper methods

  private mapTTSHealthStatus(ttsStatus: string): HealthStatus {
    switch (ttsStatus) {
      case 'healthy': return 'healthy';
      case 'degraded': return 'degraded';
      case 'unhealthy': return 'unhealthy';
      default: return 'unhealthy';
    }
  }

  private degradeStatus(current: HealthStatus, newStatus: HealthStatus): HealthStatus {
    const statusHierarchy = ['healthy', 'degraded', 'unhealthy', 'critical'];
    const currentIndex = statusHierarchy.indexOf(current);
    const newIndex = statusHierarchy.indexOf(newStatus);
    
    return statusHierarchy[Math.max(currentIndex, newIndex)] as HealthStatus;
  }

  private determineOverallHealth(components: ComponentHealth[]): HealthStatus {
    if (components.some(c => c.status === 'critical')) return 'critical';
    if (components.some(c => c.status === 'unhealthy')) return 'unhealthy';
    if (components.some(c => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = (totalUsage / 1000 / 100) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private getMemoryInfo() {
    const used = process.memoryUsage().rss;
    const total = os.totalmem();
    return { used, total };
  }

  private async getDiskUsage(): Promise<number> {
    try {
      // Simple disk usage check (this would need platform-specific implementation)
      return 50; // Placeholder
    } catch {
      return 0;
    }
  }

  private calculateRequestThroughput(): number {
    // Calculate requests per minute from recent health history
    const recentHistory = this.healthHistory.slice(-10);
    if (recentHistory.length < 2) return 0;
    
    const timeSpan = recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp;
    const requestDiff = recentHistory[recentHistory.length - 1].performance.requestThroughput - 
                       recentHistory[0].performance.requestThroughput;
    
    return timeSpan > 0 ? (requestDiff / timeSpan) * 60000 : 0; // Per minute
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

export default HealthMonitor;
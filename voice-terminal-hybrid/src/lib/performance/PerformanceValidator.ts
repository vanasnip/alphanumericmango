/**
 * Performance Validator
 * Validates system performance against enterprise targets and provides recommendations
 * 
 * ENTERPRISE TARGETS:
 * - Total end-to-end latency: <65ms (browser <50ms + backend <15ms)
 * - Throughput: 10,000+ commands/second system-wide
 * - Memory efficiency: <50MB per 1000 concurrent sessions
 * - CPU efficiency: <20% CPU for 1000 concurrent users
 * - Network efficiency: <1Mbps per 100 concurrent sessions
 * - Cache hit rate: >85%
 * - Error rate: <0.1%
 */

import { AdvancedOptimizer } from './AdvancedOptimizer.js';
import { LoadTestSuite } from './LoadTestSuite.js';
import type { PerformanceMetrics } from './AdvancedOptimizer.js';
import type { LoadTestReport } from './LoadTestSuite.js';

// Enterprise performance targets
interface EnterpriseTargets {
  latency: {
    totalEndToEnd: number;        // <65ms
    browser: number;              // <50ms
    backend: number;              // <15ms
  };
  throughput: {
    commandsPerSecond: number;    // 10,000+
    concurrentUsers: number;      // 1,000+
  };
  efficiency: {
    memoryPerSession: number;     // <50KB
    cpuUsagePercent: number;      // <20%
    networkPerUser: number;       // <10Kbps
  };
  quality: {
    cacheHitRate: number;         // >85%
    errorRate: number;            // <0.1%
    availability: number;         // >99.9%
  };
}

// Validation results
interface ValidationResult {
  target: string;
  expected: number;
  actual: number;
  passed: boolean;
  variance: number;                // Percentage variance from target
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

interface PerformanceValidationReport {
  timestamp: Date;
  testDuration: number;
  environment: string;
  targets: EnterpriseTargets;
  results: ValidationResult[];
  summary: {
    overallPassed: boolean;
    passRate: number;
    criticalFailures: number;
    recommendations: string[];
  };
  optimization: {
    beforeMetrics: PerformanceMetrics;
    afterMetrics: PerformanceMetrics;
    improvementPercent: number;
  };
  loadTestResults?: LoadTestReport;
}

// Monitoring and alerting
interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: 'warning' | 'error' | 'critical';
  metric: string;
  threshold: number;
  actualValue: number;
  description: string;
  recommendation: string;
}

interface ContinuousMonitoring {
  enabled: boolean;
  interval: number;              // Monitoring interval in seconds
  alertThresholds: Record<string, number>;
  alertCallbacks: ((alert: PerformanceAlert) => void)[];
}

/**
 * Enterprise performance validation and monitoring system
 */
export class PerformanceValidator {
  private targets: EnterpriseTargets;
  private optimizer: AdvancedOptimizer;
  private loadTestSuite: LoadTestSuite;
  private monitoring: ContinuousMonitoring;
  
  // Validation state
  private activeValidation: boolean = false;
  private lastValidation: PerformanceValidationReport | null = null;
  private alertHistory: PerformanceAlert[] = [];
  
  // Monitoring intervals
  private monitoringInterval: number | null = null;

  constructor(
    optimizer?: AdvancedOptimizer,
    customTargets?: Partial<EnterpriseTargets>
  ) {
    this.targets = {
      latency: {
        totalEndToEnd: 65,    // 65ms total
        browser: 50,          // 50ms browser
        backend: 15           // 15ms backend
      },
      throughput: {
        commandsPerSecond: 10000,  // 10K commands/sec
        concurrentUsers: 1000      // 1K concurrent users
      },
      efficiency: {
        memoryPerSession: 50 * 1024,  // 50KB per session
        cpuUsagePercent: 20,          // 20% CPU
        networkPerUser: 10 * 1024     // 10Kbps per user
      },
      quality: {
        cacheHitRate: 0.85,      // 85% cache hit rate
        errorRate: 0.001,        // 0.1% error rate
        availability: 0.999       // 99.9% availability
      },
      ...customTargets
    };

    this.optimizer = optimizer || new AdvancedOptimizer();
    this.loadTestSuite = new LoadTestSuite({}, this.optimizer);
    
    this.monitoring = {
      enabled: false,
      interval: 60,  // 1 minute
      alertThresholds: {
        latency: this.targets.latency.totalEndToEnd * 1.2,  // 20% over target
        cpu: this.targets.efficiency.cpuUsagePercent * 1.5,  // 50% over target
        memory: this.targets.efficiency.memoryPerSession * 2, // 100% over target
        errorRate: this.targets.quality.errorRate * 10       // 10x error rate
      },
      alertCallbacks: []
    };
  }

  /**
   * Run comprehensive performance validation
   */
  async validatePerformance(options: {
    includeLoadTest?: boolean;
    testDuration?: number;
    environment?: string;
  } = {}): Promise<PerformanceValidationReport> {
    const {
      includeLoadTest = true,
      testDuration = 300,  // 5 minutes default
      environment = 'test'
    } = options;

    console.log('🎯 Starting Enterprise Performance Validation...');
    this.activeValidation = true;
    
    try {
      // Initialize optimizer if not already done
      await this.optimizer.initialize();
      
      // Capture baseline metrics
      const beforeMetrics = this.optimizer.getCurrentMetrics();
      console.log('📊 Captured baseline metrics');
      
      // Run optimization
      console.log('⚡ Running performance optimization...');
      const optimizationResult = await this.optimizer.runOptimizationAnalysis();
      
      // Capture post-optimization metrics
      const afterMetrics = optimizationResult.afterMetrics;
      console.log('✅ Performance optimization completed');
      
      // Run load test if requested
      let loadTestResults: LoadTestReport | undefined;
      if (includeLoadTest) {
        console.log('🚀 Running load test validation...');
        loadTestResults = await this.loadTestSuite.runQuickValidation();
        console.log('✅ Load test completed');
      }
      
      // Validate against targets
      console.log('🔍 Validating against enterprise targets...');
      const validationResults = this.validateMetricsAgainstTargets(
        afterMetrics, 
        loadTestResults
      );
      
      // Calculate improvement
      const improvementPercent = this.calculateImprovement(beforeMetrics, afterMetrics);
      
      // Generate report
      const report: PerformanceValidationReport = {
        timestamp: new Date(),
        testDuration,
        environment,
        targets: this.targets,
        results: validationResults,
        summary: this.generateSummary(validationResults),
        optimization: {
          beforeMetrics,
          afterMetrics,
          improvementPercent
        },
        loadTestResults
      };
      
      this.lastValidation = report;
      console.log('✅ Performance validation completed');
      
      return report;
      
    } catch (error) {
      console.error('❌ Performance validation failed:', error);
      throw error;
    } finally {
      this.activeValidation = false;
    }
  }

  /**
   * Start continuous performance monitoring
   */
  startContinuousMonitoring(options: {
    interval?: number;
    alertThresholds?: Record<string, number>;
  } = {}): void {
    if (this.monitoring.enabled) {
      console.warn('Monitoring already enabled');
      return;
    }
    
    this.monitoring.enabled = true;
    this.monitoring.interval = options.interval || this.monitoring.interval;
    this.monitoring.alertThresholds = { 
      ...this.monitoring.alertThresholds, 
      ...options.alertThresholds 
    };
    
    console.log(`📡 Starting continuous monitoring (interval: ${this.monitoring.interval}s)`);
    
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCheck();
    }, this.monitoring.interval * 1000);
  }

  /**
   * Stop continuous monitoring
   */
  stopContinuousMonitoring(): void {
    if (!this.monitoring.enabled) return;
    
    this.monitoring.enabled = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('📡 Continuous monitoring stopped');
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.monitoring.alertCallbacks.push(callback);
  }

  /**
   * Get latest validation report
   */
  getLatestValidation(): PerformanceValidationReport | null {
    return this.lastValidation;
  }

  /**
   * Get alert history
   */
  getAlertHistory(): PerformanceAlert[] {
    return [...this.alertHistory];
  }

  /**
   * Generate performance scorecard
   */
  generateScorecard(): {
    overallScore: number;
    categoryScores: Record<string, number>;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  } {
    if (!this.lastValidation) {
      return { overallScore: 0, categoryScores: {}, grade: 'F' };
    }
    
    const results = this.lastValidation.results;
    const categoryScores: Record<string, number> = {};
    
    // Calculate category scores
    const latencyResults = results.filter(r => r.target.includes('latency') || r.target.includes('Latency'));
    const throughputResults = results.filter(r => r.target.includes('throughput') || r.target.includes('Throughput'));
    const efficiencyResults = results.filter(r => r.target.includes('efficiency') || r.target.includes('CPU') || r.target.includes('Memory'));
    const qualityResults = results.filter(r => r.target.includes('quality') || r.target.includes('Cache') || r.target.includes('Error'));
    
    categoryScores.latency = this.calculateCategoryScore(latencyResults);
    categoryScores.throughput = this.calculateCategoryScore(throughputResults);
    categoryScores.efficiency = this.calculateCategoryScore(efficiencyResults);
    categoryScores.quality = this.calculateCategoryScore(qualityResults);
    
    // Calculate overall score
    const overallScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length;
    
    // Assign grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 60) grade = 'D';
    else grade = 'F';
    
    return { overallScore, categoryScores, grade };
  }

  /**
   * Run quick health check
   */
  async runHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: PerformanceMetrics;
  }> {
    const metrics = this.optimizer.getCurrentMetrics();
    const issues: string[] = [];
    
    // Check critical thresholds
    if (metrics.latency.total > this.targets.latency.totalEndToEnd * 1.5) {
      issues.push(`High latency: ${metrics.latency.total}ms (target: <${this.targets.latency.totalEndToEnd}ms)`);
    }
    
    if (metrics.cpu.usage > this.targets.efficiency.cpuUsagePercent * 2) {
      issues.push(`High CPU usage: ${metrics.cpu.usage}% (target: <${this.targets.efficiency.cpuUsagePercent}%)`);
    }
    
    if (metrics.cache.hitRate < this.targets.quality.cacheHitRate * 0.5) {
      issues.push(`Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}% (target: >${(this.targets.quality.cacheHitRate * 100).toFixed(1)}%)`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics
    };
  }

  /**
   * Validate metrics against enterprise targets
   */
  private validateMetricsAgainstTargets(
    metrics: PerformanceMetrics,
    loadTestResults?: LoadTestReport
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Latency validations
    results.push(this.createValidationResult(
      'Total End-to-End Latency',
      this.targets.latency.totalEndToEnd,
      metrics.latency.total,
      'lower-is-better'
    ));
    
    results.push(this.createValidationResult(
      'Browser Latency',
      this.targets.latency.browser,
      metrics.latency.browser,
      'lower-is-better'
    ));
    
    results.push(this.createValidationResult(
      'Backend Latency',
      this.targets.latency.backend,
      metrics.latency.backend,
      'lower-is-better'
    ));
    
    // Throughput validations
    results.push(this.createValidationResult(
      'Commands Per Second',
      this.targets.throughput.commandsPerSecond,
      metrics.throughput.commandsPerSecond,
      'higher-is-better'
    ));
    
    // Efficiency validations
    const memoryPerSession = metrics.memory.sessions > 0 
      ? metrics.memory.heapUsed / metrics.memory.sessions 
      : 0;
    
    results.push(this.createValidationResult(
      'Memory Per Session',
      this.targets.efficiency.memoryPerSession,
      memoryPerSession,
      'lower-is-better'
    ));
    
    results.push(this.createValidationResult(
      'CPU Usage Percent',
      this.targets.efficiency.cpuUsagePercent,
      metrics.cpu.usage,
      'lower-is-better'
    ));
    
    // Quality validations
    results.push(this.createValidationResult(
      'Cache Hit Rate',
      this.targets.quality.cacheHitRate,
      metrics.cache.hitRate,
      'higher-is-better'
    ));
    
    // Load test specific validations
    if (loadTestResults) {
      const errorRate = loadTestResults.summary.totalErrors / 
        Math.max(loadTestResults.summary.totalCommands, 1);
      
      results.push(this.createValidationResult(
        'Error Rate',
        this.targets.quality.errorRate,
        errorRate,
        'lower-is-better'
      ));
      
      results.push(this.createValidationResult(
        'Concurrent Users Supported',
        this.targets.throughput.concurrentUsers,
        loadTestResults.summary.totalUsers,
        'higher-is-better'
      ));
    }
    
    return results;
  }

  /**
   * Create validation result
   */
  private createValidationResult(
    target: string,
    expected: number,
    actual: number,
    comparison: 'higher-is-better' | 'lower-is-better'
  ): ValidationResult {
    const passed = comparison === 'higher-is-better' 
      ? actual >= expected 
      : actual <= expected;
    
    const variance = ((actual - expected) / expected) * 100;
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    const absVariance = Math.abs(variance);
    
    if (passed) {
      severity = 'low';
    } else if (absVariance < 25) {
      severity = 'medium';
    } else if (absVariance < 50) {
      severity = 'high';
    } else {
      severity = 'critical';
    }
    
    const recommendation = this.generateRecommendation(target, passed, variance, comparison);
    
    return {
      target,
      expected,
      actual,
      passed,
      variance,
      severity,
      recommendation
    };
  }

  /**
   * Generate recommendation for validation result
   */
  private generateRecommendation(
    target: string,
    passed: boolean,
    variance: number,
    comparison: 'higher-is-better' | 'lower-is-better'
  ): string {
    if (passed) {
      return '✅ Target met - continue current optimization strategy';
    }
    
    const direction = comparison === 'higher-is-better' ? 'increase' : 'reduce';
    const absVariance = Math.abs(variance).toFixed(1);
    
    switch (target) {
      case 'Total End-to-End Latency':
        return `⚡ ${direction} latency by ${absVariance}% - enable aggressive caching and connection pooling`;
      case 'Browser Latency':
        return `🖥️ ${direction} browser latency - implement UI virtualization and lazy loading`;
      case 'Backend Latency':
        return `⚙️ ${direction} backend latency - optimize database queries and enable batching`;
      case 'Commands Per Second':
        return `📈 ${direction} throughput - enable binary protocol and increase batch sizes`;
      case 'Memory Per Session':
        return `💾 ${direction} memory usage - implement aggressive garbage collection and session cleanup`;
      case 'CPU Usage Percent':
        return `🔄 ${direction} CPU usage - optimize worker thread usage and enable parallelization`;
      case 'Cache Hit Rate':
        return `📦 ${direction} cache efficiency - adjust cache sizing and TTL strategies`;
      case 'Error Rate':
        return `🔧 ${direction} error rate - improve connection stability and retry logic`;
      case 'Concurrent Users Supported':
        return `👥 ${direction} user capacity - scale horizontally and optimize resource pooling`;
      default:
        return `🔧 ${direction} performance by ${absVariance}% to meet target`;
    }
  }

  /**
   * Generate validation summary
   */
  private generateSummary(results: ValidationResult[]): {
    overallPassed: boolean;
    passRate: number;
    criticalFailures: number;
    recommendations: string[];
  } {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = (passed / total) * 100;
    const overallPassed = passRate >= 80; // 80% pass rate required
    
    const criticalFailures = results.filter(r => r.severity === 'critical').length;
    
    // Collect unique recommendations
    const recommendations = Array.from(new Set(
      results
        .filter(r => !r.passed)
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .map(r => r.recommendation)
    )).slice(0, 5); // Top 5 recommendations
    
    return {
      overallPassed,
      passRate,
      criticalFailures,
      recommendations
    };
  }

  /**
   * Calculate performance improvement
   */
  private calculateImprovement(
    beforeMetrics: PerformanceMetrics,
    afterMetrics: PerformanceMetrics
  ): number {
    // Calculate weighted improvement across key metrics
    const latencyImprovement = Math.max(0, 
      (beforeMetrics.latency.total - afterMetrics.latency.total) / beforeMetrics.latency.total
    );
    
    const throughputImprovement = Math.max(0,
      (afterMetrics.throughput.commandsPerSecond - beforeMetrics.throughput.commandsPerSecond) / 
      Math.max(beforeMetrics.throughput.commandsPerSecond, 1)
    );
    
    const memoryImprovement = Math.max(0,
      (beforeMetrics.memory.heapUsed - afterMetrics.memory.heapUsed) / beforeMetrics.memory.heapUsed
    );
    
    const cacheImprovement = Math.max(0,
      afterMetrics.cache.hitRate - beforeMetrics.cache.hitRate
    );
    
    // Weighted average (latency and throughput are most important)
    return (
      latencyImprovement * 0.3 +
      throughputImprovement * 0.3 +
      memoryImprovement * 0.2 +
      cacheImprovement * 0.2
    ) * 100;
  }

  /**
   * Calculate category score
   */
  private calculateCategoryScore(results: ValidationResult[]): number {
    if (results.length === 0) return 100;
    
    const totalScore = results.reduce((sum, result) => {
      if (result.passed) return sum + 100;
      
      // Partial credit based on how close to target
      const absVariance = Math.abs(result.variance);
      if (absVariance <= 10) return sum + 90;
      if (absVariance <= 25) return sum + 75;
      if (absVariance <= 50) return sum + 50;
      if (absVariance <= 100) return sum + 25;
      return sum + 0;
    }, 0);
    
    return totalScore / results.length;
  }

  /**
   * Perform monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    if (!this.monitoring.enabled) return;
    
    try {
      const metrics = this.optimizer.getCurrentMetrics();
      
      // Check each threshold
      this.checkThreshold('latency', metrics.latency.total, this.monitoring.alertThresholds.latency!);
      this.checkThreshold('cpu', metrics.cpu.usage, this.monitoring.alertThresholds.cpu!);
      
      const memoryPerSession = metrics.memory.sessions > 0 
        ? metrics.memory.heapUsed / metrics.memory.sessions 
        : 0;
      this.checkThreshold('memory', memoryPerSession, this.monitoring.alertThresholds.memory!);
      
      // Clean up old alerts (keep last 100)
      if (this.alertHistory.length > 100) {
        this.alertHistory.splice(0, this.alertHistory.length - 100);
      }
      
    } catch (error) {
      console.error('Monitoring check failed:', error);
    }
  }

  /**
   * Check individual threshold
   */
  private checkThreshold(metric: string, actualValue: number, threshold: number): void {
    if (actualValue > threshold) {
      const alert: PerformanceAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        severity: this.determineSeverity(metric, actualValue, threshold),
        metric,
        threshold,
        actualValue,
        description: `${metric} threshold exceeded: ${actualValue.toFixed(2)} > ${threshold.toFixed(2)}`,
        recommendation: this.getThresholdRecommendation(metric, actualValue, threshold)
      };
      
      this.alertHistory.push(alert);
      
      // Notify callbacks
      for (const callback of this.monitoring.alertCallbacks) {
        callback(alert);
      }
    }
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(
    metric: string, 
    actualValue: number, 
    threshold: number
  ): 'warning' | 'error' | 'critical' {
    const ratio = actualValue / threshold;
    
    if (ratio > 2.0) return 'critical';
    if (ratio > 1.5) return 'error';
    return 'warning';
  }

  /**
   * Get threshold recommendation
   */
  private getThresholdRecommendation(metric: string, actualValue: number, threshold: number): string {
    const excessPercent = ((actualValue - threshold) / threshold * 100).toFixed(1);
    
    switch (metric) {
      case 'latency':
        return `Latency ${excessPercent}% above threshold - consider enabling performance mode`;
      case 'cpu':
        return `CPU usage ${excessPercent}% above threshold - consider scaling or optimization`;
      case 'memory':
        return `Memory usage ${excessPercent}% above threshold - consider garbage collection`;
      default:
        return `${metric} ${excessPercent}% above threshold - investigation required`;
    }
  }

  /**
   * Print validation report
   */
  printValidationReport(report: PerformanceValidationReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ENTERPRISE PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`  Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`  Environment: ${report.environment}`);
    console.log(`  Duration: ${report.testDuration} seconds`);
    console.log(`  Overall Result: ${report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Pass Rate: ${report.summary.passRate.toFixed(1)}%`);
    console.log(`  Critical Failures: ${report.summary.criticalFailures}`);
    
    console.log(`\n⚡ OPTIMIZATION RESULTS:`);
    console.log(`  Performance Improvement: ${report.optimization.improvementPercent.toFixed(1)}%`);
    
    console.log(`\n📈 TARGET VALIDATION:`);
    for (const result of report.results) {
      const status = result.passed ? '✅' : 
        result.severity === 'critical' ? '🔴' : 
        result.severity === 'high' ? '🟠' : 
        result.severity === 'medium' ? '🟡' : '🔵';
      
      const variance = result.variance >= 0 ? `+${result.variance.toFixed(1)}%` : `${result.variance.toFixed(1)}%`;
      
      console.log(`  ${status} ${result.target}: ${result.actual.toFixed(2)} (target: ${result.expected.toFixed(2)}, ${variance})`);
    }
    
    if (report.summary.recommendations.length > 0) {
      console.log(`\n💡 TOP RECOMMENDATIONS:`);
      for (const recommendation of report.summary.recommendations) {
        console.log(`  ${recommendation}`);
      }
    }
    
    if (report.loadTestResults) {
      console.log(`\n🚀 LOAD TEST RESULTS:`);
      console.log(`  Users: ${report.loadTestResults.summary.totalUsers.toLocaleString()}`);
      console.log(`  Commands: ${report.loadTestResults.summary.totalCommands.toLocaleString()}`);
      console.log(`  Errors: ${report.loadTestResults.summary.totalErrors.toLocaleString()}`);
      console.log(`  Peak Throughput: ${report.loadTestResults.summary.peakThroughput.toFixed(0)} commands/sec`);
    }
    
    const scorecard = this.generateScorecard();
    console.log(`\n🏆 PERFORMANCE SCORECARD:`);
    console.log(`  Overall Grade: ${scorecard.grade} (${scorecard.overallScore.toFixed(1)}/100)`);
    console.log(`  Latency: ${scorecard.categoryScores.latency?.toFixed(1) || 'N/A'}/100`);
    console.log(`  Throughput: ${scorecard.categoryScores.throughput?.toFixed(1) || 'N/A'}/100`);
    console.log(`  Efficiency: ${scorecard.categoryScores.efficiency?.toFixed(1) || 'N/A'}/100`);
    console.log(`  Quality: ${scorecard.categoryScores.quality?.toFixed(1) || 'N/A'}/100`);
    
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.stopContinuousMonitoring();
    await this.optimizer.destroy();
    
    console.log('🧹 Performance Validator destroyed');
  }
}
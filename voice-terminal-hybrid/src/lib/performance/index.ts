/**
 * Enterprise Performance Optimization Suite
 * Main entry point for voice-terminal-hybrid performance optimizations
 * 
 * This module provides enterprise-grade performance optimizations to achieve:
 * - Total end-to-end latency: <65ms (browser <50ms + backend <15ms)
 * - Throughput: 10,000+ commands/second system-wide
 * - Memory efficiency: <50MB per 1000 concurrent sessions
 * - CPU efficiency: <20% CPU for 1000 concurrent users
 * - Network efficiency: <1Mbps per 100 concurrent sessions
 */

export { AdvancedOptimizer } from './AdvancedOptimizer.js';
export { CacheHierarchy } from './CacheHierarchy.js';
export { NetworkOptimization } from './NetworkOptimization.js';
export { ResourcePooling } from './ResourcePooling.js';
export { LoadTestSuite } from './LoadTestSuite.js';
export { PerformanceValidator } from './PerformanceValidator.js';

// Re-export types
export type { 
  PerformanceMetrics,
  OptimizationConfig,
  OptimizationResult
} from './AdvancedOptimizer.js';

export type {
  LoadTestConfig,
  LoadTestReport,
  UserProfile
} from './LoadTestSuite.js';

export type {
  PerformanceValidationReport,
  ValidationResult,
  PerformanceAlert
} from './PerformanceValidator.js';

import { AdvancedOptimizer } from './AdvancedOptimizer.js';
import { LoadTestSuite } from './LoadTestSuite.js';
import { PerformanceValidator } from './PerformanceValidator.js';

/**
 * Enterprise Performance Suite - All-in-one performance optimization
 */
export class EnterprisePerformanceSuite {
  private optimizer: AdvancedOptimizer;
  private loadTestSuite: LoadTestSuite;
  private validator: PerformanceValidator;
  
  constructor() {
    this.optimizer = new AdvancedOptimizer();
    this.loadTestSuite = new LoadTestSuite({}, this.optimizer);
    this.validator = new PerformanceValidator(this.optimizer);
  }

  /**
   * Initialize the complete performance suite
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Enterprise Performance Suite...');
    
    await this.optimizer.initialize();
    
    // Start continuous monitoring
    this.validator.startContinuousMonitoring();
    
    // Set up alert handling
    this.validator.onAlert((alert) => {
      console.warn(`⚠️ Performance Alert: ${alert.description}`);
      console.log(`💡 Recommendation: ${alert.recommendation}`);
    });
    
    console.log('✅ Enterprise Performance Suite ready');
  }

  /**
   * Run complete performance validation
   */
  async runCompleteValidation(): Promise<void> {
    console.log('\n🎯 Running Complete Enterprise Performance Validation...');
    
    const report = await this.validator.validatePerformance({
      includeLoadTest: true,
      testDuration: 300,
      environment: 'production-validation'
    });
    
    this.validator.printValidationReport(report);
    
    const scorecard = this.validator.generateScorecard();
    
    if (scorecard.grade === 'A' || scorecard.grade === 'B') {
      console.log('\n🏆 Excellent! System meets enterprise performance standards.');
    } else {
      console.log('\n⚠️ Performance optimization needed. Review recommendations above.');
    }
    
    return;
  }

  /**
   * Run quick health check
   */
  async runHealthCheck(): Promise<void> {
    console.log('\n🔍 Running Performance Health Check...');
    
    const health = await this.validator.runHealthCheck();
    
    if (health.healthy) {
      console.log('✅ System is healthy and performing within targets');
    } else {
      console.log('❌ Performance issues detected:');
      for (const issue of health.issues) {
        console.log(`  - ${issue}`);
      }
    }
    
    console.log('\n📊 Current Metrics:');
    console.log(`  Latency: ${health.metrics.latency.total.toFixed(2)}ms`);
    console.log(`  Throughput: ${health.metrics.throughput.commandsPerSecond.toFixed(0)} cmd/s`);
    console.log(`  CPU: ${health.metrics.cpu.usage.toFixed(1)}%`);
    console.log(`  Cache Hit Rate: ${(health.metrics.cache.hitRate * 100).toFixed(1)}%`);
  }

  /**
   * Run load test scenarios
   */
  async runLoadTests(): Promise<void> {
    console.log('\n🚀 Running Enterprise Load Test Suite...');
    
    const reports = await this.loadTestSuite.runFullTestSuite();
    
    console.log('\n📊 Load Test Summary:');
    for (const report of reports) {
      const passedText = report.summary.thresholdViolations.length === 0 ? '✅ PASSED' : '❌ FAILED';
      console.log(`  ${report.execution.scenario.name}: ${passedText}`);
      console.log(`    Users: ${report.summary.totalUsers.toLocaleString()}`);
      console.log(`    Peak Throughput: ${report.summary.peakThroughput.toFixed(0)} cmd/s`);
      console.log(`    Avg Response: ${report.summary.averageResponseTime.toFixed(2)}ms`);
      console.log(`    Error Rate: ${(report.summary.totalErrors / Math.max(report.summary.totalCommands, 1) * 100).toFixed(3)}%`);
    }
  }

  /**
   * Optimize system performance
   */
  async optimize(): Promise<void> {
    console.log('\n⚡ Running Performance Optimization...');
    
    const result = await this.optimizer.runOptimizationAnalysis();
    
    console.log('✅ Optimization completed:');
    console.log(`  Latency reduction: ${result.improvements.latencyReduction.toFixed(1)}%`);
    console.log(`  Throughput increase: ${result.improvements.throughputIncrease.toFixed(1)}%`);
    console.log(`  Memory reduction: ${result.improvements.memoryReduction.toFixed(1)}%`);
    console.log(`  CPU reduction: ${result.improvements.cpuReduction.toFixed(1)}%`);
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of result.recommendations) {
        console.log(`  ${rec}`);
      }
    }
  }

  /**
   * Get optimizer instance for direct access
   */
  getOptimizer(): AdvancedOptimizer {
    return this.optimizer;
  }

  /**
   * Get load test suite for custom testing
   */
  getLoadTestSuite(): LoadTestSuite {
    return this.loadTestSuite;
  }

  /**
   * Get validator for custom validation
   */
  getValidator(): PerformanceValidator {
    return this.validator;
  }

  /**
   * Clean up all resources
   */
  async destroy(): Promise<void> {
    await this.validator.destroy();
    await this.optimizer.destroy();
    
    console.log('🧹 Enterprise Performance Suite destroyed');
  }
}

/**
 * Default singleton instance for easy access
 */
export const performanceSuite = new EnterprisePerformanceSuite();

/**
 * Quick start function for immediate optimization
 */
export async function quickStart(): Promise<void> {
  console.log('🚀 Quick Start: Enterprise Performance Optimization');
  
  await performanceSuite.initialize();
  await performanceSuite.optimize();
  await performanceSuite.runHealthCheck();
  
  console.log('\n✅ Quick start completed! System optimized and validated.');
  console.log('💡 Use performanceSuite.runCompleteValidation() for full testing');
}

/**
 * CLI interface for performance testing
 */
export async function runCLI(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🎯 Enterprise Performance Suite CLI

Usage:
  npm run perf:quick           - Quick optimization and health check
  npm run perf:validate        - Complete validation with load tests
  npm run perf:load-test       - Run load test suite only
  npm run perf:optimize        - Run optimization only
  npm run perf:health          - Health check only

Examples:
  npm run perf:validate
  npm run perf:load-test
`);
    return;
  }

  const command = args[0];
  
  try {
    await performanceSuite.initialize();
    
    switch (command) {
      case 'quick':
        await quickStart();
        break;
      case 'validate':
        await performanceSuite.runCompleteValidation();
        break;
      case 'load-test':
        await performanceSuite.runLoadTests();
        break;
      case 'optimize':
        await performanceSuite.optimize();
        break;
      case 'health':
        await performanceSuite.runHealthCheck();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Performance suite failed:', error);
    process.exit(1);
  } finally {
    await performanceSuite.destroy();
  }
}

// Auto-run CLI if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runCLI();
}
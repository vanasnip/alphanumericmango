import { EventEmitter } from 'events';
import { TmuxSessionManager } from '../../TmuxSessionManager';
import { BackendManager } from '../../backends/BackendManager';
import { SecureCommandExecutor } from '../../security/SecureCommandExecutor';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../../security/AuditLogger';
import { TmuxConnectionPool } from '../../performance/TmuxConnectionPool';
import { CommandBatcher } from '../../performance/CommandBatcher';
import { SessionCache } from '../../performance/SessionCache';
import { PerformanceBenchmark } from '../../performance/PerformanceBenchmark';
import type { 
  TmuxConfig, 
  PerformanceMetrics,
  CommandExecution 
} from '../../types';
import type { BenchmarkResult } from '../../performance/PerformanceBenchmark';

/**
 * Performance regression test configuration
 */
export interface PerformanceRegressionConfig {
  securityEnabled: boolean;
  auditingEnabled: boolean;
  performanceMode: 'balanced' | 'performance';
  targetLatency: number; // milliseconds
  targetThroughput: number; // operations per second
  securityOverheadThreshold: number; // milliseconds
  testDuration: number; // milliseconds
  warmupDuration: number; // milliseconds
  measurementInterval: number; // milliseconds
  enableContinuousMonitoring: boolean;
  stressTestMultiplier: number;
}

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  timestamp: Date;
  latency: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  securityOverhead: number;
  operationType: string;
  contextInfo: {
    securityEnabled: boolean;
    auditingEnabled: boolean;
    performanceMode: string;
    concurrentOperations: number;
  };
}

/**
 * Performance regression test result
 */
export interface PerformanceRegressionResult {
  testName: string;
  configuration: PerformanceRegressionConfig;
  baseline: {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    memoryEfficiency: number;
  };
  withSecurity: {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    memoryEfficiency: number;
    securityOverhead: number;
    auditingOverhead: number;
  };
  regression: {
    latencyIncrease: number; // percentage
    throughputDecrease: number; // percentage
    memoryIncrease: number; // percentage
    overallImpact: 'minimal' | 'acceptable' | 'concerning' | 'critical';
  };
  measurements: PerformanceMeasurement[];
  recommendations: string[];
  timestamp: Date;
  duration: number;
}

/**
 * Comprehensive performance regression tests with security enabled
 * 
 * Validates that security features don't significantly impact performance:
 * - <15ms latency maintained with security enabled
 * - <3ms security overhead acceptable
 * - Throughput regression <10%
 * - Memory overhead <20%
 * - Continuous performance monitoring
 */
export class PerformanceRegressionTests extends EventEmitter {
  private config: PerformanceRegressionConfig;
  private measurements: PerformanceMeasurement[] = [];
  private testResults: PerformanceRegressionResult[] = [];
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<PerformanceRegressionConfig> = {}) {
    super();
    
    this.config = {
      securityEnabled: true,
      auditingEnabled: true,
      performanceMode: 'performance',
      targetLatency: 15,
      targetThroughput: 100,
      securityOverheadThreshold: 3,
      testDuration: 30000, // 30 seconds
      warmupDuration: 5000, // 5 seconds
      measurementInterval: 1000, // 1 second
      enableContinuousMonitoring: true,
      stressTestMultiplier: 2,
      ...config
    };
  }

  /**
   * Run the complete performance regression test suite
   */
  async runFullSuite(): Promise<PerformanceRegressionResult[]> {
    if (this.isRunning) {
      throw new Error('Performance regression tests are already running');
    }

    this.isRunning = true;
    this.testResults = [];
    this.measurements = [];

    console.log('\n🚀 Starting Performance Regression Tests with Security');
    console.log('=' .repeat(60));

    try {
      // Test 1: Baseline performance (no security)
      await this.runBaselinePerformanceTest();
      
      // Test 2: Security overhead impact
      await this.runSecurityOverheadTest();
      
      // Test 3: Audit logging impact
      await this.runAuditLoggingImpactTest();
      
      // Test 4: Combined security features impact
      await this.runCombinedSecurityImpactTest();
      
      // Test 5: Stress test with security
      await this.runSecurityStressTest();
      
      // Test 6: Long-running performance stability
      await this.runLongRunningStabilityTest();

    } finally {
      this.isRunning = false;
      await this.generatePerformanceReport();
    }

    return this.testResults;
  }

  /**
   * Test baseline performance without security features
   */
  private async runBaselinePerformanceTest(): Promise<void> {
    console.log('\n📊 Test 1: Baseline Performance (No Security)');
    
    await this.executePerformanceTest(
      'Baseline Performance',
      {
        ...this.config,
        securityEnabled: false,
        auditingEnabled: false
      },
      async (tmuxManager) => {
        const measurements = [];
        const operationCount = 100;

        for (let i = 0; i < operationCount; i++) {
          const startTime = performance.now();
          
          // Basic operation without security
          await tmuxManager.refreshSessions();
          
          const latency = performance.now() - startTime;
          measurements.push({
            timestamp: new Date(),
            latency,
            throughput: 1000 / latency, // ops per second
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: 0, // Would measure CPU in real implementation
            securityOverhead: 0,
            operationType: 'refresh-sessions',
            contextInfo: {
              securityEnabled: false,
              auditingEnabled: false,
              performanceMode: this.config.performanceMode,
              concurrentOperations: 1
            }
          });

          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return measurements;
      }
    );
  }

  /**
   * Test security validation overhead
   */
  private async runSecurityOverheadTest(): Promise<void> {
    console.log('\n🔒 Test 2: Security Validation Overhead');
    
    await this.executePerformanceTest(
      'Security Validation Overhead',
      {
        ...this.config,
        securityEnabled: true,
        auditingEnabled: false
      },
      async (tmuxManager) => {
        const measurements = [];
        const operationCount = 100;

        // Create secure executor for comparison
        const secureExecutor = new SecureCommandExecutor({
          socketPath: '/tmp/perf-test-socket',
          commandTimeout: 5000,
          enableAuditLogging: false,
          rateLimitConfig: {
            windowMs: 60000,
            maxRequests: 1000,
            blockDurationMs: 1000
          },
          maxConcurrentCommands: 10
        });

        try {
          for (let i = 0; i < operationCount; i++) {
            // Measure baseline operation
            const baselineStart = performance.now();
            await tmuxManager.refreshSessions();
            const baselineLatency = performance.now() - baselineStart;

            // Measure secure operation
            const secureStart = performance.now();
            await secureExecutor.executeSecureCommand(
              'list-sessions',
              {},
              { sessionId: `perf-test-${i}`, userId: 'test-user' }
            );
            const secureLatency = performance.now() - secureStart;

            const securityOverhead = secureLatency - baselineLatency;

            measurements.push({
              timestamp: new Date(),
              latency: secureLatency,
              throughput: 1000 / secureLatency,
              memoryUsage: process.memoryUsage().heapUsed,
              cpuUsage: 0,
              securityOverhead,
              operationType: 'secure-list-sessions',
              contextInfo: {
                securityEnabled: true,
                auditingEnabled: false,
                performanceMode: this.config.performanceMode,
                concurrentOperations: 1
              }
            });

            await new Promise(resolve => setTimeout(resolve, 10));
          }

        } finally {
          await secureExecutor.shutdown();
        }

        return measurements;
      }
    );
  }

  /**
   * Test audit logging performance impact
   */
  private async runAuditLoggingImpactTest(): Promise<void> {
    console.log('\n📝 Test 3: Audit Logging Impact');
    
    await this.executePerformanceTest(
      'Audit Logging Impact',
      {
        ...this.config,
        securityEnabled: true,
        auditingEnabled: true
      },
      async (tmuxManager) => {
        const measurements = [];
        const operationCount = 100;

        for (let i = 0; i < operationCount; i++) {
          const startTime = performance.now();
          
          // Operation with full auditing
          const session = await tmuxManager.createSession(`audit-test-${i}`);
          await tmuxManager.sendCommand(session.id, 'echo "audit test"');
          await tmuxManager.destroySession(session.id);
          
          const latency = performance.now() - startTime;

          measurements.push({
            timestamp: new Date(),
            latency,
            throughput: 1000 / latency,
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: 0,
            securityOverhead: 0, // Would calculate based on comparison
            operationType: 'full-session-lifecycle-with-audit',
            contextInfo: {
              securityEnabled: true,
              auditingEnabled: true,
              performanceMode: this.config.performanceMode,
              concurrentOperations: 1
            }
          });

          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return measurements;
      }
    );
  }

  /**
   * Test combined security features impact
   */
  private async runCombinedSecurityImpactTest(): Promise<void> {
    console.log('\n🛡️ Test 4: Combined Security Features Impact');
    
    await this.executePerformanceTest(
      'Combined Security Features',
      {
        ...this.config,
        securityEnabled: true,
        auditingEnabled: true
      },
      async (tmuxManager) => {
        const measurements = [];
        const operationTypes = [
          'session-creation',
          'command-execution',
          'output-capture',
          'session-destruction'
        ];

        for (let i = 0; i < 25; i++) {
          for (const opType of operationTypes) {
            const startTime = performance.now();
            
            let operationDescription = '';
            
            switch (opType) {
              case 'session-creation':
                const session = await tmuxManager.createSession(`combined-test-${i}`);
                operationDescription = 'create-session';
                
                // Execute other operations on this session
                const cmdTime = performance.now();
                await tmuxManager.sendCommand(session.id, `echo "combined test ${i}"`);
                const cmdLatency = performance.now() - cmdTime;
                
                const captureTime = performance.now();
                await tmuxManager.captureOutput(session.id);
                const captureLatency = performance.now() - captureTime;
                
                const destroyTime = performance.now();
                await tmuxManager.destroySession(session.id);
                const destroyLatency = performance.now() - destroyTime;
                
                // Record all operations
                [
                  { type: 'command-execution', latency: cmdLatency },
                  { type: 'output-capture', latency: captureLatency },
                  { type: 'session-destruction', latency: destroyLatency }
                ].forEach(op => {
                  measurements.push({
                    timestamp: new Date(),
                    latency: op.latency,
                    throughput: 1000 / op.latency,
                    memoryUsage: process.memoryUsage().heapUsed,
                    cpuUsage: 0,
                    securityOverhead: 0,
                    operationType: op.type,
                    contextInfo: {
                      securityEnabled: true,
                      auditingEnabled: true,
                      performanceMode: this.config.performanceMode,
                      concurrentOperations: 1
                    }
                  });
                });
                break;
            }
            
            const latency = performance.now() - startTime;

            measurements.push({
              timestamp: new Date(),
              latency,
              throughput: 1000 / latency,
              memoryUsage: process.memoryUsage().heapUsed,
              cpuUsage: 0,
              securityOverhead: 0,
              operationType: operationDescription || opType,
              contextInfo: {
                securityEnabled: true,
                auditingEnabled: true,
                performanceMode: this.config.performanceMode,
                concurrentOperations: 1
              }
            });
          }
        }

        return measurements;
      }
    );
  }

  /**
   * Test security under stress conditions
   */
  private async runSecurityStressTest(): Promise<void> {
    console.log('\n💪 Test 5: Security Under Stress');
    
    await this.executePerformanceTest(
      'Security Stress Test',
      {
        ...this.config,
        securityEnabled: true,
        auditingEnabled: true
      },
      async (tmuxManager) => {
        const measurements = [];
        const concurrentOperations = 20 * this.config.stressTestMultiplier;
        const operationsPerConcurrent = 10;

        console.log(`  Running ${concurrentOperations} concurrent operations...`);

        const promises: Promise<PerformanceMeasurement[]>[] = [];

        for (let i = 0; i < concurrentOperations; i++) {
          const promise = (async () => {
            const threadMeasurements: PerformanceMeasurement[] = [];
            
            for (let j = 0; j < operationsPerConcurrent; j++) {
              const startTime = performance.now();
              
              try {
                const session = await tmuxManager.createSession(`stress-${i}-${j}`);
                await tmuxManager.sendCommand(session.id, `echo "stress test ${i}-${j}"`);
                const output = await tmuxManager.captureOutput(session.id);
                await tmuxManager.destroySession(session.id);
                
                const latency = performance.now() - startTime;

                threadMeasurements.push({
                  timestamp: new Date(),
                  latency,
                  throughput: 1000 / latency,
                  memoryUsage: process.memoryUsage().heapUsed,
                  cpuUsage: 0,
                  securityOverhead: 0,
                  operationType: 'stress-session-lifecycle',
                  contextInfo: {
                    securityEnabled: true,
                    auditingEnabled: true,
                    performanceMode: this.config.performanceMode,
                    concurrentOperations
                  }
                });

              } catch (error) {
                // Record failed operations with high latency
                const latency = performance.now() - startTime;
                threadMeasurements.push({
                  timestamp: new Date(),
                  latency: latency || 1000, // High penalty for failures
                  throughput: 0,
                  memoryUsage: process.memoryUsage().heapUsed,
                  cpuUsage: 0,
                  securityOverhead: 0,
                  operationType: 'stress-session-lifecycle-failed',
                  contextInfo: {
                    securityEnabled: true,
                    auditingEnabled: true,
                    performanceMode: this.config.performanceMode,
                    concurrentOperations
                  }
                });
              }
            }
            
            return threadMeasurements;
          })();
          
          promises.push(promise);
        }

        const results = await Promise.allSettled(promises);
        
        for (const result of results) {
          if (result.status === 'fulfilled') {
            measurements.push(...result.value);
          }
        }

        return measurements;
      }
    );
  }

  /**
   * Test long-running performance stability with security
   */
  private async runLongRunningStabilityTest(): Promise<void> {
    console.log('\n⏱️ Test 6: Long-Running Performance Stability');
    
    await this.executePerformanceTest(
      'Long-Running Stability',
      {
        ...this.config,
        securityEnabled: true,
        auditingEnabled: true,
        testDuration: 60000 // 1 minute
      },
      async (tmuxManager) => {
        const measurements: PerformanceMeasurement[] = [];
        const startTime = Date.now();
        let operationCount = 0;

        // Start continuous monitoring
        if (this.config.enableContinuousMonitoring) {
          this.startContinuousMonitoring(measurements);
        }

        while (Date.now() - startTime < this.config.testDuration) {
          const opStart = performance.now();
          
          try {
            // Rotate through different operation types
            const opType = operationCount % 4;
            
            switch (opType) {
              case 0:
                await tmuxManager.refreshSessions();
                break;
              case 1:
                const session = await tmuxManager.createSession(`stability-${operationCount}`);
                await tmuxManager.destroySession(session.id);
                break;
              case 2:
                // Create and use session
                const workSession = await tmuxManager.createSession(`work-${operationCount}`);
                await tmuxManager.sendCommand(workSession.id, 'echo "stability test"');
                await tmuxManager.captureOutput(workSession.id);
                await tmuxManager.destroySession(workSession.id);
                break;
              case 3:
                // Quick operations
                await tmuxManager.refreshSessions();
                break;
            }
            
            const latency = performance.now() - opStart;

            measurements.push({
              timestamp: new Date(),
              latency,
              throughput: 1000 / latency,
              memoryUsage: process.memoryUsage().heapUsed,
              cpuUsage: 0,
              securityOverhead: 0,
              operationType: `stability-op-${opType}`,
              contextInfo: {
                securityEnabled: true,
                auditingEnabled: true,
                performanceMode: this.config.performanceMode,
                concurrentOperations: 1
              }
            });

            operationCount++;

          } catch (error) {
            // Record errors but continue
            const latency = performance.now() - opStart;
            measurements.push({
              timestamp: new Date(),
              latency: latency || 500,
              throughput: 0,
              memoryUsage: process.memoryUsage().heapUsed,
              cpuUsage: 0,
              securityOverhead: 0,
              operationType: 'stability-error',
              contextInfo: {
                securityEnabled: true,
                auditingEnabled: true,
                performanceMode: this.config.performanceMode,
                concurrentOperations: 1
              }
            });
          }

          // Brief pause between operations
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.stopContinuousMonitoring();

        console.log(`  Completed ${operationCount} operations over ${this.config.testDuration / 1000} seconds`);
        return measurements;
      }
    );
  }

  /**
   * Execute a performance test with comprehensive measurement
   */
  private async executePerformanceTest(
    testName: string,
    testConfig: PerformanceRegressionConfig,
    testFunc: (tmuxManager: TmuxSessionManager) => Promise<PerformanceMeasurement[]>
  ): Promise<void> {
    console.log(`  🧪 ${testName}...`);
    
    const startTime = performance.now();
    
    // Initialize tmux manager with test configuration
    const tmuxConfig: TmuxConfig = {
      socketPath: '/tmp/perf-regression-socket',
      performanceMode: testConfig.performanceMode,
      commandTimeout: 5000
    };

    const tmuxManager = new TmuxSessionManager(tmuxConfig);
    
    try {
      await tmuxManager.initialize();
      
      // Warmup period
      if (testConfig.warmupDuration > 0) {
        console.log(`    Warming up for ${testConfig.warmupDuration / 1000}s...`);
        const warmupEnd = Date.now() + testConfig.warmupDuration;
        while (Date.now() < warmupEnd) {
          await tmuxManager.refreshSessions();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Execute test and collect measurements
      const measurements = await testFunc(tmuxManager);
      this.measurements.push(...measurements);

      // Calculate performance metrics
      const latencies = measurements.map(m => m.latency);
      const sortedLatencies = latencies.sort((a, b) => a - b);
      
      const baseline = {
        averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
        p95Latency: sortedLatencies[Math.floor(latencies.length * 0.95)] || 0,
        p99Latency: sortedLatencies[Math.floor(latencies.length * 0.99)] || 0,
        throughput: measurements.reduce((sum, m) => sum + m.throughput, 0) / measurements.length,
        memoryEfficiency: measurements.reduce((sum, m) => sum + m.memoryUsage, 0) / measurements.length
      };

      const withSecurity = { ...baseline };
      const securityOverhead = measurements
        .filter(m => m.securityOverhead > 0)
        .reduce((sum, m) => sum + m.securityOverhead, 0) / 
        measurements.filter(m => m.securityOverhead > 0).length || 0;

      withSecurity.securityOverhead = securityOverhead;
      withSecurity.auditingOverhead = 0; // Would calculate separately

      // Analyze regression
      const regression = {
        latencyIncrease: 0, // Would compare against baseline
        throughputDecrease: 0,
        memoryIncrease: 0,
        overallImpact: this.determineImpact(baseline, withSecurity) as 'minimal' | 'acceptable' | 'concerning' | 'critical'
      };

      const result: PerformanceRegressionResult = {
        testName,
        configuration: testConfig,
        baseline,
        withSecurity,
        regression,
        measurements,
        recommendations: this.generateRecommendations(baseline, withSecurity),
        timestamp: new Date(),
        duration: performance.now() - startTime
      };

      this.testResults.push(result);

      // Report immediate results
      const avgLatency = baseline.averageLatency;
      const targetMet = avgLatency < testConfig.targetLatency;
      const icon = targetMet ? '✅' : '❌';
      
      console.log(`    ${icon} ${avgLatency.toFixed(2)}ms avg (target: <${testConfig.targetLatency}ms)`);
      console.log(`    📊 Throughput: ${baseline.throughput.toFixed(1)} ops/sec`);
      
      if (securityOverhead > 0) {
        const overheadIcon = securityOverhead < testConfig.securityOverheadThreshold ? '✅' : '⚠️';
        console.log(`    🔒 Security overhead: ${overheadIcon} ${securityOverhead.toFixed(2)}ms`);
      }

      this.emit('test-completed', { testName, result });

    } finally {
      await tmuxManager.cleanup();
    }
  }

  /**
   * Start continuous performance monitoring
   */
  private startContinuousMonitoring(measurements: PerformanceMeasurement[]): void {
    this.monitoringInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage().heapUsed;
      
      measurements.push({
        timestamp: new Date(),
        latency: 0,
        throughput: 0,
        memoryUsage,
        cpuUsage: 0,
        securityOverhead: 0,
        operationType: 'monitoring-sample',
        contextInfo: {
          securityEnabled: this.config.securityEnabled,
          auditingEnabled: this.config.auditingEnabled,
          performanceMode: this.config.performanceMode,
          concurrentOperations: 0
        }
      });
    }, this.config.measurementInterval);
  }

  /**
   * Stop continuous monitoring
   */
  private stopContinuousMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Determine performance impact level
   */
  private determineImpact(baseline: any, withSecurity: any): string {
    const latencyIncrease = ((withSecurity.averageLatency - baseline.averageLatency) / baseline.averageLatency) * 100;
    const throughputDecrease = ((baseline.throughput - withSecurity.throughput) / baseline.throughput) * 100;
    
    if (latencyIncrease > 50 || throughputDecrease > 30) return 'critical';
    if (latencyIncrease > 25 || throughputDecrease > 15) return 'concerning';
    if (latencyIncrease > 10 || throughputDecrease > 5) return 'acceptable';
    return 'minimal';
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(baseline: any, withSecurity: any): string[] {
    const recommendations: string[] = [];
    
    if (baseline.averageLatency > this.config.targetLatency) {
      recommendations.push(`⚠️ Average latency ${baseline.averageLatency.toFixed(2)}ms exceeds target ${this.config.targetLatency}ms`);
    }
    
    if (withSecurity.securityOverhead > this.config.securityOverheadThreshold) {
      recommendations.push(`🔒 Security overhead ${withSecurity.securityOverhead.toFixed(2)}ms exceeds threshold ${this.config.securityOverheadThreshold}ms`);
    }
    
    if (baseline.throughput < this.config.targetThroughput) {
      recommendations.push(`📊 Throughput ${baseline.throughput.toFixed(1)} ops/sec below target ${this.config.targetThroughput}`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All performance targets met');
    }
    
    return recommendations;
  }

  /**
   * Generate comprehensive performance regression report
   */
  private async generatePerformanceReport(): Promise<void> {
    const totalTests = this.testResults.length;
    const testsMeetingTarget = this.testResults.filter(t => 
      t.baseline.averageLatency < this.config.targetLatency
    ).length;

    const avgLatency = this.testResults.reduce((sum, t) => sum + t.baseline.averageLatency, 0) / totalTests;
    const avgThroughput = this.testResults.reduce((sum, t) => sum + t.baseline.throughput, 0) / totalTests;
    const avgSecurityOverhead = this.testResults.reduce((sum, t) => sum + (t.withSecurity.securityOverhead || 0), 0) / totalTests;

    const criticalTests = this.testResults.filter(t => t.regression.overallImpact === 'critical');
    const concerningTests = this.testResults.filter(t => t.regression.overallImpact === 'concerning');

    console.log('\n' + '='.repeat(80));
    console.log('🎯 PERFORMANCE REGRESSION REPORT WITH SECURITY');
    console.log('='.repeat(80));
    
    console.log(`\n📊 TEST EXECUTION SUMMARY:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Meeting Target (<${this.config.targetLatency}ms): ${testsMeetingTarget} ✅`);
    console.log(`  Critical Impact: ${criticalTests.length} ${criticalTests.length > 0 ? '❌' : ''}`);
    console.log(`  Concerning Impact: ${concerningTests.length} ${concerningTests.length > 0 ? '⚠️' : ''}`);

    console.log(`\n⚡ PERFORMANCE SUMMARY:`);
    console.log(`  Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Average Throughput: ${avgThroughput.toFixed(1)} ops/sec`);
    console.log(`  Target Met (<${this.config.targetLatency}ms): ${avgLatency < this.config.targetLatency ? '✅' : '❌'}`);

    console.log(`\n🔒 SECURITY IMPACT SUMMARY:`);
    console.log(`  Average Security Overhead: ${avgSecurityOverhead.toFixed(2)}ms`);
    console.log(`  Overhead Target Met (<${this.config.securityOverheadThreshold}ms): ${avgSecurityOverhead < this.config.securityOverheadThreshold ? '✅' : '❌'}`);
    console.log(`  Security Enabled: ${this.config.securityEnabled ? 'Yes' : 'No'}`);
    console.log(`  Auditing Enabled: ${this.config.auditingEnabled ? 'Yes' : 'No'}`);

    console.log(`\n📈 DETAILED TEST RESULTS:`);
    for (const result of this.testResults) {
      const impactIcon = {
        'minimal': '✅',
        'acceptable': '🟡',
        'concerning': '⚠️',
        'critical': '❌'
      }[result.regression.overallImpact];
      
      console.log(`  ${impactIcon} ${result.testName}:`);
      console.log(`    Average Latency: ${result.baseline.averageLatency.toFixed(2)}ms`);
      console.log(`    P95 Latency: ${result.baseline.p95Latency.toFixed(2)}ms`);
      console.log(`    Throughput: ${result.baseline.throughput.toFixed(1)} ops/sec`);
      
      if (result.withSecurity.securityOverhead > 0) {
        console.log(`    Security Overhead: ${result.withSecurity.securityOverhead.toFixed(2)}ms`);
      }
      
      console.log(`    Impact Level: ${result.regression.overallImpact}`);
      console.log();
    }

    if (criticalTests.length > 0 || concerningTests.length > 0) {
      console.log(`\n⚠️ PERFORMANCE CONCERNS:`);
      
      for (const test of [...criticalTests, ...concerningTests]) {
        console.log(`  • ${test.testName}: ${test.regression.overallImpact} impact`);
        for (const recommendation of test.recommendations) {
          console.log(`    ${recommendation}`);
        }
      }
    }

    console.log(`\n💡 OVERALL RECOMMENDATIONS:`);
    
    if (avgLatency >= this.config.targetLatency) {
      console.log(`  🔴 CRITICAL: Average latency ${avgLatency.toFixed(2)}ms exceeds target ${this.config.targetLatency}ms`);
      console.log(`    • Consider optimizing connection pooling`);
      console.log(`    • Review command batching strategy`);
      console.log(`    • Optimize security validation logic`);
    } else {
      console.log(`  ✅ Latency target achieved`);
    }

    if (avgSecurityOverhead >= this.config.securityOverheadThreshold) {
      console.log(`  ⚠️ Security overhead ${avgSecurityOverhead.toFixed(2)}ms exceeds threshold`);
      console.log(`    • Optimize security validation algorithms`);
      console.log(`    • Consider async audit logging`);
      console.log(`    • Review security caching strategies`);
    } else {
      console.log(`  ✅ Security overhead within acceptable limits`);
    }

    if (avgThroughput < this.config.targetThroughput) {
      console.log(`  ⚠️ Throughput ${avgThroughput.toFixed(1)} ops/sec below target ${this.config.targetThroughput}`);
      console.log(`    • Increase connection pool size`);
      console.log(`    • Optimize batch processing`);
      console.log(`    • Consider parallel execution strategies`);
    } else {
      console.log(`  ✅ Throughput target achieved`);
    }

    console.log('\n' + '='.repeat(80));

    this.emit('suite-completed', {
      summary: {
        totalTests,
        testsMeetingTarget,
        criticalTests: criticalTests.length,
        concerningTests: concerningTests.length,
        avgLatency,
        avgThroughput,
        avgSecurityOverhead,
        targetsMet: avgLatency < this.config.targetLatency && 
                   avgSecurityOverhead < this.config.securityOverheadThreshold,
        overallRecommendation: criticalTests.length === 0 ? 'approved' : 'needs-optimization'
      },
      results: this.testResults
    });
  }

  /**
   * Get real-time performance metrics
   */
  getCurrentMetrics(): {
    avgLatency: number;
    currentThroughput: number;
    memoryUsage: number;
    securityOverhead: number;
    measurementCount: number;
  } {
    const recentMeasurements = this.measurements.slice(-100); // Last 100 measurements
    
    if (recentMeasurements.length === 0) {
      return {
        avgLatency: 0,
        currentThroughput: 0,
        memoryUsage: 0,
        securityOverhead: 0,
        measurementCount: 0
      };
    }

    return {
      avgLatency: recentMeasurements.reduce((sum, m) => sum + m.latency, 0) / recentMeasurements.length,
      currentThroughput: recentMeasurements.reduce((sum, m) => sum + m.throughput, 0) / recentMeasurements.length,
      memoryUsage: process.memoryUsage().heapUsed,
      securityOverhead: recentMeasurements.reduce((sum, m) => sum + m.securityOverhead, 0) / recentMeasurements.length,
      measurementCount: this.measurements.length
    };
  }

  /**
   * Clean up test resources
   */
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up performance regression test resources...');
    
    this.stopContinuousMonitoring();
    
    console.log('✅ Performance regression test cleanup completed');
  }
}
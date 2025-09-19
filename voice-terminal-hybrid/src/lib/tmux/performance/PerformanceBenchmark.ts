import { TmuxSessionManager } from '../TmuxSessionManager';
import { TmuxIntegration } from '../TmuxIntegration';
import type { TmuxConfig } from '../types';

export interface BenchmarkConfig {
  testDuration: number; // milliseconds
  concurrentCommands: number;
  commandTypes: ('simple' | 'session-list' | 'output-capture' | 'batch')[];
  performanceMode: boolean;
  targetLatency: number;
  samples: number;
}

export interface BenchmarkResult {
  testName: string;
  config: BenchmarkConfig;
  results: {
    averageLatency: number;
    medianLatency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    standardDeviation: number;
    throughput: number; // commands per second
    successRate: number;
    targetMet: boolean;
  };
  breakdown: {
    connectionPoolMetrics: any;
    batcherMetrics: any;
    cacheMetrics: any;
  };
  rawLatencies: number[];
  timestamp: Date;
}

export interface PerformanceReport {
  benchmarks: BenchmarkResult[];
  summary: {
    overallTargetMet: boolean;
    bestCase: BenchmarkResult;
    worstCase: BenchmarkResult;
    averageImprovement: number; // percentage improvement over baseline
    recommendations: string[];
  };
}

/**
 * Comprehensive performance benchmarking suite to validate <15ms latency target
 */
export class PerformanceBenchmark {
  private tmuxConfig: TmuxConfig;
  private defaultBenchmarkConfig: BenchmarkConfig;

  constructor(tmuxConfig: TmuxConfig = {}) {
    this.tmuxConfig = tmuxConfig;
    this.defaultBenchmarkConfig = {
      testDuration: 30000, // 30 seconds
      concurrentCommands: 10,
      commandTypes: ['simple', 'session-list', 'output-capture', 'batch'],
      performanceMode: true,
      targetLatency: 15, // <15ms target
      samples: 1000
    };
  }

  /**
   * Run comprehensive performance benchmark suite
   */
  async runFullBenchmark(): Promise<PerformanceReport> {
    const benchmarks: BenchmarkResult[] = [];

    console.log('🚀 Starting comprehensive performance benchmark...');

    // Test 1: Baseline performance (legacy mode)
    benchmarks.push(await this.runBenchmark('Baseline (Legacy Mode)', {
      ...this.defaultBenchmarkConfig,
      performanceMode: false,
      samples: 500
    }));

    // Test 2: Performance mode with connection pooling
    benchmarks.push(await this.runBenchmark('Performance Mode', {
      ...this.defaultBenchmarkConfig,
      performanceMode: true
    }));

    // Test 3: High concurrency stress test
    benchmarks.push(await this.runBenchmark('High Concurrency', {
      ...this.defaultBenchmarkConfig,
      concurrentCommands: 25,
      samples: 200
    }));

    // Test 4: Batch operation optimization
    benchmarks.push(await this.runBenchmark('Batch Operations', {
      ...this.defaultBenchmarkConfig,
      commandTypes: ['batch'],
      samples: 100
    }));

    // Test 5: Cache efficiency test
    benchmarks.push(await this.runBenchmark('Cache Efficiency', {
      ...this.defaultBenchmarkConfig,
      commandTypes: ['session-list'],
      samples: 500
    }));

    // Test 6: Mixed workload simulation
    benchmarks.push(await this.runBenchmark('Mixed Workload', {
      ...this.defaultBenchmarkConfig,
      commandTypes: ['simple', 'session-list', 'output-capture', 'batch'],
      concurrentCommands: 15
    }));

    return this.generateReport(benchmarks);
  }

  /**
   * Run a specific benchmark configuration
   */
  async runBenchmark(testName: string, config: BenchmarkConfig): Promise<BenchmarkResult> {
    console.log(`\n📊 Running benchmark: ${testName}`);
    console.log(`  Target: <${config.targetLatency}ms latency`);
    console.log(`  Samples: ${config.samples}`);
    console.log(`  Performance Mode: ${config.performanceMode}`);

    // Initialize tmux with specified configuration
    const tmuxConfig: TmuxConfig = {
      ...this.tmuxConfig,
      performanceMode: config.performanceMode ? 'performance' : 'balanced'
    };

    const tmuxIntegration = new TmuxIntegration(tmuxConfig);
    
    try {
      await tmuxIntegration.initialize();
      
      const latencies: number[] = [];
      const errors: number[] = [];
      const startTime = Date.now();

      // Run benchmark samples
      for (let i = 0; i < config.samples; i++) {
        const commandLatency = await this.executeTestCommand(tmuxIntegration, config);
        
        if (commandLatency !== null) {
          latencies.push(commandLatency);
        } else {
          errors.push(i);
        }

        // Progress indicator
        if ((i + 1) % Math.floor(config.samples / 10) === 0) {
          const progress = Math.round(((i + 1) / config.samples) * 100);
          process.stdout.write(`\r  Progress: ${progress}%`);
        }
      }

      console.log(`\r  Progress: 100% ✅`);

      // Calculate statistics
      const results = this.calculateStatistics(latencies, config.targetLatency, startTime);
      const breakdown = tmuxIntegration.getEnhancedPerformanceMetrics();

      await tmuxIntegration.cleanup();

      return {
        testName,
        config,
        results: {
          ...results,
          successRate: ((config.samples - errors.length) / config.samples) * 100
        },
        breakdown: {
          connectionPoolMetrics: breakdown.connectionPool,
          batcherMetrics: breakdown.batcher,
          cacheMetrics: breakdown.cache
        },
        rawLatencies: latencies,
        timestamp: new Date()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Benchmark failed: ${errorMessage}`);
      await tmuxIntegration.cleanup();
      throw error;
    }
  }

  /**
   * Execute a test command based on the specified type
   */
  private async executeTestCommand(tmux: TmuxIntegration, config: BenchmarkConfig): Promise<number | null> {
    const startTime = performance.now();
    
    try {
      const commandType = config.commandTypes[Math.floor(Math.random() * config.commandTypes.length)];
      
      switch (commandType) {
        case 'simple':
          await tmux.executeCommand('echo "benchmark test"');
          break;
          
        case 'session-list':
          tmux.getSessions(); // This should hit cache after first call
          break;
          
        case 'output-capture':
          await tmux.getOutput(50);
          break;
          
        case 'batch':
          await tmux.executeBatch([
            'echo "batch1"',
            'echo "batch2"',
            'echo "batch3"'
          ]);
          break;
      }
      
      return performance.now() - startTime;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Command failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Calculate statistical metrics from latency data
   */
  private calculateStatistics(latencies: number[], targetLatency: number, startTime: number): {
    averageLatency: number;
    medianLatency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    standardDeviation: number;
    throughput: number;
    targetMet: boolean;
  } {
    if (latencies.length === 0) {
      throw new Error('No successful command executions');
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const total = latencies.reduce((sum, l) => sum + l, 0);
    const average = total / latencies.length;
    
    // Calculate percentiles
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    // Calculate standard deviation
    const variance = latencies.reduce((sum, l) => sum + Math.pow(l - average, 2), 0) / latencies.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate throughput
    const totalTime = (Date.now() - startTime) / 1000; // seconds
    const throughput = latencies.length / totalTime;

    return {
      averageLatency: average,
      medianLatency: median,
      p95Latency: p95,
      p99Latency: p99,
      minLatency: sorted[0],
      maxLatency: sorted[sorted.length - 1],
      standardDeviation,
      throughput,
      targetMet: average < targetLatency
    };
  }

  /**
   * Generate comprehensive performance report
   */
  private generateReport(benchmarks: BenchmarkResult[]): PerformanceReport {
    const targetMetBenchmarks = benchmarks.filter(b => b.results.targetMet);
    const bestCase = benchmarks.reduce((best, current) => 
      current.results.averageLatency < best.results.averageLatency ? current : best
    );
    const worstCase = benchmarks.reduce((worst, current) => 
      current.results.averageLatency > worst.results.averageLatency ? current : worst
    );

    // Calculate improvement over baseline
    const baseline = benchmarks.find(b => b.testName.includes('Baseline'));
    const performanceMode = benchmarks.find(b => b.testName.includes('Performance Mode'));
    
    let averageImprovement = 0;
    if (baseline && performanceMode) {
      averageImprovement = ((baseline.results.averageLatency - performanceMode.results.averageLatency) / baseline.results.averageLatency) * 100;
    }

    const recommendations = this.generateRecommendations(benchmarks);

    return {
      benchmarks,
      summary: {
        overallTargetMet: targetMetBenchmarks.length === benchmarks.length,
        bestCase,
        worstCase,
        averageImprovement,
        recommendations
      }
    };
  }

  /**
   * Generate performance optimization recommendations
   */
  private generateRecommendations(benchmarks: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    
    const avgLatency = benchmarks.reduce((sum, b) => sum + b.results.averageLatency, 0) / benchmarks.length;
    
    if (avgLatency > 15) {
      recommendations.push('❌ Average latency exceeds 15ms target. Consider increasing connection pool size.');
    } else {
      recommendations.push('✅ Average latency meets <15ms target.');
    }

    const cacheHitRate = benchmarks.reduce((sum, b) => sum + (b.breakdown.cacheMetrics.hitRate || 0), 0) / benchmarks.length;
    if (cacheHitRate < 80) {
      recommendations.push('🔄 Cache hit rate is low. Consider increasing cache TTL or warming strategies.');
    } else {
      recommendations.push('✅ Cache performing well with >80% hit rate.');
    }

    const batchEfficiency = benchmarks.reduce((sum, b) => sum + (b.breakdown.batcherMetrics.batchingEfficiency || 0), 0) / benchmarks.length;
    if (batchEfficiency < 50) {
      recommendations.push('📦 Batching efficiency could be improved. Consider reducing batch wait time.');
    } else {
      recommendations.push('✅ Command batching is performing efficiently.');
    }

    return recommendations;
  }

  /**
   * Print formatted benchmark report
   */
  printReport(report: PerformanceReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`  Overall Target Met: ${report.summary.overallTargetMet ? '✅' : '❌'}`);
    console.log(`  Performance Improvement: ${report.summary.averageImprovement.toFixed(1)}%`);
    console.log(`  Best Case: ${report.summary.bestCase.testName} (${report.summary.bestCase.results.averageLatency.toFixed(2)}ms)`);
    console.log(`  Worst Case: ${report.summary.worstCase.testName} (${report.summary.worstCase.results.averageLatency.toFixed(2)}ms)`);

    console.log(`\n📊 DETAILED RESULTS:`);
    for (const benchmark of report.benchmarks) {
      console.log(`\n  ${benchmark.testName}:`);
      console.log(`    Average Latency: ${benchmark.results.averageLatency.toFixed(2)}ms ${benchmark.results.targetMet ? '✅' : '❌'}`);
      console.log(`    P95 Latency: ${benchmark.results.p95Latency.toFixed(2)}ms`);
      console.log(`    Throughput: ${benchmark.results.throughput.toFixed(1)} ops/sec`);
      console.log(`    Success Rate: ${benchmark.results.successRate.toFixed(1)}%`);
      console.log(`    Cache Hit Rate: ${(benchmark.breakdown.cacheMetrics.hitRate || 0).toFixed(1)}%`);
    }

    console.log(`\n💡 RECOMMENDATIONS:`);
    for (const recommendation of report.summary.recommendations) {
      console.log(`  ${recommendation}`);
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Quick performance validation test
   */
  async quickValidation(): Promise<boolean> {
    console.log('🔍 Running quick performance validation...');
    
    const result = await this.runBenchmark('Quick Validation', {
      ...this.defaultBenchmarkConfig,
      samples: 100,
      testDuration: 10000
    });

    const targetMet = result.results.targetMet;
    console.log(`Quick validation: ${targetMet ? '✅ PASSED' : '❌ FAILED'} (${result.results.averageLatency.toFixed(2)}ms avg)`);
    
    return targetMet;
  }
}

/**
 * CLI interface for running benchmarks
 */
export async function runPerformanceBenchmark(options: {
  quick?: boolean;
  full?: boolean;
  config?: Partial<TmuxConfig>;
} = {}): Promise<void> {
  const benchmark = new PerformanceBenchmark(options.config);
  
  try {
    if (options.quick) {
      await benchmark.quickValidation();
    } else {
      const report = await benchmark.runFullBenchmark();
      benchmark.printReport(report);
    }
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Export for CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick');
  const isFull = args.includes('--full');
  
  runPerformanceBenchmark({ 
    quick: isQuick && !isFull,
    full: isFull || (!isQuick && !isFull)
  });
}
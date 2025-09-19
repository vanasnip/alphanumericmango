import { TmuxIntegration } from './TmuxIntegration';
import { TmuxSessionManager } from './TmuxSessionManager';
import type { PerformanceMetrics } from './types';

interface BenchmarkResult {
  testName: string;
  iterations: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  throughput: number;
}

interface BenchmarkSuite {
  commandInjection: BenchmarkResult;
  outputCapture: BenchmarkResult;
  batchCommands: BenchmarkResult;
  multipleSessions: BenchmarkResult;
  stressTest: BenchmarkResult;
  overallMetrics: PerformanceMetrics;
}

export class TmuxBenchmark {
  private integration: TmuxIntegration;
  private results: BenchmarkSuite = {} as BenchmarkSuite;

  constructor() {
    this.integration = new TmuxIntegration({
      performanceMode: 'performance',
      commandTimeout: 10000
    });
  }

  async runFullSuite(): Promise<BenchmarkSuite> {
    console.log('Starting tmux integration benchmark suite...\n');
    
    await this.integration.initialize();
    
    this.results.commandInjection = await this.benchmarkCommandInjection();
    this.results.outputCapture = await this.benchmarkOutputCapture();
    this.results.batchCommands = await this.benchmarkBatchCommands();
    this.results.multipleSessions = await this.benchmarkMultipleSessions();
    this.results.stressTest = await this.benchmarkStressTest();
    this.results.overallMetrics = this.integration.getPerformanceMetrics();
    
    await this.integration.cleanup();
    
    return this.results;
  }

  private async benchmarkCommandInjection(iterations: number = 100): Promise<BenchmarkResult> {
    console.log(`Running command injection benchmark (${iterations} iterations)...`);
    const latencies: number[] = [];
    const startTime = performance.now();
    let failures = 0;

    for (let i = 0; i < iterations; i++) {
      const cmdStart = performance.now();
      try {
        await this.integration.executeCommand(`echo "Test ${i}"`);
        latencies.push(performance.now() - cmdStart);
      } catch {
        failures++;
      }

      if ((i + 1) % 20 === 0) {
        process.stdout.write(`\rProgress: ${i + 1}/${iterations}`);
      }
    }

    const totalTime = performance.now() - startTime;
    console.log('\n');

    return this.calculateStats('Command Injection', latencies, iterations, failures, totalTime);
  }

  private async benchmarkOutputCapture(iterations: number = 50): Promise<BenchmarkResult> {
    console.log(`Running output capture benchmark (${iterations} iterations)...`);
    const latencies: number[] = [];
    const startTime = performance.now();
    let failures = 0;

    await this.integration.executeCommand('seq 1 100');
    await new Promise(r => setTimeout(r, 100));

    for (let i = 0; i < iterations; i++) {
      const captureStart = performance.now();
      try {
        await this.integration.getOutput(50);
        latencies.push(performance.now() - captureStart);
      } catch {
        failures++;
      }

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\rProgress: ${i + 1}/${iterations}`);
      }
    }

    const totalTime = performance.now() - startTime;
    console.log('\n');

    return this.calculateStats('Output Capture', latencies, iterations, failures, totalTime);
  }

  private async benchmarkBatchCommands(batchSize: number = 20): Promise<BenchmarkResult> {
    console.log(`Running batch command benchmark (batch size: ${batchSize})...`);
    const iterations = 5;
    const latencies: number[] = [];
    const startTime = performance.now();
    let failures = 0;

    for (let i = 0; i < iterations; i++) {
      const commands = Array(batchSize).fill(0).map((_, j) => `echo "Batch ${i} Command ${j}"`);
      const batchStart = performance.now();
      
      try {
        await this.integration.executeBatch(commands);
        const batchLatency = (performance.now() - batchStart) / batchSize;
        latencies.push(...Array(batchSize).fill(batchLatency));
      } catch {
        failures++;
      }

      process.stdout.write(`\rProgress: ${i + 1}/${iterations}`);
    }

    const totalTime = performance.now() - startTime;
    console.log('\n');

    return this.calculateStats('Batch Commands', latencies, iterations * batchSize, failures, totalTime);
  }

  private async benchmarkMultipleSessions(sessionCount: number = 10): Promise<BenchmarkResult> {
    console.log(`Running multiple session benchmark (${sessionCount} sessions)...`);
    const latencies: number[] = [];
    const startTime = performance.now();
    let failures = 0;
    const sessions: string[] = [];

    for (let i = 0; i < sessionCount; i++) {
      try {
        const sessionStart = performance.now();
        const session = await this.integration.createSession(`test-session-${i}`);
        sessions.push(session.id);
        latencies.push(performance.now() - sessionStart);
        
        process.stdout.write(`\rCreated sessions: ${i + 1}/${sessionCount}`);
      } catch {
        failures++;
      }
    }
    console.log('\n');

    console.log('Testing concurrent command execution across sessions...');
    const commandPromises = sessions.map((sessionId, i) => 
      this.integration.executeCommand(`echo "Session ${i} active"`, sessionId)
    );

    const cmdStart = performance.now();
    await Promise.all(commandPromises);
    const avgCmdLatency = (performance.now() - cmdStart) / sessions.length;
    latencies.push(...Array(sessions.length).fill(avgCmdLatency));

    const totalTime = performance.now() - startTime;
    
    return this.calculateStats('Multiple Sessions', latencies, sessionCount * 2, failures, totalTime);
  }

  private async benchmarkStressTest(): Promise<BenchmarkResult> {
    console.log('Running stress test (rapid command execution)...');
    const duration = 5000;
    const latencies: number[] = [];
    const startTime = performance.now();
    let commandCount = 0;
    let failures = 0;

    const endTime = startTime + duration;
    
    while (performance.now() < endTime) {
      const cmdStart = performance.now();
      try {
        await this.integration.executeCommand(`echo "${commandCount}"`);
        latencies.push(performance.now() - cmdStart);
        commandCount++;
      } catch {
        failures++;
      }

      if (commandCount % 50 === 0) {
        process.stdout.write(`\rCommands executed: ${commandCount}`);
      }
    }

    const totalTime = performance.now() - startTime;
    console.log(`\nExecuted ${commandCount} commands in ${(totalTime / 1000).toFixed(2)}s\n`);

    return this.calculateStats('Stress Test', latencies, commandCount, failures, totalTime);
  }

  private calculateStats(
    testName: string, 
    latencies: number[], 
    iterations: number,
    failures: number,
    totalTime: number
  ): BenchmarkResult {
    if (latencies.length === 0) {
      return {
        testName,
        iterations,
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        successRate: 0,
        throughput: 0
      };
    }

    latencies.sort((a, b) => a - b);

    return {
      testName,
      iterations,
      averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      p50Latency: latencies[Math.floor(latencies.length * 0.5)],
      p95Latency: latencies[Math.floor(latencies.length * 0.95)],
      p99Latency: latencies[Math.floor(latencies.length * 0.99)],
      successRate: ((iterations - failures) / iterations) * 100,
      throughput: (iterations / totalTime) * 1000
    };
  }

  generateReport(): string {
    const results = this.results;
    
    let report = '# tmux Integration Performance Report\n\n';
    report += '## Executive Summary\n\n';
    
    const overallLatency = results.overallMetrics.averageLatency;
    const meetsTarget = overallLatency < 20;
    const meetsMinimum = overallLatency < 50;
    
    report += `- **Overall Average Latency**: ${overallLatency.toFixed(2)}ms\n`;
    report += `- **Target (<20ms)**: ${meetsTarget ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Minimum Viable (<50ms)**: ${meetsMinimum ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Overall Success Rate**: ${results.overallMetrics.successRate.toFixed(2)}%\n\n`;
    
    report += '## Detailed Results\n\n';
    
    const tests = [
      results.commandInjection,
      results.outputCapture,
      results.batchCommands,
      results.multipleSessions,
      results.stressTest
    ];
    
    for (const test of tests) {
      if (!test) continue;
      
      report += `### ${test.testName}\n`;
      report += `- Iterations: ${test.iterations}\n`;
      report += `- Average Latency: ${test.averageLatency.toFixed(2)}ms\n`;
      report += `- Min/Max: ${test.minLatency.toFixed(2)}ms / ${test.maxLatency.toFixed(2)}ms\n`;
      report += `- P50/P95/P99: ${test.p50Latency.toFixed(2)}ms / ${test.p95Latency.toFixed(2)}ms / ${test.p99Latency.toFixed(2)}ms\n`;
      report += `- Success Rate: ${test.successRate.toFixed(2)}%\n`;
      report += `- Throughput: ${test.throughput.toFixed(2)} ops/sec\n\n`;
    }
    
    report += '## Performance Metrics\n\n';
    report += `- Command Injection P95: ${results.overallMetrics.p95Latency.toFixed(2)}ms\n`;
    report += `- Command Injection P99: ${results.overallMetrics.p99Latency.toFixed(2)}ms\n`;
    report += `- Total Commands Executed: ${results.overallMetrics.totalCommands}\n`;
    report += `- Failed Commands: ${results.overallMetrics.failedCommands}\n\n`;
    
    report += '## Recommendations\n\n';
    
    if (meetsTarget) {
      report += '✅ **GO**: Performance meets target requirements (<20ms latency)\n';
      report += '- tmux integration is viable for production use\n';
      report += '- Consider implementing caching for frequently accessed outputs\n';
      report += '- Monitor performance under production load\n';
    } else if (meetsMinimum) {
      report += '⚠️ **CONDITIONAL GO**: Performance meets minimum requirements but not target\n';
      report += '- Consider optimization strategies:\n';
      report += '  - Implement command batching\n';
      report += '  - Use persistent connections\n';
      report += '  - Optimize output capture frequency\n';
      report += '  - Consider alternative terminal multiplexers\n';
    } else {
      report += '❌ **NO GO**: Performance does not meet minimum requirements\n';
      report += '- Explore alternative approaches:\n';
      report += '  - Direct PTY integration\n';
      report += '  - Node-pty library\n';
      report += '  - Custom terminal emulator\n';
      report += '  - WebSocket-based terminal proxy\n';
    }
    
    return report;
  }
}

export async function runBenchmark(): Promise<void> {
  const benchmark = new TmuxBenchmark();
  
  try {
    await benchmark.runFullSuite();
    const report = benchmark.generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log(report);
    
    const fs = await import('fs/promises');
    await fs.writeFile('tmux-benchmark-report.md', report);
    console.log('Report saved to tmux-benchmark-report.md');
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runBenchmark();
}
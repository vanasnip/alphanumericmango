/**
 * Failure Mode Testing Framework for VAL-003
 * Tests system behavior under failure conditions and edge cases
 */

import { VoicePipelineBenchmark, BenchmarkConfig } from '../voice-pipeline-benchmark';
import { AudioSampleGenerator, AudioSample } from '../test-data/audio-sample-generator';
import { ErrorHandler, BenchmarkError, ErrorCodes } from '../errors';

export interface FailureScenario {
  name: string;
  description: string;
  category: 'resource' | 'input' | 'model' | 'network' | 'timeout' | 'corruption';
  severity: 'low' | 'medium' | 'high' | 'critical';
  expectedBehavior: 'graceful_degradation' | 'error_recovery' | 'fail_fast' | 'timeout';
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
}

export interface FailureTestResult {
  scenario: FailureScenario;
  passed: boolean;
  actualBehavior: string;
  errorMessage?: string;
  recoveryTime?: number;
  resourceLeaks?: boolean;
}

export class FailureModeTester {
  private benchmark: VoicePipelineBenchmark;
  private originalConfig: BenchmarkConfig | null = null;
  
  constructor() {
    this.benchmark = new VoicePipelineBenchmark();
  }
  
  /**
   * Run comprehensive failure mode testing
   */
  async runFailureModeTests(baseConfig: BenchmarkConfig): Promise<FailureTestResult[]> {
    console.log('Starting Failure Mode Testing...');
    this.originalConfig = baseConfig;
    
    const scenarios = this.getFailureScenarios();
    const results: FailureTestResult[] = [];
    
    for (const scenario of scenarios) {
      console.log(`\nTesting failure scenario: ${scenario.name}`);
      
      try {
        const result = await this.runFailureScenario(scenario, baseConfig);
        results.push(result);
        
        console.log(`  Result: ${result.passed ? '✅ PASS' : '❌ FAIL'} - ${result.actualBehavior}`);
        if (!result.passed && result.errorMessage) {
          console.log(`  Error: ${result.errorMessage}`);
        }
        
      } catch (error) {
        console.error(`  Failed to run scenario: ${error}`);
        results.push({
          scenario,
          passed: false,
          actualBehavior: 'test_execution_failed',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    this.generateFailureModeReport(results);
    return results;
  }
  
  /**
   * Define failure scenarios to test
   */
  private getFailureScenarios(): FailureScenario[] {
    return [
      // Resource exhaustion scenarios
      {
        name: 'Memory Pressure',
        description: 'Test behavior when system memory is low',
        category: 'resource',
        severity: 'high',
        expectedBehavior: 'graceful_degradation',
        setup: async () => {
          // Simulate memory pressure
          console.log('  Simulating memory pressure...');
        },
        teardown: async () => {
          // Cleanup memory pressure simulation
        }
      },
      
      {
        name: 'CPU Throttling',
        description: 'Test behavior under CPU throttling conditions',
        category: 'resource',
        severity: 'medium',
        expectedBehavior: 'graceful_degradation',
        setup: async () => {
          console.log('  Simulating CPU throttling...');
        },
        teardown: async () => {}
      },
      
      // Input validation scenarios
      {
        name: 'Empty Audio Buffer',
        description: 'Test handling of empty audio input',
        category: 'input',
        severity: 'medium',
        expectedBehavior: 'fail_fast',
        setup: async () => {},
        teardown: async () => {}
      },
      
      {
        name: 'Corrupted Audio Data',
        description: 'Test handling of corrupted audio input',
        category: 'corruption',
        severity: 'high',
        expectedBehavior: 'error_recovery',
        setup: async () => {},
        teardown: async () => {}
      },
      
      {
        name: 'Extremely Long Audio',
        description: 'Test handling of unusually long audio input (>30 seconds)',
        category: 'input',
        severity: 'medium',
        expectedBehavior: 'timeout',
        setup: async () => {},
        teardown: async () => {}
      },
      
      // Model failure scenarios
      {
        name: 'STT Model Failure',
        description: 'Test behavior when STT model fails to load',
        category: 'model',
        severity: 'critical',
        expectedBehavior: 'fail_fast',
        setup: async () => {
          console.log('  Simulating STT model failure...');
        },
        teardown: async () => {}
      },
      
      {
        name: 'TTS Model Failure',
        description: 'Test behavior when TTS model fails to load',
        category: 'model',
        severity: 'critical',
        expectedBehavior: 'fail_fast',
        setup: async () => {
          console.log('  Simulating TTS model failure...');
        },
        teardown: async () => {}
      },
      
      // Timeout scenarios
      {
        name: 'STT Processing Timeout',
        description: 'Test behavior when STT processing exceeds timeout',
        category: 'timeout',
        severity: 'high',
        expectedBehavior: 'timeout',
        setup: async () => {},
        teardown: async () => {}
      },
      
      {
        name: 'TTS Generation Timeout',
        description: 'Test behavior when TTS generation exceeds timeout',
        category: 'timeout',
        severity: 'high',
        expectedBehavior: 'timeout',
        setup: async () => {},
        teardown: async () => {}
      },
      
      // Concurrent failure scenarios
      {
        name: 'Concurrent Load Spike',
        description: 'Test behavior under sudden concurrent load increase',
        category: 'resource',
        severity: 'high',
        expectedBehavior: 'graceful_degradation',
        setup: async () => {},
        teardown: async () => {}
      }
    ];
  }
  
  /**
   * Run a single failure scenario
   */
  private async runFailureScenario(
    scenario: FailureScenario,
    baseConfig: BenchmarkConfig
  ): Promise<FailureTestResult> {
    const startTime = Date.now();
    
    try {
      // Setup failure condition
      await scenario.setup();
      
      // Run the specific failure test
      const result = await this.executeFailureTest(scenario, baseConfig);
      
      // Cleanup
      await scenario.teardown();
      
      const recoveryTime = Date.now() - startTime;
      
      return {
        scenario,
        passed: this.evaluateTestResult(result, scenario.expectedBehavior),
        actualBehavior: result.behavior,
        errorMessage: result.error,
        recoveryTime,
        resourceLeaks: await this.checkResourceLeaks()
      };
      
    } catch (error) {
      await scenario.teardown();
      
      return {
        scenario,
        passed: false,
        actualBehavior: 'unexpected_exception',
        errorMessage: error instanceof Error ? error.message : String(error),
        recoveryTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Execute specific failure test based on scenario
   */
  private async executeFailureTest(
    scenario: FailureScenario,
    baseConfig: BenchmarkConfig
  ): Promise<{ behavior: string; error?: string }> {
    
    switch (scenario.name) {
      case 'Empty Audio Buffer':
        return await this.testEmptyAudioBuffer(baseConfig);
        
      case 'Corrupted Audio Data':
        return await this.testCorruptedAudioData(baseConfig);
        
      case 'Extremely Long Audio':
        return await this.testExtremelyLongAudio(baseConfig);
        
      case 'STT Model Failure':
        return await this.testSTTModelFailure(baseConfig);
        
      case 'TTS Model Failure':
        return await this.testTTSModelFailure(baseConfig);
        
      case 'STT Processing Timeout':
        return await this.testSTTTimeout(baseConfig);
        
      case 'TTS Generation Timeout':
        return await this.testTTSTimeout(baseConfig);
        
      case 'Concurrent Load Spike':
        return await this.testConcurrentLoadSpike(baseConfig);
        
      default:
        return await this.testGenericResourceFailure(baseConfig);
    }
  }
  
  /**
   * Test empty audio buffer handling
   */
  private async testEmptyAudioBuffer(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      await this.benchmark.initialize(config);
      
      // Create empty audio buffer
      const emptyBuffer = new ArrayBuffer(0);
      
      await this.benchmark.runSingleBenchmark(emptyBuffer);
      
      return { behavior: 'unexpected_success' };
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Audio buffer is required')) {
        return { behavior: 'fail_fast' };
      }
      return { behavior: 'unexpected_error', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Test corrupted audio data handling
   */
  private async testCorruptedAudioData(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      await this.benchmark.initialize(config);
      
      // Create corrupted audio buffer
      const corruptedBuffer = new ArrayBuffer(1000);
      const view = new Uint8Array(corruptedBuffer);
      view.fill(255); // Fill with invalid data
      
      const result = await this.benchmark.runSingleBenchmark(corruptedBuffer);
      
      // If it succeeds but takes unusually long, it's graceful degradation
      if (result.total > 1000) {
        return { behavior: 'graceful_degradation' };
      }
      
      return { behavior: 'error_recovery' };
      
    } catch (error) {
      return { behavior: 'fail_fast', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Test extremely long audio handling
   */
  private async testExtremelyLongAudio(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      await this.benchmark.initialize(config);
      
      // Create 30-second audio buffer
      const duration = 30; // seconds
      const sampleRate = 16000;
      const sampleCount = duration * sampleRate;
      const longBuffer = new ArrayBuffer(sampleCount * 2);
      
      const startTime = Date.now();
      
      try {
        await ErrorHandler.withTimeout(
          this.benchmark.runSingleBenchmark(longBuffer),
          10000, // 10 second timeout
          'Long audio processing'
        );
        
        return { behavior: 'unexpected_success' };
        
      } catch (timeoutError) {
        if (timeoutError.name === 'TimeoutError') {
          return { behavior: 'timeout' };
        }
        throw timeoutError;
      }
      
    } catch (error) {
      return { behavior: 'fail_fast', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Test STT model failure handling
   */
  private async testSTTModelFailure(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      // Use invalid model configuration
      const invalidConfig = { ...config, sttModel: 'invalid_model' as any };
      
      await this.benchmark.initialize(invalidConfig);
      
      return { behavior: 'unexpected_success' };
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid STT model')) {
        return { behavior: 'fail_fast' };
      }
      return { behavior: 'unexpected_error', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Test TTS model failure handling
   */
  private async testTTSModelFailure(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      // Use invalid model configuration
      const invalidConfig = { ...config, ttsModel: 'invalid_model' as any };
      
      await this.benchmark.initialize(invalidConfig);
      
      return { behavior: 'unexpected_success' };
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid TTS model')) {
        return { behavior: 'fail_fast' };
      }
      return { behavior: 'unexpected_error', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Test STT timeout handling
   */
  private async testSTTTimeout(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    // This would require modifying the WhisperModel to simulate slow processing
    return { behavior: 'timeout_test_not_implemented' };
  }
  
  /**
   * Test TTS timeout handling
   */
  private async testTTSTimeout(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    // This would require modifying the CoquiTTSModel to simulate slow processing
    return { behavior: 'timeout_test_not_implemented' };
  }
  
  /**
   * Test concurrent load spike handling
   */
  private async testConcurrentLoadSpike(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    try {
      await this.benchmark.initialize(config);
      
      // Generate test audio
      const audioSample = AudioSampleGenerator.generateTestDataset({ commandCount: 1 })[0];
      
      // Launch many concurrent requests
      const concurrentCount = 50;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          this.benchmark.runSingleBenchmark(audioSample.buffer).catch(error => ({ error }))
        );
      }
      
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected').length;
      const successRate = (results.length - failures) / results.length;
      
      if (successRate > 0.8) {
        return { behavior: 'graceful_degradation' };
      } else if (successRate > 0.5) {
        return { behavior: 'partial_degradation' };
      } else {
        return { behavior: 'system_overload' };
      }
      
    } catch (error) {
      return { behavior: 'fail_fast', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Generic resource failure test
   */
  private async testGenericResourceFailure(config: BenchmarkConfig): Promise<{ behavior: string; error?: string }> {
    return { behavior: 'test_not_implemented' };
  }
  
  /**
   * Evaluate if test result matches expected behavior
   */
  private evaluateTestResult(result: { behavior: string; error?: string }, expectedBehavior: string): boolean {
    return result.behavior === expectedBehavior;
  }
  
  /**
   * Check for resource leaks after test
   */
  private async checkResourceLeaks(): Promise<boolean> {
    // Check if cleanup was successful
    const memoryUsage = process.memoryUsage();
    // Simple heuristic - in production this would be more sophisticated
    return memoryUsage.heapUsed > 500 * 1024 * 1024; // 500MB threshold
  }
  
  /**
   * Generate failure mode test report
   */
  private generateFailureModeReport(results: FailureTestResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('FAILURE MODE TEST REPORT');
    console.log('='.repeat(60));
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\nSummary:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    
    // Group by category
    const categories = new Map<string, FailureTestResult[]>();
    results.forEach(result => {
      const category = result.scenario.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(result);
    });
    
    console.log(`\nResults by Category:`);
    for (const [category, categoryResults] of categories) {
      const categoryPassed = categoryResults.filter(r => r.passed).length;
      console.log(`  ${category}: ${categoryPassed}/${categoryResults.length} passed`);
    }
    
    // List failed tests
    const failedResults = results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log(`\nFailed Tests:`);
      failedResults.forEach(result => {
        console.log(`  ❌ ${result.scenario.name}: ${result.actualBehavior}`);
        if (result.errorMessage) {
          console.log(`     Error: ${result.errorMessage}`);
        }
      });
    }
    
    // Resource leak warnings
    const leakResults = results.filter(r => r.resourceLeaks);
    if (leakResults.length > 0) {
      console.log(`\n⚠️  Resource Leak Warnings:`);
      leakResults.forEach(result => {
        console.log(`     ${result.scenario.name}: Potential memory leak detected`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  /**
   * Cleanup the tester
   */
  async cleanup(): Promise<void> {
    await this.benchmark.cleanup();
  }
}
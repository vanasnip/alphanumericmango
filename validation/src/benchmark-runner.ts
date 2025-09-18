#!/usr/bin/env node

/**
 * VAL-003 Benchmark Runner
 * Executes comprehensive latency validation tests for local voice models
 */

import { VoicePipelineBenchmark, BenchmarkConfig } from './voice-pipeline-benchmark';
import { WhisperModelSize } from './models/whisper-model';
import { CoquiModelType } from './models/coqui-tts-model';
import { AudioSampleGenerator, AudioSample, DEVELOPER_COMMANDS } from './test-data/audio-sample-generator';
import { FailureModeTester } from './testing/failure-mode-tester';
import { IntegrationTester } from './testing/integration-tester';
import { CommandAccuracyValidator } from './testing/command-accuracy-validator';
import { HardwareVariationTester } from './testing/hardware-variation-tester';
import * as fs from 'fs';
import * as path from 'path';

interface TestScenario {
  name: string;
  sttModel: WhisperModelSize;
  ttsModel: CoquiModelType;
  iterations: number;
  description: string;
}

class BenchmarkRunner {
  private benchmark: VoicePipelineBenchmark;
  private resultsDir: string;
  
  constructor() {
    this.benchmark = new VoicePipelineBenchmark();
    this.resultsDir = path.join(__dirname, '../results');
    this.ensureResultsDirectory();
  }
  
  /**
   * Ensure results directory exists
   */
  private ensureResultsDirectory(): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }
  
  /**
   * Generate realistic test audio samples using real voice commands
   */
  private generateTestSamples(count: number = 10): { samples: AudioSample[], buffers: ArrayBuffer[] } {
    console.log(`Generating ${count} realistic audio samples...`);
    
    // Generate diverse, realistic audio samples
    const audioSamples = AudioSampleGenerator.generateTestDataset({
      commandCount: Math.min(count, DEVELOPER_COMMANDS.length),
      speakerVariety: true,
      environmentVariety: true,
      includeEdgeCases: count > 20 // Include edge cases for larger datasets
    });
    
    // Extract buffers for backward compatibility
    const buffers = audioSamples.map(sample => sample.buffer);
    
    console.log(`Generated samples with ${audioSamples.length} commands across ${new Set(audioSamples.map(s => s.command.category)).size} categories`);
    
    return { samples: audioSamples, buffers };
  }
  
  /**
   * Generate test samples for specific scenarios
   */
  private generateScenarioSamples(scenario: 'simple' | 'complex' | 'noisy' | 'diverse'): { samples: AudioSample[], buffers: ArrayBuffer[] } {
    let audioSamples: AudioSample[];
    
    switch (scenario) {
      case 'simple':
        // Only simple commands in quiet environments
        audioSamples = AudioSampleGenerator.generateTestDataset({
          commandCount: 20,
          speakerVariety: false,
          environmentVariety: false,
          includeEdgeCases: false
        }).filter(s => s.command.complexity === 'simple');
        break;
        
      case 'complex':
        // Complex commands with variety
        audioSamples = AudioSampleGenerator.generateTestDataset({
          commandCount: 30,
          speakerVariety: true,
          environmentVariety: true,
          includeEdgeCases: true
        }).filter(s => s.command.complexity === 'complex');
        break;
        
      case 'noisy':
        // All commands in noisy environments
        audioSamples = AudioSampleGenerator.generateTestDataset({
          commandCount: 25,
          speakerVariety: true,
          environmentVariety: false,
          includeEdgeCases: false
        }).filter(s => s.recordingConditions.noiseLevel > 60);
        break;
        
      case 'diverse':
      default:
        // Full diversity
        audioSamples = AudioSampleGenerator.generateTestDataset({
          commandCount: 40,
          speakerVariety: true,
          environmentVariety: true,
          includeEdgeCases: true
        });
        break;
    }
    
    const buffers = audioSamples.map(sample => sample.buffer);
    return { samples: audioSamples, buffers };
  }
  
  /**
   * Run Phase 1: Component Benchmarks
   */
  async runPhase1ComponentBenchmarks(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 1: Component Benchmarks');
    console.log('========================================\n');
    
    const { samples: audioSamples, buffers: testSamples } = this.generateTestSamples(30);
    
    // Test different Whisper models
    const whisperModels: WhisperModelSize[] = ['tiny', 'base', 'small'];
    const whisperResults: any[] = [];
    
    for (const model of whisperModels) {
      console.log(`\nTesting Whisper ${model} model...`);
      
      const config: BenchmarkConfig = {
        sttModel: model,
        ttsModel: 'vits',
        iterations: 1000, // Increased for statistical confidence
        warmupRuns: 50,   // Increased warmup runs
        environmentNoise: 45,
        concurrentRequests: 1
      };
      
      const result = await this.benchmark.runBenchmarkSuite(config, testSamples);
      whisperResults.push({
        model,
        p50: result.percentileAnalysis.p50.speechToText,
        p95: result.percentileAnalysis.p95.speechToText,
        successRate: result.successRate
      });
      
      await this.benchmark.cleanup();
    }
    
    // Test different Coqui models
    const coquiModels: CoquiModelType[] = ['tacotron2', 'vits', 'yourtts'];
    const coquiResults: any[] = [];
    
    for (const model of coquiModels) {
      console.log(`\nTesting Coqui ${model} model...`);
      
      const config: BenchmarkConfig = {
        sttModel: 'base',
        ttsModel: model,
        iterations: 1000, // Increased for statistical confidence
        warmupRuns: 50,   // Increased warmup runs
        environmentNoise: 45,
        concurrentRequests: 1
      };
      
      const result = await this.benchmark.runBenchmarkSuite(config, testSamples);
      coquiResults.push({
        model,
        p50: result.percentileAnalysis.p50.textToSpeech,
        p95: result.percentileAnalysis.p95.textToSpeech,
        successRate: result.successRate
      });
      
      await this.benchmark.cleanup();
    }
    
    // Save results
    this.saveResults('phase1-components', {
      whisper: whisperResults,
      coqui: coquiResults
    });
    
    // Print summary
    console.log('\n--- Phase 1 Summary ---');
    console.log('Whisper Models:');
    whisperResults.forEach(r => {
      console.log(`  ${r.model}: P50=${r.p50.toFixed(2)}ms, P95=${r.p95.toFixed(2)}ms`);
    });
    console.log('Coqui Models:');
    coquiResults.forEach(r => {
      console.log(`  ${r.model}: P50=${r.p50.toFixed(2)}ms, P95=${r.p95.toFixed(2)}ms`);
    });
  }
  
  /**
   * Run Phase 2: End-to-End Pipeline Tests
   */
  async runPhase2PipelineTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 2: End-to-End Pipeline Tests');
    console.log('========================================\n');
    
    const { samples: audioSamples, buffers: testSamples } = this.generateScenarioSamples('diverse');
    
    const scenarios: TestScenario[] = [
      {
        name: 'optimal',
        sttModel: 'tiny',
        ttsModel: 'tacotron2',
        iterations: 500, // Increased for end-to-end confidence
        description: 'Fastest models, lowest quality'
      },
      {
        name: 'balanced',
        sttModel: 'base',
        ttsModel: 'vits',
        iterations: 500, // Increased for end-to-end confidence
        description: 'Balanced speed and quality'
      },
      {
        name: 'quality',
        sttModel: 'small',
        ttsModel: 'yourtts',
        iterations: 500, // Increased for end-to-end confidence
        description: 'Highest quality, slower processing'
      }
    ];
    
    const pipelineResults: any[] = [];
    
    for (const scenario of scenarios) {
      console.log(`\nTesting scenario: ${scenario.name} - ${scenario.description}`);
      
      const config: BenchmarkConfig = {
        sttModel: scenario.sttModel,
        ttsModel: scenario.ttsModel,
        iterations: scenario.iterations,
        warmupRuns: 50, // Increased warmup runs
        environmentNoise: 45,
        concurrentRequests: 1
      };
      
      const result = await this.benchmark.runBenchmarkSuite(config, testSamples);
      
      pipelineResults.push({
        scenario: scenario.name,
        description: scenario.description,
        config: {
          stt: scenario.sttModel,
          tts: scenario.ttsModel
        },
        latency: {
          p50: result.percentileAnalysis.p50.total,
          p75: result.percentileAnalysis.p75.total,
          p90: result.percentileAnalysis.p90.total,
          p95: result.percentileAnalysis.p95.total,
          p99: result.percentileAnalysis.p99.total
        },
        successRate: result.successRate,
        resourceUsage: result.resourceUsage
      });
      
      await this.benchmark.cleanup();
    }
    
    // Save results
    this.saveResults('phase2-pipeline', pipelineResults);
    
    // Print summary
    console.log('\n--- Phase 2 Summary ---');
    pipelineResults.forEach(r => {
      console.log(`${r.scenario} (${r.config.stt}+${r.config.tts}):`);
      console.log(`  P50: ${r.latency.p50.toFixed(2)}ms`);
      console.log(`  P95: ${r.latency.p95.toFixed(2)}ms`);
      console.log(`  Success Rate: ${r.successRate.toFixed(1)}%`);
      console.log(`  Target Met (<250ms P95): ${r.latency.p95 < 250 ? '✅ YES' : '❌ NO'}`);
    });
  }
  
  /**
   * Run Phase 3: Load and Concurrency Tests
   */
  async runPhase3LoadTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 3: Load and Concurrency Tests');
    console.log('========================================\n');
    
    const { samples: audioSamples, buffers: testSamples } = this.generateScenarioSamples('simple');
    const concurrencyLevels = [1, 5, 10, 20];
    const loadResults: any[] = [];
    
    for (const level of concurrencyLevels) {
      console.log(`\nTesting with ${level} concurrent requests...`);
      
      const config: BenchmarkConfig = {
        sttModel: 'base',
        ttsModel: 'vits',
        iterations: 200, // Increased for load test confidence
        warmupRuns: 20,  // Increased warmup for load tests
        environmentNoise: 45,
        concurrentRequests: level
      };
      
      const result = await this.benchmark.runConcurrentLoadTest(config, testSamples);
      loadResults.push(result);
      
      await this.benchmark.cleanup();
    }
    
    // Save results
    this.saveResults('phase3-load', loadResults);
    
    // Print summary
    console.log('\n--- Phase 3 Summary ---');
    console.log('Concurrency | Avg Latency | P95 Latency | Throughput | Error Rate');
    console.log('-----------|-------------|-------------|------------|------------');
    loadResults.forEach(r => {
      console.log(
        `${r.concurrencyLevel.toString().padEnd(10)} | ` +
        `${r.avgLatency.toFixed(2).padEnd(11)}ms | ` +
        `${r.p95Latency.toFixed(2).padEnd(11)}ms | ` +
        `${r.throughput.toFixed(2).padEnd(10)}/s | ` +
        `${r.errorRate.toFixed(1)}%`
      );
    });
  }
  
  /**
   * Run Phase 4: Environmental Tests
   */
  async runPhase4EnvironmentalTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 4: Environmental Tests');
    console.log('========================================\n');
    
    const { samples: audioSamples, buffers: testSamples } = this.generateScenarioSamples('noisy');
    const noiseProfiles = [
      { name: 'quiet-office', dbLevel: 35 },
      { name: 'normal-office', dbLevel: 55 },
      { name: 'noisy-environment', dbLevel: 65 }
    ];
    
    const baseConfig: BenchmarkConfig = {
      sttModel: 'base',
      ttsModel: 'vits',
      iterations: 300, // Increased for environmental test confidence
      warmupRuns: 30,  // Increased warmup for environmental tests
      environmentNoise: 45,
      concurrentRequests: 1
    };
    
    const noiseResults = await this.benchmark.testNoiseRobustness(
      baseConfig,
      noiseProfiles,
      testSamples
    );
    
    // Save results
    const resultsArray = Array.from(noiseResults.entries()).map(([profile, result]) => ({
      profile,
      latency: {
        p50: result.percentileAnalysis.p50.total,
        p95: result.percentileAnalysis.p95.total
      },
      successRate: result.successRate
    }));
    
    this.saveResults('phase4-environmental', resultsArray);
    
    // Print summary
    console.log('\n--- Phase 4 Summary ---');
    console.log('Environment | Noise (dB) | P50 Latency | P95 Latency | Success Rate');
    console.log('------------|------------|-------------|-------------|-------------');
    resultsArray.forEach(r => {
      const profile = noiseProfiles.find(p => p.name === r.profile);
      console.log(
        `${r.profile.padEnd(11)} | ` +
        `${(profile?.dbLevel || 0).toString().padEnd(10)} | ` +
        `${r.latency.p50.toFixed(2).padEnd(11)}ms | ` +
        `${r.latency.p95.toFixed(2).padEnd(11)}ms | ` +
        `${r.successRate.toFixed(1)}%`
      );
    });
    
    await this.benchmark.cleanup();
  }
  
  /**
   * Run Phase 5: Failure Mode Testing
   */
  async runPhase5FailureModeTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 5: Failure Mode Testing');
    console.log('========================================\n');
    
    const failureTester = new FailureModeTester();
    
    const baseConfig: BenchmarkConfig = {
      sttModel: 'base',
      ttsModel: 'vits',
      iterations: 10,
      warmupRuns: 2,
      environmentNoise: 45,
      concurrentRequests: 1
    };
    
    try {
      const failureResults = await failureTester.runFailureModeTests(baseConfig);
      
      // Save failure test results
      this.saveResults('phase5-failure-modes', {
        timestamp: new Date().toISOString(),
        totalTests: failureResults.length,
        passedTests: failureResults.filter(r => r.passed).length,
        failedTests: failureResults.filter(r => !r.passed).length,
        results: failureResults.map(r => ({
          scenario: r.scenario.name,
          category: r.scenario.category,
          severity: r.scenario.severity,
          expected: r.scenario.expectedBehavior,
          actual: r.actualBehavior,
          passed: r.passed,
          error: r.errorMessage,
          recoveryTime: r.recoveryTime,
          resourceLeaks: r.resourceLeaks
        }))
      });
      
      // Print summary
      const passedCount = failureResults.filter(r => r.passed).length;
      const totalCount = failureResults.length;
      const successRate = (passedCount / totalCount) * 100;
      
      console.log('\n--- Phase 5 Summary ---');
      console.log(`Failure Mode Tests: ${passedCount}/${totalCount} passed (${successRate.toFixed(1)}%)`);
      
      // Critical failures
      const criticalFailures = failureResults.filter(r => 
        !r.passed && r.scenario.severity === 'critical'
      );
      
      if (criticalFailures.length > 0) {
        console.log(`❌ Critical Failures: ${criticalFailures.length}`);
        criticalFailures.forEach(f => {
          console.log(`  - ${f.scenario.name}: ${f.actualBehavior}`);
        });
      } else {
        console.log('✅ No critical failures detected');
      }
      
      // Resource leaks
      const resourceLeaks = failureResults.filter(r => r.resourceLeaks);
      if (resourceLeaks.length > 0) {
        console.log(`⚠️  Resource Leaks: ${resourceLeaks.length} tests`);
      }
      
    } catch (error) {
      console.error('Failure mode testing failed:', error);
    } finally {
      await failureTester.cleanup();
    }
  }
  
  /**
   * Run Phase 6: Integration Testing
   */
  async runPhase6IntegrationTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 6: Integration Testing');
    console.log('========================================\n');
    
    const integrationTester = new IntegrationTester();
    const accuracyValidator = new CommandAccuracyValidator();
    const { samples: audioSamples, buffers: testSamples } = this.generateTestSamples(20);
    
    const baseConfig: BenchmarkConfig = {
      sttModel: 'base',
      ttsModel: 'vits',
      iterations: 100,
      warmupRuns: 10,
      environmentNoise: 45,
      concurrentRequests: 1
    };
    
    try {
      // Run integration tests
      const integrationResults = await integrationTester.runIntegrationTests(baseConfig, testSamples);
      
      // Run command accuracy validation
      console.log('\n🎯 Running command accuracy validation...');
      const accuracyResults = await accuracyValidator.runAccuracyValidation(baseConfig);
      
      // Save integration test results
      this.saveResults('phase6-integration', {
        timestamp: new Date().toISOString(),
        totalTests: integrationResults.length,
        passedTests: integrationResults.filter(r => r.passed).length,
        failedTests: integrationResults.filter(r => !r.passed).length,
        results: integrationResults.map(r => ({
          scenario: r.scenario.name,
          category: r.scenario.category,
          description: r.scenario.description,
          validations: r.scenario.validations,
          passed: r.passed,
          errors: r.errors,
          performance: r.performanceMetrics,
          dataFlowIntegrity: r.dataFlowIntegrity
        }))
      });
      
      // Save accuracy validation results
      this.saveResults('phase6-accuracy', {
        timestamp: new Date().toISOString(),
        totalCommands: accuracyResults.length,
        passedCommands: accuracyResults.filter(r => r.passed).length,
        failedCommands: accuracyResults.filter(r => !r.passed).length,
        averageKeywordAccuracy: accuracyResults.reduce((sum, r) => sum + r.accuracyMetrics.keywordMatchPercentage, 0) / accuracyResults.length,
        averageLatencyMs: accuracyResults.reduce((sum, r) => sum + r.latencyMs, 0) / accuracyResults.length,
        results: accuracyResults.map(r => ({
          scenario: r.scenario.name,
          category: r.scenario.category,
          expectedCommand: r.expectedText,
          transcribedCommand: r.transcribedText,
          passed: r.passed,
          keywordAccuracy: r.accuracyMetrics.keywordMatchPercentage,
          latencyMs: r.latencyMs,
          confidence: r.confidence,
          errors: r.errors
        }))
      });
      
      // Print summary
      const passedCount = integrationResults.filter(r => r.passed).length;
      const totalCount = integrationResults.length;
      const successRate = (passedCount / totalCount) * 100;
      
      const accuracyPassedCount = accuracyResults.filter(r => r.passed).length;
      const accuracyTotalCount = accuracyResults.length;
      const accuracySuccessRate = (accuracyPassedCount / accuracyTotalCount) * 100;
      const avgKeywordAccuracy = accuracyResults.reduce((sum, r) => sum + r.accuracyMetrics.keywordMatchPercentage, 0) / accuracyResults.length * 100;
      
      console.log('\n--- Phase 6 Summary ---');
      console.log(`Integration Tests: ${passedCount}/${totalCount} passed (${successRate.toFixed(1)}%)`);
      console.log(`Command Accuracy: ${accuracyPassedCount}/${accuracyTotalCount} passed (${accuracySuccessRate.toFixed(1)}%)`);
      console.log(`Average Keyword Accuracy: ${avgKeywordAccuracy.toFixed(1)}%`);
      
      // Data flow failures
      const dataFlowFailures = integrationResults.filter(r => 
        !r.passed && r.dataFlowIntegrity === false
      );
      
      if (dataFlowFailures.length > 0) {
        console.log(`❌ Data Flow Failures: ${dataFlowFailures.length}`);
        dataFlowFailures.forEach(f => {
          console.log(`  - ${f.scenario.name}: Data integrity compromised`);
        });
      } else {
        console.log('✅ All data flow integrity tests passed');
      }
      
      // Command accuracy failures by category
      const commandFailures = accuracyResults.filter(r => !r.passed);
      if (commandFailures.length > 0) {
        const failuresByCategory = commandFailures.reduce((acc, f) => {
          acc[f.scenario.category] = (acc[f.scenario.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`❌ Command Accuracy Failures: ${commandFailures.length}`);
        Object.entries(failuresByCategory).forEach(([category, count]) => {
          console.log(`  - ${category}: ${count} failures`);
        });
      } else {
        console.log('✅ All command accuracy tests passed');
      }
      
      // Performance regressions
      const perfRegressions = integrationResults.filter(r => 
        r.performanceMetrics && r.performanceMetrics.latency > 300
      );
      
      if (perfRegressions.length > 0) {
        console.log(`⚠️  Performance Regressions: ${perfRegressions.length} tests`);
      }
      
    } catch (error) {
      console.error('Integration testing failed:', error);
    } finally {
      await integrationTester.cleanup();
      await accuracyValidator.cleanup();
    }
  }
  
  /**
   * Run Phase 7: Hardware Variation Testing
   */
  async runPhase7HardwareVariationTests(): Promise<void> {
    console.log('\n========================================');
    console.log('PHASE 7: Hardware Variation Testing');
    console.log('========================================\n');
    
    const hardwareTester = new HardwareVariationTester();
    const { samples: audioSamples, buffers: testSamples } = this.generateTestSamples(30);
    
    const baseConfig: BenchmarkConfig = {
      sttModel: 'base',
      ttsModel: 'vits',
      iterations: 50,
      warmupRuns: 5,
      environmentNoise: 45,
      concurrentRequests: 1
    };
    
    try {
      const hardwareResults = await hardwareTester.runHardwareVariationTests(baseConfig, testSamples);
      
      // Save hardware variation test results
      this.saveResults('phase7-hardware', {
        timestamp: new Date().toISOString(),
        totalScenarios: hardwareResults.length,
        passedScenarios: hardwareResults.filter(r => r.passed).length,
        failedScenarios: hardwareResults.filter(r => !r.passed).length,
        results: hardwareResults.map(r => ({
          scenario: r.scenario.name,
          hardwareProfile: r.scenario.profile.name,
          testType: r.scenario.testType,
          passed: r.passed,
          latency: r.metrics.latency,
          performance: r.metrics.performance,
          hardware: r.metrics.hardware,
          errors: r.errors,
          baselineComparison: r.baselineComparison
        }))
      });
      
      // Print summary
      const passedCount = hardwareResults.filter(r => r.passed).length;
      const totalCount = hardwareResults.length;
      const successRate = (passedCount / totalCount) * 100;
      
      console.log('\n--- Phase 7 Summary ---');
      console.log(`Hardware Tests: ${passedCount}/${totalCount} passed (${successRate.toFixed(1)}%)`);
      
      // Group results by test type
      const resultsByType = hardwareResults.reduce((acc, r) => {
        const type = r.scenario.testType;
        acc[type] = acc[type] || [];
        acc[type].push(r);
        return acc;
      }, {} as Record<string, any[]>);
      
      Object.entries(resultsByType).forEach(([testType, results]) => {
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        const rate = (passed / total) * 100;
        console.log(`  ${testType}: ${passed}/${total} passed (${rate.toFixed(1)}%)`);
      });
      
      // Hardware stress failures
      const stressFailures = hardwareResults.filter(r => 
        !r.passed && (r.scenario.testType === 'stress' || r.scenario.testType === 'memory_pressure')
      );
      
      if (stressFailures.length > 0) {
        console.log(`❌ Stress Test Failures: ${stressFailures.length}`);
        stressFailures.forEach(f => {
          const degradation = f.metrics.performance.degradationPercent.toFixed(1);
          console.log(`  - ${f.scenario.name}: ${degradation}% degradation`);
        });
      } else {
        console.log('✅ All stress tests passed');
      }
      
      // Performance regressions
      const perfRegressions = hardwareResults.filter(r => 
        r.metrics.performance.degradationPercent > 100
      );
      
      if (perfRegressions.length > 0) {
        console.log(`⚠️  Significant Performance Regressions: ${perfRegressions.length} tests`);
      }
      
      // Hardware issues detected
      const hardwareIssues = hardwareResults.filter(r => 
        r.metrics.hardware.thermalThrottling || 
        r.metrics.hardware.memoryPressure ||
        r.metrics.hardware.diskIOThrottling
      );
      
      if (hardwareIssues.length > 0) {
        console.log(`⚠️  Hardware Issues Detected: ${hardwareIssues.length} tests`);
        hardwareIssues.forEach(h => {
          const issues = [];
          if (h.metrics.hardware.thermalThrottling) issues.push('thermal throttling');
          if (h.metrics.hardware.memoryPressure) issues.push('memory pressure');
          if (h.metrics.hardware.diskIOThrottling) issues.push('disk I/O throttling');
          console.log(`  - ${h.scenario.name}: ${issues.join(', ')}`);
        });
      }
      
    } catch (error) {
      console.error('Hardware variation testing failed:', error);
    } finally {
      await hardwareTester.cleanup();
    }
  }
  
  /**
   * Generate final validation report
   */
  async generateValidationReport(): Promise<void> {
    console.log('\n========================================');
    console.log('FINAL VALIDATION REPORT');
    console.log('========================================\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      validation: 'VAL-003',
      title: 'Local Voice Model Latency Validation',
      target: {
        total: '<250ms P95',
        stt: '<100ms',
        tts: '<150ms'
      },
      conclusion: '',
      recommendations: [],
      goNoGo: ''
    };
    
    // Analyze results from all phases
    const phase2Results = this.loadResults('phase2-pipeline');
    
    if (phase2Results) {
      const balancedScenario = phase2Results.find((r: any) => r.scenario === 'balanced');
      
      if (balancedScenario && balancedScenario.latency.p95 < 250) {
        report.conclusion = 'Target latency of <250ms P95 is ACHIEVABLE with local models';
        report.goNoGo = '✅ GO';
        report.recommendations = [
          'Use Whisper base model for balanced accuracy/speed',
          'Use Coqui VITS for good quality/speed tradeoff',
          'Implement model caching and warmup',
          'Consider quantization for further optimization'
        ];
      } else {
        report.conclusion = 'Target latency of <250ms P95 requires additional optimization';
        report.goNoGo = '⚠️ CONDITIONAL GO';
        report.recommendations = [
          'Implement pipeline parallelization',
          'Use smaller Whisper models with accuracy tradeoff',
          'Cache common TTS responses',
          'Consider hardware acceleration (GPU/NPU)'
        ];
      }
    }
    
    // Save final report
    this.saveResults('final-validation-report', report);
    
    // Print report
    console.log('Target Requirements:');
    console.log(`  Total Latency: ${report.target.total}`);
    console.log(`  STT: ${report.target.stt}`);
    console.log(`  TTS: ${report.target.tts}`);
    console.log('');
    console.log(`Conclusion: ${report.conclusion}`);
    console.log('');
    console.log('Recommendations:');
    report.recommendations.forEach(r => console.log(`  • ${r}`));
    console.log('');
    console.log(`Go/No-Go Decision: ${report.goNoGo}`);
  }
  
  /**
   * Save results to file
   */
  private saveResults(name: string, data: any): void {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `${name}-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`Results saved to: ${filepath}`);
  }
  
  /**
   * Load results from file
   */
  private loadResults(name: string): any {
    const files = fs.readdirSync(this.resultsDir);
    const matchingFile = files
      .filter(f => f.startsWith(name))
      .sort()
      .pop();
    
    if (matchingFile) {
      const filepath = path.join(this.resultsDir, matchingFile);
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
    
    return null;
  }
  
  /**
   * Run all benchmark phases
   */
  async runAllPhases(): Promise<void> {
    console.log('Starting VAL-003 Latency Validation Benchmarks');
    console.log('==============================================');
    
    try {
      await this.runPhase1ComponentBenchmarks();
      await this.runPhase2PipelineTests();
      await this.runPhase3LoadTests();
      await this.runPhase4EnvironmentalTests();
      await this.runPhase5FailureModeTests();
      await this.runPhase6IntegrationTests();
      await this.runPhase7HardwareVariationTests();
      await this.generateValidationReport();
      
      console.log('\n✅ All benchmark phases completed successfully!');
    } catch (error) {
      console.error('\n❌ Benchmark failed:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const runner = new BenchmarkRunner();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const phase = args[0];
  
  (async () => {
    switch (phase) {
      case 'phase1':
        await runner.runPhase1ComponentBenchmarks();
        break;
      case 'phase2':
        await runner.runPhase2PipelineTests();
        break;
      case 'phase3':
        await runner.runPhase3LoadTests();
        break;
      case 'phase4':
        await runner.runPhase4EnvironmentalTests();
        break;
      case 'phase5':
        await runner.runPhase5FailureModeTests();
        break;
      case 'phase6':
        await runner.runPhase6IntegrationTests();
        break;
      case 'phase7':
        await runner.runPhase7HardwareVariationTests();
        break;
      case 'report':
        await runner.generateValidationReport();
        break;
      default:
        await runner.runAllPhases();
    }
  })();
}

export default BenchmarkRunner;
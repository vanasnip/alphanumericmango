/**
 * VAL-003 Hardware Variation Tester
 * Tests voice pipeline performance across different hardware configurations
 */

import { BenchmarkConfig } from '../voice-pipeline-benchmark';
import { WhisperModel } from '../models/whisper-model';
import { CoquiTTSModel } from '../models/coqui-tts-model';
import { SystemProfiler } from '../utils/system-profiler';
import { ValidationError } from '../errors';
import { AudioSample } from '../test-data/audio-sample-generator';

export interface HardwareProfile {
  name: string;
  description: string;
  category: 'low_end' | 'mid_range' | 'high_end' | 'server';
  specs: {
    cpuCores: number;
    cpuFrequencyGHz: number;
    ramGB: number;
    cpuArchitecture: 'x86_64' | 'arm64' | 'arm32';
    hasGPU: boolean;
    gpuMemoryGB?: number;
    storageType: 'hdd' | 'ssd' | 'nvme';
  };
  limitations: {
    maxConcurrentProcesses: number;
    memoryPressureThreshold: number; // GB
    thermalThrottlingTemp: number; // Celsius
  };
  expectedPerformance: {
    whisperLatencyMs: {
      p50: number;
      p95: number;
    };
    ttsLatencyMs: {
      p50: number;
      p95: number;
    };
    totalLatencyMs: {
      p50: number;
      p95: number;
    };
  };
}

export interface HardwareTestScenario {
  name: string;
  profile: HardwareProfile;
  testType: 'baseline' | 'stress' | 'memory_pressure' | 'thermal' | 'concurrent_load';
  configuration: {
    modelSize: 'tiny' | 'base' | 'small' | 'medium';
    concurrentRequests: number;
    iterations: number;
    artificialMemoryPressure?: number; // GB to allocate
    artificialCpuLoad?: number; // % CPU to consume
  };
  acceptanceCriteria: {
    maxLatencyDegradation: number; // % vs baseline
    minSuccessRate: number; // %
    maxMemoryUsage: number; // GB
  };
}

export interface HardwareTestResult {
  scenario: HardwareTestScenario;
  passed: boolean;
  metrics: {
    latency: {
      whisper: { p50: number; p95: number };
      tts: { p50: number; p95: number };
      total: { p50: number; p95: number };
    };
    performance: {
      successRate: number;
      memoryUsageGB: number;
      cpuUsagePercent: number;
      degradationPercent: number;
    };
    hardware: {
      thermalThrottling: boolean;
      memoryPressure: boolean;
      diskIOThrottling: boolean;
    };
  };
  errors: string[];
  baselineComparison?: {
    latencyIncrease: number;
    performanceDegradation: number;
  };
}

export class HardwareVariationTester {
  private systemProfiler: SystemProfiler;
  private whisperModel: WhisperModel | null = null;
  private ttsModel: CoquiTTSModel | null = null;
  private baselineResults: Map<string, any> = new Map();
  private artificialLoads: Array<{ type: string; handle: any }> = [];

  constructor() {
    this.systemProfiler = new SystemProfiler();
  }

  /**
   * Generate hardware test profiles
   */
  generateHardwareProfiles(): HardwareProfile[] {
    return [
      {
        name: 'Development Laptop (Low-End)',
        description: 'Typical budget development laptop',
        category: 'low_end',
        specs: {
          cpuCores: 4,
          cpuFrequencyGHz: 2.0,
          ramGB: 8,
          cpuArchitecture: 'x86_64',
          hasGPU: false,
          storageType: 'ssd'
        },
        limitations: {
          maxConcurrentProcesses: 2,
          memoryPressureThreshold: 6,
          thermalThrottlingTemp: 85
        },
        expectedPerformance: {
          whisperLatencyMs: { p50: 120, p95: 180 },
          ttsLatencyMs: { p50: 180, p95: 250 },
          totalLatencyMs: { p50: 320, p95: 450 }
        }
      },
      {
        name: 'MacBook Pro M1 (Mid-Range)',
        description: 'Apple Silicon development machine',
        category: 'mid_range',
        specs: {
          cpuCores: 8,
          cpuFrequencyGHz: 3.2,
          ramGB: 16,
          cpuArchitecture: 'arm64',
          hasGPU: true,
          gpuMemoryGB: 16, // Unified memory
          storageType: 'nvme'
        },
        limitations: {
          maxConcurrentProcesses: 4,
          memoryPressureThreshold: 12,
          thermalThrottlingTemp: 95
        },
        expectedPerformance: {
          whisperLatencyMs: { p50: 80, p95: 120 },
          ttsLatencyMs: { p50: 120, p95: 180 },
          totalLatencyMs: { p50: 220, p95: 320 }
        }
      },
      {
        name: 'Gaming Desktop (High-End)',
        description: 'High-performance desktop for development',
        category: 'high_end',
        specs: {
          cpuCores: 16,
          cpuFrequencyGHz: 4.5,
          ramGB: 32,
          cpuArchitecture: 'x86_64',
          hasGPU: true,
          gpuMemoryGB: 12,
          storageType: 'nvme'
        },
        limitations: {
          maxConcurrentProcesses: 8,
          memoryPressureThreshold: 24,
          thermalThrottlingTemp: 90
        },
        expectedPerformance: {
          whisperLatencyMs: { p50: 60, p95: 90 },
          ttsLatencyMs: { p50: 90, p95: 130 },
          totalLatencyMs: { p50: 170, p95: 240 }
        }
      },
      {
        name: 'Cloud Instance (Server)',
        description: 'Cloud computing instance',
        category: 'server',
        specs: {
          cpuCores: 8,
          cpuFrequencyGHz: 2.5,
          ramGB: 64,
          cpuArchitecture: 'x86_64',
          hasGPU: false,
          storageType: 'ssd'
        },
        limitations: {
          maxConcurrentProcesses: 16,
          memoryPressureThreshold: 48,
          thermalThrottlingTemp: 80
        },
        expectedPerformance: {
          whisperLatencyMs: { p50: 100, p95: 150 },
          ttsLatencyMs: { p50: 140, p95: 200 },
          totalLatencyMs: { p50: 260, p95: 370 }
        }
      }
    ];
  }

  /**
   * Generate test scenarios for hardware variations
   */
  generateHardwareTestScenarios(): HardwareTestScenario[] {
    const profiles = this.generateHardwareProfiles();
    const scenarios: HardwareTestScenario[] = [];

    profiles.forEach(profile => {
      // Baseline test
      scenarios.push({
        name: `${profile.name} - Baseline`,
        profile,
        testType: 'baseline',
        configuration: {
          modelSize: 'base',
          concurrentRequests: 1,
          iterations: 50
        },
        acceptanceCriteria: {
          maxLatencyDegradation: 0, // Baseline has no degradation
          minSuccessRate: 95,
          maxMemoryUsage: profile.specs.ramGB * 0.7
        }
      });

      // Memory pressure test
      scenarios.push({
        name: `${profile.name} - Memory Pressure`,
        profile,
        testType: 'memory_pressure',
        configuration: {
          modelSize: 'base',
          concurrentRequests: 1,
          iterations: 30,
          artificialMemoryPressure: profile.limitations.memoryPressureThreshold
        },
        acceptanceCriteria: {
          maxLatencyDegradation: 50, // 50% increase allowed under memory pressure
          minSuccessRate: 80,
          maxMemoryUsage: profile.specs.ramGB * 0.9
        }
      });

      // Concurrent load test
      scenarios.push({
        name: `${profile.name} - Concurrent Load`,
        profile,
        testType: 'concurrent_load',
        configuration: {
          modelSize: 'base',
          concurrentRequests: profile.limitations.maxConcurrentProcesses,
          iterations: 20
        },
        acceptanceCriteria: {
          maxLatencyDegradation: 100, // 100% increase allowed under concurrent load
          minSuccessRate: 70,
          maxMemoryUsage: profile.specs.ramGB * 0.8
        }
      });

      // CPU stress test
      scenarios.push({
        name: `${profile.name} - CPU Stress`,
        profile,
        testType: 'stress',
        configuration: {
          modelSize: 'base',
          concurrentRequests: 1,
          iterations: 20,
          artificialCpuLoad: 80 // 80% CPU load
        },
        acceptanceCriteria: {
          maxLatencyDegradation: 75, // 75% increase allowed under CPU stress
          minSuccessRate: 75,
          maxMemoryUsage: profile.specs.ramGB * 0.7
        }
      });

      // Model size variation (if high-end)
      if (profile.category === 'high_end' || profile.category === 'server') {
        scenarios.push({
          name: `${profile.name} - Large Model`,
          profile,
          testType: 'stress',
          configuration: {
            modelSize: 'small',
            concurrentRequests: 1,
            iterations: 20
          },
          acceptanceCriteria: {
            maxLatencyDegradation: 200, // 200% increase for larger model
            minSuccessRate: 90,
            maxMemoryUsage: profile.specs.ramGB * 0.8
          }
        });
      }
    });

    return scenarios;
  }

  /**
   * Run hardware variation tests
   */
  async runHardwareVariationTests(baseConfig: BenchmarkConfig, testSamples: Buffer[]): Promise<HardwareTestResult[]> {
    console.log('🖥️  Starting hardware variation testing...');
    
    const scenarios = this.generateHardwareTestScenarios();
    const results: HardwareTestResult[] = [];

    // Detect current hardware profile
    const currentHardware = await this.detectCurrentHardware();
    console.log(`   Detected hardware: ${currentHardware.name}`);

    // Filter scenarios to match current hardware
    const relevantScenarios = scenarios.filter(s => 
      this.isHardwareProfileCompatible(s.profile, currentHardware)
    );

    console.log(`   Running ${relevantScenarios.length} relevant scenarios...`);

    for (const scenario of relevantScenarios) {
      console.log(`   Testing: ${scenario.name}`);
      
      try {
        const result = await this.runHardwareTestScenario(scenario, baseConfig, testSamples);
        results.push(result);
        
        const status = result.passed ? '✅' : '❌';
        const degradation = result.metrics.performance.degradationPercent.toFixed(1);
        console.log(`     ${status} ${degradation}% degradation, ${result.metrics.performance.successRate.toFixed(1)}% success`);
        
      } catch (error) {
        console.log(`     ❌ Failed: ${error}`);
        results.push({
          scenario,
          passed: false,
          metrics: {
            latency: {
              whisper: { p50: 0, p95: 0 },
              tts: { p50: 0, p95: 0 },
              total: { p50: 0, p95: 0 }
            },
            performance: {
              successRate: 0,
              memoryUsageGB: 0,
              cpuUsagePercent: 0,
              degradationPercent: 999
            },
            hardware: {
              thermalThrottling: false,
              memoryPressure: false,
              diskIOThrottling: false
            }
          },
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    return results;
  }

  /**
   * Run a single hardware test scenario
   */
  private async runHardwareTestScenario(
    scenario: HardwareTestScenario,
    baseConfig: BenchmarkConfig,
    testSamples: Buffer[]
  ): Promise<HardwareTestResult> {
    
    // Apply artificial loads if specified
    await this.applyArtificialLoads(scenario.configuration);

    try {
      // Initialize models with scenario-specific configuration
      this.whisperModel = new WhisperModel(scenario.configuration.modelSize);
      await this.whisperModel.initialize();

      this.ttsModel = new CoquiTTSModel('vits');
      await this.ttsModel.initialize();

      // Run performance test
      const metrics = await this.measureHardwarePerformance(scenario, testSamples);

      // Get baseline for comparison
      const baselineKey = `${scenario.profile.name}-baseline`;
      let baselineComparison;
      
      if (scenario.testType === 'baseline') {
        this.baselineResults.set(baselineKey, metrics);
      } else {
        const baseline = this.baselineResults.get(baselineKey);
        if (baseline) {
          baselineComparison = {
            latencyIncrease: ((metrics.latency.total.p95 - baseline.latency.total.p95) / baseline.latency.total.p95) * 100,
            performanceDegradation: metrics.performance.degradationPercent
          };
        }
      }

      // Evaluate acceptance criteria
      const passed = this.evaluateHardwareAcceptance(metrics, scenario.acceptanceCriteria);

      return {
        scenario,
        passed,
        metrics,
        errors: passed ? [] : this.generateHardwareErrorMessages(metrics, scenario.acceptanceCriteria),
        baselineComparison
      };

    } finally {
      await this.cleanupArtificialLoads();
      if (this.whisperModel) {
        await this.whisperModel.dispose();
        this.whisperModel = null;
      }
      if (this.ttsModel) {
        await this.ttsModel.dispose();
        this.ttsModel = null;
      }
    }
  }

  /**
   * Measure hardware-specific performance metrics
   */
  private async measureHardwarePerformance(scenario: HardwareTestScenario, testSamples: Buffer[]) {
    const whisperLatencies: number[] = [];
    const ttsLatencies: number[] = [];
    const totalLatencies: number[] = [];
    let successCount = 0;

    const startMemory = await this.systemProfiler.getMemoryUsage();
    const startCpu = await this.systemProfiler.getCpuUsage();

    // Run test iterations
    for (let i = 0; i < scenario.configuration.iterations; i++) {
      const sample = testSamples[i % testSamples.length];
      
      try {
        // Measure Whisper latency
        const whisperStart = performance.now();
        const transcription = await this.whisperModel!.transcribe(sample);
        const whisperLatency = performance.now() - whisperStart;
        whisperLatencies.push(whisperLatency);

        // Measure TTS latency
        const ttsStart = performance.now();
        await this.ttsModel!.synthesize(transcription.text);
        const ttsLatency = performance.now() - ttsStart;
        ttsLatencies.push(ttsLatency);

        totalLatencies.push(whisperLatency + ttsLatency);
        successCount++;

      } catch (error) {
        // Log error but continue testing
        console.warn(`    Iteration ${i} failed: ${error}`);
      }
    }

    const endMemory = await this.systemProfiler.getMemoryUsage();
    const endCpu = await this.systemProfiler.getCpuUsage();

    // Calculate percentiles
    const whisperP50 = this.calculatePercentile(whisperLatencies, 50);
    const whisperP95 = this.calculatePercentile(whisperLatencies, 95);
    const ttsP50 = this.calculatePercentile(ttsLatencies, 50);
    const ttsP95 = this.calculatePercentile(ttsLatencies, 95);
    const totalP50 = this.calculatePercentile(totalLatencies, 50);
    const totalP95 = this.calculatePercentile(totalLatencies, 95);

    // Calculate degradation vs expected performance
    const expectedTotal = scenario.profile.expectedPerformance.totalLatencyMs.p95;
    const degradationPercent = expectedTotal > 0 ? ((totalP95 - expectedTotal) / expectedTotal) * 100 : 0;

    return {
      latency: {
        whisper: { p50: whisperP50, p95: whisperP95 },
        tts: { p50: ttsP50, p95: ttsP95 },
        total: { p50: totalP50, p95: totalP95 }
      },
      performance: {
        successRate: (successCount / scenario.configuration.iterations) * 100,
        memoryUsageGB: (endMemory.used - startMemory.used) / (1024 * 1024 * 1024),
        cpuUsagePercent: endCpu.usage,
        degradationPercent: Math.max(0, degradationPercent)
      },
      hardware: {
        thermalThrottling: endCpu.usage > 90, // Simplified detection
        memoryPressure: endMemory.used / endMemory.total > 0.9,
        diskIOThrottling: false // Would require more sophisticated monitoring
      }
    };
  }

  /**
   * Apply artificial loads for stress testing
   */
  private async applyArtificialLoads(config: any): Promise<void> {
    // Memory pressure simulation
    if (config.artificialMemoryPressure) {
      const memoryHog = Buffer.alloc(config.artificialMemoryPressure * 1024 * 1024 * 1024);
      this.artificialLoads.push({ type: 'memory', handle: memoryHog });
    }

    // CPU load simulation (simplified)
    if (config.artificialCpuLoad) {
      const cpuWorkers = Math.ceil(config.artificialCpuLoad / 25); // Rough approximation
      for (let i = 0; i < cpuWorkers; i++) {
        const worker = setInterval(() => {
          // Busy work to consume CPU
          Math.random() * Math.random();
        }, 1);
        this.artificialLoads.push({ type: 'cpu', handle: worker });
      }
    }
  }

  /**
   * Cleanup artificial loads
   */
  private async cleanupArtificialLoads(): Promise<void> {
    this.artificialLoads.forEach(load => {
      if (load.type === 'cpu') {
        clearInterval(load.handle);
      }
      // Memory loads will be GC'd when references are removed
    });
    this.artificialLoads = [];
  }

  /**
   * Detect current hardware profile
   */
  private async detectCurrentHardware(): Promise<HardwareProfile> {
    const memoryGB = Math.round((await this.systemProfiler.getMemoryUsage()).total / (1024 * 1024 * 1024));
    const cpuInfo = await this.systemProfiler.getCpuInfo();
    
    // Simple hardware detection based on available memory and CPU
    if (memoryGB <= 8) {
      return this.generateHardwareProfiles()[0]; // Low-end
    } else if (memoryGB <= 16) {
      return this.generateHardwareProfiles()[1]; // Mid-range
    } else if (memoryGB <= 32) {
      return this.generateHardwareProfiles()[2]; // High-end
    } else {
      return this.generateHardwareProfiles()[3]; // Server
    }
  }

  /**
   * Check if hardware profile is compatible with current system
   */
  private isHardwareProfileCompatible(profile: HardwareProfile, current: HardwareProfile): boolean {
    // Test scenarios for similar or lower spec hardware
    return profile.specs.ramGB <= current.specs.ramGB * 1.5 &&
           profile.specs.cpuCores <= current.specs.cpuCores * 2;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Evaluate hardware acceptance criteria
   */
  private evaluateHardwareAcceptance(metrics: any, criteria: any): boolean {
    if (metrics.performance.degradationPercent > criteria.maxLatencyDegradation) {
      return false;
    }
    
    if (metrics.performance.successRate < criteria.minSuccessRate) {
      return false;
    }
    
    if (metrics.performance.memoryUsageGB > criteria.maxMemoryUsage) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate error messages for hardware test failures
   */
  private generateHardwareErrorMessages(metrics: any, criteria: any): string[] {
    const errors: string[] = [];
    
    if (metrics.performance.degradationPercent > criteria.maxLatencyDegradation) {
      errors.push(`Latency degradation ${metrics.performance.degradationPercent.toFixed(1)}% exceeds limit ${criteria.maxLatencyDegradation}%`);
    }
    
    if (metrics.performance.successRate < criteria.minSuccessRate) {
      errors.push(`Success rate ${metrics.performance.successRate.toFixed(1)}% below minimum ${criteria.minSuccessRate}%`);
    }
    
    if (metrics.performance.memoryUsageGB > criteria.maxMemoryUsage) {
      errors.push(`Memory usage ${metrics.performance.memoryUsageGB.toFixed(1)}GB exceeds limit ${criteria.maxMemoryUsage}GB`);
    }
    
    return errors;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.cleanupArtificialLoads();
    
    if (this.whisperModel) {
      await this.whisperModel.dispose();
      this.whisperModel = null;
    }
    
    if (this.ttsModel) {
      await this.ttsModel.dispose();
      this.ttsModel = null;
    }
  }
}
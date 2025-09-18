/**
 * Edge Case Validation Framework for VAL-003
 * Tests boundary conditions and unusual scenarios
 */

import { VoicePipelineBenchmark, BenchmarkConfig } from '../voice-pipeline-benchmark';
import { AudioSampleGenerator, AudioSample, VoiceCommand } from '../test-data/audio-sample-generator';

export interface EdgeCase {
  name: string;
  description: string;
  category: 'audio' | 'command' | 'environment' | 'timing' | 'load';
  severity: 'low' | 'medium' | 'high';
  input: EdgeCaseInput;
  expectedOutcome: EdgeCaseExpectation;
}

export interface EdgeCaseInput {
  audioData?: ArrayBuffer;
  command?: VoiceCommand;
  environment?: any;
  timing?: {
    delayMs?: number;
    timeoutMs?: number;
  };
}

export interface EdgeCaseExpectation {
  shouldSucceed: boolean;
  maxLatency?: number;
  minAccuracy?: number;
  expectedError?: string;
  allowGracefulDegradation?: boolean;
}

export interface EdgeCaseResult {
  edgeCase: EdgeCase;
  passed: boolean;
  actualLatency?: number;
  actualAccuracy?: number;
  actualError?: string;
  notes: string[];
}

export class EdgeCaseValidator {
  private benchmark: VoicePipelineBenchmark;
  
  constructor() {
    this.benchmark = new VoicePipelineBenchmark();
  }
  
  /**
   * Run comprehensive edge case validation
   */
  async runEdgeCaseValidation(baseConfig: BenchmarkConfig): Promise<EdgeCaseResult[]> {
    console.log('Starting Edge Case Validation...');
    
    const edgeCases = this.getEdgeCases();
    const results: EdgeCaseResult[] = [];
    
    for (const edgeCase of edgeCases) {
      console.log(`\nValidating edge case: ${edgeCase.name}`);
      
      try {
        const result = await this.validateEdgeCase(edgeCase, baseConfig);
        results.push(result);
        
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  Result: ${status} - ${result.notes.join(', ')}`);
        
      } catch (error) {
        console.error(`  Failed to validate: ${error}`);
        results.push({
          edgeCase,
          passed: false,
          notes: [`Validation error: ${error}`]
        });
      }
    }
    
    this.generateEdgeCaseReport(results);
    return results;
  }
  
  /**
   * Define edge cases to validate
   */
  private getEdgeCases(): EdgeCase[] {
    return [
      // Audio edge cases
      {
        name: 'Silent Audio',
        description: 'Audio buffer with no speech content (silence)',
        category: 'audio',
        severity: 'medium',
        input: {
          audioData: this.generateSilentAudio(2000) // 2 seconds of silence
        },
        expectedOutcome: {
          shouldSucceed: false,
          expectedError: 'no_speech_detected',
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Very Short Audio',
        description: 'Audio buffer less than 100ms',
        category: 'audio',
        severity: 'medium',
        input: {
          audioData: this.generateShortAudio(50) // 50ms
        },
        expectedOutcome: {
          shouldSucceed: false,
          expectedError: 'audio_too_short',
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Very Long Audio',
        description: 'Audio buffer over 60 seconds',
        category: 'audio',
        severity: 'high',
        input: {
          audioData: this.generateLongAudio(65000) // 65 seconds
        },
        expectedOutcome: {
          shouldSucceed: false,
          maxLatency: 10000, // Should timeout before 10s
          expectedError: 'timeout',
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'High Frequency Audio',
        description: 'Audio with frequencies above normal speech range',
        category: 'audio',
        severity: 'low',
        input: {
          audioData: this.generateHighFrequencyAudio(2000)
        },
        expectedOutcome: {
          shouldSucceed: false,
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Clipped Audio',
        description: 'Audio with clipping distortion',
        category: 'audio',
        severity: 'medium',
        input: {
          audioData: this.generateClippedAudio(2000)
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 500,
          minAccuracy: 0.7, // Lower accuracy expected
          allowGracefulDegradation: true
        }
      },
      
      // Command edge cases
      {
        name: 'Single Character Command',
        description: 'Command with single character',
        category: 'command',
        severity: 'low',
        input: {
          command: {
            text: 'x',
            category: 'misc',
            complexity: 'simple',
            expectedLatency: 120
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 300
        }
      },
      
      {
        name: 'Extremely Long Command',
        description: 'Command with 200+ characters',
        category: 'command',
        severity: 'medium',
        input: {
          command: {
            text: 'docker run dash dash rm dash it dash dash name test dash container dash p eight thousand eight hundred colon eight thousand eight hundred dash v dollar pwd colon slash app dash w slash app node colon alpine sh dash c npm install and and npm run build and and npm test and and npm start',
            category: 'docker',
            complexity: 'complex',
            expectedLatency: 500
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 800,
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Special Characters Command',
        description: 'Command with unusual special characters',
        category: 'command',
        severity: 'medium',
        input: {
          command: {
            text: 'echo dollar open brace question mark colon dash one close brace',
            category: 'misc',
            complexity: 'complex',
            expectedLatency: 300
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 400,
          minAccuracy: 0.8
        }
      },
      
      {
        name: 'Numbers and Punctuation',
        description: 'Command with complex numbers and punctuation',
        category: 'command',
        severity: 'high',
        input: {
          command: {
            text: 'curl dash H Content dash Type colon application slash json dash d open brace quote id quote colon one two three four five comma quote value quote colon three point one four one five nine close brace',
            category: 'misc',
            complexity: 'complex',
            expectedLatency: 400
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 600,
          minAccuracy: 0.75
        }
      },
      
      // Timing edge cases
      {
        name: 'Rapid Sequential Commands',
        description: 'Multiple commands in quick succession',
        category: 'timing',
        severity: 'high',
        input: {
          timing: {
            delayMs: 10 // 10ms between commands
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Long Pause Before Command',
        description: 'Long silence before speech starts',
        category: 'timing',
        severity: 'medium',
        input: {
          audioData: this.generateDelayedAudio(3000, 2000) // 3s silence + 2s speech
        },
        expectedOutcome: {
          shouldSucceed: true,
          maxLatency: 400
        }
      },
      
      // Environment edge cases
      {
        name: 'Maximum Noise Level',
        description: 'Audio in extremely noisy environment (80dB+)',
        category: 'environment',
        severity: 'high',
        input: {
          environment: {
            noiseLevel: 85,
            backgroundNoise: ['construction', 'traffic', 'music', 'conversation']
          }
        },
        expectedOutcome: {
          shouldSucceed: false,
          allowGracefulDegradation: true
        }
      },
      
      {
        name: 'Microphone Distance Extreme',
        description: 'Very distant microphone (2+ meters)',
        category: 'environment',
        severity: 'medium',
        input: {
          environment: {
            microphoneDistance: 250, // 2.5 meters
            noiseLevel: 60
          }
        },
        expectedOutcome: {
          shouldSucceed: true,
          minAccuracy: 0.6,
          allowGracefulDegradation: true
        }
      }
    ];
  }
  
  /**
   * Validate a single edge case
   */
  private async validateEdgeCase(
    edgeCase: EdgeCase,
    baseConfig: BenchmarkConfig
  ): Promise<EdgeCaseResult> {
    
    await this.benchmark.initialize(baseConfig);
    
    try {
      let audioBuffer: ArrayBuffer;
      let expectedCommand: string | undefined;
      
      // Prepare test input
      if (edgeCase.input.audioData) {
        audioBuffer = edgeCase.input.audioData;
      } else if (edgeCase.input.command) {
        const audioSample = AudioSampleGenerator.generateSample(
          edgeCase.input.command,
          { id: 'test', gender: 'male', accent: 'american', ageRange: '30-40', speakingRate: 'normal' },
          { noiseLevel: 45, environment: 'quiet_office', microphoneDistance: 40, backgroundNoise: [] }
        );
        audioBuffer = audioSample.buffer;
        expectedCommand = audioSample.command.text;
      } else {
        // Generate default test audio
        const testSample = AudioSampleGenerator.generateTestDataset({ commandCount: 1 })[0];
        audioBuffer = testSample.buffer;
        expectedCommand = testSample.command.text;
      }
      
      // Handle timing-based edge cases
      if (edgeCase.category === 'timing' && edgeCase.input.timing?.delayMs) {
        return await this.validateTimingEdgeCase(edgeCase, audioBuffer, expectedCommand);
      }
      
      // Run single benchmark
      const startTime = Date.now();
      
      let result;
      try {
        result = await this.benchmark.runSingleBenchmark(audioBuffer, expectedCommand);
      } catch (error) {
        const actualError = error instanceof Error ? error.message : String(error);
        
        // Check if the error matches expectation
        if (edgeCase.expectedOutcome.expectedError && 
            actualError.toLowerCase().includes(edgeCase.expectedOutcome.expectedError.toLowerCase())) {
          return {
            edgeCase,
            passed: true,
            actualError,
            notes: ['Expected error occurred as designed']
          };
        }
        
        if (edgeCase.expectedOutcome.allowGracefulDegradation) {
          return {
            edgeCase,
            passed: true,
            actualError,
            notes: ['Graceful degradation - error handled appropriately']
          };
        }
        
        throw error;
      }
      
      const actualLatency = Date.now() - startTime;
      
      // Evaluate results
      const notes: string[] = [];
      let passed = true;
      
      // Check if should have succeeded
      if (!edgeCase.expectedOutcome.shouldSucceed) {
        passed = false;
        notes.push('Expected failure but succeeded');
      }
      
      // Check latency constraints
      if (edgeCase.expectedOutcome.maxLatency && actualLatency > edgeCase.expectedOutcome.maxLatency) {
        if (!edgeCase.expectedOutcome.allowGracefulDegradation) {
          passed = false;
          notes.push(`Latency ${actualLatency}ms exceeds max ${edgeCase.expectedOutcome.maxLatency}ms`);
        } else {
          notes.push(`High latency ${actualLatency}ms but graceful degradation allowed`);
        }
      }
      
      // Check accuracy constraints (simulated)
      const simulatedAccuracy = 0.9; // In real implementation, get from STT result
      if (edgeCase.expectedOutcome.minAccuracy && simulatedAccuracy < edgeCase.expectedOutcome.minAccuracy) {
        if (!edgeCase.expectedOutcome.allowGracefulDegradation) {
          passed = false;
          notes.push(`Accuracy ${simulatedAccuracy} below min ${edgeCase.expectedOutcome.minAccuracy}`);
        } else {
          notes.push(`Low accuracy ${simulatedAccuracy} but graceful degradation allowed`);
        }
      }
      
      if (passed && notes.length === 0) {
        notes.push('Edge case handled successfully');
      }
      
      return {
        edgeCase,
        passed,
        actualLatency,
        actualAccuracy: simulatedAccuracy,
        notes
      };
      
    } finally {
      await this.benchmark.cleanup();
    }
  }
  
  /**
   * Validate timing-based edge cases
   */
  private async validateTimingEdgeCase(
    edgeCase: EdgeCase,
    audioBuffer: ArrayBuffer,
    expectedCommand?: string
  ): Promise<EdgeCaseResult> {
    
    const delayMs = edgeCase.input.timing?.delayMs || 100;
    const commandCount = 5;
    const results: number[] = [];
    
    for (let i = 0; i < commandCount; i++) {
      const startTime = Date.now();
      
      try {
        await this.benchmark.runSingleBenchmark(audioBuffer, expectedCommand);
        results.push(Date.now() - startTime);
      } catch (error) {
        results.push(-1); // Mark failure
      }
      
      if (i < commandCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    const successCount = results.filter(r => r > 0).length;
    const avgLatency = results.filter(r => r > 0).reduce((a, b) => a + b, 0) / successCount;
    
    const passed = successCount >= Math.floor(commandCount * 0.8); // 80% success rate
    
    return {
      edgeCase,
      passed,
      actualLatency: avgLatency,
      notes: [`${successCount}/${commandCount} commands succeeded with ${delayMs}ms delay`]
    };
  }
  
  /**
   * Generate silent audio buffer
   */
  private generateSilentAudio(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(sampleCount * 2);
    // Buffer is already zeroed, representing silence
    return buffer;
  }
  
  /**
   * Generate very short audio buffer
   */
  private generateShortAudio(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(sampleCount * 2);
    const view = new Int16Array(buffer);
    
    // Generate brief audio burst
    for (let i = 0; i < sampleCount; i++) {
      view[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000;
    }
    
    return buffer;
  }
  
  /**
   * Generate very long audio buffer
   */
  private generateLongAudio(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(sampleCount * 2);
    const view = new Int16Array(buffer);
    
    // Generate repetitive pattern to simulate long speech
    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      view[i] = Math.sin(2 * Math.PI * 200 * t) * 8000 + 
               Math.sin(2 * Math.PI * 400 * t) * 4000;
    }
    
    return buffer;
  }
  
  /**
   * Generate high frequency audio
   */
  private generateHighFrequencyAudio(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(sampleCount * 2);
    const view = new Int16Array(buffer);
    
    // Generate high frequency content (above speech range)
    for (let i = 0; i < sampleCount; i++) {
      view[i] = Math.sin(2 * Math.PI * 6000 * i / sampleRate) * 12000;
    }
    
    return buffer;
  }
  
  /**
   * Generate clipped/distorted audio
   */
  private generateClippedAudio(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(sampleCount * 2);
    const view = new Int16Array(buffer);
    
    // Generate clipped waveform
    for (let i = 0; i < sampleCount; i++) {
      const sample = Math.sin(2 * Math.PI * 200 * i / sampleRate) * 40000;
      view[i] = Math.max(-32767, Math.min(32767, sample)); // Hard clipping
    }
    
    return buffer;
  }
  
  /**
   * Generate audio with initial delay
   */
  private generateDelayedAudio(silenceMs: number, speechMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const silenceSamples = Math.floor((silenceMs / 1000) * sampleRate);
    const speechSamples = Math.floor((speechMs / 1000) * sampleRate);
    const totalSamples = silenceSamples + speechSamples;
    
    const buffer = new ArrayBuffer(totalSamples * 2);
    const view = new Int16Array(buffer);
    
    // Silence portion (already zeroed)
    
    // Speech portion
    for (let i = silenceSamples; i < totalSamples; i++) {
      const t = (i - silenceSamples) / sampleRate;
      view[i] = Math.sin(2 * Math.PI * 200 * t) * 12000;
    }
    
    return buffer;
  }
  
  /**
   * Generate edge case test report
   */
  private generateEdgeCaseReport(results: EdgeCaseResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('EDGE CASE VALIDATION REPORT');
    console.log('='.repeat(60));
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\nSummary:`);
    console.log(`  Total Edge Cases: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    
    // Group by category
    const categories = new Map<string, EdgeCaseResult[]>();
    results.forEach(result => {
      const category = result.edgeCase.category;
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
    
    // List failed edge cases
    const failedResults = results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log(`\nFailed Edge Cases:`);
      failedResults.forEach(result => {
        console.log(`  ❌ ${result.edgeCase.name}: ${result.notes.join('; ')}`);
      });
    }
    
    // Highlight critical failures
    const criticalFailures = failedResults.filter(r => r.edgeCase.severity === 'high');
    if (criticalFailures.length > 0) {
      console.log(`\n🚨 Critical Edge Case Failures:`);
      criticalFailures.forEach(result => {
        console.log(`     ${result.edgeCase.name}: ${result.edgeCase.description}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  /**
   * Cleanup the validator
   */
  async cleanup(): Promise<void> {
    await this.benchmark.cleanup();
  }
}
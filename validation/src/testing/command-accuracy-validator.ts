/**
 * VAL-003 Command Accuracy Validator
 * Validates STT transcription accuracy for real developer voice commands
 */

import { BenchmarkConfig } from '../voice-pipeline-benchmark';
import { WhisperModel } from '../models/whisper-model';
import { AudioSample, DEVELOPER_COMMANDS } from '../test-data/audio-sample-generator';
import { ValidationError } from '../errors';

export interface AccuracyScenario {
  name: string;
  category: 'git' | 'npm' | 'docker' | 'k8s' | 'file' | 'build' | 'edge';
  expectedCommand: string;
  speakerProfile: string;
  environment: string;
  complexity: 'simple' | 'medium' | 'complex';
  criticalKeywords: string[];
  tolerances: {
    exactMatch: boolean;
    semanticMatch: boolean;
    keywordMatch: number; // Minimum percentage of keywords that must match
    levenshteinDistance: number; // Maximum edit distance
  };
}

export interface AccuracyResult {
  scenario: AccuracyScenario;
  passed: boolean;
  transcribedText: string;
  expectedText: string;
  accuracyMetrics: {
    exactMatch: boolean;
    semanticMatch: boolean;
    keywordMatchPercentage: number;
    levenshteinDistance: number;
    wordErrorRate: number;
  };
  latencyMs: number;
  confidence: number;
  errors: string[];
}

export class CommandAccuracyValidator {
  private whisperModel: WhisperModel | null = null;

  constructor() {}

  /**
   * Generate accuracy validation scenarios
   */
  generateAccuracyScenarios(): AccuracyScenario[] {
    const scenarios: AccuracyScenario[] = [];

    // Git commands
    const gitCommands = DEVELOPER_COMMANDS.git;
    gitCommands.forEach(cmd => {
      scenarios.push({
        name: `Git: ${cmd}`,
        category: 'git',
        expectedCommand: cmd,
        speakerProfile: 'male_us_standard',
        environment: 'quiet_office',
        complexity: this.getCommandComplexity(cmd),
        criticalKeywords: this.extractCriticalKeywords(cmd, 'git'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.8, // 80% of critical keywords must match
          levenshteinDistance: Math.max(3, Math.floor(cmd.length * 0.1))
        }
      });
    });

    // NPM commands with different speaker profiles
    const npmCommands = DEVELOPER_COMMANDS.npm;
    const speakers = ['female_uk_standard', 'male_canadian_fast', 'female_indian_clear'];
    npmCommands.forEach((cmd, idx) => {
      scenarios.push({
        name: `NPM: ${cmd}`,
        category: 'npm',
        expectedCommand: cmd,
        speakerProfile: speakers[idx % speakers.length],
        environment: 'office_background',
        complexity: this.getCommandComplexity(cmd),
        criticalKeywords: this.extractCriticalKeywords(cmd, 'npm'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.85,
          levenshteinDistance: Math.max(2, Math.floor(cmd.length * 0.08))
        }
      });
    });

    // Docker commands with noisy environments
    const dockerCommands = DEVELOPER_COMMANDS.docker;
    const noisyEnvs = ['cafe_moderate', 'openoffice_busy'];
    dockerCommands.forEach((cmd, idx) => {
      scenarios.push({
        name: `Docker: ${cmd}`,
        category: 'docker',
        expectedCommand: cmd,
        speakerProfile: 'male_us_technical',
        environment: noisyEnvs[idx % noisyEnvs.length],
        complexity: this.getCommandComplexity(cmd),
        criticalKeywords: this.extractCriticalKeywords(cmd, 'docker'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.75, // Lower tolerance for noisy environments
          levenshteinDistance: Math.max(4, Math.floor(cmd.length * 0.12))
        }
      });
    });

    // Kubernetes commands (complex)
    const k8sCommands = DEVELOPER_COMMANDS.k8s;
    k8sCommands.forEach(cmd => {
      scenarios.push({
        name: `K8s: ${cmd}`,
        category: 'k8s',
        expectedCommand: cmd,
        speakerProfile: 'female_us_technical',
        environment: 'quiet_office',
        complexity: 'complex',
        criticalKeywords: this.extractCriticalKeywords(cmd, 'k8s'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.9, // High tolerance for complex commands
          levenshteinDistance: Math.max(5, Math.floor(cmd.length * 0.15))
        }
      });
    });

    // File operations with fast speech
    const fileCommands = DEVELOPER_COMMANDS.file;
    fileCommands.forEach(cmd => {
      scenarios.push({
        name: `File: ${cmd}`,
        category: 'file',
        expectedCommand: cmd,
        speakerProfile: 'male_canadian_fast',
        environment: 'quiet_office',
        complexity: this.getCommandComplexity(cmd),
        criticalKeywords: this.extractCriticalKeywords(cmd, 'file'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.85,
          levenshteinDistance: Math.max(3, Math.floor(cmd.length * 0.1))
        }
      });
    });

    // Build commands
    const buildCommands = DEVELOPER_COMMANDS.build;
    buildCommands.forEach(cmd => {
      scenarios.push({
        name: `Build: ${cmd}`,
        category: 'build',
        expectedCommand: cmd,
        speakerProfile: 'female_uk_clear',
        environment: 'openoffice_busy',
        complexity: this.getCommandComplexity(cmd),
        criticalKeywords: this.extractCriticalKeywords(cmd, 'build'),
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.8,
          levenshteinDistance: Math.max(3, Math.floor(cmd.length * 0.1))
        }
      });
    });

    // Edge cases
    scenarios.push(
      {
        name: 'Edge: Single character command',
        category: 'edge',
        expectedCommand: 'l',
        speakerProfile: 'male_us_standard',
        environment: 'quiet_office',
        complexity: 'simple',
        criticalKeywords: ['l'],
        tolerances: {
          exactMatch: true,
          semanticMatch: false,
          keywordMatch: 1.0,
          levenshteinDistance: 0
        }
      },
      {
        name: 'Edge: Very long command',
        category: 'edge',
        expectedCommand: 'find /usr/local/bin -name "*.sh" -type f -exec grep -l "docker" {} \\; | head -10',
        speakerProfile: 'female_us_technical',
        environment: 'quiet_office',
        complexity: 'complex',
        criticalKeywords: ['find', 'usr', 'local', 'bin', 'name', 'sh', 'type', 'exec', 'grep', 'docker', 'head'],
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.7,
          levenshteinDistance: 15
        }
      },
      {
        name: 'Edge: Special characters',
        category: 'edge',
        expectedCommand: 'echo "Hello, World!" | grep -E "^[A-Z].*[!]$"',
        speakerProfile: 'male_uk_technical',
        environment: 'cafe_moderate',
        complexity: 'complex',
        criticalKeywords: ['echo', 'Hello', 'World', 'grep', 'E'],
        tolerances: {
          exactMatch: false,
          semanticMatch: true,
          keywordMatch: 0.6,
          levenshteinDistance: 8
        }
      }
    );

    return scenarios;
  }

  /**
   * Run accuracy validation tests
   */
  async runAccuracyValidation(config: BenchmarkConfig): Promise<AccuracyResult[]> {
    console.log('🎯 Starting command accuracy validation...');
    
    const scenarios = this.generateAccuracyScenarios();
    const results: AccuracyResult[] = [];

    // Initialize Whisper model
    this.whisperModel = new WhisperModel(config.sttModel);
    await this.whisperModel.initialize();

    for (const scenario of scenarios) {
      console.log(`  Testing: ${scenario.name}`);
      
      try {
        const result = await this.validateCommandAccuracy(scenario, config);
        results.push(result);
        
        const status = result.passed ? '✅' : '❌';
        const accuracy = (result.accuracyMetrics.keywordMatchPercentage * 100).toFixed(1);
        console.log(`    ${status} ${accuracy}% keyword accuracy, ${result.latencyMs}ms`);
        
      } catch (error) {
        console.log(`    ❌ Failed: ${error}`);
        results.push({
          scenario,
          passed: false,
          transcribedText: '',
          expectedText: scenario.expectedCommand,
          accuracyMetrics: {
            exactMatch: false,
            semanticMatch: false,
            keywordMatchPercentage: 0,
            levenshteinDistance: 999,
            wordErrorRate: 1.0
          },
          latencyMs: 0,
          confidence: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    return results;
  }

  /**
   * Validate accuracy for a single command
   */
  private async validateCommandAccuracy(scenario: AccuracyScenario, config: BenchmarkConfig): Promise<AccuracyResult> {
    if (!this.whisperModel) {
      throw new ValidationError('Whisper model not initialized');
    }

    // Generate synthetic audio for the expected command
    const audioBuffer = this.generateSyntheticAudio(
      scenario.expectedCommand,
      scenario.speakerProfile,
      scenario.environment
    );

    // Measure transcription latency
    const startTime = performance.now();
    const transcriptionResult = await this.whisperModel.transcribe(audioBuffer);
    const latencyMs = performance.now() - startTime;

    const transcribedText = transcriptionResult.text.toLowerCase().trim();
    const expectedText = scenario.expectedCommand.toLowerCase().trim();

    // Calculate accuracy metrics
    const accuracyMetrics = this.calculateAccuracyMetrics(transcribedText, expectedText, scenario.criticalKeywords);

    // Determine if scenario passed
    const passed = this.evaluateAccuracy(accuracyMetrics, scenario.tolerances);

    return {
      scenario,
      passed,
      transcribedText,
      expectedText,
      accuracyMetrics,
      latencyMs,
      confidence: transcriptionResult.confidence || 0,
      errors: passed ? [] : this.generateErrorMessages(accuracyMetrics, scenario.tolerances)
    };
  }

  /**
   * Calculate accuracy metrics
   */
  private calculateAccuracyMetrics(transcribed: string, expected: string, criticalKeywords: string[]) {
    // Exact match
    const exactMatch = transcribed === expected;

    // Keyword matching
    const transcribedWords = transcribed.split(/\s+/);
    const expectedWords = expected.split(/\s+/);
    const keywordMatches = criticalKeywords.filter(keyword => 
      transcribedWords.some(word => word.includes(keyword.toLowerCase()))
    ).length;
    const keywordMatchPercentage = criticalKeywords.length > 0 ? keywordMatches / criticalKeywords.length : 0;

    // Levenshtein distance
    const levenshteinDistance = this.calculateLevenshteinDistance(transcribed, expected);

    // Word Error Rate (WER)
    const wordErrorRate = this.calculateWordErrorRate(transcribedWords, expectedWords);

    // Semantic match (simplified - checks if main action words are present)
    const semanticMatch = this.checkSemanticMatch(transcribed, expected);

    return {
      exactMatch,
      semanticMatch,
      keywordMatchPercentage,
      levenshteinDistance,
      wordErrorRate
    };
  }

  /**
   * Evaluate if accuracy meets tolerances
   */
  private evaluateAccuracy(metrics: any, tolerances: any): boolean {
    if (tolerances.exactMatch && !metrics.exactMatch) {
      return false;
    }

    if (tolerances.semanticMatch && !metrics.semanticMatch) {
      return false;
    }

    if (metrics.keywordMatchPercentage < tolerances.keywordMatch) {
      return false;
    }

    if (metrics.levenshteinDistance > tolerances.levenshteinDistance) {
      return false;
    }

    return true;
  }

  /**
   * Get command complexity
   */
  private getCommandComplexity(command: string): 'simple' | 'medium' | 'complex' {
    const wordCount = command.split(/\s+/).length;
    const hasSpecialChars = /[|&;()<>{}[\]\\'"$`]/.test(command);
    
    if (wordCount <= 2 && !hasSpecialChars) return 'simple';
    if (wordCount <= 5 && !hasSpecialChars) return 'medium';
    return 'complex';
  }

  /**
   * Extract critical keywords from command
   */
  private extractCriticalKeywords(command: string, category: string): string[] {
    const words = command.split(/\s+/);
    const keywords: string[] = [];

    // Always include the main command
    if (words.length > 0) {
      keywords.push(words[0]);
    }

    // Add category-specific keywords
    switch (category) {
      case 'git':
        keywords.push(...words.filter(w => ['add', 'commit', 'push', 'pull', 'branch', 'checkout', 'merge', 'status'].includes(w)));
        break;
      case 'npm':
        keywords.push(...words.filter(w => ['install', 'run', 'start', 'build', 'test', 'publish'].includes(w)));
        break;
      case 'docker':
        keywords.push(...words.filter(w => ['run', 'build', 'pull', 'push', 'ps', 'exec', 'logs'].includes(w)));
        break;
      case 'k8s':
        keywords.push(...words.filter(w => ['get', 'apply', 'describe', 'delete', 'pods', 'services', 'deployments'].includes(w)));
        break;
      case 'file':
        keywords.push(...words.filter(w => ['ls', 'cd', 'mkdir', 'rm', 'cp', 'mv', 'find', 'grep'].includes(w)));
        break;
      case 'build':
        keywords.push(...words.filter(w => ['make', 'cmake', 'ninja', 'cargo', 'go'].includes(w)));
        break;
    }

    // Add important parameters (anything after flags)
    keywords.push(...words.filter(w => w.includes('/') || w.includes('.') || w.includes('-')));

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Generate synthetic audio (simplified simulation)
   */
  private generateSyntheticAudio(text: string, speakerProfile: string, environment: string): Buffer {
    // In a real implementation, this would use TTS with speaker characteristics
    // For now, return a placeholder buffer
    const textBuffer = Buffer.from(text);
    const metadataBuffer = Buffer.from(JSON.stringify({ speakerProfile, environment }));
    return Buffer.concat([textBuffer, metadataBuffer]);
  }

  /**
   * Calculate Levenshtein distance
   */
  private calculateLevenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[a.length][b.length];
  }

  /**
   * Calculate Word Error Rate
   */
  private calculateWordErrorRate(transcribed: string[], expected: string[]): number {
    if (expected.length === 0) return transcribed.length > 0 ? 1 : 0;
    
    const distance = this.calculateLevenshteinDistance(transcribed.join(' '), expected.join(' '));
    return distance / expected.length;
  }

  /**
   * Check semantic match (simplified)
   */
  private checkSemanticMatch(transcribed: string, expected: string): boolean {
    const transcribedWords = new Set(transcribed.split(/\s+/));
    const expectedWords = new Set(expected.split(/\s+/));
    
    // Check if main action words are present
    const actionWords = ['git', 'npm', 'docker', 'kubectl', 'ls', 'cd', 'mkdir', 'rm', 'cp', 'mv'];
    const expectedActions = [...expectedWords].filter(w => actionWords.includes(w));
    const transcribedActions = [...transcribedWords].filter(w => actionWords.includes(w));
    
    return expectedActions.every(action => transcribedActions.includes(action));
  }

  /**
   * Generate error messages
   */
  private generateErrorMessages(metrics: any, tolerances: any): string[] {
    const errors: string[] = [];

    if (tolerances.exactMatch && !metrics.exactMatch) {
      errors.push('Exact match required but not achieved');
    }

    if (tolerances.semanticMatch && !metrics.semanticMatch) {
      errors.push('Semantic match failed - main action words missing');
    }

    if (metrics.keywordMatchPercentage < tolerances.keywordMatch) {
      errors.push(`Keyword match ${(metrics.keywordMatchPercentage * 100).toFixed(1)}% below threshold ${(tolerances.keywordMatch * 100).toFixed(1)}%`);
    }

    if (metrics.levenshteinDistance > tolerances.levenshteinDistance) {
      errors.push(`Edit distance ${metrics.levenshteinDistance} exceeds threshold ${tolerances.levenshteinDistance}`);
    }

    return errors;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.whisperModel) {
      await this.whisperModel.dispose();
      this.whisperModel = null;
    }
  }
}
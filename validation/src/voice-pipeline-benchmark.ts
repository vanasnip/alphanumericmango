/**
 * Voice Pipeline Benchmark Implementation
 * Part of VAL-003: Local Voice Model Latency Validation
 */

import { LatencyTracker, LatencyMetrics, DetailedMetrics } from './latency-tracker';
import { WhisperModel } from './models/whisper-model';
import { CoquiTTSModel } from './models/coqui-tts-model';
import { VoiceActivityDetector } from './models/voice-activity-detector';
import { SystemProfiler } from './utils/system-profiler';
import { BenchmarkError, ErrorCodes, ErrorHandler } from './errors';

export interface BenchmarkConfig {
  sttModel: 'tiny' | 'base' | 'small';
  ttsModel: 'tacotron2' | 'vits' | 'yourtts';
  iterations: number;
  warmupRuns: number;
  environmentNoise: number; // dB level
  concurrentRequests: number;
  audioQuality?: 'low' | 'medium' | 'high';
  sampleRate?: number;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  latencyMetrics: LatencyMetrics[];
  percentileAnalysis: {
    p50: LatencyMetrics;
    p75: LatencyMetrics;
    p90: LatencyMetrics;
    p95: LatencyMetrics;
    p99: LatencyMetrics;
  };
  successRate: number;
  resourceUsage: {
    avgCpu: number;
    peakCpu: number;
    avgMemory: number;
    peakMemory: number;
  };
}

export class VoicePipelineBenchmark {
  private tracker: LatencyTracker;
  private whisperModel: WhisperModel | null = null;
  private coquiTTS: CoquiTTSModel | null = null;
  private vad: VoiceActivityDetector;
  private systemProfiler: SystemProfiler;
  private isInitialized: boolean = false;
  private currentConfig: BenchmarkConfig | null = null;
  
  /**
   * Validate benchmark configuration
   */
  private validateConfig(config: BenchmarkConfig): void {
    if (!config) {
      ErrorHandler.handleValidationError(
        'Benchmark configuration is required',
        ErrorCodes.MISSING_REQUIRED_FIELD,
        { config }
      );
    }
    
    if (config.iterations < 1) {
      ErrorHandler.handleConfigurationError(
        'Iterations must be positive',
        'iterations',
        config.iterations
      );
    }
    
    if (config.iterations > 10000) {
      console.warn(`High iteration count (${config.iterations}). This may take a very long time.`);
    }
    
    if (config.warmupRuns < 0) {
      ErrorHandler.handleConfigurationError(
        'Warmup runs cannot be negative',
        'warmupRuns',
        config.warmupRuns
      );
    }
    
    if (config.environmentNoise < 0 || config.environmentNoise > 120) {
      ErrorHandler.handleConfigurationError(
        'Environment noise must be between 0-120 dB',
        'environmentNoise',
        config.environmentNoise
      );
    }
    
    if (config.concurrentRequests < 1 || config.concurrentRequests > 100) {
      ErrorHandler.handleConfigurationError(
        'Concurrent requests must be between 1-100',
        'concurrentRequests',
        config.concurrentRequests
      );
    }
    
    const validSTTModels = ['tiny', 'base', 'small'];
    if (!validSTTModels.includes(config.sttModel)) {
      ErrorHandler.handleConfigurationError(
        `Invalid STT model. Must be one of: ${validSTTModels.join(', ')}`,
        'sttModel',
        config.sttModel
      );
    }
    
    const validTTSModels = ['tacotron2', 'vits', 'yourtts'];
    if (!validTTSModels.includes(config.ttsModel)) {
      ErrorHandler.handleConfigurationError(
        `Invalid TTS model. Must be one of: ${validTTSModels.join(', ')}`,
        'ttsModel',
        config.ttsModel
      );
    }
  }
  
  constructor() {
    this.tracker = new LatencyTracker();
    this.vad = new VoiceActivityDetector();
    this.systemProfiler = new SystemProfiler();
  }
  
  /**
   * Initialize benchmark with specific models
   */
  async initialize(config: BenchmarkConfig): Promise<void> {
    console.log('Initializing Voice Pipeline Benchmark...');
    
    try {
      // Validate configuration
      this.validateConfig(config);
      
      // Store configuration for use in measurements
      this.currentConfig = {
        ...config,
        audioQuality: config.audioQuality || 'high',
        sampleRate: config.sampleRate || 16000
      };
      
      // Load Whisper model with timeout
      this.whisperModel = new WhisperModel(config.sttModel);
      await ErrorHandler.withTimeout(
        this.whisperModel.load(),
        30000, // 30 second timeout
        `Loading Whisper ${config.sttModel} model`
      );
      
      // Load Coqui TTS model with timeout
      this.coquiTTS = new CoquiTTSModel(config.ttsModel);
      await ErrorHandler.withTimeout(
        this.coquiTTS.load(),
        60000, // 60 second timeout for larger TTS models
        `Loading Coqui ${config.ttsModel} model`
      );
      
      // Initialize VAD
      await this.vad.initialize();
      
      // Start system profiling
      this.systemProfiler.start();
      
      this.isInitialized = true;
      console.log('Benchmark initialization complete');
      
    } catch (error) {
      // Cleanup on failure
      await this.cleanup();
      
      if (error instanceof Error) {
        ErrorHandler.handleBenchmarkError(
          `Failed to initialize benchmark: ${error.message}`,
          ErrorCodes.BENCHMARK_FAILED,
          { config, error: error.message }
        );
      }
      throw error;
    }
  }
  
  /**
   * Run a single benchmark iteration
   */
  async runSingleBenchmark(
    audioBuffer: ArrayBuffer,
    expectedCommand?: string
  ): Promise<DetailedMetrics> {
    if (!this.isInitialized || !this.whisperModel || !this.coquiTTS) {
      ErrorHandler.handleBenchmarkError(
        'Benchmark not initialized. Call initialize() first.',
        ErrorCodes.BENCHMARK_NOT_INITIALIZED,
        { 
          isInitialized: this.isInitialized,
          hasWhisperModel: !!this.whisperModel,
          hasCoquiTTS: !!this.coquiTTS
        }
      );
    }
    
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      ErrorHandler.handleValidationError(
        'Audio buffer is required and cannot be empty',
        ErrorCodes.MISSING_REQUIRED_FIELD,
        { bufferSize: audioBuffer?.byteLength }
      );
    }
    
    const metrics: LatencyMetrics = {
      voiceActivityDetection: 0,
      speechToText: 0,
      commandParsing: 0,
      terminalExecution: 0,
      textToSpeech: 0,
      audioPlayback: 0,
      total: 0,
      timestamp: new Date()
    };
    
    const totalStart = performance.now();
    
    try {
      // Step 1: Voice Activity Detection
      this.tracker.startTimer('vad');
      const voiceSegment = await this.vad.detectVoiceSegment(audioBuffer);
      metrics.voiceActivityDetection = this.tracker.endTimer('vad');
      
      // Step 2: Speech to Text
      this.tracker.startTimer('stt');
      const transcription = await this.whisperModel.transcribe(voiceSegment);
      metrics.speechToText = this.tracker.endTimer('stt');
      
      // Step 3: Command Parsing
      this.tracker.startTimer('parse');
      const command = this.parseCommand(transcription.text);
      metrics.commandParsing = this.tracker.endTimer('parse');
      
      // Step 4: Terminal Execution (simulated)
      this.tracker.startTimer('exec');
      const result = await this.simulateTerminalExecution(command);
      metrics.terminalExecution = this.tracker.endTimer('exec');
      
      // Step 5: Text to Speech
      this.tracker.startTimer('tts');
      const audioOutput = await this.coquiTTS.synthesize(result.output);
      metrics.textToSpeech = this.tracker.endTimer('tts');
      
      // Step 6: Audio Playback (simulated)
      this.tracker.startTimer('playback');
      await this.simulateAudioPlayback(audioOutput);
      metrics.audioPlayback = this.tracker.endTimer('playback');
      
    } catch (error) {
      console.error('Benchmark iteration failed:', error);
      throw error;
    }
    
    metrics.total = performance.now() - totalStart;
    
    // Create detailed metrics
    const detailedMetrics: DetailedMetrics = {
      ...metrics,
      modelConfig: {
        sttModel: this.whisperModel.getModelName(),
        ttsModel: this.coquiTTS.getModelName(),
        sttModelSize: this.whisperModel.getModelSize(),
        ttsModelSize: this.coquiTTS.getModelSize()
      },
      hardwareConfig: this.systemProfiler.getHardwareInfo(),
      environmentConfig: {
        noiseLevel: this.currentConfig?.environmentNoise || 45,
        audioQuality: this.currentConfig?.audioQuality || 'high',
        sampleRate: this.currentConfig?.sampleRate || 16000
      },
      accuracy: {
        sttConfidence: this.whisperModel?.getExpectedAccuracy() || 0.95,
        commandRecognized: true,
        responseGenerated: true
      },
      resourceUsage: this.systemProfiler.getCurrentUsage()
    };
    
    this.tracker.recordPipelineMeasurement(detailedMetrics);
    
    return detailedMetrics;
  }
  
  /**
   * Run complete benchmark suite
   */
  async runBenchmarkSuite(
    config: BenchmarkConfig,
    testAudioSamples: ArrayBuffer[]
  ): Promise<BenchmarkResult> {
    await this.initialize(config);
    
    console.log(`Running ${config.warmupRuns} warmup iterations...`);
    // Warmup runs to ensure models are cached
    for (let i = 0; i < config.warmupRuns; i++) {
      const sample = testAudioSamples[i % testAudioSamples.length];
      await this.runSingleBenchmark(sample);
    }
    
    // Reset tracker after warmup
    this.tracker.reset();
    
    console.log(`Running ${config.iterations} benchmark iterations...`);
    const results: DetailedMetrics[] = [];
    
    for (let i = 0; i < config.iterations; i++) {
      const sample = testAudioSamples[i % testAudioSamples.length];
      const result = await this.runSingleBenchmark(sample);
      results.push(result);
      
      if ((i + 1) % 10 === 0) {
        console.log(`Completed ${i + 1}/${config.iterations} iterations`);
      }
    }
    
    // Calculate statistics
    const summary = this.tracker.generateSummaryReport();
    const resourceStats = this.systemProfiler.getStatistics();
    
    return {
      config,
      latencyMetrics: results.map(r => ({
        voiceActivityDetection: r.voiceActivityDetection,
        speechToText: r.speechToText,
        commandParsing: r.commandParsing,
        terminalExecution: r.terminalExecution,
        textToSpeech: r.textToSpeech,
        audioPlayback: r.audioPlayback,
        total: r.total,
        timestamp: r.timestamp
      })),
      percentileAnalysis: this.calculatePercentileMetrics(results),
      successRate: summary.successRate,
      resourceUsage: resourceStats
    };
  }
  
  /**
   * Run concurrent load test
   */
  async runConcurrentLoadTest(
    config: BenchmarkConfig,
    testAudioSamples: ArrayBuffer[]
  ): Promise<{
    concurrencyLevel: number;
    avgLatency: number;
    p95Latency: number;
    throughput: number;
    errorRate: number;
  }> {
    await this.initialize(config);
    
    const startTime = performance.now();
    const promises: Promise<DetailedMetrics>[] = [];
    let errors = 0;
    
    // Launch concurrent requests
    for (let i = 0; i < config.concurrentRequests; i++) {
      const sample = testAudioSamples[i % testAudioSamples.length];
      promises.push(
        this.runSingleBenchmark(sample).catch(err => {
          errors++;
          throw err;
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<DetailedMetrics>).value);
    
    const totalTime = performance.now() - startTime;
    const latencies = successfulResults.map(r => r.total);
    latencies.sort((a, b) => a - b);
    
    return {
      concurrencyLevel: config.concurrentRequests,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      throughput: (successfulResults.length / totalTime) * 1000, // requests per second
      errorRate: (errors / config.concurrentRequests) * 100
    };
  }
  
  /**
   * Test with different noise levels
   */
  async testNoiseRobustness(
    baseConfig: BenchmarkConfig,
    noiseProfiles: { name: string; dbLevel: number }[],
    testAudioSamples: ArrayBuffer[]
  ): Promise<Map<string, BenchmarkResult>> {
    const results = new Map<string, BenchmarkResult>();
    
    for (const profile of noiseProfiles) {
      console.log(`Testing with noise profile: ${profile.name} (${profile.dbLevel}dB)`);
      
      const config = {
        ...baseConfig,
        environmentNoise: profile.dbLevel
      };
      
      const result = await this.runBenchmarkSuite(config, testAudioSamples);
      results.set(profile.name, result);
    }
    
    return results;
  }
  
  /**
   * Parse command from transcription
   */
  private parseCommand(transcript: string): {
    command: string;
    args: string[];
  } {
    const parts = transcript.trim().split(/\s+/);
    return {
      command: parts[0] || '',
      args: parts.slice(1)
    };
  }
  
  /**
   * Simulate terminal command execution
   */
  private async simulateTerminalExecution(command: {
    command: string;
    args: string[];
  }): Promise<{ output: string; exitCode: number }> {
    // Simulate variable execution time based on command
    const executionTime = Math.random() * 30 + 20; // 20-50ms
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    return {
      output: `Command '${command.command}' executed successfully`,
      exitCode: 0
    };
  }
  
  /**
   * Simulate audio playback
   */
  private async simulateAudioPlayback(audioBuffer: ArrayBuffer): Promise<void> {
    // Simulate playback time based on audio length
    const playbackTime = Math.random() * 20 + 10; // 10-30ms
    await new Promise(resolve => setTimeout(resolve, playbackTime));
  }
  
  /**
   * Calculate percentile metrics from results
   */
  private calculatePercentileMetrics(results: DetailedMetrics[]): {
    p50: LatencyMetrics;
    p75: LatencyMetrics;
    p90: LatencyMetrics;
    p95: LatencyMetrics;
    p99: LatencyMetrics;
  } {
    const getPercentileValue = (values: number[], p: number): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    };
    
    const extractMetricArray = (key: keyof LatencyMetrics): number[] => {
      return results.map(r => r[key] as number).filter(v => typeof v === 'number');
    };
    
    const createPercentileMetric = (p: number): LatencyMetrics => ({
      voiceActivityDetection: getPercentileValue(extractMetricArray('voiceActivityDetection'), p),
      speechToText: getPercentileValue(extractMetricArray('speechToText'), p),
      commandParsing: getPercentileValue(extractMetricArray('commandParsing'), p),
      terminalExecution: getPercentileValue(extractMetricArray('terminalExecution'), p),
      textToSpeech: getPercentileValue(extractMetricArray('textToSpeech'), p),
      audioPlayback: getPercentileValue(extractMetricArray('audioPlayback'), p),
      total: getPercentileValue(extractMetricArray('total'), p),
      timestamp: new Date()
    });
    
    return {
      p50: createPercentileMetric(50),
      p75: createPercentileMetric(75),
      p90: createPercentileMetric(90),
      p95: createPercentileMetric(95),
      p99: createPercentileMetric(99)
    };
  }
  
  /**
   * Export benchmark results
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.tracker.exportToCSV();
    }
    return this.tracker.exportToJSON();
  }
  
  /**
   * Cleanup resources with comprehensive error handling
   */
  async cleanup(): Promise<void> {
    console.log('Starting benchmark cleanup...');
    const errors: Error[] = [];
    
    // Cleanup Whisper model
    if (this.whisperModel) {
      try {
        await this.whisperModel.dispose();
        this.whisperModel = null;
      } catch (error) {
        errors.push(new Error(`Failed to cleanup Whisper model: ${error}`));
      }
    }
    
    // Cleanup Coqui TTS model
    if (this.coquiTTS) {
      try {
        await this.coquiTTS.dispose();
        this.coquiTTS = null;
      } catch (error) {
        errors.push(new Error(`Failed to cleanup Coqui TTS model: ${error}`));
      }
    }
    
    // Cleanup VAD
    try {
      await this.vad.dispose();
    } catch (error) {
      errors.push(new Error(`Failed to cleanup VAD: ${error}`));
    }
    
    // Cleanup system profiler
    try {
      this.systemProfiler.stop();
    } catch (error) {
      errors.push(new Error(`Failed to stop system profiler: ${error}`));
    }
    
    // Reset tracker
    try {
      this.tracker.reset();
    } catch (error) {
      errors.push(new Error(`Failed to reset tracker: ${error}`));
    }
    
    // Clear configuration and state
    this.currentConfig = null;
    this.isInitialized = false;
    
    // Report any cleanup errors
    if (errors.length > 0) {
      console.warn(`Cleanup completed with ${errors.length} errors:`);
      errors.forEach(error => console.warn(`  - ${error.message}`));
    } else {
      console.log('Benchmark cleanup completed successfully');
    }
  }
  
  /**
   * Dispose of the benchmark (alias for cleanup)
   */
  async dispose(): Promise<void> {
    await this.cleanup();
  }
}
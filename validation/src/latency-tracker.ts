/**
 * Latency Tracker for Voice Pipeline Performance Measurement
 * Part of VAL-003: Local Voice Model Latency Validation
 */

import { ValidationError, ErrorCodes, ErrorHandler } from './errors';

export interface PercentileMetrics {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  sampleCount: number;
}

export interface LatencyMetrics {
  voiceActivityDetection: number;
  speechToText: number;
  commandParsing: number;
  terminalExecution: number;
  textToSpeech: number;
  audioPlayback: number;
  total: number;
  timestamp: Date;
}

export interface DetailedMetrics extends LatencyMetrics {
  modelConfig: {
    sttModel: string;
    ttsModel: string;
    sttModelSize: number; // in MB
    ttsModelSize: number; // in MB
  };
  hardwareConfig: {
    cpu: string;
    ram: number; // in GB
    platform: string;
  };
  environmentConfig: {
    noiseLevel: number; // in dB
    audioQuality: string;
    sampleRate: number;
  };
  accuracy: {
    sttConfidence: number;
    commandRecognized: boolean;
    responseGenerated: boolean;
  };
  resourceUsage: {
    cpuUsage: number; // percentage
    memoryUsage: number; // in MB
  };
}

export class LatencyTracker {
  private metrics: Map<string, number[]> = new Map();
  private timestamps: Map<string, number> = new Map();
  private detailedResults: DetailedMetrics[] = [];
  
  /**
   * Start timing a specific operation
   */
  startTimer(label: string): void {
    if (!label || typeof label !== 'string') {
      ErrorHandler.handleValidationError(
        'Timer label must be a non-empty string',
        ErrorCodes.INVALID_CONFIG,
        { label }
      );
    }
    
    // Warn if timer already exists (potential bug)
    if (this.timestamps.has(label)) {
      console.warn(`Timer '${label}' already exists. Overwriting previous start time.`);
    }
    
    this.timestamps.set(label, performance.now());
  }
  
  /**
   * End timing and record the duration
   */
  endTimer(label: string): number {
    if (!label || typeof label !== 'string') {
      ErrorHandler.handleValidationError(
        'Timer label must be a non-empty string',
        ErrorCodes.INVALID_CONFIG,
        { label }
      );
    }
    
    const start = this.timestamps.get(label);
    if (!start) {
      ErrorHandler.handleValidationError(
        `No start time found for timer label: ${label}`,
        ErrorCodes.MISSING_REQUIRED_FIELD,
        { label, availableTimers: Array.from(this.timestamps.keys()) }
      );
    }
    
    const duration = performance.now() - start;
    this.timestamps.delete(label);
    
    // Validate duration is reasonable (0-60 seconds)
    if (duration < 0 || duration > 60000) {
      console.warn(`Unusual timer duration for '${label}': ${duration}ms`);
    }
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
    
    return duration;
  }
  
  /**
   * Record a complete pipeline measurement
   */
  recordPipelineMeasurement(metrics: DetailedMetrics): void {
    this.detailedResults.push(metrics);
    
    // Also record individual components for percentile analysis
    this.recordMetric('vad', metrics.voiceActivityDetection);
    this.recordMetric('stt', metrics.speechToText);
    this.recordMetric('parse', metrics.commandParsing);
    this.recordMetric('exec', metrics.terminalExecution);
    this.recordMetric('tts', metrics.textToSpeech);
    this.recordMetric('playback', metrics.audioPlayback);
    this.recordMetric('total', metrics.total);
  }
  
  /**
   * Record a single metric value
   */
  private recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);
  }
  
  /**
   * Calculate percentiles for a specific metric
   */
  getPercentiles(label: string): PercentileMetrics {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) {
      return {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        mean: 0,
        min: 0,
        max: 0,
        sampleCount: 0
      };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      p50: this.percentile(sorted, 50),
      p75: this.percentile(sorted, 75),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      sampleCount: values.length
    };
  }
  
  /**
   * Calculate a specific percentile value using linear interpolation
   * This implements the most common percentile calculation method
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    
    // Use linear interpolation method (R-6/Excel method)
    const rank = (p / 100) * (sortedValues.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    
    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }
    
    const weight = rank - lowerIndex;
    return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
  }
  
  /**
   * Get all percentile metrics for all tracked labels
   */
  getAllPercentiles(): Map<string, PercentileMetrics> {
    const result = new Map<string, PercentileMetrics>();
    
    for (const label of this.metrics.keys()) {
      result.set(label, this.getPercentiles(label));
    }
    
    return result;
  }
  
  /**
   * Get detailed results for analysis
   */
  getDetailedResults(): DetailedMetrics[] {
    return [...this.detailedResults];
  }
  
  /**
   * Generate a summary report
   */
  generateSummaryReport(): {
    totalSamples: number;
    successRate: number; // % under 250ms
    componentBreakdown: Map<string, PercentileMetrics>;
    targetsMet: {
      vad: boolean; // <20ms P95
      stt: boolean; // <100ms P95
      tts: boolean; // <150ms P95
      total: boolean; // <250ms P95
    };
    recommendations: string[];
  } {
    const totalMetrics = this.getPercentiles('total');
    const vadMetrics = this.getPercentiles('vad');
    const sttMetrics = this.getPercentiles('stt');
    const ttsMetrics = this.getPercentiles('tts');
    
    const successfulSamples = (this.metrics.get('total') || [])
      .filter(t => t < 250).length;
    const totalSamples = (this.metrics.get('total') || []).length;
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (sttMetrics.p95 > 100) {
      recommendations.push('Consider using a smaller Whisper model or implementing quantization');
    }
    if (ttsMetrics.p95 > 150) {
      recommendations.push('TTS latency exceeds target - consider caching common responses');
    }
    if (vadMetrics.p95 > 20) {
      recommendations.push('VAD latency is high - optimize voice activity detection algorithm');
    }
    
    return {
      totalSamples,
      successRate: totalSamples > 0 ? (successfulSamples / totalSamples) * 100 : 0,
      componentBreakdown: this.getAllPercentiles(),
      targetsMet: {
        vad: vadMetrics.p95 <= 20,
        stt: sttMetrics.p95 <= 100,
        tts: ttsMetrics.p95 <= 150,
        total: totalMetrics.p95 <= 250
      },
      recommendations
    };
  }
  
  /**
   * Export results to JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      summary: this.generateSummaryReport(),
      detailedResults: this.detailedResults,
      rawMetrics: Object.fromEntries(this.metrics)
    }, null, 2);
  }
  
  /**
   * Export results to CSV
   */
  exportToCSV(): string {
    const headers = [
      'timestamp',
      'vad_ms',
      'stt_ms',
      'parse_ms',
      'exec_ms',
      'tts_ms',
      'playback_ms',
      'total_ms',
      'stt_model',
      'tts_model',
      'cpu_usage',
      'memory_mb',
      'success'
    ];
    
    const rows = this.detailedResults.map(r => [
      r.timestamp.toISOString(),
      r.voiceActivityDetection.toFixed(2),
      r.speechToText.toFixed(2),
      r.commandParsing.toFixed(2),
      r.terminalExecution.toFixed(2),
      r.textToSpeech.toFixed(2),
      r.audioPlayback.toFixed(2),
      r.total.toFixed(2),
      r.modelConfig.sttModel,
      r.modelConfig.ttsModel,
      r.resourceUsage.cpuUsage.toFixed(1),
      r.resourceUsage.memoryUsage.toFixed(0),
      r.total < 250 ? 'true' : 'false'
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.timestamps.clear();
    this.detailedResults = [];
  }
}
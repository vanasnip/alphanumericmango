/**
 * Stream Processing Optimization
 * Enhances voice stream, terminal output, and event stream processing with backpressure and memory efficiency
 */

import { EventEmitter, Transform, Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface StreamConfig {
  bufferSize: number;
  highWaterMark: number;
  enableCompression: boolean;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  maxMemoryUsage: number;
  backpressureThreshold: number;
}

export interface StreamMetrics {
  bytesProcessed: number;
  chunksProcessed: number;
  averageChunkSize: number;
  processingRate: number; // chunks per second
  memoryUsage: number;
  backpressureEvents: number;
  compressionRatio: number;
  errorCount: number;
  lastProcessedAt: number;
}

export interface AudioStreamConfig extends StreamConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  vadThreshold: number;
  noiseGateThreshold: number;
  enableVAD: boolean;
}

export interface TerminalStreamConfig extends StreamConfig {
  encoding: string;
  enableANSIProcessing: boolean;
  maxLineLength: number;
  enableHistoryBuffer: boolean;
  historySize: number;
}

/**
 * Base Stream Processor
 */
export abstract class StreamProcessor extends EventEmitter {
  protected config: StreamConfig;
  protected metrics: StreamMetrics;
  protected isActive: boolean = false;
  protected buffer: Buffer[] = [];
  protected batchTimer: NodeJS.Timeout | null = null;
  protected memoryMonitor: NodeJS.Timer | null = null;

  constructor(config: Partial<StreamConfig> = {}) {
    super();
    
    this.config = {
      bufferSize: config.bufferSize || 64 * 1024, // 64KB
      highWaterMark: config.highWaterMark || 16 * 1024, // 16KB
      enableCompression: config.enableCompression ?? false,
      enableBatching: config.enableBatching ?? true,
      batchSize: config.batchSize || 100,
      batchTimeout: config.batchTimeout || 100, // 100ms
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      backpressureThreshold: config.backpressureThreshold || 0.8
    };

    this.metrics = {
      bytesProcessed: 0,
      chunksProcessed: 0,
      averageChunkSize: 0,
      processingRate: 0,
      memoryUsage: 0,
      backpressureEvents: 0,
      compressionRatio: 1.0,
      errorCount: 0,
      lastProcessedAt: 0
    };

    this.startMemoryMonitoring();
  }

  /**
   * Abstract method for processing chunks
   */
  protected abstract processChunk(chunk: Buffer): Promise<Buffer | Buffer[]>;

  /**
   * Start stream processing
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Stream processor already active');
    }

    this.isActive = true;
    this.emit('started');
    console.log('Stream processor started');
  }

  /**
   * Stop stream processing
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    // Process remaining buffer
    if (this.buffer.length > 0) {
      await this.flushBuffer();
    }

    this.clearBatchTimer();
    this.stopMemoryMonitoring();
    
    this.emit('stopped');
    console.log('Stream processor stopped');
  }

  /**
   * Process data chunk
   */
  async process(chunk: Buffer): Promise<Buffer | Buffer[]> {
    if (!this.isActive) {
      throw new Error('Stream processor not active');
    }

    const startTime = Date.now();

    try {
      // Check memory pressure
      if (this.isMemoryPressureHigh()) {
        this.emit('backpressure', { reason: 'memory_pressure', usage: this.metrics.memoryUsage });
        this.metrics.backpressureEvents++;
        
        // Apply backpressure by slowing down processing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Update metrics
      this.updateProcessingMetrics(chunk);

      // Apply compression if enabled
      const processedChunk = this.config.enableCompression 
        ? await this.compressChunk(chunk)
        : chunk;

      // Process the chunk
      const result = await this.processChunk(processedChunk);
      
      // Handle batching
      if (this.config.enableBatching) {
        return await this.handleBatching(result);
      }

      this.metrics.lastProcessedAt = Date.now();
      return result;

    } catch (error) {
      this.metrics.errorCount++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle batching logic
   */
  private async handleBatching(data: Buffer | Buffer[]): Promise<Buffer | Buffer[]> {
    const chunks = Array.isArray(data) ? data : [data];
    
    this.buffer.push(...chunks);

    // Check if we should flush
    if (this.buffer.length >= this.config.batchSize) {
      return await this.flushBuffer();
    }

    // Set timer for timeout-based flushing
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(async () => {
        try {
          await this.flushBuffer();
        } catch (error) {
          this.emit('error', error);
        }
      }, this.config.batchTimeout);
    }

    return Buffer.alloc(0); // Return empty buffer for batched processing
  }

  /**
   * Flush the buffer
   */
  private async flushBuffer(): Promise<Buffer | Buffer[]> {
    if (this.buffer.length === 0) {
      return Buffer.alloc(0);
    }

    const batch = this.buffer.splice(0);
    this.clearBatchTimer();

    // Combine buffers efficiently
    const combined = Buffer.concat(batch);
    this.emit('batch_flushed', { size: batch.length, bytes: combined.length });
    
    return combined;
  }

  /**
   * Clear batch timer
   */
  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Compress chunk if compression is enabled
   */
  private async compressChunk(chunk: Buffer): Promise<Buffer> {
    if (!this.config.enableCompression) {
      return chunk;
    }

    try {
      // Placeholder for compression logic
      // In production, use zlib, brotli, or other compression libraries
      const compressed = chunk; // No actual compression for demo
      
      const ratio = chunk.length > 0 ? compressed.length / chunk.length : 1;
      this.metrics.compressionRatio = (this.metrics.compressionRatio * 0.9) + (ratio * 0.1);
      
      return compressed;
    } catch (error) {
      console.warn('Compression failed, using original chunk:', error);
      return chunk;
    }
  }

  /**
   * Check if memory pressure is high
   */
  private isMemoryPressureHigh(): boolean {
    return this.metrics.memoryUsage > this.config.maxMemoryUsage * this.config.backpressureThreshold;
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(chunk: Buffer): void {
    this.metrics.bytesProcessed += chunk.length;
    this.metrics.chunksProcessed++;
    
    // Update average chunk size
    this.metrics.averageChunkSize = 
      (this.metrics.averageChunkSize * 0.9) + (chunk.length * 0.1);
    
    // Calculate processing rate (chunks per second)
    const now = Date.now();
    if (this.metrics.lastProcessedAt > 0) {
      const timeDiff = (now - this.metrics.lastProcessedAt) / 1000;
      const rate = timeDiff > 0 ? 1 / timeDiff : 0;
      this.metrics.processingRate = (this.metrics.processingRate * 0.9) + (rate * 0.1);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      this.updateMemoryMetrics();
    }, 1000); // Monitor every second
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;
    
    // Emit warning if memory usage is high
    if (this.isMemoryPressureHigh()) {
      this.emit('memory_pressure', this.metrics.memoryUsage);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      bytesProcessed: 0,
      chunksProcessed: 0,
      averageChunkSize: 0,
      processingRate: 0,
      memoryUsage: this.metrics.memoryUsage,
      backpressureEvents: 0,
      compressionRatio: 1.0,
      errorCount: 0,
      lastProcessedAt: 0
    };
  }
}

/**
 * Voice Stream Processor
 */
export class VoiceStreamProcessor extends StreamProcessor {
  private audioConfig: AudioStreamConfig;
  private vadState: boolean = false;
  private silenceCounter: number = 0;
  private noiseGate: boolean = false;

  constructor(config: Partial<AudioStreamConfig> = {}) {
    super(config);
    
    this.audioConfig = {
      ...this.config,
      sampleRate: config.sampleRate || 16000,
      channels: config.channels || 1,
      bitDepth: config.bitDepth || 16,
      vadThreshold: config.vadThreshold || 0.01,
      noiseGateThreshold: config.noiseGateThreshold || 0.005,
      enableVAD: config.enableVAD ?? true
    } as AudioStreamConfig;
  }

  protected async processChunk(chunk: Buffer): Promise<Buffer | Buffer[]> {
    // Apply noise gate
    const gatedChunk = this.applyNoiseGate(chunk);
    
    // Apply VAD (Voice Activity Detection)
    if (this.audioConfig.enableVAD) {
      const hasVoice = this.detectVoiceActivity(gatedChunk);
      
      if (!hasVoice) {
        this.silenceCounter++;
        
        // Skip processing if silence detected for too long
        if (this.silenceCounter > 10) {
          return Buffer.alloc(0);
        }
      } else {
        this.silenceCounter = 0;
      }
    }

    // Apply audio processing (normalization, filtering, etc.)
    const processedChunk = this.processAudio(gatedChunk);
    
    return processedChunk;
  }

  /**
   * Apply noise gate to reduce background noise
   */
  private applyNoiseGate(chunk: Buffer): Buffer {
    if (chunk.length === 0) return chunk;

    // Calculate RMS (Root Mean Square) for amplitude
    const samples = this.bufferToSamples(chunk);
    const rms = this.calculateRMS(samples);
    
    if (rms < this.audioConfig.noiseGateThreshold) {
      // Below threshold, apply gate (reduce to silence)
      return Buffer.alloc(chunk.length);
    }
    
    return chunk;
  }

  /**
   * Detect voice activity in audio chunk
   */
  private detectVoiceActivity(chunk: Buffer): boolean {
    if (chunk.length === 0) return false;

    const samples = this.bufferToSamples(chunk);
    const rms = this.calculateRMS(samples);
    
    return rms > this.audioConfig.vadThreshold;
  }

  /**
   * Process audio chunk (normalization, filtering)
   */
  private processAudio(chunk: Buffer): Buffer {
    if (chunk.length === 0) return chunk;

    // Apply audio processing
    const samples = this.bufferToSamples(chunk);
    const processedSamples = this.normalizeAudio(samples);
    
    return this.samplesToBuffer(processedSamples);
  }

  /**
   * Convert buffer to audio samples
   */
  private bufferToSamples(buffer: Buffer): Float32Array {
    const samples = new Float32Array(buffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    return samples;
  }

  /**
   * Convert audio samples to buffer
   */
  private samplesToBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      buffer.writeInt16LE(sample * 32767, i * 2);
    }
    return buffer;
  }

  /**
   * Calculate RMS of audio samples
   */
  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Normalize audio levels
   */
  private normalizeAudio(samples: Float32Array): Float32Array {
    const rms = this.calculateRMS(samples);
    if (rms === 0) return samples;

    const targetRMS = 0.1; // Target RMS level
    const gain = targetRMS / rms;
    const maxGain = 4.0; // Limit gain to prevent distortion
    
    const finalGain = Math.min(gain, maxGain);
    
    const normalized = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      normalized[i] = Math.max(-1, Math.min(1, samples[i] * finalGain));
    }
    
    return normalized;
  }
}

/**
 * Terminal Stream Processor
 */
export class TerminalStreamProcessor extends StreamProcessor {
  private terminalConfig: TerminalStreamConfig;
  private lineBuffer: string = '';
  private history: string[] = [];
  private ansiParser: ANSIParser;

  constructor(config: Partial<TerminalStreamConfig> = {}) {
    super(config);
    
    this.terminalConfig = {
      ...this.config,
      encoding: config.encoding || 'utf8',
      enableANSIProcessing: config.enableANSIProcessing ?? true,
      maxLineLength: config.maxLineLength || 4096,
      enableHistoryBuffer: config.enableHistoryBuffer ?? true,
      historySize: config.historySize || 1000
    } as TerminalStreamConfig;

    this.ansiParser = new ANSIParser();
  }

  protected async processChunk(chunk: Buffer): Promise<Buffer | Buffer[]> {
    const text = chunk.toString(this.terminalConfig.encoding);
    
    // Process ANSI escape sequences if enabled
    const processedText = this.terminalConfig.enableANSIProcessing 
      ? this.ansiParser.parse(text)
      : text;

    // Handle line buffering
    const lines = this.processLines(processedText);
    
    // Convert processed lines back to buffer
    if (lines.length > 0) {
      const output = lines.join('\n') + '\n';
      return Buffer.from(output, this.terminalConfig.encoding);
    }

    return Buffer.alloc(0);
  }

  /**
   * Process lines with buffering and history
   */
  private processLines(text: string): string[] {
    const lines: string[] = [];
    this.lineBuffer += text;

    // Split by newlines and process complete lines
    const parts = this.lineBuffer.split('\n');
    this.lineBuffer = parts.pop() || ''; // Keep incomplete line in buffer

    for (const line of parts) {
      // Truncate overly long lines
      const processedLine = line.length > this.terminalConfig.maxLineLength
        ? line.substring(0, this.terminalConfig.maxLineLength) + '...'
        : line;

      lines.push(processedLine);

      // Add to history if enabled
      if (this.terminalConfig.enableHistoryBuffer) {
        this.addToHistory(processedLine);
      }
    }

    return lines;
  }

  /**
   * Add line to history buffer
   */
  private addToHistory(line: string): void {
    this.history.push(line);
    
    // Maintain history size limit
    if (this.history.length > this.terminalConfig.historySize) {
      this.history.shift();
    }
  }

  /**
   * Get terminal history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear terminal history
   */
  clearHistory(): void {
    this.history = [];
  }
}

/**
 * Simple ANSI Parser for terminal output
 */
class ANSIParser {
  private static readonly ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

  parse(text: string): string {
    // For now, just strip ANSI codes
    // In production, you might want to convert them to HTML or handle them differently
    return text.replace(ANSIParser.ANSI_REGEX, '');
  }
}

/**
 * Event Stream Processor
 */
export class EventStreamProcessor extends StreamProcessor {
  private eventQueue: any[] = [];
  private eventHandlers: Map<string, Function[]> = new Map();

  protected async processChunk(chunk: Buffer): Promise<Buffer | Buffer[]> {
    try {
      // Parse JSON events from chunk
      const text = chunk.toString('utf8');
      const events = text.split('\n').filter(line => line.trim());

      for (const eventLine of events) {
        try {
          const event = JSON.parse(eventLine);
          await this.processEvent(event);
        } catch (parseError) {
          console.warn('Failed to parse event:', eventLine, parseError);
        }
      }

      // Return processed events as JSON
      if (this.eventQueue.length > 0) {
        const output = this.eventQueue.map(event => JSON.stringify(event)).join('\n') + '\n';
        this.eventQueue = [];
        return Buffer.from(output, 'utf8');
      }

      return Buffer.alloc(0);

    } catch (error) {
      console.error('Event stream processing error:', error);
      throw error;
    }
  }

  /**
   * Process individual event
   */
  private async processEvent(event: any): Promise<void> {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add processing metadata
    event._processed = true;
    event._processingTime = Date.now();

    // Trigger event handlers
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.warn(`Event handler error for ${event.type}:`, error);
      }
    }

    this.eventQueue.push(event);
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: Function): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

/**
 * Stream Processing Manager
 */
export class StreamProcessingManager extends EventEmitter {
  private processors: Map<string, StreamProcessor> = new Map();

  /**
   * Create voice stream processor
   */
  createVoiceProcessor(name: string, config?: Partial<AudioStreamConfig>): VoiceStreamProcessor {
    const processor = new VoiceStreamProcessor(config);
    this.processors.set(name, processor);
    this.setupProcessorListeners(name, processor);
    return processor;
  }

  /**
   * Create terminal stream processor
   */
  createTerminalProcessor(name: string, config?: Partial<TerminalStreamConfig>): TerminalStreamProcessor {
    const processor = new TerminalStreamProcessor(config);
    this.processors.set(name, processor);
    this.setupProcessorListeners(name, processor);
    return processor;
  }

  /**
   * Create event stream processor
   */
  createEventProcessor(name: string, config?: Partial<StreamConfig>): EventStreamProcessor {
    const processor = new EventStreamProcessor(config);
    this.processors.set(name, processor);
    this.setupProcessorListeners(name, processor);
    return processor;
  }

  /**
   * Setup processor event listeners
   */
  private setupProcessorListeners(name: string, processor: StreamProcessor): void {
    processor.on('error', (error) => {
      this.emit('processorError', { name, error });
    });

    processor.on('backpressure', (data) => {
      this.emit('backpressure', { name, ...data });
    });

    processor.on('memory_pressure', (usage) => {
      this.emit('memoryPressure', { name, usage });
    });
  }

  /**
   * Get processor by name
   */
  getProcessor(name: string): StreamProcessor | undefined {
    return this.processors.get(name);
  }

  /**
   * Get all processor metrics
   */
  getAllMetrics(): Record<string, StreamMetrics> {
    const metrics: Record<string, StreamMetrics> = {};
    for (const [name, processor] of this.processors) {
      metrics[name] = processor.getMetrics();
    }
    return metrics;
  }

  /**
   * Stop all processors
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    for (const processor of this.processors.values()) {
      stopPromises.push(processor.stop());
    }

    await Promise.allSettled(stopPromises);
    console.log('All stream processors stopped');
  }

  /**
   * Shutdown manager
   */
  async shutdown(): Promise<void> {
    await this.stopAll();
    this.processors.clear();
    console.log('Stream processing manager shutdown complete');
  }
}

// Global stream processing manager
export const streamProcessingManager = new StreamProcessingManager();

export default StreamProcessor;
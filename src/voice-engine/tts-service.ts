/**
 * Coqui TTS Service - TypeScript Interface
 * Production-ready wrapper for Python TTS service with comprehensive error handling
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Types and interfaces
export interface TTSConfig {
  model?: string;
  pythonPath?: string;
  modulePath?: string;
  maxConcurrentRequests?: number;
  timeoutMs?: number;
  cacheDir?: string;
  enableGPU?: boolean;
  enableStreaming?: boolean;
}

export interface SynthesisRequest {
  text: string;
  outputPath?: string;
  model?: string;
  streaming?: boolean;
}

export interface SynthesisResult {
  success: boolean;
  outputPath?: string;
  duration?: number;
  error?: string;
  metadata?: {
    latency: number;
    cached: boolean;
    model: string;
    audioLength: number;
  };
}

export interface StreamingChunk {
  type: 'audio' | 'error' | 'complete';
  data?: Buffer;
  metadata?: {
    chunkId: number;
    progress: number;
    latency: number;
  };
  error?: string;
}

export interface PerformanceMetrics {
  averageLatency: number;
  cacheHitRate: number;
  totalRequests: number;
  errorRate: number;
  gpuUtilization?: number;
  memoryUsage: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  processId?: number;
  lastCheck: number;
  issues: string[];
  performance: PerformanceMetrics;
}

// Error classes
export class TTSError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TTSError';
  }
}

export class TTSTimeoutError extends TTSError {
  constructor(timeout: number) {
    super(`TTS request timed out after ${timeout}ms`, 'TIMEOUT');
  }
}

export class TTSValidationError extends TTSError {
  constructor(field: string, value: any) {
    super(`Invalid ${field}: ${value}`, 'VALIDATION_ERROR', { field, value });
  }
}

export class TTSServiceError extends TTSError {
  constructor(message: string, details?: any) {
    super(`TTS service error: ${message}`, 'SERVICE_ERROR', details);
  }
}

/**
 * Main TTS Service Class
 * Manages Python TTS process and provides TypeScript interface
 */
export class TTSService extends EventEmitter {
  private pythonProcess: ChildProcess | null = null;
  private requestQueue: Map<string, any> = new Map();
  private isReady: boolean = false;
  private config: Required<TTSConfig>;
  private startTime: number = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics = {
    averageLatency: 0,
    cacheHitRate: 0,
    totalRequests: 0,
    errorRate: 0,
    memoryUsage: 0
  };

  constructor(config: TTSConfig = {}) {
    super();
    
    // Default configuration
    this.config = {
      model: config.model || 'fast',
      pythonPath: config.pythonPath || 'python3',
      modulePath: config.modulePath || path.join(__dirname, '../../modules/voice-engine'),
      maxConcurrentRequests: config.maxConcurrentRequests || 5,
      timeoutMs: config.timeoutMs || 30000,
      cacheDir: config.cacheDir || path.join(process.cwd(), '.cache', 'tts'),
      enableGPU: config.enableGPU ?? true,
      enableStreaming: config.enableStreaming ?? true
    };

    this.validateConfig();
    this.setupErrorHandling();
  }

  /**
   * Initialize the TTS service
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureCacheDirectory();
      await this.startPythonProcess();
      await this.waitForReady();
      this.startHealthMonitoring();
      
      this.emit('ready');
      console.log('TTS Service initialized successfully');
      
    } catch (error) {
      this.emit('error', error);
      throw new TTSServiceError('Failed to initialize TTS service', error);
    }
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    this.validateSynthesisRequest(request);
    
    if (!this.isReady) {
      throw new TTSServiceError('TTS service not ready');
    }

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      // Prepare request
      const pythonRequest = {
        id: requestId,
        command: request.streaming ? 'synthesize_streaming' : 'synthesize',
        text: request.text,
        output_path: request.outputPath,
        model: request.model || this.config.model
      };

      // Send request to Python process
      const result = await this.sendRequest(pythonRequest);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, true);

      // Validate output file exists
      if (result.output_path && !(await this.fileExists(result.output_path))) {
        throw new TTSServiceError('Output file was not created');
      }

      return {
        success: true,
        outputPath: result.output_path,
        duration: latency,
        metadata: {
          latency,
          cached: result.cached || false,
          model: result.model || this.config.model,
          audioLength: result.audio_length || 0
        }
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);
      
      if (error instanceof TTSError) {
        throw error;
      }
      
      throw new TTSServiceError('Synthesis failed', error);
    }
  }

  /**
   * Synthesize with streaming output
   */
  async *synthesizeStreaming(request: SynthesisRequest): AsyncGenerator<StreamingChunk> {
    this.validateSynthesisRequest(request);
    
    if (!this.isReady) {
      throw new TTSServiceError('TTS service not ready');
    }

    if (!this.config.enableStreaming) {
      throw new TTSServiceError('Streaming is disabled');
    }

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const pythonRequest = {
        id: requestId,
        command: 'synthesize_streaming',
        text: request.text,
        model: request.model || this.config.model
      };

      // Send streaming request
      yield* this.sendStreamingRequest(pythonRequest);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, true);

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);
      
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error'
      };
    }
  }

  /**
   * Get available voice models
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.isReady) {
      throw new TTSServiceError('TTS service not ready');
    }

    try {
      const result = await this.sendRequest({
        id: uuidv4(),
        command: 'get_models'
      });

      return result.models || [];
    } catch (error) {
      throw new TTSServiceError('Failed to get available models', error);
    }
  }

  /**
   * Switch voice model
   */
  async switchModel(modelName: string): Promise<void> {
    if (!modelName || typeof modelName !== 'string') {
      throw new TTSValidationError('model name', modelName);
    }

    if (!this.isReady) {
      throw new TTSServiceError('TTS service not ready');
    }

    try {
      await this.sendRequest({
        id: uuidv4(),
        command: 'switch_model',
        model: modelName
      });

      this.config.model = modelName;
      this.emit('modelChanged', modelName);
      
    } catch (error) {
      throw new TTSServiceError(`Failed to switch to model: ${modelName}`, error);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    if (!this.isReady) {
      return this.metrics;
    }

    try {
      const result = await this.sendRequest({
        id: uuidv4(),
        command: 'get_metrics'
      });

      // Merge with local metrics
      return {
        ...this.metrics,
        ...result.metrics
      };
    } catch (error) {
      console.warn('Failed to get remote performance metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check if process is running
    if (!this.pythonProcess || this.pythonProcess.killed) {
      issues.push('Python process not running');
      status = 'unhealthy';
    }

    // Check if service is ready
    if (!this.isReady) {
      issues.push('Service not ready');
      status = 'unhealthy';
    }

    // Check performance metrics
    const metrics = await this.getPerformanceMetrics();
    
    if (metrics.errorRate > 10) {
      issues.push(`High error rate: ${metrics.errorRate}%`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    if (metrics.averageLatency > 200) {
      issues.push(`High latency: ${metrics.averageLatency}ms`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      processId: this.pythonProcess?.pid,
      lastCheck: Date.now(),
      issues,
      performance: metrics
    };
  }

  /**
   * Clear audio cache
   */
  async clearCache(): Promise<void> {
    if (!this.isReady) {
      throw new TTSServiceError('TTS service not ready');
    }

    try {
      await this.sendRequest({
        id: uuidv4(),
        command: 'clear_cache'
      });

      this.emit('cacheCleared');
    } catch (error) {
      throw new TTSServiceError('Failed to clear cache', error);
    }
  }

  /**
   * Shutdown the TTS service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down TTS service...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Clear pending requests
    for (const [id, request] of this.requestQueue) {
      request.reject(new TTSServiceError('Service shutting down'));
    }
    this.requestQueue.clear();

    // Shutdown Python process gracefully
    if (this.pythonProcess && !this.pythonProcess.killed) {
      try {
        // Send shutdown command
        await this.sendRequest({
          id: uuidv4(),
          command: 'shutdown'
        }, 5000); // 5 second timeout

      } catch (error) {
        console.warn('Graceful shutdown failed, forcing termination');
      }

      // Force kill if still running
      if (!this.pythonProcess.killed) {
        this.pythonProcess.kill('SIGTERM');
        
        // Wait a bit, then force kill
        setTimeout(() => {
          if (this.pythonProcess && !this.pythonProcess.killed) {
            this.pythonProcess.kill('SIGKILL');
          }
        }, 2000);
      }
    }

    this.isReady = false;
    this.pythonProcess = null;
    this.emit('shutdown');
    
    console.log('TTS service shutdown complete');
  }

  // Private methods

  private validateConfig(): void {
    if (!this.config.pythonPath) {
      throw new TTSValidationError('pythonPath', this.config.pythonPath);
    }

    if (!this.config.modulePath) {
      throw new TTSValidationError('modulePath', this.config.modulePath);
    }

    if (this.config.timeoutMs < 1000) {
      throw new TTSValidationError('timeoutMs', this.config.timeoutMs);
    }
  }

  private validateSynthesisRequest(request: SynthesisRequest): void {
    if (!request.text || typeof request.text !== 'string') {
      throw new TTSValidationError('text', request.text);
    }

    if (request.text.length > 10000) {
      throw new TTSValidationError('text length', request.text.length);
    }

    if (request.outputPath && typeof request.outputPath !== 'string') {
      throw new TTSValidationError('outputPath', request.outputPath);
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      throw new TTSServiceError('Failed to create cache directory', error);
    }
  }

  private async startPythonProcess(): Promise<void> {
    const args = [
      path.join(this.config.modulePath, 'tts_service.py'),
      '--model', this.config.model,
      '--cache-dir', this.config.cacheDir
    ];

    if (this.config.enableGPU) {
      args.push('--enable-gpu');
    }

    console.log(`Starting Python process: ${this.config.pythonPath} ${args.join(' ')}`);

    this.pythonProcess = spawn(this.config.pythonPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.modulePath,
      env: {
        ...process.env,
        PYTHONPATH: this.config.modulePath,
        PYTHONUNBUFFERED: '1'
      }
    });

    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    if (!this.pythonProcess) return;

    this.pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      this.emit('error', new TTSServiceError('Python process error', error));
    });

    this.pythonProcess.on('exit', (code, signal) => {
      console.log(`Python process exited with code ${code}, signal ${signal}`);
      this.isReady = false;
      this.pythonProcess = null;
      
      if (code !== 0 && code !== null) {
        this.emit('error', new TTSServiceError(`Python process crashed with code ${code}`));
      }
    });

    // Handle stdout for responses
    if (this.pythonProcess.stdout) {
      let buffer = '';
      this.pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        
        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            this.handlePythonResponse(line.trim());
          }
        }
      });
    }

    // Handle stderr for errors and logs
    if (this.pythonProcess.stderr) {
      this.pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.error('Python stderr:', message);
        
        // Don't emit as error for debugging output
        if (message.includes('ERROR') || message.includes('CRITICAL')) {
          this.emit('error', new TTSServiceError('Python process error: ' + message));
        }
      });
    }
  }

  private handlePythonResponse(line: string): void {
    try {
      const response = JSON.parse(line);
      
      if (response.status === 'ready') {
        this.isReady = true;
        console.log('TTS service ready');
        return;
      }

      if (response.id && this.requestQueue.has(response.id)) {
        const request = this.requestQueue.get(response.id);
        this.requestQueue.delete(response.id);

        if (response.error) {
          request.reject(new TTSServiceError(response.error));
        } else {
          request.resolve(response);
        }
      }

    } catch (error) {
      console.error('Failed to parse Python response:', line, error);
    }
  }

  private async waitForReady(timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new TTSTimeoutError(timeoutMs));
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(timeout);
        this.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        this.off('ready', onReady);
        reject(error);
      };

      this.once('ready', onReady);
      this.once('error', onError);
    });
  }

  private async sendRequest(request: any, timeoutMs?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestQueue.delete(request.id);
        reject(new TTSTimeoutError(timeoutMs || this.config.timeoutMs));
      }, timeoutMs || this.config.timeoutMs);

      this.requestQueue.set(request.id, {
        resolve: (response: any) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send request to Python process
      if (this.pythonProcess && this.pythonProcess.stdin) {
        this.pythonProcess.stdin.write(JSON.stringify(request) + '\n');
      } else {
        this.requestQueue.delete(request.id);
        clearTimeout(timeout);
        reject(new TTSServiceError('Python process not available'));
      }
    });
  }

  private async *sendStreamingRequest(request: any): AsyncGenerator<StreamingChunk> {
    // For streaming, we'll implement a different approach
    // This is a simplified version - full implementation would handle streaming protocol
    try {
      const result = await this.sendRequest(request);
      
      if (result.chunks) {
        for (let i = 0; i < result.chunks.length; i++) {
          yield {
            type: 'audio',
            data: Buffer.from(result.chunks[i].data, 'base64'),
            metadata: {
              chunkId: i,
              progress: (i + 1) / result.chunks.length,
              latency: result.chunks[i].latency || 0
            }
          };
        }
      }

      yield {
        type: 'complete'
      };

    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private updateMetrics(latency: number, success: boolean): void {
    this.metrics.totalRequests++;
    
    // Update average latency (exponential moving average)
    const alpha = 0.1;
    this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + latency * alpha;
    
    // Update error rate
    const errors = success ? 0 : 1;
    this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalRequests - 1) + errors * 100) / this.metrics.totalRequests;
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in TTS service:', error);
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection in TTS service:', reason);
      this.emit('error', new Error(`Unhandled rejection: ${reason}`));
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        this.emit('healthCheck', health);
        
        if (health.status === 'unhealthy') {
          console.warn('TTS service health check failed:', health.issues);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }
}

// Export singleton instance
let defaultTTSService: TTSService | null = null;

export const getDefaultTTSService = (config?: TTSConfig): TTSService => {
  if (!defaultTTSService) {
    defaultTTSService = new TTSService(config);
  }
  return defaultTTSService;
};

export default TTSService;
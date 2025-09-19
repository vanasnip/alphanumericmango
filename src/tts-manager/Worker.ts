/**
 * TTS Worker - Individual worker process for voice synthesis
 * Implements formal service contracts and health monitoring
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { WorkerCircuitBreaker } from './CircuitBreaker';
import { ProtocolNegotiator, IPCMessage, MessageType } from './ProtocolNegotiator';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkerConfig {
  modelName: string;
  cacheDir: string;
  pythonPath?: string;
  maxQueueSize?: number;
  healthCheckIntervalMs?: number;
  restartOnFailure?: boolean;
}

export interface WorkerStats {
  requestsProcessed: number;
  totalLatency: number;
  averageLatency: number;
  successRate: number;
  lastActivityTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface SynthesisRequest {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  outputFormat?: 'wav' | 'mp3' | 'ogg';
  outputPath?: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export interface SynthesisResult {
  success: boolean;
  requestId: string;
  outputPath?: string;
  duration?: number;
  latencyMs: number;
  error?: any;
  metadata?: {
    modelUsed: string;
    workerUsed: string;
    cacheHit: boolean;
  };
}

export enum WorkerState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  UNHEALTHY = 'unhealthy',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated'
}

export class Worker extends EventEmitter {
  public readonly id: string;
  private config: WorkerConfig;
  private process: ChildProcess | null = null;
  private state: WorkerState = WorkerState.INITIALIZING;
  private circuitBreaker: WorkerCircuitBreaker;
  private protocolNegotiator: ProtocolNegotiator;
  private responseBuffer: string = '';
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }>();
  
  private stats: WorkerStats = {
    requestsProcessed: 0,
    totalLatency: 0,
    averageLatency: 0,
    successRate: 1.0,
    lastActivityTime: Date.now()
  };
  
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(id: string, config: WorkerConfig) {
    super();
    
    this.id = id;
    this.config = {
      maxQueueSize: 10,
      healthCheckIntervalMs: 5000,
      restartOnFailure: true,
      pythonPath: 'python3',
      ...config
    };
    
    this.circuitBreaker = new WorkerCircuitBreaker(this.id, {
      failureThreshold: 0.5,
      timeoutMs: 10000,
      resetTimeoutMs: 30000,
      successThreshold: 3,
      slidingWindowSize: 10
    });
    
    this.protocolNegotiator = new ProtocolNegotiator();
    
    this.setupEventHandlers();
  }
  
  /**
   * Initialize worker process
   */
  async initialize(): Promise<void> {
    if (this.process) {
      throw new Error(`Worker ${this.id} already initialized`);
    }
    
    console.log(`Initializing worker ${this.id} with model: ${this.config.modelName}`);
    
    try {
      await this.spawnWorkerProcess();
      await this.waitForReady();
      
      this.state = WorkerState.READY;
      this.startHealthChecking();
      
      console.log(`Worker ${this.id} initialized successfully`);
      this.emit('ready');
    } catch (error) {
      this.state = WorkerState.UNHEALTHY;
      console.error(`Failed to initialize worker ${this.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Spawn Python worker process
   */
  private async spawnWorkerProcess(): Promise<void> {
    const scriptPath = path.join(__dirname, '../../modules/voice-engine/tts_service.py');
    
    // Check if Python script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`TTS service script not found: ${scriptPath}`);
    }
    
    // Determine Python executable
    const venvPath = path.join(path.dirname(scriptPath), 'venv');
    const pythonExec = fs.existsSync(venvPath) 
      ? path.join(venvPath, 'bin', 'python')
      : this.config.pythonPath!;
    
    // Spawn Python process
    this.process = spawn(pythonExec, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PYTHONUNBUFFERED: '1',
        TTS_MODEL: this.config.modelName,
        TTS_CACHE_DIR: this.config.cacheDir
      }
    });
    
    // Handle stdout (responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.responseBuffer += data.toString();
      this.processResponses();
    });
    
    // Handle stderr (logging)
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[Worker ${this.id}]`, message);
      }
    });
    
    // Handle process errors
    this.process.on('error', (error) => {
      console.error(`Worker ${this.id} process error:`, error);
      this.handleProcessError(error);
    });
    
    // Handle process exit
    this.process.on('close', (code, signal) => {
      console.log(`Worker ${this.id} process exited with code ${code}, signal ${signal}`);
      this.handleProcessExit(code, signal);
    });
  }
  
  /**
   * Wait for worker to be ready
   */
  private async waitForReady(timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${this.id} initialization timeout`));
      }, timeoutMs);
      
      const readyHandler = (message: IPCMessage) => {
        if (message.type === MessageType.EVENT && message.payload.status === 'ready') {
          clearTimeout(timeout);
          this.removeListener('message', readyHandler);
          resolve();
        }
      };
      
      this.on('message', readyHandler);
    });
  }
  
  /**
   * Process buffered responses from Python process
   */
  private processResponses(): void {
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = this.protocolNegotiator.parseMessage(line);
          this.handleMessage(message);
        } catch (error) {
          console.error(`Worker ${this.id} failed to parse message:`, line, error);
        }
      }
    }
  }
  
  /**
   * Handle incoming message from Python process
   */
  private handleMessage(message: IPCMessage): void {
    this.stats.lastActivityTime = Date.now();
    this.emit('message', message);
    
    // Handle response messages
    if (message.type === MessageType.RESPONSE || message.type === MessageType.ERROR) {
      const correlationId = message.metadata?.correlationId;
      if (correlationId) {
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
          this.pendingRequests.delete(correlationId);
          
          if (message.type === MessageType.ERROR) {
            pending.reject(new Error(message.payload.message || 'Unknown error'));
          } else {
            pending.resolve(message.payload);
          }
        }
      }
    }
    
    // Handle events
    if (message.type === MessageType.EVENT) {
      this.handleEvent(message.payload);
    }
  }
  
  /**
   * Handle event messages
   */
  private handleEvent(event: any): void {
    switch (event.type) {
      case 'model_loaded':
        console.log(`Worker ${this.id} loaded model: ${event.model}`);
        break;
      case 'cache_hit':
        console.log(`Worker ${this.id} cache hit for synthesis`);
        break;
      case 'synthesis_complete':
        this.updateStats(true, event.latency_ms);
        break;
      case 'synthesis_failed':
        this.updateStats(false, event.latency_ms);
        break;
    }
  }
  
  /**
   * Send command to Python process
   */
  private async sendCommand(command: any): Promise<any> {
    if (!this.process || this.state !== WorkerState.READY) {
      throw new Error(`Worker ${this.id} not ready for commands`);
    }
    
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.pendingRequests.size >= (this.config.maxQueueSize || 10)) {
        reject(new Error(`Worker ${this.id} queue full`));
        return;
      }
      
      // Create message
      const message = this.protocolNegotiator.createMessage(
        MessageType.REQUEST,
        command,
        '2.0.0',
        { workerId: this.id }
      );
      
      // Store pending request
      this.pendingRequests.set(message.messageId, {
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Send command
      const commandStr = JSON.stringify(message) + '\n';
      this.process?.stdin?.write(commandStr);
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(message.messageId)) {
          this.pendingRequests.delete(message.messageId);
          reject(new Error(`Worker ${this.id} request timeout`));
        }
      }, 15000); // 15 second timeout
    });
  }
  
  /**
   * Synthesize text to speech
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    if (!this.isHealthy()) {
      throw new Error(`Worker ${this.id} is not healthy`);
    }
    
    this.state = WorkerState.BUSY;
    
    try {
      const result = await this.circuitBreaker.synthesize(async () => {
        const response = await this.sendCommand({
          type: 'synthesize',
          text: request.text,
          voice: request.voice,
          speed: request.speed,
          pitch: request.pitch,
          output_format: request.outputFormat,
          output_path: request.outputPath
        });
        
        return {
          success: response.status === 'success',
          requestId: request.metadata?.requestId || this.generateRequestId(),
          outputPath: response.output_path,
          latencyMs: response.latency_ms || 0,
          metadata: {
            modelUsed: this.config.modelName,
            workerUsed: this.id,
            cacheHit: response.cache_hit || false
          }
        };
      });
      
      this.state = WorkerState.READY;
      return result;
    } catch (error) {
      this.state = WorkerState.READY;
      throw error;
    }
  }
  
  /**
   * Load voice model
   */
  async loadModel(modelName: string): Promise<void> {
    await this.sendCommand({
      type: 'switch_model',
      model: modelName
    });
    
    this.config.modelName = modelName;
  }
  
  /**
   * Get worker metrics
   */
  async getMetrics(): Promise<any> {
    const response = await this.sendCommand({
      type: 'get_metrics'
    });
    
    return {
      worker: this.stats,
      service: response.metrics
    };
  }
  
  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.process || this.state === WorkerState.TERMINATED) {
        return false;
      }
      
      // Send ping and wait for response
      await this.sendCommand({
        type: 'ping'
      });
      
      return true;
    } catch (error) {
      console.error(`Worker ${this.id} health check failed:`, error);
      return false;
    }
  }
  
  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy && this.state !== WorkerState.UNHEALTHY) {
        this.state = WorkerState.UNHEALTHY;
        this.emit('unhealthy', this.id);
      }
    }, this.config.healthCheckIntervalMs);
  }
  
  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
  
  /**
   * Handle process error
   */
  private handleProcessError(error: Error): void {
    this.state = WorkerState.UNHEALTHY;
    this.emit('error', error);
  }
  
  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.state = WorkerState.TERMINATED;
    this.process = null;
    this.stopHealthChecking();
    
    // Reject all pending requests
    for (const [messageId, pending] of this.pendingRequests) {
      pending.reject(new Error(`Worker ${this.id} process terminated`));
    }
    this.pendingRequests.clear();
    
    this.emit('exit', { code, signal });
  }
  
  /**
   * Update worker statistics
   */
  private updateStats(success: boolean, latencyMs: number): void {
    this.stats.requestsProcessed++;
    this.stats.totalLatency += latencyMs;
    this.stats.averageLatency = this.stats.totalLatency / this.stats.requestsProcessed;
    
    // Update success rate with exponential moving average
    const alpha = 0.1;
    this.stats.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * this.stats.successRate;
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.circuitBreaker.on('workerFailure', (event) => {
      console.error(`Circuit breaker detected failure in worker ${this.id}:`, event);
    });
    
    this.circuitBreaker.on('stateChange', (event) => {
      console.log(`Worker ${this.id} circuit breaker state: ${event.from} -> ${event.to}`);
    });
  }
  
  /**
   * Check if worker is healthy
   */
  isHealthy(): boolean {
    return this.state === WorkerState.READY || this.state === WorkerState.BUSY;
  }
  
  /**
   * Get worker state
   */
  getState(): WorkerState {
    return this.state;
  }
  
  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    return { ...this.stats };
  }
  
  /**
   * Get queue depth
   */
  getQueueDepth(): number {
    return this.pendingRequests.size;
  }
  
  /**
   * Shutdown worker
   */
  async shutdown(): Promise<void> {
    console.log(`Shutting down worker ${this.id}...`);
    
    this.state = WorkerState.SHUTTING_DOWN;
    this.stopHealthChecking();
    
    if (this.process) {
      try {
        // Send shutdown command
        await this.sendCommand({ type: 'shutdown' });
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error during graceful shutdown of worker ${this.id}:`, error);
      }
      
      // Force kill if still running
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      }
    }
    
    this.state = WorkerState.TERMINATED;
    console.log(`Worker ${this.id} shutdown complete`);
  }
}
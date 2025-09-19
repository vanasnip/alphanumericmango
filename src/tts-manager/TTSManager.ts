/**
 * TTS Manager - Orchestrates worker pool and provides service management
 * Part of the medium-term architecture enhancement plan
 */

import { EventEmitter } from 'events';
import { Worker } from './Worker';
import { LoadBalancer } from './LoadBalancer';
import { CircuitBreaker } from './CircuitBreaker';
import { HealthMonitor } from './HealthMonitor';
import { ProtocolNegotiator } from './ProtocolNegotiator';

export interface TTSManagerConfig {
  workerPool: {
    minWorkers: number;
    maxWorkers: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    workerTimeoutMs: number;
    modelSpecialization: boolean;
  };
  circuitBreaker: {
    failureThreshold: number;
    timeoutMs: number;
    resetTimeoutMs: number;
    successThreshold: number;
    slidingWindowSize: number;
  };
  protocol: {
    version: string;
    enableBackwardCompatibility: boolean;
  };
  models: {
    preloadModels: string[];
    cacheDir: string;
    maxCacheSize: number;
  };
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
  error?: ServiceError;
  metadata?: {
    modelUsed: string;
    workerUsed: string;
    cacheHit: boolean;
  };
}

export interface ServiceError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

export enum ErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  SYNTHESIS_FAILED = 'SYNTHESIS_FAILED',
  TIMEOUT = 'TIMEOUT',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  INVALID_REQUEST = 'INVALID_REQUEST'
}

export class TTSManager extends EventEmitter {
  private config: TTSManagerConfig;
  private workers: Map<string, Worker> = new Map();
  private loadBalancer: LoadBalancer;
  private circuitBreaker: CircuitBreaker;
  private healthMonitor: HealthMonitor;
  private protocolNegotiator: ProtocolNegotiator;
  private isInitialized: boolean = false;
  private requestQueue: SynthesisRequest[] = [];
  
  constructor(config: Partial<TTSManagerConfig> = {}) {
    super();
    
    this.config = {
      workerPool: {
        minWorkers: config.workerPool?.minWorkers ?? 1,
        maxWorkers: config.workerPool?.maxWorkers ?? 3,
        scaleUpThreshold: config.workerPool?.scaleUpThreshold ?? 5,
        scaleDownThreshold: config.workerPool?.scaleDownThreshold ?? 30000,
        workerTimeoutMs: config.workerPool?.workerTimeoutMs ?? 30000,
        modelSpecialization: config.workerPool?.modelSpecialization ?? false,
        ...config.workerPool
      },
      circuitBreaker: {
        failureThreshold: config.circuitBreaker?.failureThreshold ?? 0.5,
        timeoutMs: config.circuitBreaker?.timeoutMs ?? 10000,
        resetTimeoutMs: config.circuitBreaker?.resetTimeoutMs ?? 60000,
        successThreshold: config.circuitBreaker?.successThreshold ?? 3,
        slidingWindowSize: config.circuitBreaker?.slidingWindowSize ?? 10,
        ...config.circuitBreaker
      },
      protocol: {
        version: config.protocol?.version ?? '2.0.0',
        enableBackwardCompatibility: config.protocol?.enableBackwardCompatibility ?? true,
        ...config.protocol
      },
      models: {
        preloadModels: config.models?.preloadModels ?? ['default'],
        cacheDir: config.models?.cacheDir ?? process.env.HOME + '/.cache/coqui_tts',
        maxCacheSize: config.models?.maxCacheSize ?? 100,
        ...config.models
      }
    };
    
    this.loadBalancer = new LoadBalancer(this.config.workerPool);
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.healthMonitor = new HealthMonitor(this.config.workerPool.workerTimeoutMs);
    this.protocolNegotiator = new ProtocolNegotiator();
    
    this.setupEventHandlers();
  }
  
  /**
   * Initialize TTS Manager and worker pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('TTSManager already initialized');
    }
    
    console.log('Initializing TTS Manager with config:', this.config);
    
    try {
      // Start minimum number of workers
      await this.scaleWorkers(this.config.workerPool.minWorkers);
      
      // Preload models if specified
      if (this.config.models.preloadModels.length > 0) {
        await this.preloadModels(this.config.models.preloadModels);
      }
      
      // Start health monitoring
      this.healthMonitor.start();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('TTS Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TTS Manager:', error);
      throw error;
    }
  }
  
  /**
   * Synthesize text to speech
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    if (!this.isInitialized) {
      throw new Error('TTSManager not initialized');
    }
    
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Execute through circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return await this.executeSynthesis({ ...request, metadata: { ...request.metadata, requestId } });
      });
      
      const latencyMs = Date.now() - startTime;
      
      return {
        ...result,
        requestId,
        latencyMs
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      return {
        success: false,
        requestId,
        latencyMs,
        error: {
          code: this.classifyError(error),
          message: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error)
        }
      };
    }
  }
  
  /**
   * Execute synthesis request through worker pool
   */
  private async executeSynthesis(request: SynthesisRequest): Promise<SynthesisResult> {
    // Select appropriate worker
    const worker = await this.selectWorker(request);
    
    if (!worker) {
      throw new Error('No available workers');
    }
    
    // Execute synthesis
    const result = await worker.synthesize(request);
    
    // Update load balancer metrics
    this.loadBalancer.recordRequest(worker.id, result.latencyMs);
    
    return result;
  }
  
  /**
   * Select optimal worker for request
   */
  private async selectWorker(request: SynthesisRequest): Promise<Worker | null> {
    const availableWorkers = Array.from(this.workers.values()).filter(w => w.isHealthy());
    
    if (availableWorkers.length === 0) {
      // Try to scale up if possible
      if (this.workers.size < this.config.workerPool.maxWorkers) {
        await this.addWorker();
        return Array.from(this.workers.values()).find(w => w.isHealthy()) || null;
      }
      return null;
    }
    
    // Use load balancer to select worker
    return this.loadBalancer.selectWorker(availableWorkers, request);
  }
  
  /**
   * Scale worker pool to target size
   */
  private async scaleWorkers(targetCount: number): Promise<void> {
    const currentCount = this.workers.size;
    
    if (targetCount > currentCount) {
      // Scale up
      const workersToAdd = targetCount - currentCount;
      for (let i = 0; i < workersToAdd; i++) {
        await this.addWorker();
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const workersToRemove = currentCount - targetCount;
      const workerIds = Array.from(this.workers.keys());
      
      for (let i = 0; i < workersToRemove; i++) {
        const workerId = workerIds[i];
        await this.removeWorker(workerId);
      }
    }
  }
  
  /**
   * Add new worker to pool
   */
  private async addWorker(): Promise<Worker> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const worker = new Worker(workerId, {
      modelName: this.config.models.preloadModels[0] || 'default',
      cacheDir: this.config.models.cacheDir
    });
    
    // Set up worker event handlers
    worker.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
      this.handleWorkerFailure(workerId, error);
    });
    
    worker.on('ready', () => {
      console.log(`Worker ${workerId} ready`);
      this.emit('workerStarted', workerId);
    });
    
    // Initialize worker
    await worker.initialize();
    
    // Add to pool
    this.workers.set(workerId, worker);
    
    // Start health monitoring
    this.healthMonitor.addWorker(worker);
    
    console.log(`Added worker ${workerId} to pool`);
    return worker;
  }
  
  /**
   * Remove worker from pool
   */
  private async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }
    
    try {
      // Stop health monitoring
      this.healthMonitor.removeWorker(worker);
      
      // Graceful shutdown
      await worker.shutdown();
      
      // Remove from pool
      this.workers.delete(workerId);
      
      console.log(`Removed worker ${workerId} from pool`);
      this.emit('workerStopped', workerId);
    } catch (error) {
      console.error(`Error removing worker ${workerId}:`, error);
    }
  }
  
  /**
   * Handle worker failure
   */
  private async handleWorkerFailure(workerId: string, error: Error): Promise<void> {
    console.error(`Worker ${workerId} failed:`, error);
    
    // Remove failed worker
    await this.removeWorker(workerId);
    
    // Replace with new worker if below minimum
    if (this.workers.size < this.config.workerPool.minWorkers) {
      try {
        await this.addWorker();
      } catch (addError) {
        console.error('Failed to replace failed worker:', addError);
      }
    }
    
    this.emit('workerFailed', { workerId, error });
  }
  
  /**
   * Preload models into worker pool
   */
  private async preloadModels(modelNames: string[]): Promise<void> {
    const workers = Array.from(this.workers.values());
    
    for (const modelName of modelNames) {
      // Load model in first available worker
      const worker = workers.find(w => w.isHealthy());
      if (worker) {
        try {
          await worker.loadModel(modelName);
          console.log(`Preloaded model ${modelName} in worker ${worker.id}`);
        } catch (error) {
          console.error(`Failed to preload model ${modelName}:`, error);
        }
      }
    }
  }
  
  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Health monitor events
    this.healthMonitor.on('workerUnhealthy', async (workerId: string) => {
      console.warn(`Worker ${workerId} is unhealthy`);
      await this.handleWorkerFailure(workerId, new Error('Health check failed'));
    });
    
    // Circuit breaker events
    this.circuitBreaker.on('stateChange', (state: string) => {
      console.log(`Circuit breaker state changed to: ${state}`);
      this.emit('circuitBreakerStateChange', state);
    });
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Classify error for appropriate handling
   */
  private classifyError(error: any): ErrorCode {
    if (error.message?.includes('timeout')) {
      return ErrorCode.TIMEOUT;
    }
    if (error.message?.includes('model')) {
      return ErrorCode.MODEL_NOT_FOUND;
    }
    if (error.message?.includes('resource')) {
      return ErrorCode.RESOURCE_EXHAUSTED;
    }
    return ErrorCode.SYNTHESIS_FAILED;
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const code = this.classifyError(error);
    return [ErrorCode.TIMEOUT, ErrorCode.RESOURCE_EXHAUSTED].includes(code);
  }
  
  /**
   * Get service status and metrics
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      workerCount: this.workers.size,
      healthyWorkers: Array.from(this.workers.values()).filter(w => w.isHealthy()).length,
      circuitBreakerState: this.circuitBreaker.getState(),
      queueDepth: this.requestQueue.length,
      config: this.config
    };
  }
  
  /**
   * Shutdown TTS Manager and all workers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down TTS Manager...');
    
    // Stop health monitoring
    this.healthMonitor.stop();
    
    // Shutdown all workers
    const shutdownPromises = Array.from(this.workers.values()).map(worker => 
      worker.shutdown().catch(error => 
        console.error(`Error shutting down worker ${worker.id}:`, error)
      )
    );
    
    await Promise.all(shutdownPromises);
    
    this.workers.clear();
    this.isInitialized = false;
    
    console.log('TTS Manager shutdown complete');
    this.emit('shutdown');
  }
}
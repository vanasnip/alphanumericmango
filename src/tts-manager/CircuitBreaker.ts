/**
 * Circuit Breaker Implementation for TTS Service
 * Provides fault tolerance and automatic failure handling
 */

import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, rejecting requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failure rate to open circuit (0.0-1.0)
  timeoutMs: number;          // Request timeout
  resetTimeoutMs: number;     // Time before half-open attempt
  successThreshold: number;   // Successes to close from half-open
  slidingWindowSize: number;  // Window for failure rate calculation
}

interface CircuitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private slidingWindow: boolean[] = [];
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private stats: CircuitStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    failureRate: 0,
    averageResponseTime: 0,
    lastFailureTime: 0
  };
  
  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }
  
  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - request rejected');
      }
    }
    
    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);
      const responseTime = Date.now() - startTime;
      
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error, responseTime);
      throw error;
    }
  }
  
  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  /**
   * Handle successful operation
   */
  private onSuccess(responseTime: number): void {
    this.recordSuccess();
    this.updateStats(true, responseTime);
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // If enough successes, close the circuit
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.resetStats();
      }
    }
  }
  
  /**
   * Handle failed operation
   */
  private onFailure(error: any, responseTime: number): void {
    this.recordFailure();
    this.updateStats(false, responseTime);
    this.lastFailureTime = Date.now();
    
    // Calculate failure rate and decide if circuit should open
    const failureRate = this.calculateFailureRate();
    
    if (failureRate >= this.config.failureThreshold) {
      if (this.state !== CircuitState.OPEN) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.transitionTo(CircuitState.OPEN);
    }
    
    this.emit('failure', {
      error: error.message,
      failureRate,
      responseTime,
      state: this.state
    });
  }
  
  /**
   * Record successful operation in sliding window
   */
  private recordSuccess(): void {
    this.slidingWindow.push(true);
    this.trimWindow();
  }
  
  /**
   * Record failed operation in sliding window
   */
  private recordFailure(): void {
    this.slidingWindow.push(false);
    this.trimWindow();
  }
  
  /**
   * Trim sliding window to configured size
   */
  private trimWindow(): void {
    if (this.slidingWindow.length > this.config.slidingWindowSize) {
      this.slidingWindow = this.slidingWindow.slice(-this.config.slidingWindowSize);
    }
  }
  
  /**
   * Calculate current failure rate
   */
  private calculateFailureRate(): number {
    if (this.slidingWindow.length === 0) {
      return 0;
    }
    
    const failures = this.slidingWindow.filter(success => !success).length;
    return failures / this.slidingWindow.length;
  }
  
  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.config.resetTimeoutMs;
  }
  
  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`Circuit breaker state transition: ${oldState} -> ${newState}`);
    
    this.emit('stateChange', {
      from: oldState,
      to: newState,
      timestamp: new Date(),
      stats: this.getStats()
    });
    
    // Reset success count when transitioning
    if (newState === CircuitState.CLOSED || newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }
  
  /**
   * Update circuit breaker statistics
   */
  private updateStats(success: boolean, responseTime: number): void {
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
      this.stats.lastFailureTime = Date.now();
    }
    
    this.stats.failureRate = this.calculateFailureRate();
    
    // Update average response time using exponential moving average
    const alpha = 0.1; // Smoothing factor
    this.stats.averageResponseTime = alpha * responseTime + (1 - alpha) * this.stats.averageResponseTime;
  }
  
  /**
   * Reset statistics (typically when circuit closes)
   */
  private resetStats(): void {
    this.slidingWindow = [];
    this.successCount = 0;
    // Keep cumulative stats but reset failure tracking
    this.stats.failureRate = 0;
  }
  
  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitStats {
    return {
      ...this.stats,
      failureRate: this.calculateFailureRate()
    };
  }
  
  /**
   * Check if circuit breaker is accepting requests
   */
  isRequestAllowed(): boolean {
    return this.state !== CircuitState.OPEN;
  }
  
  /**
   * Manually force circuit breaker to open (for testing or emergency)
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
    this.lastFailureTime = Date.now();
  }
  
  /**
   * Manually force circuit breaker to close (for testing or recovery)
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.resetStats();
  }
  
  /**
   * Get detailed status for monitoring
   */
  getDetailedStatus(): any {
    return {
      state: this.state,
      config: this.config,
      stats: this.getStats(),
      slidingWindow: {
        size: this.slidingWindow.length,
        maxSize: this.config.slidingWindowSize,
        recentResults: this.slidingWindow.slice(-10) // Last 10 results
      },
      timing: {
        lastFailureTime: this.stats.lastFailureTime,
        timeSinceLastFailure: this.stats.lastFailureTime ? Date.now() - this.stats.lastFailureTime : null,
        canAttemptReset: this.shouldAttemptReset()
      }
    };
  }
}

/**
 * Worker-specific circuit breaker that includes worker identification
 */
export class WorkerCircuitBreaker extends CircuitBreaker {
  constructor(
    private workerId: string,
    config: CircuitBreakerConfig
  ) {
    super(config);
  }
  
  /**
   * Execute TTS synthesis operation with worker context
   */
  async synthesize(operation: () => Promise<any>): Promise<any> {
    try {
      const result = await this.execute(operation);
      
      this.emit('workerSuccess', {
        workerId: this.workerId,
        timestamp: Date.now(),
        responseTime: result.latencyMs
      });
      
      return result;
    } catch (error) {
      this.emit('workerFailure', {
        workerId: this.workerId,
        error: error.message,
        timestamp: Date.now(),
        state: this.getState()
      });
      
      throw error;
    }
  }
  
  /**
   * Get worker-specific status
   */
  getWorkerStatus(): any {
    return {
      workerId: this.workerId,
      ...this.getDetailedStatus()
    };
  }
}
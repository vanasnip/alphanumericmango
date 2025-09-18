/**
 * Production-Grade Circuit Breaker Implementation
 * Provides service-level protection for all external dependencies
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringWindow: number;
  volumeThreshold: number;
  onStateChange?: (state: CircuitState, error?: Error) => void;
  onFallback?: (error: Error) => any;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  rejectedRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  state: CircuitState;
  uptime: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private nextAttempt: number = 0;
  private metrics: CircuitBreakerMetrics;
  private recentResults: boolean[] = [];
  private readonly config: CircuitBreakerConfig;

  constructor(private readonly name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 30000,
      resetTimeout: config.resetTimeout || 60000,
      monitoringWindow: config.monitoringWindow || 60000,
      volumeThreshold: config.volumeThreshold || 10,
      onStateChange: config.onStateChange,
      onFallback: config.onFallback
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      rejectedRequests: 0,
      state: this.state,
      uptime: Date.now()
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.metrics.rejectedRequests++;
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        if (fallback) {
          return await this.executeFallback(fallback, error);
        }
        throw error;
      } else {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      if (fallback) {
        return await this.executeFallback(fallback, error as Error);
      }
      throw error;
    }
  }

  /**
   * Execute function with timeout protection
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error(`Circuit breaker ${this.name} timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute fallback function safely
   */
  private async executeFallback<T>(fallback: () => Promise<T>, originalError: Error): Promise<T> {
    try {
      if (this.config.onFallback) {
        this.config.onFallback(originalError);
      }
      return await fallback();
    } catch (fallbackError) {
      // If fallback fails, throw original error
      throw originalError;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = Date.now();
    this.recordResult(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failures++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = Date.now();
    this.recordResult(false);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.shouldTrip()) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Check if circuit breaker should trip to OPEN state
   */
  private shouldTrip(): boolean {
    // Must have minimum volume of requests
    if (this.metrics.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check failure rate in recent window
    const recentFailures = this.recentResults.filter(result => !result).length;
    const failureRate = recentFailures / this.recentResults.length;
    
    return failureRate >= (this.config.failureThreshold / 100);
  }

  /**
   * Record recent result for failure rate calculation
   */
  private recordResult(success: boolean): void {
    this.recentResults.push(success);
    
    // Keep only results within monitoring window
    const windowSize = Math.max(this.config.volumeThreshold, 20);
    if (this.recentResults.length > windowSize) {
      this.recentResults.shift();
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    } else if (newState === CircuitState.CLOSED) {
      this.successes = 0;
      this.failures = 0;
    }

    if (this.config.onStateChange && oldState !== newState) {
      this.config.onStateChange(newState);
    }

    console.log(`Circuit breaker ${this.name} state changed: ${oldState} -> ${newState}`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.recentResults = [];
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN;
  }
}

/**
 * Circuit Breaker Manager for handling multiple breakers
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute function with named circuit breaker
   */
  async execute<T>(
    breakerName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(breakerName, config);
    return breaker.execute(fn, fallback);
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get health status of all breakers
   */
  getHealthStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.isHealthy();
    }
    return status;
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

export default CircuitBreaker;
/**
 * Custom Error Types for VAL-003 Validation Framework
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BenchmarkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BenchmarkError';
  }
}

export class ModelError extends Error {
  constructor(
    message: string,
    public readonly modelType: string,
    public readonly modelName: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export class ResourceError extends Error {
  constructor(
    message: string,
    public readonly resourceType: 'memory' | 'cpu' | 'disk' | 'network',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ResourceError';
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configKey: string,
    public readonly configValue: unknown,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operation: string
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Error codes for consistent error handling
export const ErrorCodes = {
  // Validation errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_RANGE: 'INVALID_RANGE',
  
  // Benchmark errors
  BENCHMARK_NOT_INITIALIZED: 'BENCHMARK_NOT_INITIALIZED',
  BENCHMARK_FAILED: 'BENCHMARK_FAILED',
  INSUFFICIENT_SAMPLES: 'INSUFFICIENT_SAMPLES',
  
  // Model errors
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  MODEL_NOT_LOADED: 'MODEL_NOT_LOADED',
  MODEL_INFERENCE_FAILED: 'MODEL_INFERENCE_FAILED',
  
  // Resource errors
  INSUFFICIENT_MEMORY: 'INSUFFICIENT_MEMORY',
  HIGH_CPU_USAGE: 'HIGH_CPU_USAGE',
  DISK_SPACE_LOW: 'DISK_SPACE_LOW',
  
  // Timeout errors
  BENCHMARK_TIMEOUT: 'BENCHMARK_TIMEOUT',
  MODEL_LOAD_TIMEOUT: 'MODEL_LOAD_TIMEOUT',
  INFERENCE_TIMEOUT: 'INFERENCE_TIMEOUT'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error handler utility for consistent error processing
 */
export class ErrorHandler {
  private static logError(error: Error, context?: Record<string, unknown>): void {
    console.error(`[${error.name}] ${error.message}`);
    if (context) {
      console.error('Context:', JSON.stringify(context, null, 2));
    }
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
  
  static handleValidationError(
    message: string,
    code: ErrorCode,
    context?: Record<string, unknown>
  ): never {
    const error = new ValidationError(message, code, context);
    this.logError(error, context);
    throw error;
  }
  
  static handleBenchmarkError(
    message: string,
    code: ErrorCode,
    context?: Record<string, unknown>
  ): never {
    const error = new BenchmarkError(message, code, context);
    this.logError(error, context);
    throw error;
  }
  
  static handleModelError(
    message: string,
    modelType: string,
    modelName: string,
    context?: Record<string, unknown>
  ): never {
    const error = new ModelError(message, modelType, modelName, context);
    this.logError(error, context);
    throw error;
  }
  
  static handleResourceError(
    message: string,
    resourceType: 'memory' | 'cpu' | 'disk' | 'network',
    context?: Record<string, unknown>
  ): never {
    const error = new ResourceError(message, resourceType, context);
    this.logError(error, context);
    throw error;
  }
  
  static handleConfigurationError(
    message: string,
    configKey: string,
    configValue: unknown,
    context?: Record<string, unknown>
  ): never {
    const error = new ConfigurationError(message, configKey, configValue, context);
    this.logError(error, context);
    throw error;
  }
  
  static handleTimeoutError(
    message: string,
    timeoutMs: number,
    operation: string
  ): never {
    const error = new TimeoutError(message, timeoutMs, operation);
    this.logError(error);
    throw error;
  }
  
  /**
   * Safely execute an async operation with timeout and error handling
   */
  static async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          timeoutMs,
          operationName
        ));
      }, timeoutMs);
    });
    
    try {
      return await Promise.race([operation, timeoutPromise]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logError(error);
      }
      throw error;
    }
  }
  
  /**
   * Retry operation with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          console.error(`Operation '${operationName}' failed after ${maxRetries} attempts`);
          throw lastError;
        }
        
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Operation '${operationName}' failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}
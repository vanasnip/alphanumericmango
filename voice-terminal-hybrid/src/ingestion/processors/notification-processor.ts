/**
 * Common notification processor that handles all ingestion sources
 */

import { nanoid } from 'nanoid';
import { validateRawNotification, validateProcessedNotification, sanitizeNotification, getValidationErrorMessage } from '../schema/index.js';
import { createDefaultTransformerRegistry } from '../transformers/index.js';
import type { 
  BaseNotification, 
  RawNotificationPayload, 
  IngestionResult, 
  IngestionSource,
  NotificationTransformer,
  TransformerRegistry
} from '../types/index.js';

export interface NotificationProcessorOptions {
  transformerRegistry?: TransformerRegistry;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
    debug: (message: string, meta?: any) => void;
  };
  onNotificationProcessed?: (notification: BaseNotification, source: IngestionSource) => Promise<void>;
  onProcessingError?: (error: any, payload: any, source: IngestionSource) => Promise<void>;
}

/**
 * Main notification processor that handles all ingestion sources
 */
export class NotificationProcessor {
  private transformerRegistry: TransformerRegistry;
  private options: NotificationProcessorOptions;

  constructor(options: NotificationProcessorOptions = {}) {
    this.options = options;
    this.transformerRegistry = options.transformerRegistry || createDefaultTransformerRegistry();
  }

  /**
   * Process a notification from any ingestion source
   */
  public async processNotification(payload: any, source: IngestionSource): Promise<IngestionResult> {
    const startTime = Date.now();
    
    this.options.logger?.debug('Processing notification', {
      source,
      payloadType: typeof payload,
      payloadSize: JSON.stringify(payload).length
    });

    try {
      // Step 1: Transform payload to standard format
      const transformResult = this.transformerRegistry.transform(payload);
      
      if (!transformResult.success) {
        return this.createFailureResult(
          'TRANSFORMATION_FAILED',
          transformResult.error || 'Failed to transform payload',
          source,
          payload
        );
      }

      // Step 2: Validate raw notification data
      const validationResult = validateRawNotification(transformResult.data);
      
      if (!validationResult.isValid) {
        return this.createFailureResult(
          'VALIDATION_FAILED',
          getValidationErrorMessage(validationResult),
          source,
          payload,
          validationResult.details
        );
      }

      // Step 3: Sanitize the notification
      const sanitizedData = sanitizeNotification(validationResult.data!);

      // Step 4: Process and enrich the notification
      const processedNotification = await this.enrichNotification(sanitizedData, source);

      // Step 5: Final validation of processed notification
      const finalValidation = validateProcessedNotification(processedNotification);
      
      if (!finalValidation.isValid) {
        return this.createFailureResult(
          'FINAL_VALIDATION_FAILED',
          'Processed notification failed validation',
          source,
          payload,
          finalValidation.details
        );
      }

      const processingTime = Date.now() - startTime;

      this.options.logger?.info('Notification processed successfully', {
        notificationId: processedNotification.id,
        source,
        processingTime,
        transformerUsed: transformResult.data?._original ? 'detected' : 'generic',
        confidence: transformResult.confidence
      });

      // Trigger callback if provided
      if (this.options.onNotificationProcessed) {
        try {
          await this.options.onNotificationProcessed(processedNotification, source);
        } catch (callbackError) {
          this.options.logger?.warn('Notification processed callback failed', {
            notificationId: processedNotification.id,
            error: callbackError instanceof Error ? callbackError.message : String(callbackError)
          });
        }
      }

      return {
        success: true,
        notification: processedNotification,
        source
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.options.logger?.error('Notification processing error', {
        source,
        processingTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Trigger error callback if provided
      if (this.options.onProcessingError) {
        try {
          await this.options.onProcessingError(error, payload, source);
        } catch (callbackError) {
          this.options.logger?.error('Error callback failed', {
            error: callbackError instanceof Error ? callbackError.message : String(callbackError)
          });
        }
      }

      return this.createFailureResult(
        'PROCESSING_ERROR',
        error instanceof Error ? error.message : String(error),
        source,
        payload
      );
    }
  }

  /**
   * Enrich raw notification with additional processing
   */
  private async enrichNotification(data: RawNotificationPayload, source: IngestionSource): Promise<BaseNotification> {
    const notification: BaseNotification = {
      id: data.id || nanoid(),
      title: data.title,
      source: data.source,
      timestamp: this.parseTimestamp(data.timestamp),
      content: data.content,
      priority: data.priority || 3,
      metadata: {
        ...data.metadata,
        ingestionSource: source,
        processedAt: new Date().toISOString(),
        originalPayloadSize: data._original ? JSON.stringify(data._original).length : undefined
      },
      actions: data.actions,
      tags: this.enrichTags(data.tags, source)
    };

    return notification;
  }

  /**
   * Parse timestamp from various formats
   */
  private parseTimestamp(timestamp?: string | Date): Date {
    if (!timestamp) {
      return new Date();
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Fallback to current time
    return new Date();
  }

  /**
   * Enrich tags with ingestion source and auto-detected tags
   */
  private enrichTags(existingTags: string[] = [], source: IngestionSource): string[] {
    const tags = new Set(existingTags);
    
    // Add ingestion source tag
    tags.add(`ingestion:${source}`);
    
    // Add timestamp-based tags
    const now = new Date();
    tags.add(`hour:${now.getHours()}`);
    tags.add(`day:${now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}`);
    
    return Array.from(tags).slice(0, 20); // Limit to 20 tags
  }

  /**
   * Create a failure result
   */
  private createFailureResult(
    code: string,
    message: string,
    source: IngestionSource,
    originalPayload?: any,
    details?: any
  ): IngestionResult {
    return {
      success: false,
      error: {
        code,
        message,
        details: {
          ...details,
          originalPayload: originalPayload ? JSON.stringify(originalPayload).slice(0, 1000) : undefined
        }
      },
      source
    };
  }

  /**
   * Register a custom transformer
   */
  public registerTransformer(transformer: NotificationTransformer): void {
    this.transformerRegistry.register(transformer);
    
    this.options.logger?.info('Custom transformer registered', {
      name: transformer.name,
      priority: transformer.priority
    });
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    transformers: Array<{ name: string; priority: number }>;
  } {
    return {
      transformers: this.transformerRegistry.getAll().map(t => ({
        name: t.name,
        priority: t.priority
      }))
    };
  }

  /**
   * Test transformation without processing
   */
  public async testTransformation(payload: any): Promise<{
    suggestions: Array<{ name: string; confidence: number }>;
    selected?: { name: string; result: any };
    error?: string;
  }> {
    try {
      const suggestions = this.transformerRegistry.getSuggestions(payload);
      
      if (suggestions.length === 0) {
        return {
          suggestions: [],
          error: 'No suitable transformers found'
        };
      }

      const result = this.transformerRegistry.transform(payload);
      
      return {
        suggestions,
        selected: result.success ? {
          name: suggestions[0]?.name || 'unknown',
          result: result.data
        } : undefined,
        error: result.success ? undefined : result.error
      };
    } catch (error) {
      return {
        suggestions: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate a payload without processing
   */
  public validatePayload(payload: any): {
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Test transformation
    const transformResult = this.transformerRegistry.transform(payload);
    
    if (!transformResult.success) {
      errors.push(`Transformation failed: ${transformResult.error}`);
      suggestions.push('Ensure payload contains "title" and "source" fields');
      
      return { isValid: false, errors, suggestions };
    }

    // Test validation
    const validationResult = validateRawNotification(transformResult.data);
    
    if (!validationResult.isValid) {
      errors.push(getValidationErrorMessage(validationResult));
      
      if (!transformResult.data?.title) {
        suggestions.push('Add a "title" field with a descriptive message');
      }
      if (!transformResult.data?.source) {
        suggestions.push('Add a "source" field identifying the notification origin');
      }
    }

    return {
      isValid: validationResult.isValid,
      errors,
      suggestions
    };
  }
}
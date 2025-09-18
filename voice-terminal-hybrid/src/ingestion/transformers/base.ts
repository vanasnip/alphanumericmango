/**
 * Base transformer interface and registry
 */

import type { NotificationTransformer, TransformerResult, RawNotificationPayload } from '../types/index.js';

export abstract class BaseTransformer implements NotificationTransformer {
  abstract name: string;
  abstract priority: number;

  abstract detect(payload: any): boolean;
  abstract transform(payload: any): TransformerResult;

  /**
   * Helper method to create a successful transformation result
   */
  protected success(data: RawNotificationPayload, confidence: number = 1.0): TransformerResult {
    return {
      success: true,
      data,
      confidence
    };
  }

  /**
   * Helper method to create a failed transformation result
   */
  protected failure(error: string, confidence: number = 0.0): TransformerResult {
    return {
      success: false,
      error,
      confidence
    };
  }

  /**
   * Helper method to safely get nested object properties
   */
  protected get(obj: any, path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result !== undefined ? result : defaultValue;
  }

  /**
   * Helper method to ensure a value is a string
   */
  protected toString(value: any, defaultValue: string = ''): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  }

  /**
   * Helper method to ensure a value is a number within range
   */
  protected toPriority(value: any): 1 | 2 | 3 | 4 | 5 | undefined {
    const num = Number(value);
    if (isNaN(num)) return undefined;
    if (num < 1) return 1;
    if (num > 5) return 5;
    return Math.round(num) as 1 | 2 | 3 | 4 | 5;
  }

  /**
   * Helper method to parse ISO date strings
   */
  protected parseDate(value: any): Date | string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      // Try to parse as ISO date
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      // Return original string if not parseable
      return value;
    }
    return undefined;
  }
}

/**
 * Transformer registry for managing and selecting transformers
 */
export class TransformerRegistry {
  private transformers: NotificationTransformer[] = [];

  /**
   * Register a transformer
   */
  register(transformer: NotificationTransformer): void {
    this.transformers.push(transformer);
    // Sort by priority (higher priority first)
    this.transformers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all registered transformers
   */
  getAll(): NotificationTransformer[] {
    return [...this.transformers];
  }

  /**
   * Find the best transformer for a payload
   */
  findBest(payload: any): NotificationTransformer | null {
    for (const transformer of this.transformers) {
      if (transformer.detect(payload)) {
        return transformer;
      }
    }
    return null;
  }

  /**
   * Transform payload using the best available transformer
   */
  transform(payload: any): TransformerResult {
    const transformer = this.findBest(payload);
    
    if (!transformer) {
      return {
        success: false,
        error: 'No suitable transformer found for payload',
        confidence: 0
      };
    }

    try {
      return transformer.transform(payload);
    } catch (error) {
      return {
        success: false,
        error: `Transformer "${transformer.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0
      };
    }
  }

  /**
   * Get transformation suggestions for a payload
   */
  getSuggestions(payload: any): Array<{ name: string; confidence: number }> {
    return this.transformers
      .filter(t => t.detect(payload))
      .map(t => {
        try {
          const result = t.transform(payload);
          return { name: t.name, confidence: result.confidence };
        } catch {
          return { name: t.name, confidence: 0 };
        }
      })
      .sort((a, b) => b.confidence - a.confidence);
  }
}
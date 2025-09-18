/**
 * Conflict Resolution Strategies
 * Handles data conflicts during synchronization
 */

import type { 
  SyncConflict, 
  ConflictResolver,
  SyncMetadata 
} from './interfaces.js';

export interface ConflictResolutionOptions {
  defaultStrategy: 'newest' | 'local' | 'remote' | 'manual';
  fieldPriorities?: Record<string, 'local' | 'remote'>;
  customResolvers?: Record<string, ConflictResolver>;
  manualReviewRequired?: boolean;
}

export interface ResolvedConflict {
  resolution: 'local' | 'remote' | 'newest' | 'merged';
  resolvedData: Record<string, any>;
  confidence: number; // 0-1, how confident we are in the resolution
  reasoning: string;
  requiresManualReview: boolean;
}

/**
 * Main conflict resolver class
 */
export class ConflictResolver {
  constructor(private options: ConflictResolutionOptions = { defaultStrategy: 'newest' }) {}

  /**
   * Resolve a conflict using configured strategies
   */
  async resolveConflict(conflict: SyncConflict): Promise<ResolvedConflict> {
    const { entityType, localData, remoteData, localTimestamp, remoteTimestamp } = conflict;

    // Check for custom resolver first
    if (this.options.customResolvers?.[entityType]) {
      const customResolver = this.options.customResolvers[entityType];
      const resolution = await customResolver(conflict);
      
      return {
        resolution,
        resolvedData: resolution === 'local' ? localData : remoteData,
        confidence: 0.8,
        reasoning: `Resolved using custom strategy for ${entityType}`,
        requiresManualReview: false
      };
    }

    // Apply default strategies
    switch (this.options.defaultStrategy) {
      case 'newest':
        return this.resolveByTimestamp(conflict);
      
      case 'local':
        return {
          resolution: 'local',
          resolvedData: localData,
          confidence: 1.0,
          reasoning: 'Local-wins strategy applied',
          requiresManualReview: false
        };
      
      case 'remote':
        return {
          resolution: 'remote',
          resolvedData: remoteData,
          confidence: 1.0,
          reasoning: 'Remote-wins strategy applied',
          requiresManualReview: false
        };
      
      case 'manual':
        return {
          resolution: 'newest',
          resolvedData: localTimestamp > remoteTimestamp ? localData : remoteData,
          confidence: 0.3,
          reasoning: 'Manual review required - defaulting to newest',
          requiresManualReview: true
        };
      
      default:
        return this.resolveByTimestamp(conflict);
    }
  }

  /**
   * Resolve conflict by timestamp (newest wins)
   */
  private resolveByTimestamp(conflict: SyncConflict): ResolvedConflict {
    const { localData, remoteData, localTimestamp, remoteTimestamp } = conflict;
    
    const timeDiff = Math.abs(localTimestamp.getTime() - remoteTimestamp.getTime());
    const isRecent = timeDiff < 60000; // Less than 1 minute difference
    
    if (localTimestamp > remoteTimestamp) {
      return {
        resolution: 'local',
        resolvedData: localData,
        confidence: isRecent ? 0.6 : 0.9,
        reasoning: `Local version is newer (${timeDiff}ms difference)`,
        requiresManualReview: isRecent && this.hasSignificantChanges(localData, remoteData)
      };
    } else {
      return {
        resolution: 'remote',
        resolvedData: remoteData,
        confidence: isRecent ? 0.6 : 0.9,
        reasoning: `Remote version is newer (${timeDiff}ms difference)`,
        requiresManualReview: isRecent && this.hasSignificantChanges(localData, remoteData)
      };
    }
  }

  /**
   * Attempt smart merge for compatible changes
   */
  async smartMerge(conflict: SyncConflict): Promise<ResolvedConflict> {
    const { localData, remoteData } = conflict;
    
    try {
      const mergedData = this.mergeObjects(localData, remoteData);
      
      return {
        resolution: 'merged',
        resolvedData: mergedData,
        confidence: 0.7,
        reasoning: 'Successfully merged non-conflicting changes',
        requiresManualReview: false
      };
    } catch (error) {
      // Fallback to timestamp resolution if merge fails
      return this.resolveByTimestamp(conflict);
    }
  }

  /**
   * Merge two objects intelligently
   */
  private mergeObjects(local: Record<string, any>, remote: Record<string, any>): Record<string, any> {
    const merged = { ...local };
    
    for (const [key, remoteValue] of Object.entries(remote)) {
      const localValue = local[key];
      
      // Apply field priorities if configured
      if (this.options.fieldPriorities?.[key] === 'remote') {
        merged[key] = remoteValue;
        continue;
      }
      
      if (this.options.fieldPriorities?.[key] === 'local') {
        merged[key] = localValue;
        continue;
      }
      
      // Smart merge logic
      if (localValue === undefined) {
        // New field in remote
        merged[key] = remoteValue;
      } else if (this.isArrayField(key)) {
        // Merge arrays by combining unique items
        merged[key] = this.mergeArrays(localValue, remoteValue);
      } else if (this.isObjectField(key)) {
        // Recursively merge objects
        merged[key] = this.mergeObjects(localValue, remoteValue);
      } else if (localValue !== remoteValue) {
        // Conflicting primitive values - this needs manual resolution
        throw new Error(`Conflicting values for field ${key}`);
      }
    }
    
    return merged;
  }

  /**
   * Merge arrays by combining unique items
   */
  private mergeArrays(local: any[], remote: any[]): any[] {
    const localArray = Array.isArray(local) ? local : [];
    const remoteArray = Array.isArray(remote) ? remote : [];
    
    // Simple merge - could be made more sophisticated
    const combined = [...localArray];
    
    for (const item of remoteArray) {
      if (!combined.some(localItem => this.deepEqual(localItem, item))) {
        combined.push(item);
      }
    }
    
    return combined;
  }

  /**
   * Check if two values are deeply equal
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Check if there are significant changes between objects
   */
  private hasSignificantChanges(local: Record<string, any>, remote: Record<string, any>): boolean {
    const localKeys = Object.keys(local);
    const remoteKeys = Object.keys(remote);
    
    // Check for added/removed fields
    if (localKeys.length !== remoteKeys.length) return true;
    
    // Check for changed values in important fields
    const importantFields = ['title', 'content', 'status', 'priority'];
    
    for (const field of importantFields) {
      if (local[field] !== remote[field]) return true;
    }
    
    return false;
  }

  /**
   * Check if a field should be treated as an array
   */
  private isArrayField(fieldName: string): boolean {
    const arrayFields = ['tags', 'categories', 'attachments', 'metadata'];
    return arrayFields.includes(fieldName);
  }

  /**
   * Check if a field should be treated as an object
   */
  private isObjectField(fieldName: string): boolean {
    const objectFields = ['metadata', 'settings', 'preferences'];
    return objectFields.includes(fieldName);
  }
}

/**
 * Pre-configured conflict resolvers for common scenarios
 */
export const ConflictResolvers = {
  /**
   * Newest timestamp wins
   */
  newestWins: async (conflict: SyncConflict): Promise<'local' | 'remote' | 'newest'> => {
    return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
  },

  /**
   * Local changes always win
   */
  localWins: async (): Promise<'local'> => 'local',

  /**
   * Remote changes always win
   */
  remoteWins: async (): Promise<'remote'> => 'remote',

  /**
   * Require manual resolution
   */
  manual: async (): Promise<'newest'> => 'newest',

  /**
   * Notification-specific resolver
   */
  notificationResolver: async (conflict: SyncConflict): Promise<'local' | 'remote' | 'newest'> => {
    const { localData, remoteData } = conflict;
    
    // If status changed to 'read', prefer that version
    if (localData.status === 'read' && remoteData.status !== 'read') {
      return 'local';
    }
    if (remoteData.status === 'read' && localData.status !== 'read') {
      return 'remote';
    }
    
    // If priority changed, prefer the version with higher priority
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
    const localPriority = priorityOrder[localData.priority as keyof typeof priorityOrder] || 0;
    const remotePriority = priorityOrder[remoteData.priority as keyof typeof priorityOrder] || 0;
    
    if (localPriority > remotePriority) return 'local';
    if (remotePriority > localPriority) return 'remote';
    
    // Default to newest
    return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
  },

  /**
   * Settings-specific resolver that merges non-conflicting settings
   */
  settingsResolver: async (conflict: SyncConflict): Promise<'local' | 'remote' | 'newest'> => {
    // For settings, we typically want to preserve user preferences
    // This is a simple implementation - could be made more sophisticated
    return 'local';
  }
} as const;

/**
 * Factory for creating conflict resolvers with specific configurations
 */
export class ConflictResolverFactory {
  /**
   * Create a resolver for notification entities
   */
  static createNotificationResolver(): ConflictResolver {
    return new ConflictResolver({
      defaultStrategy: 'newest',
      fieldPriorities: {
        status: 'local', // User interactions (read/unread) stay local
        priority: 'remote', // Priority changes from server take precedence
        content: 'remote' // Content updates from server take precedence
      },
      customResolvers: {
        notifications: ConflictResolvers.notificationResolver
      }
    });
  }

  /**
   * Create a resolver for project entities
   */
  static createProjectResolver(): ConflictResolver {
    return new ConflictResolver({
      defaultStrategy: 'newest',
      fieldPriorities: {
        settings: 'local', // Local settings preferences
        name: 'remote', // Name changes from server
        description: 'remote' // Description updates from server
      }
    });
  }

  /**
   * Create a resolver for user settings
   */
  static createSettingsResolver(): ConflictResolver {
    return new ConflictResolver({
      defaultStrategy: 'local', // Settings typically prefer local changes
      customResolvers: {
        user_settings: ConflictResolvers.settingsResolver
      }
    });
  }

  /**
   * Create a conservative resolver that requires manual review
   */
  static createManualResolver(): ConflictResolver {
    return new ConflictResolver({
      defaultStrategy: 'manual',
      manualReviewRequired: true
    });
  }
}
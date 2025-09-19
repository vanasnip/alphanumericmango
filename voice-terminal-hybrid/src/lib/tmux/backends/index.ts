/**
 * Backend Abstraction Layer for Terminal Integration
 * 
 * This module provides a comprehensive abstraction layer for terminal backends,
 * enabling support for multiple terminal implementations with intelligent
 * selection, health monitoring, and A/B testing capabilities.
 * 
 * @example Basic Usage
 * ```typescript
 * import { createBackend, BackendManager } from './backends';
 * 
 * // Create a backend directly
 * const backend = await createBackend({ type: 'tmux' });
 * 
 * // Use backend manager for advanced features
 * const manager = new BackendManager({
 *   selectionStrategy: 'performance-based',
 *   fallbackBackends: ['tmux'],
 *   enableABTesting: true
 * });
 * await manager.initialize();
 * ```
 * 
 * @example A/B Testing
 * ```typescript
 * const manager = new BackendManager({
 *   enableABTesting: true,
 *   abTestConfig: {
 *     enabled: true,
 *     testName: 'tmux-vs-nodepty',
 *     variants: [
 *       { type: 'tmux', weight: 50 },
 *       { type: 'node-pty', weight: 50 }
 *     ]
 *   }
 * });
 * ```
 */

// Core interfaces and types
export type {
  ITerminalBackend,
  BackendConfig,
  BackendCapabilities,
  BackendHealth,
  BackendResult,
  ExecutionContext,
  BackendEventMap
} from './ITerminalBackend';

export { BaseTerminalBackend } from './ITerminalBackend';

// Backend implementations
export { TmuxBackend } from './TmuxBackend';

// Factory for creating backends
export type {
  BackendConstructor,
  BackendRegistration,
  BackendCreationOptions,
  FactoryResult
} from './BackendFactory';

export { 
  BackendFactory, 
  getBackendFactory, 
  createBackend, 
  registerBackend 
} from './BackendFactory';

// Manager for orchestrating multiple backends
export type {
  BackendSelectionStrategy,
  ABTestConfig,
  BackendManagerConfig
} from './BackendManager';

export { BackendManager } from './BackendManager';

/**
 * Convenience function to create a configured backend manager
 * with sensible defaults for common use cases.
 */
export async function createDefaultBackendManager(options: {
  performanceMode?: boolean;
  enableFallback?: boolean;
  enableABTesting?: boolean;
} = {}): Promise<BackendManager> {
  const config = {
    selectionStrategy: options.performanceMode ? 'performance-based' as const : 'primary-fallback' as const,
    fallbackBackends: options.enableFallback ? ['tmux'] : [],
    enableABTesting: options.enableABTesting || false,
    enableHotSwap: true,
    healthCheckInterval: 30000,
    performanceThresholds: {
      maxLatency: options.performanceMode ? 50 : 100,
      minSuccessRate: 0.95,
      maxErrorRate: 0.05
    }
  };

  const manager = new BackendManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Utility function to test backend availability
 */
export async function testBackendAvailability(type: string): Promise<{
  available: boolean;
  details: any;
}> {
  const factory = getBackendFactory();
  const result = await factory.testBackendAvailability(type);
  
  return {
    available: result.success && !!result.data?.available,
    details: result.data || { error: result.error }
  };
}

/**
 * Get information about all registered backends
 */
export function getAvailableBackends(): Array<{
  type: string;
  name: string;
  capabilities: BackendCapabilities;
  isDefault: boolean;
}> {
  const factory = getBackendFactory();
  return factory.getRegisteredBackends().map(reg => ({
    type: reg.type,
    name: reg.name,
    capabilities: reg.capabilities,
    isDefault: reg.isDefault || false
  }));
}

/**
 * Version information for the backend abstraction layer
 */
export const BACKEND_ABSTRACTION_VERSION = '1.0.0';

/**
 * Feature flags for experimental functionality
 */
export const FEATURES = {
  A_B_TESTING: true,
  HOT_SWAP: true,
  HEALTH_MONITORING: true,
  PERFORMANCE_ROUTING: true,
  MULTI_BACKEND: true
} as const;
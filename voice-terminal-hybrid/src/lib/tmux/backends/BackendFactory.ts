import { EventEmitter } from 'events';
import type { 
  ITerminalBackend, 
  BackendConfig, 
  BackendCapabilities,
  BackendResult 
} from './ITerminalBackend';
import { TmuxBackend } from './TmuxBackend';

/**
 * Backend constructor interface for registration
 */
export interface BackendConstructor {
  new(): ITerminalBackend;
}

/**
 * Backend registration information
 */
export interface BackendRegistration {
  type: string;
  name: string;
  version: string;
  constructor: BackendConstructor;
  capabilities: BackendCapabilities;
  isDefault?: boolean;
  priority?: number; // Higher number = higher priority
  description?: string;
  supportedPlatforms?: string[];
  requiredFeatures?: string[];
}

/**
 * Backend creation options
 */
export interface BackendCreationOptions {
  type?: string;
  config?: BackendConfig;
  fallbackTypes?: string[];
  requireCapabilities?: (keyof BackendCapabilities)[];
  validateHealth?: boolean;
}

/**
 * Factory result for backend operations
 */
export interface FactoryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * Factory for creating and managing terminal backend instances
 * 
 * Provides a registry for backend types and handles creation,
 * capability checking, and fallback logic.
 */
export class BackendFactory extends EventEmitter {
  private static instance: BackendFactory;
  private registrations: Map<string, BackendRegistration> = new Map();
  private createdBackends: Map<string, ITerminalBackend> = new Map();
  private defaultBackendType: string | null = null;

  private constructor() {
    super();
    this.registerBuiltinBackends();
  }

  /**
   * Get singleton instance of the factory
   */
  static getInstance(): BackendFactory {
    if (!BackendFactory.instance) {
      BackendFactory.instance = new BackendFactory();
    }
    return BackendFactory.instance;
  }

  /**
   * Register built-in backend types
   */
  private registerBuiltinBackends(): void {
    // Register tmux backend as default
    this.registerBackend({
      type: 'tmux',
      name: 'Tmux Terminal Backend',
      version: '1.0.0',
      constructor: TmuxBackend,
      capabilities: {
        supportsContinuousCapture: true,
        supportsSessionRecovery: true,
        supportsContainerIsolation: false,
        supportsBatchExecution: true,
        supportsWebSocketProxy: false,
        maxConcurrentSessions: 100,
        maxConcurrentCommands: 50,
        requiresExternalProcess: true
      },
      isDefault: true,
      priority: 100,
      description: 'Production-ready tmux backend with security and performance optimizations',
      supportedPlatforms: ['linux', 'darwin', 'freebsd'],
      requiredFeatures: ['tmux']
    });
  }

  /**
   * Register a new backend type
   * @param registration Backend registration information
   * @returns Success indicator
   */
  registerBackend(registration: BackendRegistration): FactoryResult<void> {
    try {
      // Validate registration
      if (!registration.type || !registration.constructor) {
        return {
          success: false,
          error: 'Backend registration requires type and constructor'
        };
      }

      if (this.registrations.has(registration.type)) {
        return {
          success: false,
          error: `Backend type '${registration.type}' is already registered`
        };
      }

      // Set as default if specified or if no default exists
      if (registration.isDefault || !this.defaultBackendType) {
        this.defaultBackendType = registration.type;
      }

      this.registrations.set(registration.type, registration);

      this.emit('backend-registered', {
        type: registration.type,
        name: registration.name,
        capabilities: registration.capabilities
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to register backend: ${error.message}`
      };
    }
  }

  /**
   * Unregister a backend type
   * @param type Backend type to unregister
   * @returns Success indicator
   */
  unregisterBackend(type: string): FactoryResult<void> {
    try {
      if (!this.registrations.has(type)) {
        return {
          success: false,
          error: `Backend type '${type}' is not registered`
        };
      }

      // Clean up any created instances
      const backend = this.createdBackends.get(type);
      if (backend) {
        backend.shutdown().catch(console.error);
        this.createdBackends.delete(type);
      }

      this.registrations.delete(type);

      // Find new default if this was the default
      if (this.defaultBackendType === type) {
        const remaining = Array.from(this.registrations.values())
          .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        this.defaultBackendType = remaining.length > 0 ? remaining[0].type : null;
      }

      this.emit('backend-unregistered', { type });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to unregister backend: ${error.message}`
      };
    }
  }

  /**
   * Create a backend instance
   * @param options Creation options
   * @returns Promise resolving to backend instance
   */
  async createBackend(options: BackendCreationOptions = {}): Promise<FactoryResult<ITerminalBackend>> {
    try {
      const warnings: string[] = [];
      
      // Determine backend type to create
      let targetType = options.type || this.defaultBackendType;
      
      if (!targetType) {
        return {
          success: false,
          error: 'No backend type specified and no default backend available'
        };
      }

      // Try to create the requested backend
      let backend = await this.attemptBackendCreation(targetType, options.config);
      
      if (!backend.success && options.fallbackTypes) {
        // Try fallback backends
        for (const fallbackType of options.fallbackTypes) {
          if (this.registrations.has(fallbackType)) {
            warnings.push(`Primary backend '${targetType}' failed, trying fallback '${fallbackType}'`);
            backend = await this.attemptBackendCreation(fallbackType, options.config);
            
            if (backend.success) {
              targetType = fallbackType;
              break;
            }
          }
        }
      }

      if (!backend.success) {
        return {
          success: false,
          error: backend.error,
          warnings
        };
      }

      const instance = backend.data!;

      // Check required capabilities
      if (options.requireCapabilities) {
        const missing = this.checkCapabilities(instance.capabilities, options.requireCapabilities);
        if (missing.length > 0) {
          await instance.shutdown();
          return {
            success: false,
            error: `Backend '${targetType}' missing required capabilities: ${missing.join(', ')}`,
            warnings
          };
        }
      }

      // Perform health check if requested
      if (options.validateHealth) {
        const health = await instance.getHealth();
        if (!health.isHealthy) {
          warnings.push(`Backend '${targetType}' health check failed but proceeding anyway`);
        }
      }

      // Cache the created instance
      this.createdBackends.set(`${targetType}-${Date.now()}`, instance);

      this.emit('backend-created', {
        type: targetType,
        backend: instance,
        capabilities: instance.capabilities
      });

      return {
        success: true,
        data: instance,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create backend: ${error.message}`
      };
    }
  }

  /**
   * Attempt to create and initialize a specific backend type
   */
  private async attemptBackendCreation(
    type: string, 
    config?: BackendConfig
  ): Promise<FactoryResult<ITerminalBackend>> {
    try {
      const registration = this.registrations.get(type);
      if (!registration) {
        return {
          success: false,
          error: `Backend type '${type}' is not registered`
        };
      }

      // Check platform compatibility
      if (registration.supportedPlatforms) {
        const currentPlatform = process.platform;
        if (!registration.supportedPlatforms.includes(currentPlatform)) {
          return {
            success: false,
            error: `Backend '${type}' does not support platform '${currentPlatform}'`
          };
        }
      }

      // Create instance
      const instance = new registration.constructor();
      
      // Initialize with config
      const initResult = await instance.initialize(config || {});
      if (!initResult.success) {
        await instance.shutdown().catch(() => {}); // Clean up on failure
        return {
          success: false,
          error: `Backend initialization failed: ${initResult.error}`
        };
      }

      return { success: true, data: instance };
    } catch (error) {
      return {
        success: false,
        error: `Backend creation failed: ${error.message}`
      };
    }
  }

  /**
   * Check if backend has required capabilities
   */
  private checkCapabilities(
    capabilities: BackendCapabilities, 
    required: (keyof BackendCapabilities)[]
  ): string[] {
    const missing: string[] = [];
    
    for (const capability of required) {
      if (!capabilities[capability]) {
        missing.push(capability);
      }
    }
    
    return missing;
  }

  /**
   * Get all registered backend types
   * @returns Array of registered backend information
   */
  getRegisteredBackends(): BackendRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get registration for a specific backend type
   * @param type Backend type
   * @returns Registration information or null
   */
  getBackendRegistration(type: string): BackendRegistration | null {
    return this.registrations.get(type) || null;
  }

  /**
   * Get the default backend type
   * @returns Default backend type or null
   */
  getDefaultBackendType(): string | null {
    return this.defaultBackendType;
  }

  /**
   * Set the default backend type
   * @param type Backend type to set as default
   * @returns Success indicator
   */
  setDefaultBackendType(type: string): FactoryResult<void> {
    if (!this.registrations.has(type)) {
      return {
        success: false,
        error: `Backend type '${type}' is not registered`
      };
    }

    this.defaultBackendType = type;
    this.emit('default-backend-changed', { type });
    
    return { success: true };
  }

  /**
   * Find backends with specific capabilities
   * @param requiredCapabilities Required capabilities
   * @returns Array of backend types that support the capabilities
   */
  findBackendsWithCapabilities(requiredCapabilities: (keyof BackendCapabilities)[]): string[] {
    const compatible: string[] = [];
    
    for (const [type, registration] of this.registrations) {
      const missing = this.checkCapabilities(registration.capabilities, requiredCapabilities);
      if (missing.length === 0) {
        compatible.push(type);
      }
    }
    
    // Sort by priority
    return compatible.sort((a, b) => {
      const regA = this.registrations.get(a)!;
      const regB = this.registrations.get(b)!;
      return (regB.priority || 0) - (regA.priority || 0);
    });
  }

  /**
   * Test backend availability
   * @param type Backend type to test
   * @returns Promise resolving to availability status
   */
  async testBackendAvailability(type: string): Promise<FactoryResult<{
    available: boolean;
    canCreate: boolean;
    canInitialize: boolean;
    healthCheck: boolean;
    details: Record<string, any>;
  }>> {
    try {
      const registration = this.registrations.get(type);
      if (!registration) {
        return {
          success: false,
          error: `Backend type '${type}' is not registered`
        };
      }

      // Test creation
      let instance: ITerminalBackend;
      try {
        instance = new registration.constructor();
      } catch (error) {
        return {
          success: true,
          data: {
            available: false,
            canCreate: false,
            canInitialize: false,
            healthCheck: false,
            details: { creationError: error.message }
          }
        };
      }

      // Test initialization
      let canInitialize = false;
      let healthCheck = false;
      let initError: string | undefined;

      try {
        const initResult = await instance.initialize({});
        canInitialize = initResult.success;
        initError = initResult.error;

        if (canInitialize) {
          // Test health check
          const health = await instance.getHealth();
          healthCheck = health.isHealthy;
        }
      } catch (error) {
        initError = error.message;
      } finally {
        // Clean up
        await instance.shutdown().catch(() => {});
      }

      return {
        success: true,
        data: {
          available: true,
          canCreate: true,
          canInitialize,
          healthCheck,
          details: {
            type,
            name: registration.name,
            version: registration.version,
            capabilities: registration.capabilities,
            initError
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Backend availability test failed: ${error.message}`
      };
    }
  }

  /**
   * Create multiple backends for A/B testing
   * @param configs Array of backend configurations
   * @returns Promise resolving to array of created backends
   */
  async createMultipleBackends(
    configs: Array<{ type: string; config?: BackendConfig; weight?: number }>
  ): Promise<FactoryResult<Array<{ type: string; backend: ITerminalBackend; weight: number }>>> {
    try {
      const results: Array<{ type: string; backend: ITerminalBackend; weight: number }> = [];
      const errors: string[] = [];

      for (const { type, config, weight = 1 } of configs) {
        const result = await this.createBackend({ type, config });
        
        if (result.success && result.data) {
          results.push({ type, backend: result.data, weight });
        } else {
          errors.push(`Failed to create ${type}: ${result.error}`);
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          error: `No backends could be created. Errors: ${errors.join('; ')}`
        };
      }

      return {
        success: true,
        data: results,
        warnings: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create multiple backends: ${error.message}`
      };
    }
  }

  /**
   * Clean up all created backend instances
   * @returns Promise indicating completion
   */
  async cleanup(): Promise<void> {
    const shutdownPromises = Array.from(this.createdBackends.values())
      .map(backend => backend.shutdown().catch(console.error));

    await Promise.all(shutdownPromises);
    this.createdBackends.clear();
    this.removeAllListeners();
  }

  /**
   * Get factory statistics
   * @returns Factory usage statistics
   */
  getStatistics(): {
    registeredBackends: number;
    createdInstances: number;
    defaultBackend: string | null;
    mostUsedBackend: string | null;
  } {
    // Simple stats - could be enhanced with usage tracking
    return {
      registeredBackends: this.registrations.size,
      createdInstances: this.createdBackends.size,
      defaultBackend: this.defaultBackendType,
      mostUsedBackend: this.defaultBackendType // Simplified - would need usage tracking
    };
  }
}

/**
 * Convenience function to get the factory instance
 */
export function getBackendFactory(): BackendFactory {
  return BackendFactory.getInstance();
}

/**
 * Convenience function to create a backend
 */
export async function createBackend(options?: BackendCreationOptions): Promise<FactoryResult<ITerminalBackend>> {
  return BackendFactory.getInstance().createBackend(options);
}

/**
 * Convenience function to register a backend
 */
export function registerBackend(registration: BackendRegistration): FactoryResult<void> {
  return BackendFactory.getInstance().registerBackend(registration);
}
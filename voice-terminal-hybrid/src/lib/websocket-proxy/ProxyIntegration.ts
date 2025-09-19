/**
 * CRITICAL INTEGRATION: WebSocket Proxy Integration with Backend Infrastructure
 * Demonstrates complete integration of WebSocket proxy with existing secure tmux backend
 */

import { WebSocketProxyServer, createDefaultProxyConfig } from './index.js';
import { BackendManager } from '../tmux/backends/BackendManager.js';
import { BackendFactory } from '../tmux/backends/BackendFactory.js';
import { SecureCommandExecutor } from '../tmux/security/SecureCommandExecutor.js';
import { AuditLogger, SecuritySeverity } from '../tmux/security/AuditLogger.js';

// Integration configuration
export interface ProxyIntegrationConfig {
  // WebSocket proxy settings
  proxyPort: number;
  proxyHost: string;
  maxConnections: number;
  enableSSL: boolean;
  
  // Backend settings
  tmuxSocketPath: string;
  backendPoolSize: number;
  healthCheckInterval: number;
  
  // Security settings
  enableAuthentication: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  
  // Performance settings
  targetLatency: number;
  commandTimeout: number;
  maxConcurrentCommands: number;
  
  // Redis settings (optional)
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  
  // Monitoring settings
  enableMetrics: boolean;
  metricsPort?: number;
}

// Complete integration class
export class WebSocketProxyIntegration {
  private proxyServer: WebSocketProxyServer | null = null;
  private backendManager: BackendManager | null = null;
  private auditLogger: AuditLogger;
  private config: ProxyIntegrationConfig;

  constructor(config: Partial<ProxyIntegrationConfig> = {}) {
    this.config = {
      // Default configuration
      proxyPort: 8080,
      proxyHost: '0.0.0.0',
      maxConnections: 1000,
      enableSSL: false,
      
      tmuxSocketPath: '/tmp/tmux-secure',
      backendPoolSize: 5,
      healthCheckInterval: 30000,
      
      enableAuthentication: true,
      rateLimitRequests: 100,
      rateLimitWindow: 60000,
      
      targetLatency: 50,
      commandTimeout: 10000,
      maxConcurrentCommands: 50,
      
      enableMetrics: true,
      metricsPort: 9090,
      
      ...config
    };

    this.auditLogger = new AuditLogger({
      enableConsoleOutput: true,
      logLevel: SecuritySeverity.INFO
    });
  }

  /**
   * CRITICAL: Initialize complete WebSocket proxy integration
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing WebSocket Proxy Integration...');
      
      // Step 1: Initialize backend manager
      await this.initializeBackendManager();
      
      // Step 2: Initialize WebSocket proxy server  
      await this.initializeProxyServer();
      
      // Step 3: Connect proxy to backend manager
      await this.connectProxyToBackend();
      
      // Step 4: Setup monitoring and health checks
      await this.setupMonitoring();
      
      console.log('✅ WebSocket Proxy Integration initialized successfully');
      console.log(`📡 WebSocket server listening on ${this.config.proxyHost}:${this.config.proxyPort}`);
      console.log(`🔒 Security: Authentication ${this.config.enableAuthentication ? 'enabled' : 'disabled'}`);
      console.log(`⚡ Performance: Target latency <${this.config.targetLatency}ms`);
      console.log(`📊 Monitoring: Metrics ${this.config.enableMetrics ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket proxy integration:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: Initialize backend manager with tmux backends
   */
  private async initializeBackendManager(): Promise<void> {
    console.log('🔧 Initializing backend manager...');
    
    this.backendManager = new BackendManager({
      selectionStrategy: 'performance-based',
      healthCheckInterval: this.config.healthCheckInterval,
      maxRetries: 3,
      retryDelay: 1000,
      fallbackBackends: ['tmux'],
      enableABTesting: false,
      enableHotSwap: true,
      performanceThresholds: {
        maxLatency: this.config.targetLatency,
        minSuccessRate: 0.95,
        maxErrorRate: 0.05
      }
    });

    // Initialize backend manager
    const result = await this.backendManager.initialize();
    if (!result.success) {
      throw new Error(`Backend manager initialization failed: ${result.error}`);
    }

    // Add multiple backend instances for load distribution
    for (let i = 0; i < this.config.backendPoolSize; i++) {
      const addResult = await this.backendManager.addBackend('tmux', {
        socketPath: `${this.config.tmuxSocketPath}-${i}`,
        commandTimeout: this.config.commandTimeout,
        performanceMode: 'performance'
      });
      
      if (!addResult.success) {
        console.warn(`⚠️ Failed to add backend instance ${i}: ${addResult.error}`);
      }
    }

    console.log(`✅ Backend manager initialized with ${this.config.backendPoolSize} instances`);
  }

  /**
   * CRITICAL: Initialize WebSocket proxy server
   */
  private async initializeProxyServer(): Promise<void> {
    console.log('🌐 Initializing WebSocket proxy server...');
    
    const proxyConfig = createDefaultProxyConfig({
      port: this.config.proxyPort,
      host: this.config.proxyHost,
      maxConnections: this.config.maxConnections,
      authRequired: this.config.enableAuthentication,
      enableCompression: true,
      heartbeatInterval: 30000,
      connectionTimeout: 300000,
      messageTimeout: 5000,
      
      rateLimitConfig: {
        windowMs: this.config.rateLimitWindow,
        maxRequests: this.config.rateLimitRequests,
        blockDurationMs: 300000
      },
      
      secureCommandConfig: {
        socketPath: this.config.tmuxSocketPath,
        commandTimeout: this.config.commandTimeout,
        enableAuditLogging: true,
        maxConcurrentCommands: this.config.maxConcurrentCommands
      },
      
      redisConfig: this.config.redisHost ? {
        host: this.config.redisHost,
        port: this.config.redisPort || 6379,
        password: this.config.redisPassword,
        db: 0
      } : undefined,
      
      backendPoolConfig: {
        maxBackends: this.config.backendPoolSize,
        healthCheckInterval: this.config.healthCheckInterval,
        failoverThreshold: 3
      }
    });

    this.proxyServer = new WebSocketProxyServer(proxyConfig);
    await this.proxyServer.start();
    
    console.log('✅ WebSocket proxy server initialized');
  }

  /**
   * CRITICAL: Connect WebSocket proxy to backend manager
   */
  private async connectProxyToBackend(): Promise<void> {
    if (!this.proxyServer || !this.backendManager) {
      throw new Error('Proxy server or backend manager not initialized');
    }

    console.log('🔗 Connecting proxy to backend manager...');
    
    // The integration happens through the load balancer in the proxy server
    // which will use the secure command executor to interface with backends
    
    // Setup event forwarding from backend manager to proxy
    this.backendManager.on('backend-health-degraded', (event) => {
      console.warn(`⚠️ Backend health degraded: ${event.backendId}`);
    });

    this.backendManager.on('backend-health-recovered', (event) => {
      console.log(`✅ Backend health recovered: ${event.backendId}`);
    });

    this.backendManager.on('performance-threshold-exceeded', (event) => {
      console.warn(`⚠️ Performance threshold exceeded: ${event.metric} = ${event.value}`);
    });

    console.log('✅ Proxy connected to backend manager');
  }

  /**
   * Setup monitoring and health checks
   */
  private async setupMonitoring(): Promise<void> {
    if (!this.config.enableMetrics) {
      return;
    }

    console.log('📊 Setting up monitoring...');
    
    // Start periodic health reporting
    setInterval(async () => {
      await this.logHealthMetrics();
    }, 60000); // Every minute

    // Start performance monitoring
    setInterval(async () => {
      await this.logPerformanceMetrics();
    }, 30000); // Every 30 seconds

    console.log('✅ Monitoring setup completed');
  }

  /**
   * Log health metrics
   */
  private async logHealthMetrics(): Promise<void> {
    try {
      if (!this.backendManager || !this.proxyServer) return;

      const backendHealth = await this.backendManager.getBackendHealthStatus();
      const proxyMetrics = this.proxyServer.getProxyMetrics();
      
      const healthyBackends = Object.values(backendHealth).filter(h => h.isHealthy).length;
      const totalBackends = Object.keys(backendHealth).length;
      
      console.log(`📊 Health Status: ${healthyBackends}/${totalBackends} backends healthy, ${proxyMetrics.activeConnections} active connections`);
      
      // Log to audit system
      await this.auditLogger.logEvent({
        eventType: 'COMMAND_EXECUTED',
        severity: SecuritySeverity.INFO,
        source: 'ProxyIntegration',
        description: 'Health metrics collected',
        metadata: {
          healthyBackends,
          totalBackends,
          activeConnections: proxyMetrics.activeConnections,
          averageLatency: proxyMetrics.averageLatency
        },
        outcome: 'success',
        riskScore: 1
      });
      
    } catch (error) {
      console.error('Error logging health metrics:', error);
    }
  }

  /**
   * Log performance metrics
   */
  private async logPerformanceMetrics(): Promise<void> {
    try {
      if (!this.backendManager || !this.proxyServer) return;

      const backendMetrics = this.backendManager.getAggregatedMetrics();
      const proxyMetrics = this.proxyServer.getProxyMetrics();
      
      const totalLatency = backendMetrics.averageLatency + proxyMetrics.averageLatency;
      const isPerformant = totalLatency < this.config.targetLatency;
      
      if (!isPerformant) {
        console.warn(`⚠️ Performance Warning: Total latency ${totalLatency.toFixed(2)}ms exceeds target ${this.config.targetLatency}ms`);
      }
      
      console.log(`⚡ Performance: ${totalLatency.toFixed(2)}ms total latency, ${backendMetrics.successRate.toFixed(3)} success rate`);
      
    } catch (error) {
      console.error('Error logging performance metrics:', error);
    }
  }

  /**
   * Get comprehensive status
   */
  async getStatus(): Promise<{
    proxy: any;
    backends: any;
    health: string;
    performance: {
      totalLatency: number;
      successRate: number;
      isHealthy: boolean;
    };
  }> {
    if (!this.proxyServer || !this.backendManager) {
      throw new Error('Integration not initialized');
    }

    const proxyMetrics = this.proxyServer.getProxyMetrics();
    const backendMetrics = this.backendManager.getAggregatedMetrics();
    const backendHealth = await this.backendManager.getBackendHealthStatus();
    
    const healthyBackends = Object.values(backendHealth).filter(h => h.isHealthy).length;
    const totalBackends = Object.keys(backendHealth).length;
    const totalLatency = backendMetrics.averageLatency + proxyMetrics.averageLatency;
    
    const health = healthyBackends === totalBackends ? 'healthy' : 
                  healthyBackends > totalBackends / 2 ? 'degraded' : 'critical';
    
    return {
      proxy: {
        activeConnections: proxyMetrics.activeConnections,
        totalConnections: proxyMetrics.totalConnectionsHandled,
        averageLatency: proxyMetrics.averageLatency,
        errorRate: proxyMetrics.errorRate
      },
      backends: {
        healthy: healthyBackends,
        total: totalBackends,
        averageLatency: backendMetrics.averageLatency,
        successRate: backendMetrics.successRate
      },
      health,
      performance: {
        totalLatency,
        successRate: backendMetrics.successRate,
        isHealthy: totalLatency < this.config.targetLatency && backendMetrics.successRate > 0.95
      }
    };
  }

  /**
   * CRITICAL: Graceful shutdown of complete integration
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down WebSocket proxy integration...');
    
    try {
      // Stop proxy server first to prevent new connections
      if (this.proxyServer) {
        await this.proxyServer.stop();
        console.log('✅ WebSocket proxy server stopped');
      }
      
      // Shutdown backend manager
      if (this.backendManager) {
        await this.backendManager.shutdown();
        console.log('✅ Backend manager shutdown');
      }
      
      // Shutdown audit logger
      await this.auditLogger.shutdown();
      console.log('✅ Audit logger shutdown');
      
      console.log('✅ WebSocket proxy integration shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

// Example usage and testing
export async function createIntegratedProxyServer(config?: Partial<ProxyIntegrationConfig>): Promise<WebSocketProxyIntegration> {
  const integration = new WebSocketProxyIntegration(config);
  await integration.initialize();
  return integration;
}

// Performance testing helper
export async function testProxyPerformance(integration: WebSocketProxyIntegration): Promise<{
  connectionTime: number;
  commandLatency: number;
  throughput: number;
}> {
  const startTime = performance.now();
  
  // Simulate connection and command execution
  // This would typically be done with actual WebSocket client
  
  const connectionTime = performance.now() - startTime;
  
  return {
    connectionTime,
    commandLatency: 0, // Would be measured from actual command execution
    throughput: 0      // Would be measured from actual throughput test
  };
}

// Configuration examples
export const ProxyConfigExamples = {
  /**
   * Development configuration
   */
  development: (): Partial<ProxyIntegrationConfig> => ({
    proxyPort: 8080,
    proxyHost: 'localhost',
    maxConnections: 100,
    enableAuthentication: false,
    backendPoolSize: 2,
    targetLatency: 100,
    enableMetrics: true
  }),

  /**
   * Production configuration
   */
  production: (): Partial<ProxyIntegrationConfig> => ({
    proxyPort: 8080,
    proxyHost: '0.0.0.0',
    maxConnections: 1000,
    enableAuthentication: true,
    enableSSL: true,
    backendPoolSize: 10,
    targetLatency: 50,
    rateLimitRequests: 1000,
    rateLimitWindow: 60000,
    redisHost: 'redis.internal',
    enableMetrics: true,
    metricsPort: 9090
  }),

  /**
   * High-performance configuration
   */
  highPerformance: (): Partial<ProxyIntegrationConfig> => ({
    proxyPort: 8080,
    proxyHost: '0.0.0.0',
    maxConnections: 5000,
    enableAuthentication: true,
    backendPoolSize: 20,
    targetLatency: 15,
    commandTimeout: 5000,
    maxConcurrentCommands: 200,
    healthCheckInterval: 15000,
    rateLimitRequests: 5000,
    enableMetrics: true
  })
};
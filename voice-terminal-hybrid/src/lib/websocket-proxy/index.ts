/**
 * WebSocket Proxy Server - Main Export
 * Production-grade WebSocket proxy for secure terminal access
 */

export { 
  WebSocketProxyServer, 
  type ProxyServerConfig, 
  type ProxyMessage, 
  type ProxyResponse,
  type ProxyMessageType
} from './WebSocketProxyServer.js';

export { 
  ConnectionManager, 
  type ConnectionManagerConfig, 
  type ConnectionInfo, 
  type ConnectionStats 
} from './ConnectionManager.js';

export { 
  SessionPersistence, 
  type RedisConfig, 
  type SessionState, 
  type SessionStats 
} from './SessionPersistence.js';

export { 
  LoadBalancer, 
  type LoadBalancerConfig, 
  type BackendInstance, 
  type LoadBalancerStats 
} from './LoadBalancer.js';

export { 
  AuthenticationHandler, 
  type AuthenticationConfig, 
  type UserCredentials, 
  type AuthToken, 
  type AuthResult, 
  type TokenValidationResult 
} from './AuthenticationHandler.js';

// Default configuration factory
export function createDefaultProxyConfig(overrides: Partial<ProxyServerConfig> = {}): ProxyServerConfig {
  return {
    port: 8080,
    host: '0.0.0.0',
    maxConnections: 1000,
    authRequired: true,
    enableCompression: true,
    heartbeatInterval: 30000,
    connectionTimeout: 300000,
    messageTimeout: 5000,
    
    rateLimitConfig: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      blockDurationMs: 300000 // 5 minutes
    },
    
    secureCommandConfig: {
      socketPath: '/tmp/tmux-secure',
      commandTimeout: 10000,
      enableAuditLogging: true,
      maxConcurrentCommands: 50
    },
    
    redisConfig: {
      host: 'localhost',
      port: 6379,
      db: 0
    },
    
    backendPoolConfig: {
      maxBackends: 10,
      healthCheckInterval: 30000,
      failoverThreshold: 3
    },
    
    ...overrides
  };
}

// Server factory function
export async function createWebSocketProxyServer(config?: Partial<ProxyServerConfig>): Promise<WebSocketProxyServer> {
  const finalConfig = createDefaultProxyConfig(config);
  const server = new WebSocketProxyServer(finalConfig);
  
  // Initialize server
  await server.start();
  
  return server;
}

// Performance monitoring utilities
export const ProxyPerformance = {
  /**
   * Calculate target latency thresholds
   */
  getLatencyTargets() {
    return {
      excellent: 15, // <15ms backend latency
      good: 50,      // <50ms total latency (backend + proxy)
      warning: 100,  // >100ms indicates issues
      critical: 200  // >200ms unacceptable
    };
  },

  /**
   * Calculate connection capacity
   */
  getConnectionCapacity(targetLatency: number = 50): number {
    // Rough estimate: 1000 connections at 50ms target
    const baseConnections = 1000;
    const latencyFactor = 50 / Math.max(targetLatency, 1);
    return Math.floor(baseConnections * latencyFactor);
  },

  /**
   * Memory estimation for given connection count
   */
  estimateMemoryUsage(connections: number): { 
    perConnection: number; 
    total: number; 
    recommended: number 
  } {
    const perConnection = 100; // ~100KB per connection
    const baseOverhead = 50 * 1024 * 1024; // 50MB base
    const total = baseOverhead + (connections * perConnection * 1024);
    const recommended = total * 1.5; // 50% headroom
    
    return {
      perConnection,
      total,
      recommended
    };
  }
};

// Integration helpers
export const ProxyIntegration = {
  /**
   * Create client configuration for browser connection
   */
  createClientConfig(serverUrl: string, token?: string) {
    return {
      url: token ? `${serverUrl}?token=${encodeURIComponent(token)}` : serverUrl,
      protocols: ['terminal-v1'],
      timeout: 5000,
      reconnectInterval: 2000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      enableCompression: true,
      enableBinaryFrames: false
    };
  },

  /**
   * Backend health check helper
   */
  async validateBackendHealth(backend: any): Promise<boolean> {
    try {
      const health = await backend.getHealth();
      return health.isHealthy && health.latency < 100; // <100ms latency
    } catch {
      return false;
    }
  }
};
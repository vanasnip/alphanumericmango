#!/usr/bin/env node
/**
 * PRODUCTION WEBSOCKET PROXY SERVER
 * Standalone server for secure terminal access via WebSocket
 */

import { WebSocketProxyIntegration, ProxyConfigExamples } from './ProxyIntegration.js';

// Configuration from environment or defaults
const config = {
  proxyPort: parseInt(process.env.PROXY_PORT || '8080'),
  proxyHost: process.env.PROXY_HOST || '0.0.0.0',
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
  enableAuthentication: process.env.ENABLE_AUTH !== 'false',
  enableSSL: process.env.ENABLE_SSL === 'true',
  
  tmuxSocketPath: process.env.TMUX_SOCKET_PATH || '/tmp/tmux-secure',
  backendPoolSize: parseInt(process.env.BACKEND_POOL_SIZE || '5'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  
  targetLatency: parseInt(process.env.TARGET_LATENCY || '50'),
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '10000'),
  maxConcurrentCommands: parseInt(process.env.MAX_CONCURRENT_COMMANDS || '50'),
  
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
  
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
  redisPassword: process.env.REDIS_PASSWORD,
  
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  metricsPort: parseInt(process.env.METRICS_PORT || '9090')
};

// Global server instance
let proxyIntegration: WebSocketProxyIntegration | null = null;

/**
 * Start the WebSocket proxy server
 */
async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting WebSocket Proxy Server...');
    console.log('⚙️  Configuration:');
    console.log(`   📡 WebSocket: ${config.proxyHost}:${config.proxyPort}`);
    console.log(`   🔒 Auth: ${config.enableAuthentication ? 'enabled' : 'disabled'}`);
    console.log(`   🎯 Target Latency: <${config.targetLatency}ms`);
    console.log(`   🔧 Backend Pool: ${config.backendPoolSize} instances`);
    console.log(`   📊 Metrics: ${config.enableMetrics ? 'enabled' : 'disabled'}`);
    
    if (config.redisHost) {
      console.log(`   🗄️  Redis: ${config.redisHost}:${config.redisPort || 6379}`);
    }
    
    console.log('');

    // Initialize proxy integration
    proxyIntegration = new WebSocketProxyIntegration(config);
    await proxyIntegration.initialize();

    // Setup status monitoring
    if (config.enableMetrics) {
      setupStatusMonitoring();
    }

    console.log('');
    console.log('✅ WebSocket Proxy Server is running!');
    console.log(`📡 Connect to: ws://${config.proxyHost}:${config.proxyPort}`);
    if (config.enableAuthentication) {
      console.log('🔑 Authentication required - use token parameter');
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to start WebSocket proxy server:', error);
    process.exit(1);
  }
}

/**
 * Setup status monitoring and periodic reporting
 */
function setupStatusMonitoring(): void {
  // Log status every 5 minutes
  setInterval(async () => {
    if (proxyIntegration) {
      try {
        const status = await proxyIntegration.getStatus();
        
        console.log('📊 Status Report:');
        console.log(`   🌐 Connections: ${status.proxy.activeConnections} active / ${status.proxy.totalConnections} total`);
        console.log(`   🖥️  Backends: ${status.backends.healthy}/${status.backends.total} healthy`);
        console.log(`   ⚡ Latency: ${status.performance.totalLatency.toFixed(2)}ms total`);
        console.log(`   ✅ Success Rate: ${(status.performance.successRate * 100).toFixed(1)}%`);
        console.log(`   🚀 Health: ${status.health}`);
        console.log('');
        
      } catch (error) {
        console.error('Error getting status:', error);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (proxyIntegration) {
    try {
      await proxyIntegration.shutdown();
      console.log('✅ WebSocket proxy server shutdown completed');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
  
  process.exit(0);
}

/**
 * Health check endpoint (for load balancers)
 */
async function healthCheck(): Promise<void> {
  if (!proxyIntegration) {
    throw new Error('Server not initialized');
  }
  
  const status = await proxyIntegration.getStatus();
  
  if (status.health === 'critical') {
    throw new Error('Server health is critical');
  }
  
  return;
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

// Unhandled error handlers
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// CLI commands
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
    case undefined:
      startServer();
      break;
      
    case 'health':
      healthCheck()
        .then(() => {
          console.log('✅ Server is healthy');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Health check failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'config':
      console.log('📋 Current Configuration:');
      console.log(JSON.stringify(config, null, 2));
      break;
      
    default:
      console.log('Usage: node server.ts [start|health|config]');
      console.log('');
      console.log('Commands:');
      console.log('  start   - Start the WebSocket proxy server (default)');
      console.log('  health  - Check server health');
      console.log('  config  - Show current configuration');
      console.log('');
      console.log('Environment Variables:');
      console.log('  PROXY_PORT              - WebSocket server port (default: 8080)');
      console.log('  PROXY_HOST              - WebSocket server host (default: 0.0.0.0)');
      console.log('  MAX_CONNECTIONS         - Maximum concurrent connections (default: 1000)');
      console.log('  ENABLE_AUTH             - Enable authentication (default: true)');
      console.log('  ENABLE_SSL              - Enable SSL/TLS (default: false)');
      console.log('  TMUX_SOCKET_PATH        - Tmux socket path (default: /tmp/tmux-secure)');
      console.log('  BACKEND_POOL_SIZE       - Number of backend instances (default: 5)');
      console.log('  TARGET_LATENCY          - Target latency in ms (default: 50)');
      console.log('  RATE_LIMIT_REQUESTS     - Rate limit requests per window (default: 100)');
      console.log('  REDIS_HOST              - Redis host for session persistence');
      console.log('  ENABLE_METRICS          - Enable metrics collection (default: true)');
      break;
  }
}

export { startServer, healthCheck, config as serverConfig };
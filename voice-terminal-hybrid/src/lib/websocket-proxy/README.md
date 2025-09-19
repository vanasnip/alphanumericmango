# WebSocket Proxy Server

A production-grade WebSocket proxy server that bridges browser clients with secure tmux backends, enabling real-time terminal access through browsers while maintaining all security and performance characteristics.

## 🚀 Features

### Core Capabilities
- **Real-time Terminal Access**: WebSocket-based terminal access with <65ms total latency
- **Secure Command Execution**: Integration with SecureCommandExecutor for validation
- **Session Persistence**: Redis-based session state management for scalability
- **Load Balancing**: Intelligent backend distribution across multiple tmux instances
- **Connection Management**: Support for 1000+ concurrent WebSocket connections
- **Authentication & Authorization**: JWT-based auth with role-based permissions

### Security Features
- **Command Injection Protection**: All commands validated through SecureCommandExecutor
- **Rate Limiting**: Configurable rate limits per IP and user
- **Audit Logging**: Comprehensive security event logging
- **Session Security**: Secure session management with Redis persistence
- **IP Blocking**: Automatic blocking of suspicious activity

### Performance Features
- **<15ms Backend Latency**: Direct integration with optimized tmux backends
- **<50ms Browser Latency**: Efficient WebSocket message handling
- **Load Balancing**: Multiple backend instances with health monitoring
- **Connection Pooling**: Efficient resource utilization
- **Circuit Breakers**: Automatic failover for unhealthy backends

## 📁 Architecture

```
src/lib/websocket-proxy/
├── WebSocketProxyServer.ts     # Main WebSocket server
├── ConnectionManager.ts        # Connection lifecycle management
├── SessionPersistence.ts       # Redis-based session storage
├── LoadBalancer.ts            # Backend distribution & health
├── AuthenticationHandler.ts   # JWT auth & authorization
├── ProxyIntegration.ts        # Complete integration layer
├── server.ts                  # Standalone server startup
├── index.ts                   # Main exports
└── README.md                  # This file
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ with TypeScript support
- Redis server (optional, for session persistence)
- tmux installed and configured
- WebSocket library (`ws`)

### Dependencies
```bash
npm install ws ioredis
npm install --save-dev @types/ws
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | 8080 | WebSocket server port |
| `PROXY_HOST` | 0.0.0.0 | WebSocket server host |
| `MAX_CONNECTIONS` | 1000 | Maximum concurrent connections |
| `ENABLE_AUTH` | true | Enable authentication |
| `ENABLE_SSL` | false | Enable SSL/TLS |
| `TMUX_SOCKET_PATH` | /tmp/tmux-secure | Tmux socket path |
| `BACKEND_POOL_SIZE` | 5 | Number of backend instances |
| `TARGET_LATENCY` | 50 | Target latency in ms |
| `RATE_LIMIT_REQUESTS` | 100 | Rate limit per window |
| `RATE_LIMIT_WINDOW` | 60000 | Rate limit window in ms |
| `REDIS_HOST` | - | Redis host for persistence |
| `REDIS_PORT` | 6379 | Redis port |
| `ENABLE_METRICS` | true | Enable metrics collection |

### Configuration Examples

#### Development
```typescript
import { ProxyConfigExamples } from './websocket-proxy';

const config = ProxyConfigExamples.development();
```

#### Production
```typescript
const config = ProxyConfigExamples.production();
```

#### High Performance
```typescript
const config = ProxyConfigExamples.highPerformance();
```

## 🚀 Usage

### Standalone Server

```bash
# Start the server
node src/lib/websocket-proxy/server.ts start

# Check health
node src/lib/websocket-proxy/server.ts health

# Show configuration
node src/lib/websocket-proxy/server.ts config
```

### Programmatic Usage

```typescript
import { WebSocketProxyIntegration } from './websocket-proxy';

// Initialize with custom config
const proxy = new WebSocketProxyIntegration({
  proxyPort: 8080,
  maxConnections: 1000,
  enableAuthentication: true,
  targetLatency: 50
});

// Start the server
await proxy.initialize();

// Get status
const status = await proxy.getStatus();
console.log('Server status:', status);

// Graceful shutdown
await proxy.shutdown();
```

### Browser Client

```typescript
// Connect to WebSocket proxy
const ws = new WebSocket('ws://localhost:8080?token=your-auth-token');

// Session management
ws.send(JSON.stringify({
  type: 'session-create',
  id: 'msg-1',
  timestamp: Date.now(),
  data: { name: 'my-session' }
}));

// Command execution
ws.send(JSON.stringify({
  type: 'command-execute',
  id: 'msg-2',
  timestamp: Date.now(),
  data: {
    sessionId: 'session-id',
    command: 'ls -la'
  }
}));

// Handle responses
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};
```

## 📋 API Reference

### WebSocket Message Types

#### Authentication
```typescript
{
  type: 'auth',
  id: string,
  timestamp: number,
  data: {
    username: string,
    password: string
  }
}
```

#### Session Management
```typescript
// Create session
{
  type: 'session-create',
  data: { name: string, options?: any }
}

// List sessions
{
  type: 'session-list',
  data: {}
}

// Attach to session
{
  type: 'session-attach',
  data: { sessionId: string }
}

// Destroy session
{
  type: 'session-destroy',
  data: { sessionId: string }
}
```

#### Command Execution
```typescript
// Execute single command
{
  type: 'command-execute',
  data: {
    sessionId: string,
    command: string,
    target?: string
  }
}

// Execute batch commands
{
  type: 'batch-execute',
  data: {
    sessionId: string,
    commands: string[]
  }
}
```

#### System Operations
```typescript
// Heartbeat
{
  type: 'heartbeat',
  data: { timestamp: number }
}

// Get metrics
{
  type: 'metrics',
  data: {}
}
```

### Response Format

```typescript
{
  id: string,              // Request ID
  success: boolean,        // Operation success
  data?: any,             // Response data
  error?: string,         // Error message
  timestamp: number,      // Response timestamp
  latency?: number,       // Request latency
  backendInfo?: {         // Backend information
    type: string,
    latency: number,
    load: number
  }
}
```

## 📊 Monitoring

### Health Endpoints

The server provides health monitoring through:

```bash
# Check server health
curl http://localhost:9090/health

# Get metrics
curl http://localhost:9090/metrics
```

### Performance Metrics

- **Connection Metrics**: Active connections, total handled
- **Latency Metrics**: Average, P95, P99 response times
- **Backend Metrics**: Health status, load distribution
- **Security Metrics**: Failed authentications, blocked IPs

### Logging

All security events are logged through the AuditLogger:

```typescript
// Example log entry
{
  timestamp: 1704067200000,
  eventType: 'COMMAND_EXECUTED',
  severity: 'INFO',
  source: 'WebSocketProxyServer',
  description: 'Command executed successfully',
  metadata: {
    sessionId: 'session-123',
    command: 'ls',
    executionTime: 45
  },
  outcome: 'success',
  riskScore: 2
}
```

## 🔧 Integration

### With Existing Backend

The proxy integrates seamlessly with the existing tmux backend infrastructure:

```typescript
import { BackendManager } from '../tmux/backends/BackendManager';
import { SecureCommandExecutor } from '../tmux/security/SecureCommandExecutor';

// The proxy uses these existing components
const backendManager = new BackendManager({
  selectionStrategy: 'performance-based',
  fallbackBackends: ['tmux']
});

const secureExecutor = new SecureCommandExecutor({
  socketPath: '/tmp/tmux-secure',
  enableAuditLogging: true
});
```

### With Frontend Components

The proxy works with the existing TerminalWebSocketClient:

```typescript
import { TerminalWebSocketClient } from '../websocket/TerminalWebSocketClient';

const client = new TerminalWebSocketClient({
  url: 'ws://localhost:8080',
  securityToken: 'auth-token'
});

await client.connect();
```

## 🚨 Security Considerations

### Command Validation
- All commands go through SecureCommandExecutor
- Whitelist-based command validation
- Parameter sanitization and validation
- SQL injection and command injection prevention

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- Role-based access control (RBAC)
- IP-based restrictions and blocking
- Session management with Redis persistence

### Rate Limiting
- Per-IP rate limiting with configurable windows
- Per-user rate limiting for authenticated users
- Automatic IP blocking for suspicious activity
- Circuit breaker pattern for backend protection

### Audit Logging
- Comprehensive security event logging
- Failed authentication tracking
- Command execution audit trail
- Real-time security monitoring

## 🎯 Performance Targets

### Latency Requirements
- **Backend Latency**: <15ms for tmux operations
- **Proxy Latency**: <50ms for message processing
- **Total Latency**: <65ms end-to-end

### Throughput Requirements
- **Connections**: 1000+ concurrent WebSocket connections
- **Commands**: 1000+ commands per second
- **Memory**: <100MB per 1000 connections
- **CPU**: <2% overhead per connection

### Scalability
- Horizontal scaling through multiple proxy instances
- Session persistence enables proxy failover
- Load balancing across backend instances
- Redis-based session sharing

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if server is running
   node server.ts health
   
   # Check port binding
   netstat -tuln | grep 8080
   ```

2. **Authentication Failures**
   ```bash
   # Check token format
   # Verify user credentials
   # Check audit logs for details
   ```

3. **High Latency**
   ```bash
   # Check backend health
   # Monitor system resources
   # Review connection pool size
   ```

4. **Memory Issues**
   ```bash
   # Monitor connection count
   # Check for connection leaks
   # Review session cleanup
   ```

### Debug Mode

Enable debug logging:

```bash
DEBUG=websocket-proxy:* node server.ts
```

## 📝 License

This WebSocket proxy server is part of the voice-terminal-hybrid project and follows the same licensing terms.

## 🤝 Contributing

When contributing to the WebSocket proxy:

1. Maintain security-first approach
2. Follow performance requirements
3. Add comprehensive tests
4. Update documentation
5. Include audit logging for new features

## 📚 Related Documentation

- [Terminal Backend Architecture](../docs/adr-001-terminal-backend-architecture.md)
- [Tmux Architecture](../docs/tmux-architecture.md)
- [Security Documentation](../tmux/security/README.md)
- [Performance Analysis](../../tmux-performance-analysis.md)
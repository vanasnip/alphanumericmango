# ADR-002: WebSocket Proxy Service Architecture

## Status
Proposed

## Context
Current tmux integration works well for Node.js applications but requires WebSocket proxy for browser-based access. The voice-terminal-hybrid application needs real-time bidirectional communication between browser and terminal backend.

Current limitations:
- No browser integration path
- Direct tmux communication limited to server-side
- Voice commands need real-time terminal feedback
- Multiple concurrent users need session isolation

## Decision
Implement a **WebSocket Proxy Service** as a separate microservice that bridges browser clients with terminal backends.

### Architecture Components

#### 1. WebSocket Gateway
```typescript
interface WebSocketGateway {
  handleConnection(socket: WebSocket): void;
  authenticate(token: string): Promise<User>;
  routeMessage(sessionId: string, message: TerminalMessage): void;
  broadcastOutput(sessionId: string, output: string): void;
}
```

#### 2. Session Router
```typescript
interface SessionRouter {
  createSession(userId: string, sessionConfig: SessionConfig): Promise<string>;
  getSession(sessionId: string): Promise<TerminalSession | null>;
  routeCommand(sessionId: string, command: Command): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
}
```

#### 3. Backend Pool Manager
```typescript
interface BackendPoolManager {
  acquireBackend(requirements: BackendRequirements): Promise<ITerminalBackend>;
  releaseBackend(backendId: string): Promise<void>;
  healthCheck(): Promise<BackendHealth[]>;
  scalePool(targetSize: number): Promise<void>;
}
```

## Architectural Benefits

### Scalability
- **Horizontal Scaling**: Multiple proxy instances behind load balancer
- **Backend Pooling**: Shared terminal backends across connections
- **Resource Optimization**: Efficient backend allocation

### Security
- **Authentication Gateway**: Centralized user authentication
- **Command Validation**: Sanitize and validate all terminal commands
- **Session Isolation**: Prevent cross-session access

### Performance
- **Connection Multiplexing**: Multiple browser sessions per backend
- **Output Buffering**: Efficient real-time streaming
- **Heartbeat Monitoring**: Detect and recover from stale connections

## Implementation Design

### Message Protocol
```typescript
interface TerminalMessage {
  type: 'command' | 'output' | 'control' | 'heartbeat';
  sessionId: string;
  payload: string | CommandPayload | ControlPayload;
  timestamp: number;
  messageId: string;
}

interface CommandPayload {
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

interface ControlPayload {
  action: 'resize' | 'interrupt' | 'clear' | 'disconnect';
  parameters?: any;
}
```

### Session State Management
```typescript
interface SessionState {
  sessionId: string;
  userId: string;
  backendId: string;
  status: 'active' | 'idle' | 'disconnected';
  lastActivity: Date;
  connectionCount: number;
  workingDirectory: string;
  environment: Record<string, string>;
}
```

## Deployment Architecture

### Development Setup
```yaml
services:
  websocket-proxy:
    build: ./packages/websocket-proxy
    ports: ["3001:3001"]
    environment:
      - BACKEND_POOL_SIZE=5
      - MAX_SESSIONS_PER_BACKEND=10
  
  voice-terminal:
    build: ./packages/voice-terminal-hybrid
    ports: ["3000:3000"]
    depends_on: [websocket-proxy]
```

### Production Setup
```yaml
services:
  nginx-lb:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]
  
  websocket-proxy:
    replicas: 3
    image: voice-terminal/websocket-proxy:latest
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - BACKEND_POOL_SIZE=20
  
  redis:
    image: redis:alpine
    command: redis-server --appendonly yes
    volumes: ["redis-data:/data"]
```

## Consequences

### Benefits
- **Browser Compatibility**: Full browser-based terminal access
- **Real-time Performance**: WebSocket streaming optimized for voice commands
- **Concurrent Users**: Support 100+ simultaneous sessions
- **Fault Tolerance**: Backend failure isolation and recovery

### Trade-offs
- **Additional Complexity**: New service to deploy and monitor
- **Network Latency**: Additional hop between browser and backend
- **State Management**: Session state coordination complexity
- **Resource Overhead**: WebSocket connections consume memory

### Risks
- **Single Point of Failure**: If proxy service fails, all terminals disconnect
- **Session Persistence**: WebSocket reconnection and session recovery
- **Resource Exhaustion**: Memory leaks in long-running connections

## Mitigation Strategies

### High Availability
- Deploy multiple proxy instances with load balancing
- Implement graceful degradation modes
- Session state persistence in Redis

### Resource Management
- Connection pooling and automatic cleanup
- Backend health monitoring and replacement
- Memory usage monitoring and alerts

### Security
- Rate limiting and DDoS protection
- Command sanitization and validation
- Audit logging for all terminal sessions

## Metrics for Success
- WebSocket connection latency <50ms
- Command round-trip time <100ms (including network)
- Support 100+ concurrent WebSocket connections
- 99.9% proxy uptime
- Automatic session recovery within 5 seconds

## Migration Path
1. **Phase 1**: Develop proxy service alongside current implementation
2. **Phase 2**: Add WebSocket support to existing terminal components
3. **Phase 3**: Deploy proxy service and test with browser clients
4. **Phase 4**: Migrate production traffic to proxy-based architecture
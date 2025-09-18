# API Specifications
## AlphanumericMango Project

Version: 1.0.0  
Last Updated: 2025-09-18  
Status: Draft  
Format: OpenAPI 3.0 Compatible

---

## 1. Overview

This document provides comprehensive API specifications for all service interfaces within the AlphanumericMango system. APIs are categorized by service domain and include REST endpoints, WebSocket protocols, IPC channels, and internal service contracts.

## 2. API Categories

### 2.1 Service APIs
- Voice Engine API
- Terminal Control API
- Project Management API
- AI Integration API (Claude MCP)
- Notification API

### 2.2 Communication Protocols
- IPC Communication Protocol
- WebSocket Protocol
- Event Bus Protocol

### 2.3 Extension APIs
- Plugin Extension API
- Theme API
- Command Extension API

---

## 3. Voice Engine API

### 3.1 REST Endpoints

#### Initialize Voice Engine
```yaml
POST /api/voice/initialize
Content-Type: application/json

Request:
  {
    "config": {
      "language": "en-US",
      "sampleRate": 48000,
      "channels": 1,
      "deviceId": "default",
      "mode": "hybrid", # local|cloud|hybrid
      "vad": {
        "enabled": true,
        "sensitivity": 0.7
      }
    }
  }

Response:
  200 OK
  {
    "sessionId": "voice-session-123",
    "status": "initialized",
    "capabilities": {
      "streaming": true,
      "languages": ["en-US", "en-GB"],
      "maxDuration": 60000
    }
  }
```

#### Start Voice Capture
```yaml
POST /api/voice/capture/start
Content-Type: application/json

Request:
  {
    "sessionId": "voice-session-123",
    "mode": "continuous", # continuous|push-to-talk|command
    "timeout": 30000
  }

Response:
  200 OK
  {
    "captureId": "capture-456",
    "status": "capturing",
    "streamUrl": "ws://localhost:3001/voice/stream/capture-456"
  }
```

#### Stop Voice Capture
```yaml
POST /api/voice/capture/stop
Content-Type: application/json

Request:
  {
    "captureId": "capture-456"
  }

Response:
  200 OK
  {
    "captureId": "capture-456",
    "status": "stopped",
    "duration": 5234,
    "transcript": "open terminal in project folder"
  }
```

### 3.2 WebSocket Protocol

#### Voice Stream WebSocket
```typescript
// Connection
ws://localhost:3001/voice/stream/{captureId}

// Client -> Server Messages
interface VoiceStreamMessage {
  type: 'audio' | 'control';
  data: {
    // For audio type
    audio?: ArrayBuffer;
    timestamp?: number;
    
    // For control type
    command?: 'pause' | 'resume' | 'cancel';
  };
}

// Server -> Client Messages
interface VoiceStreamResponse {
  type: 'transcript' | 'status' | 'error';
  data: {
    // For transcript type
    text?: string;
    confidence?: number;
    isFinal?: boolean;
    alternatives?: Array<{text: string; confidence: number}>;
    
    // For status type
    status?: 'processing' | 'ready' | 'error';
    message?: string;
    
    // For error type
    error?: {
      code: string;
      message: string;
    };
  };
}
```

### 3.3 Voice Command Grammar

```bnf
<voice-command> ::= <action> <target> [<parameters>]

<action> ::= "open" | "close" | "create" | "delete" | "run" | 
             "build" | "test" | "debug" | "search" | "navigate"

<target> ::= "terminal" | "file" | "project" | "window" | "tab" |
             "session" | "pane" | <file-path> | <project-name>

<parameters> ::= <flag>* <argument>*

<flag> ::= "-" <flag-name>
<argument> ::= <string> | <number> | <path>
```

---

## 4. Terminal Control API

### 4.1 IPC Channels

#### Create Terminal Session
```typescript
// Main Process IPC
channel: 'terminal:create'

interface CreateTerminalRequest {
  projectId: string;
  config: {
    shell?: string;
    cwd?: string;
    env?: Record<string, string>;
    rows?: number;
    cols?: number;
    fontSize?: number;
  };
}

interface CreateTerminalResponse {
  sessionId: string;
  pid: number;
  status: 'created' | 'error';
  error?: string;
}
```

#### Execute Command
```typescript
channel: 'terminal:execute'

interface ExecuteCommandRequest {
  sessionId: string;
  command: string;
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    silent?: boolean;
  };
}

interface ExecuteCommandResponse {
  executionId: string;
  status: 'running' | 'completed' | 'failed';
  exitCode?: number;
  output?: string;
  error?: string;
}
```

#### Terminal Output Stream
```typescript
channel: 'terminal:output'

interface TerminalOutputEvent {
  sessionId: string;
  type: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}
```

### 4.2 tmux Integration Protocol

#### Session Management
```typescript
interface TmuxSession {
  name: string;
  id: string;
  windows: TmuxWindow[];
  created: Date;
  attached: boolean;
}

interface TmuxWindow {
  id: string;
  index: number;
  name: string;
  active: boolean;
  panes: TmuxPane[];
  layout: string;
}

interface TmuxPane {
  id: string;
  index: number;
  active: boolean;
  width: number;
  height: number;
  pid: number;
  command: string;
  cwd: string;
}
```

#### tmux Commands
```yaml
# Create new session
tmux new-session -d -s {session_name} -c {working_directory}

# Create new window
tmux new-window -t {session_name} -n {window_name}

# Split pane horizontally
tmux split-window -h -t {session_name}:{window_index}

# Split pane vertically  
tmux split-window -v -t {session_name}:{window_index}

# Send command to pane
tmux send-keys -t {session_name}:{window_index}.{pane_index} "{command}" Enter

# Capture pane output
tmux capture-pane -t {session_name}:{window_index}.{pane_index} -p
```

---

## 5. Project Management API

### 5.1 REST Endpoints

#### List Projects
```yaml
GET /api/projects

Response:
  200 OK
  {
    "projects": [
      {
        "id": "proj-123",
        "name": "AlphanumericMango",
        "path": "/Users/user/projects/alphanumeric",
        "type": "node",
        "status": "active",
        "lastAccessed": "2025-09-18T10:00:00Z"
      }
    ]
  }
```

#### Create Project Context
```yaml
POST /api/projects/{projectId}/context
Content-Type: application/json

Request:
  {
    "name": "Feature Development",
    "environment": {
      "workingDirectory": "/path/to/project",
      "variables": {
        "NODE_ENV": "development"
      }
    },
    "terminals": [
      {
        "name": "main",
        "command": "npm run dev"
      }
    ]
  }

Response:
  201 Created
  {
    "contextId": "ctx-456",
    "projectId": "proj-123",
    "status": "created"
  }
```

#### Switch Project Context
```yaml
POST /api/projects/{projectId}/context/{contextId}/activate

Response:
  200 OK
  {
    "contextId": "ctx-456",
    "status": "active",
    "restoredSessions": 3,
    "restoredWindows": 2
  }
```

### 5.2 Project Context Protocol

```typescript
interface ProjectContextAPI {
  // Context lifecycle
  create(config: ProjectConfig): Promise<ProjectContext>;
  load(contextId: string): Promise<ProjectContext>;
  save(context: ProjectContext): Promise<void>;
  delete(contextId: string): Promise<void>;
  
  // Context switching
  activate(contextId: string): Promise<void>;
  suspend(contextId: string): Promise<void>;
  switch(from: string, to: string): Promise<void>;
  
  // State management
  getState(contextId: string): Promise<ContextState>;
  setState(contextId: string, state: ContextState): Promise<void>;
  syncState(contexts: string[]): Promise<void>;
}
```

---

## 6. AI Integration API (Claude MCP)

### 6.1 MCP Protocol Implementation

#### Initialize MCP Connection
```typescript
interface MCPInitialize {
  method: 'initialize';
  params: {
    clientInfo: {
      name: string;
      version: string;
    };
    capabilities: {
      tools?: boolean;
      prompts?: boolean;
      resources?: boolean;
      logging?: boolean;
    };
  };
}

interface MCPInitializeResponse {
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: ToolCapability[];
    prompts?: PromptCapability[];
  };
}
```

#### Send Message to Claude
```typescript
interface ClaudeMessage {
  method: 'messages.create';
  params: {
    model: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    system?: string;
    temperature?: number;
    max_tokens?: number;
    tools?: Array<{
      name: string;
      description: string;
      input_schema: object;
    }>;
    stream?: boolean;
  };
}

interface ClaudeResponse {
  id: string;
  model: string;
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_call';
    text?: string;
    tool_call?: {
      name: string;
      input: any;
    };
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

#### Tool Execution Protocol
```typescript
interface ToolExecution {
  method: 'tools.execute';
  params: {
    name: string;
    input: any;
    context?: {
      projectId: string;
      sessionId: string;
    };
  };
}

interface ToolResult {
  output: any;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    duration: number;
    resourcesUsed: string[];
  };
}
```

### 6.2 AI Context Management

```typescript
interface AIContextManager {
  // Session management
  createSession(config: SessionConfig): Promise<string>;
  endSession(sessionId: string): Promise<void>;
  
  // Context operations
  addContext(sessionId: string, context: ContextItem): Promise<void>;
  clearContext(sessionId: string): Promise<void>;
  getContext(sessionId: string): Promise<ContextItem[]>;
  
  // Conversation management
  addMessage(sessionId: string, message: Message): Promise<void>;
  getHistory(sessionId: string, limit?: number): Promise<Message[]>;
  
  // Tool management
  registerTool(tool: ToolDefinition): Promise<void>;
  executeTool(name: string, params: any): Promise<ToolResult>;
}
```

---

## 7. Notification API

### 7.1 REST Endpoints

#### Create Notification
```yaml
POST /api/notifications
Content-Type: application/json

Request:
  {
    "type": "info",
    "title": "Build Complete",
    "message": "Project built successfully",
    "priority": "medium",
    "channels": ["ui", "tray"],
    "actions": [
      {
        "label": "View Output",
        "action": "view-output"
      }
    ]
  }

Response:
  201 Created
  {
    "notificationId": "notif-789",
    "status": "delivered",
    "deliveredTo": ["ui", "tray"]
  }
```

#### Webhook Registration
```yaml
POST /api/notifications/webhooks
Content-Type: application/json

Request:
  {
    "url": "https://example.com/webhook",
    "events": ["build.complete", "test.failed"],
    "secret": "webhook-secret-key",
    "active": true
  }

Response:
  201 Created
  {
    "webhookId": "webhook-123",
    "status": "registered"
  }
```

### 7.2 WebSocket Notification Stream

```typescript
// Connection
ws://localhost:3001/notifications/stream

// Server -> Client Messages
interface NotificationEvent {
  type: 'notification' | 'update' | 'dismiss';
  data: {
    id: string;
    notification?: Notification;
    update?: {
      field: string;
      value: any;
    };
    dismissed?: boolean;
  };
}

// Client -> Server Messages
interface NotificationAction {
  type: 'acknowledge' | 'dismiss' | 'action';
  data: {
    notificationId: string;
    actionId?: string;
  };
}
```

---

## 8. Plugin Extension API

### 8.1 Plugin Manifest

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "displayName": "Example Plugin",
  "description": "An example plugin for AlphanumericMango",
  "author": "Developer Name",
  "main": "dist/index.js",
  "engines": {
    "alphanumeric": ">=0.1.0"
  },
  "activationEvents": [
    "onCommand:example.command",
    "onLanguage:javascript",
    "onStartup"
  ],
  "contributes": {
    "commands": [
      {
        "command": "example.command",
        "title": "Run Example Command"
      }
    ],
    "keybindings": [
      {
        "command": "example.command",
        "key": "ctrl+shift+e"
      }
    ],
    "themes": [
      {
        "id": "example-theme",
        "label": "Example Theme",
        "path": "./themes/example.json"
      }
    ]
  }
}
```

### 8.2 Plugin API Interface

```typescript
interface PluginAPI {
  // Lifecycle
  activate(context: ExtensionContext): void;
  deactivate(): void;
  
  // Command registration
  registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
  executeCommand(command: string, ...args: any[]): Promise<any>;
  
  // Terminal access
  createTerminal(options: TerminalOptions): Terminal;
  getActiveTerminal(): Terminal | undefined;
  
  // Voice integration
  registerVoiceCommand(pattern: string, handler: VoiceHandler): Disposable;
  
  // UI extension
  createWebviewPanel(viewType: string, title: string, options: WebviewOptions): WebviewPanel;
  showMessage(message: string, type: MessageType): void;
  
  // Event subscriptions
  onDidChangeActiveTerminal(listener: (terminal: Terminal) => void): Disposable;
  onDidReceiveVoiceCommand(listener: (command: VoiceCommand) => void): Disposable;
  
  // Storage
  getGlobalState(): Memento;
  getWorkspaceState(): Memento;
}
```

### 8.3 Extension Context

```typescript
interface ExtensionContext {
  // Extension metadata
  extension: Extension;
  extensionPath: string;
  extensionUri: Uri;
  
  // Storage
  globalState: Memento;
  workspaceState: Memento;
  secrets: SecretStorage;
  
  // Paths
  storagePath?: string;
  globalStoragePath: string;
  logPath: string;
  
  // Subscription management
  subscriptions: Disposable[];
  
  // Environment
  environmentVariableCollection: EnvironmentVariableCollection;
  
  // Extension mode
  extensionMode: ExtensionMode;
}
```

---

## 9. IPC Communication Protocol

### 9.1 IPC Message Format

```typescript
interface IPCMessage {
  // Message metadata
  id: string;
  channel: string;
  timestamp: number;
  
  // Message type
  type: 'request' | 'response' | 'event' | 'error';
  
  // Request/Response correlation
  correlationId?: string;
  replyTo?: string;
  
  // Payload
  payload: any;
  
  // Error information
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 9.2 IPC Channel Registry

```typescript
const IPC_CHANNELS = {
  // System channels
  'system:ready': SystemReadyChannel,
  'system:shutdown': SystemShutdownChannel,
  'system:update': SystemUpdateChannel,
  
  // Voice channels
  'voice:start': VoiceStartChannel,
  'voice:stop': VoiceStopChannel,
  'voice:result': VoiceResultChannel,
  
  // Terminal channels
  'terminal:create': TerminalCreateChannel,
  'terminal:execute': TerminalExecuteChannel,
  'terminal:resize': TerminalResizeChannel,
  'terminal:output': TerminalOutputChannel,
  
  // Project channels
  'project:open': ProjectOpenChannel,
  'project:close': ProjectCloseChannel,
  'project:switch': ProjectSwitchChannel,
  
  // AI channels
  'ai:query': AIQueryChannel,
  'ai:response': AIResponseChannel,
  'ai:tool': AIToolChannel,
  
  // Notification channels
  'notification:show': NotificationShowChannel,
  'notification:dismiss': NotificationDismissChannel,
  'notification:action': NotificationActionChannel
};
```

### 9.3 IPC Security Model

```typescript
interface IPCSecurityPolicy {
  // Channel permissions
  allowedChannels: string[];
  deniedChannels: string[];
  
  // Message validation
  validateMessage: (message: IPCMessage) => boolean;
  sanitizePayload: (payload: any) => any;
  
  // Rate limiting
  rateLimit: {
    maxRequestsPerSecond: number;
    maxPayloadSize: number;
  };
  
  // Encryption
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyExchange: string;
  };
}
```

---

## 10. Error Codes and Responses

### 10.1 Standard Error Codes

```typescript
enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'E_BAD_REQUEST',
  UNAUTHORIZED = 'E_UNAUTHORIZED',
  FORBIDDEN = 'E_FORBIDDEN',
  NOT_FOUND = 'E_NOT_FOUND',
  CONFLICT = 'E_CONFLICT',
  RATE_LIMITED = 'E_RATE_LIMITED',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'E_INTERNAL',
  NOT_IMPLEMENTED = 'E_NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE = 'E_SERVICE_UNAVAILABLE',
  
  // Domain-specific errors
  VOICE_NOT_AVAILABLE = 'E_VOICE_UNAVAILABLE',
  TERMINAL_SESSION_DEAD = 'E_TERMINAL_DEAD',
  AI_QUOTA_EXCEEDED = 'E_AI_QUOTA',
  PLUGIN_LOAD_FAILED = 'E_PLUGIN_LOAD'
}
```

### 10.2 Error Response Format

```json
{
  "error": {
    "code": "E_BAD_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "sessionId",
      "reason": "Session ID is required"
    },
    "timestamp": "2025-09-18T10:00:00Z",
    "requestId": "req-123456"
  }
}
```

---

## 11. Rate Limiting and Quotas

### 11.1 API Rate Limits

```yaml
Rate Limits:
  Voice API:
    - Initialization: 10 requests/minute
    - Capture: 100 requests/minute
    - Stream: Unlimited (connection-based)
  
  Terminal API:
    - Session Creation: 20 sessions/minute
    - Command Execution: 1000 commands/minute
    - Output Stream: Unlimited
  
  AI API:
    - Queries: 60 requests/minute
    - Token Limit: 100,000 tokens/hour
    - Tool Executions: 500/hour
  
  Notification API:
    - Create: 100 notifications/minute
    - Webhook: 1000 events/hour
```

### 11.2 Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1695028800
X-RateLimit-RetryAfter: 30
```

---

## 12. Versioning Strategy

### 12.1 API Version Format

```
/api/v{major}/resource

Examples:
- /api/v1/voice/initialize
- /api/v2/terminal/sessions
```

### 12.2 Version Compatibility

```typescript
interface VersionCompatibility {
  current: string;
  supported: string[];
  deprecated: string[];
  sunset: Record<string, Date>;
}
```

---

## Document History
- v1.0.0 (2025-09-18): Initial API specifications documentation
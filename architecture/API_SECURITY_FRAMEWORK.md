# API SECURITY FRAMEWORK - EMERGENCY IMPLEMENTATION

**STATUS**: 🔒 ZERO-TRUST API ARCHITECTURE
**PRIORITY**: CRITICAL - Phase 0 Implementation  
**COMPLIANCE**: Defense-in-Depth API Security

## API THREAT LANDSCAPE ASSESSMENT

### CRITICAL API VULNERABILITIES IDENTIFIED

#### 1. UNAUTHENTICATED API ENDPOINTS - SEVERITY: CRITICAL
```typescript
// VULNERABLE: No authentication on API endpoints
ipcMain.handle('tmux:command', async (event, command) => {
  return this.executeTmuxCommand(command); // ANYONE CAN EXECUTE
});

ipcMain.handle('voice:start', async () => {
  return this.startVoiceRecording(); // NO AUTHORIZATION
});
```

#### 2. UNRESTRICTED API ACCESS - SEVERITY: CRITICAL
```javascript
// VULNERABLE: Renderer can call any API
contextBridge.exposeInMainWorld('electronAPI', {
  tmux: {
    sendCommand: (command) => ipcRenderer.invoke('tmux:command', command) // NO LIMITS
  }
});
```

#### 3. MISSING INPUT VALIDATION - SEVERITY: HIGH
```typescript
// VULNERABLE: No input validation or sanitization
private async executeTmuxCommand(command: string) {
  console.log('tmux command:', command); // LOGS SENSITIVE DATA
  return { success: true, output: 'tmux output placeholder' }; // NO VALIDATION
}
```

## SECURE API ARCHITECTURE

### 1. AUTHENTICATION AND AUTHORIZATION ENGINE

```typescript
// SECURE: Zero-trust API authentication
interface APISecurityContext {
  sessionId: string;
  userId: string;
  permissions: APIPermission[];
  rateLimits: RateLimitConfig;
  deviceId: string;
  timestamp: number;
  expiresAt: number;
}

interface APIPermission {
  resource: string;     // 'tmux', 'voice', 'system'
  actions: string[];    // ['read', 'execute', 'admin']
  conditions?: string[]; // ['time_based', 'ip_restricted']
}

class APIAuthenticationEngine {
  private sessions = new Map<string, APISecurityContext>();
  private rateLimiters = new Map<string, RateLimiter>();
  private permissionRegistry = new APIPermissionRegistry();
  
  async authenticateAPIRequest(request: APIRequest): Promise<APISecurityContext> {
    // ENFORCE: Extract authentication headers
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APISecurityError('Authentication required', 'UNAUTHORIZED', 401);
    }
    
    const token = authHeader.substring(7);
    
    // ENFORCE: Token validation
    const tokenPayload = await this.validateToken(token);
    if (!tokenPayload.valid) {
      throw new APISecurityError('Invalid token', 'INVALID_TOKEN', 401);
    }
    
    // ENFORCE: Session validation
    const session = this.sessions.get(tokenPayload.sessionId);
    if (!session) {
      throw new APISecurityError('Session not found', 'SESSION_INVALID', 401);
    }
    
    // ENFORCE: Session expiration
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(tokenPayload.sessionId);
      throw new APISecurityError('Session expired', 'SESSION_EXPIRED', 401);
    }
    
    // ENFORCE: Device validation
    if (session.deviceId !== request.deviceId) {
      throw new APISecurityError('Device mismatch', 'DEVICE_INVALID', 403);
    }
    
    // ENFORCE: Rate limiting
    const rateLimitOk = await this.checkRateLimit(session.userId, request.endpoint);
    if (!rateLimitOk) {
      throw new APISecurityError('Rate limit exceeded', 'RATE_LIMITED', 429);
    }
    
    return session;
  }
  
  async authorizeAPIRequest(
    context: APISecurityContext,
    resource: string,
    action: string
  ): Promise<boolean> {
    // ENFORCE: Permission check
    const hasPermission = context.permissions.some(perm =>
      perm.resource === resource && perm.actions.includes(action)
    );
    
    if (!hasPermission) {
      this.auditAPIAccess('PERMISSION_DENIED', {
        userId: context.userId,
        resource,
        action,
        timestamp: Date.now()
      });
      return false;
    }
    
    // ENFORCE: Conditional access checks
    const conditionsMet = await this.evaluateAccessConditions(context, resource);
    if (!conditionsMet) {
      this.auditAPIAccess('CONDITIONS_NOT_MET', {
        userId: context.userId,
        resource,
        action,
        timestamp: Date.now()
      });
      return false;
    }
    
    return true;
  }
  
  async createSecureSession(credentials: LoginCredentials): Promise<APISession> {
    // ENFORCE: Multi-factor authentication
    const mfaValid = await this.validateMFA(credentials.mfaToken);
    if (!mfaValid) {
      throw new APISecurityError('MFA required', 'MFA_INVALID', 401);
    }
    
    // ENFORCE: Device fingerprinting
    const deviceId = this.generateDeviceFingerprint(credentials.deviceInfo);
    
    // ENFORCE: Generate secure session
    const sessionId = this.generateSecureSessionId();
    const userId = credentials.userId;
    
    // ENFORCE: Get user permissions
    const permissions = await this.permissionRegistry.getPermissions(userId);
    
    const context: APISecurityContext = {
      sessionId,
      userId,
      permissions,
      rateLimits: await this.getRateLimits(userId),
      deviceId,
      timestamp: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
    
    this.sessions.set(sessionId, context);
    
    // AUDIT: Log session creation
    this.auditAPIAccess('SESSION_CREATED', {
      sessionId,
      userId,
      deviceId,
      timestamp: Date.now()
    });
    
    // GENERATE: JWT token
    const token = await this.generateJWTToken(context);
    
    return {
      token,
      sessionId,
      expiresAt: context.expiresAt,
      permissions: permissions.map(p => ({ resource: p.resource, actions: p.actions }))
    };
  }
}
```

### 2. SECURE API GATEWAY

```typescript
// SECURE: API Gateway with comprehensive security
class SecureAPIGateway {
  private authEngine = new APIAuthenticationEngine();
  private validator = new APIInputValidator();
  private monitor = new APISecurityMonitor();
  
  async handleSecureAPIRequest(rawRequest: any): Promise<APIResponse> {
    let requestId: string;
    let context: APISecurityContext | null = null;
    
    try {
      // GENERATE: Request ID for tracking
      requestId = this.generateRequestId();
      
      // PARSE: Request structure
      const request = this.parseAPIRequest(rawRequest, requestId);
      
      // VALIDATE: Request format
      const formatValid = this.validator.validateRequestFormat(request);
      if (!formatValid.valid) {
        throw new APISecurityError(
          `Invalid request format: ${formatValid.reason}`,
          'INVALID_FORMAT',
          400
        );
      }
      
      // AUTHENTICATE: User and session
      context = await this.authEngine.authenticateAPIRequest(request);
      
      // AUTHORIZE: Resource access
      const authorized = await this.authEngine.authorizeAPIRequest(
        context,
        request.resource,
        request.action
      );
      
      if (!authorized) {
        throw new APISecurityError('Access denied', 'FORBIDDEN', 403);
      }
      
      // VALIDATE: Input parameters
      const inputValid = await this.validator.validateInput(
        request.payload,
        request.resource,
        request.action
      );
      
      if (!inputValid.valid) {
        throw new APISecurityError(
          `Invalid input: ${inputValid.reason}`,
          'INVALID_INPUT',
          400
        );
      }
      
      // MONITOR: Security events
      this.monitor.trackAPIRequest(request, context);
      
      // EXECUTE: Secure operation
      const result = await this.executeSecureOperation(
        request.resource,
        request.action,
        inputValid.sanitizedPayload,
        context
      );
      
      // AUDIT: Successful operation
      this.auditAPIOperation('SUCCESS', {
        requestId,
        userId: context.userId,
        resource: request.resource,
        action: request.action,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        data: result,
        requestId,
        timestamp: Date.now()
      };
      
    } catch (error) {
      // AUDIT: Failed operation
      this.auditAPIOperation('FAILURE', {
        requestId: requestId || 'unknown',
        userId: context?.userId || 'anonymous',
        error: error.message,
        errorCode: error.code,
        timestamp: Date.now()
      });
      
      // SECURITY: Don't leak sensitive error details
      const sanitizedError = this.sanitizeError(error);
      
      return {
        success: false,
        error: sanitizedError,
        requestId: requestId || 'unknown',
        timestamp: Date.now()
      };
    }
  }
  
  private async executeSecureOperation(
    resource: string,
    action: string,
    payload: any,
    context: APISecurityContext
  ): Promise<any> {
    // ROUTE: To appropriate secure handler
    switch (resource) {
      case 'tmux':
        return this.handleTmuxOperation(action, payload, context);
      case 'voice':
        return this.handleVoiceOperation(action, payload, context);
      case 'system':
        return this.handleSystemOperation(action, payload, context);
      default:
        throw new APISecurityError('Unknown resource', 'UNKNOWN_RESOURCE', 400);
    }
  }
  
  private async handleTmuxOperation(
    action: string,
    payload: any,
    context: APISecurityContext
  ): Promise<any> {
    const tmuxHandler = new SecureTmuxHandler();
    
    switch (action) {
      case 'list_sessions':
        return tmuxHandler.listSessions(context);
      case 'execute_command':
        return tmuxHandler.executeCommand(payload.command, context);
      case 'get_output':
        return tmuxHandler.getOutput(payload.sessionId, context);
      default:
        throw new APISecurityError('Unknown tmux action', 'UNKNOWN_ACTION', 400);
    }
  }
}
```

### 3. INPUT VALIDATION ENGINE

```typescript
// SECURE: Comprehensive input validation
interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: any[];
    min?: number;
    max?: number;
  };
  sanitizer?: (value: any) => any;
}

class APIInputValidator {
  private validationSchemas = new Map<string, ValidationRule[]>();
  
  constructor() {
    this.initializeSchemas();
  }
  
  private initializeSchemas() {
    // DEFINE: tmux command validation
    this.validationSchemas.set('tmux.execute_command', [
      {
        field: 'command',
        type: 'string',
        required: true,
        constraints: {
          maxLength: 256,
          pattern: /^[a-zA-Z0-9\s\-\._\/]+$/,
        },
        sanitizer: (value: string) => value.trim().replace(/\s+/g, ' ')
      },
      {
        field: 'sessionId',
        type: 'string',
        required: false,
        constraints: {
          pattern: /^[a-zA-Z0-9\-_]{1,32}$/
        }
      }
    ]);
    
    // DEFINE: voice command validation
    this.validationSchemas.set('voice.start_recording', [
      {
        field: 'maxDuration',
        type: 'number',
        required: false,
        constraints: {
          min: 1000,
          max: 30000 // 30 seconds max
        }
      },
      {
        field: 'consentId',
        type: 'string',
        required: true,
        constraints: {
          pattern: /^consent_[a-zA-Z0-9]+$/
        }
      }
    ]);
    
    // DEFINE: system operation validation
    this.validationSchemas.set('system.get_info', [
      {
        field: 'infoType',
        type: 'string',
        required: true,
        constraints: {
          allowedValues: ['status', 'metrics', 'version']
        }
      }
    ]);
  }
  
  async validateInput(
    payload: any,
    resource: string,
    action: string
  ): Promise<ValidationResult> {
    const schemaKey = `${resource}.${action}`;
    const schema = this.validationSchemas.get(schemaKey);
    
    if (!schema) {
      return {
        valid: false,
        reason: 'No validation schema found',
        errors: [`Unknown operation: ${schemaKey}`]
      };
    }
    
    const errors: string[] = [];
    const sanitizedPayload: any = {};
    
    // VALIDATE: Each field according to schema
    for (const rule of schema) {
      const value = payload[rule.field];
      
      // CHECK: Required fields
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Field '${rule.field}' is required`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        // CHECK: Type validation
        const typeValid = this.validateType(value, rule.type);
        if (!typeValid) {
          errors.push(`Field '${rule.field}' must be of type ${rule.type}`);
          continue;
        }
        
        // CHECK: Constraints
        const constraintValid = this.validateConstraints(value, rule.constraints);
        if (!constraintValid.valid) {
          errors.push(`Field '${rule.field}': ${constraintValid.reason}`);
          continue;
        }
        
        // SANITIZE: Input value
        sanitizedPayload[rule.field] = rule.sanitizer ? rule.sanitizer(value) : value;
      }
    }
    
    // CHECK: No extra fields (prevent parameter pollution)
    const allowedFields = schema.map(rule => rule.field);
    const extraFields = Object.keys(payload).filter(key => !allowedFields.includes(key));
    
    if (extraFields.length > 0) {
      errors.push(`Unexpected fields: ${extraFields.join(', ')}`);
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        reason: 'Validation failed',
        errors,
        sanitizedPayload: null
      };
    }
    
    return {
      valid: true,
      sanitizedPayload,
      errors: []
    };
  }
  
  private validateConstraints(value: any, constraints?: ValidationRule['constraints']): {
    valid: boolean;
    reason?: string;
  } {
    if (!constraints) return { valid: true };
    
    // STRING constraints
    if (typeof value === 'string') {
      if (constraints.minLength && value.length < constraints.minLength) {
        return { valid: false, reason: `Minimum length is ${constraints.minLength}` };
      }
      
      if (constraints.maxLength && value.length > constraints.maxLength) {
        return { valid: false, reason: `Maximum length is ${constraints.maxLength}` };
      }
      
      if (constraints.pattern && !constraints.pattern.test(value)) {
        return { valid: false, reason: 'Invalid format' };
      }
    }
    
    // NUMBER constraints
    if (typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        return { valid: false, reason: `Minimum value is ${constraints.min}` };
      }
      
      if (constraints.max !== undefined && value > constraints.max) {
        return { valid: false, reason: `Maximum value is ${constraints.max}` };
      }
    }
    
    // ALLOWED VALUES constraint
    if (constraints.allowedValues && !constraints.allowedValues.includes(value)) {
      return { valid: false, reason: `Value must be one of: ${constraints.allowedValues.join(', ')}` };
    }
    
    return { valid: true };
  }
}
```

### 4. RATE LIMITING ENGINE

```typescript
// SECURE: Advanced rate limiting
interface RateLimitConfig {
  requests: number;      // Max requests
  window: number;        // Time window in ms
  burst: number;         // Burst allowance
  punishment: number;    // Penalty duration in ms
}

class APIRateLimiter {
  private limiters = new Map<string, RateLimitTracker>();
  private configs = new Map<string, RateLimitConfig>();
  
  constructor() {
    this.initializeConfigs();
  }
  
  private initializeConfigs() {
    // CONFIGURE: Different limits for different operations
    this.configs.set('tmux.execute_command', {
      requests: 10,
      window: 60000,     // 1 minute
      burst: 3,
      punishment: 300000 // 5 minutes
    });
    
    this.configs.set('voice.start_recording', {
      requests: 5,
      window: 60000,     // 1 minute
      burst: 1,
      punishment: 600000 // 10 minutes
    });
    
    this.configs.set('system.get_info', {
      requests: 30,
      window: 60000,     // 1 minute
      burst: 10,
      punishment: 60000  // 1 minute
    });
  }
  
  async checkRateLimit(
    userId: string,
    operation: string,
    ipAddress: string
  ): Promise<RateLimitResult> {
    const config = this.configs.get(operation);
    if (!config) {
      // Default conservative limits
      return this.checkDefaultRateLimit(userId, ipAddress);
    }
    
    const key = `${userId}:${operation}`;
    let tracker = this.limiters.get(key);
    
    if (!tracker) {
      tracker = {
        requests: [],
        burstUsed: 0,
        punishedUntil: 0
      };
      this.limiters.set(key, tracker);
    }
    
    const now = Date.now();
    
    // CHECK: Punishment period
    if (now < tracker.punishedUntil) {
      return {
        allowed: false,
        reason: 'Rate limit punishment active',
        retryAfter: tracker.punishedUntil - now
      };
    }
    
    // CLEAN: Old requests outside window
    tracker.requests = tracker.requests.filter(
      timestamp => now - timestamp < config.window
    );
    
    // CHECK: Regular rate limit
    if (tracker.requests.length >= config.requests) {
      // CHECK: Burst allowance
      if (tracker.burstUsed < config.burst) {
        tracker.burstUsed++;
        tracker.requests.push(now);
        
        return {
          allowed: true,
          remaining: 0,
          burstUsed: tracker.burstUsed,
          resetTime: now + config.window
        };
      }
      
      // PUNISH: Apply punishment
      tracker.punishedUntil = now + config.punishment;
      
      this.auditRateLimit('RATE_LIMIT_EXCEEDED', {
        userId,
        operation,
        ipAddress,
        requestCount: tracker.requests.length,
        timestamp: now
      });
      
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: config.punishment
      };
    }
    
    // ALLOW: Request within limits
    tracker.requests.push(now);
    
    // RESET: Burst allowance if window has passed
    if (tracker.requests.length === 1) {
      tracker.burstUsed = 0;
    }
    
    return {
      allowed: true,
      remaining: config.requests - tracker.requests.length,
      resetTime: now + config.window
    };
  }
}
```

## SECURE API IMPLEMENTATION

### 1. SECURE PRELOAD REPLACEMENT

```typescript
// SECURE: Replace insecure preload.js
const { contextBridge, ipcRenderer } = require('electron');

// SECURE: Authentication-first API
contextBridge.exposeInMainWorld('secureAPI', {
  // AUTHENTICATION: Required for all operations
  auth: {
    async login(credentials: LoginCredentials): Promise<AuthResult> {
      return ipcRenderer.invoke('api:auth:login', credentials);
    },
    
    async logout(sessionId: string): Promise<void> {
      return ipcRenderer.invoke('api:auth:logout', { sessionId });
    },
    
    async refreshToken(sessionId: string): Promise<AuthResult> {
      return ipcRenderer.invoke('api:auth:refresh', { sessionId });
    }
  },
  
  // TMUX: Secure terminal operations
  tmux: {
    async listSessions(token: string): Promise<TmuxSession[]> {
      return ipcRenderer.invoke('api:tmux:list_sessions', {}, { 
        authorization: `Bearer ${token}` 
      });
    },
    
    async executeCommand(command: string, token: string, sessionId?: string): Promise<CommandResult> {
      return ipcRenderer.invoke('api:tmux:execute_command', 
        { command, sessionId }, 
        { authorization: `Bearer ${token}` }
      );
    },
    
    async getOutput(sessionId: string, token: string): Promise<OutputResult> {
      return ipcRenderer.invoke('api:tmux:get_output', 
        { sessionId }, 
        { authorization: `Bearer ${token}` }
      );
    }
  },
  
  // VOICE: Secure voice operations  
  voice: {
    async startRecording(token: string, consentId: string): Promise<VoiceSession> {
      return ipcRenderer.invoke('api:voice:start_recording', 
        { consentId }, 
        { authorization: `Bearer ${token}` }
      );
    },
    
    async stopRecording(sessionId: string, token: string): Promise<VoiceResult> {
      return ipcRenderer.invoke('api:voice:stop_recording', 
        { sessionId }, 
        { authorization: `Bearer ${token}` }
      );
    }
  },
  
  // SYSTEM: Safe system information
  system: {
    async getInfo(infoType: string, token: string): Promise<SystemInfo> {
      return ipcRenderer.invoke('api:system:get_info', 
        { infoType }, 
        { authorization: `Bearer ${token}` }
      );
    }
  }
});

// REMOVE: Insecure electronAPI
// contextBridge.exposeInMainWorld('electronAPI', { ... }); // DELETED
```

### 2. SECURE MAIN PROCESS HANDLERS

```typescript
// SECURE: Replace all IPC handlers with authenticated versions
class SecureMainProcess {
  private apiGateway = new SecureAPIGateway();
  
  setupSecureHandlers() {
    // AUTHENTICATION endpoints
    ipcMain.handle('api:auth:login', async (event, credentials) => {
      return this.apiGateway.handleSecureAPIRequest({
        resource: 'auth',
        action: 'login',
        payload: credentials,
        headers: {},
        deviceId: this.getDeviceId(event),
        timestamp: Date.now()
      });
    });
    
    // TMUX endpoints with authentication
    ipcMain.handle('api:tmux:execute_command', async (event, payload, headers) => {
      return this.apiGateway.handleSecureAPIRequest({
        resource: 'tmux',
        action: 'execute_command',
        payload,
        headers,
        deviceId: this.getDeviceId(event),
        timestamp: Date.now()
      });
    });
    
    // VOICE endpoints with authentication
    ipcMain.handle('api:voice:start_recording', async (event, payload, headers) => {
      return this.apiGateway.handleSecureAPIRequest({
        resource: 'voice',
        action: 'start_recording',
        payload,
        headers,
        deviceId: this.getDeviceId(event),
        timestamp: Date.now()
      });
    });
    
    // REMOVE: All insecure handlers
    // ipcMain.handle('tmux:command', ...); // DELETED
    // ipcMain.handle('voice:start', ...);  // DELETED
    // ipcMain.handle('batch-ipc', ...);    // DELETED
  }
}
```

## SECURITY CONFIGURATION

### API Security Config

```yaml
# api-security-config.yaml
api_security:
  authentication:
    token_expiry: 1800 # 30 minutes
    refresh_threshold: 300 # 5 minutes
    max_sessions_per_user: 3
    require_device_registration: true
    
  authorization:
    permission_model: "rbac" # Role-Based Access Control
    default_permissions: ["system:get_info"]
    admin_permissions: ["system:*", "tmux:*", "voice:*"]
    user_permissions: ["tmux:list_sessions", "tmux:execute_command", "voice:start_recording"]
    
  rate_limiting:
    global_requests_per_minute: 60
    per_user_requests_per_minute: 30
    burst_allowance: 5
    punishment_duration: 300 # 5 minutes
    
  input_validation:
    max_payload_size: 65536 # 64KB
    strict_type_checking: true
    sanitize_all_inputs: true
    log_validation_failures: true
    
  monitoring:
    log_all_requests: true
    log_failed_auth: true
    alert_on_suspicious_activity: true
    security_event_retention: 2592000 # 30 days
```

---

**IMPLEMENTATION STATUS**: API Security Framework - Ready for Emergency Deployment
**SECURITY PRIORITY**: CRITICAL - Replace all existing API handlers immediately
**NEXT ACTIONS**: Deploy secure API gateway, implement authentication engine

🔐 **ZERO TRUST**: All API access now requires authentication and authorization
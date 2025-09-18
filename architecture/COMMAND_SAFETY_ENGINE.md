# TERMINAL COMMAND SAFETY ENGINE - CRITICAL SECURITY IMPLEMENTATION

**STATUS**: 🚨 COMMAND EXECUTION RESTRICTED - ALLOWLIST ONLY
**PRIORITY**: CRITICAL - Phase 0 Emergency Deployment
**COMPLIANCE**: Zero Trust Command Execution

## COMMAND INJECTION THREAT ANALYSIS

### CRITICAL COMMAND VULNERABILITIES IDENTIFIED

#### 1. ARBITRARY COMMAND EXECUTION - SEVERITY: CRITICAL
```typescript
// VULNERABLE: Direct command execution without validation
private async executeTmuxCommand(command: string) {
  console.log('tmux command:', command);
  return { success: true, output: 'tmux output placeholder' };
}

// ATTACK VECTORS:
// - Shell injection: 'ls; rm -rf /'
// - Command chaining: 'ls && cat /etc/passwd'
// - Environment manipulation: 'env | grep SECRET'
// - Process spawning: 'python -c "import os; os.system(\"malicious\")"'
```

#### 2. TMUX COMMAND INJECTION - SEVERITY: CRITICAL  
```javascript
// VULNERABLE: Unvalidated tmux send-keys
ipcMain.handle('tmux:command', async (event, command) => {
  // NO VALIDATION - ANY COMMAND POSSIBLE
  return spawn('tmux', ['send-keys', '-t', 'session', command, 'Enter']);
});

// ATTACK SCENARIOS:
// - Shell escape: 'exit; malicious_command'
// - Multi-command: 'cmd1; cmd2; cmd3'
// - Background execution: 'malicious &'
```

#### 3. PARAMETER INJECTION - SEVERITY: HIGH
```typescript
// VULNERABLE: Unvalidated parameters in command construction
const command = `tmux send-keys -t ${session} "${userInput}" Enter`;
// INJECTION: session = "session\"; malicious; echo \""
```

## SECURE COMMAND SAFETY ARCHITECTURE

### 1. COMMAND ALLOWLIST ENGINE

```typescript
// SECURE: Comprehensive command allowlisting
interface CommandSafetyRule {
  command: string;
  category: 'SAFE' | 'RESTRICTED' | 'FORBIDDEN';
  parameters?: ParameterRule[];
  conditions?: string[];
  maxExecutionTime?: number;
  requiresConfirmation?: boolean;
}

interface ParameterRule {
  name: string;
  type: 'string' | 'path' | 'number' | 'flag';
  required: boolean;
  validation: RegExp | string[];
  sanitizer?: (value: string) => string;
}

class CommandSafetyEngine {
  // ENFORCE: Strict allowlist of safe commands
  private readonly SAFE_COMMANDS: Map<string, CommandSafetyRule> = new Map([
    ['ls', {
      command: 'ls',
      category: 'SAFE',
      parameters: [
        {
          name: 'flags',
          type: 'flag',
          required: false,
          validation: /^-[alhtSr]*$/,
          sanitizer: (value) => value.replace(/[^-alhtSr]/g, '')
        },
        {
          name: 'path',
          type: 'path',
          required: false,
          validation: /^[a-zA-Z0-9\/\._-]*$/,
          sanitizer: (value) => this.sanitizePath(value)
        }
      ],
      maxExecutionTime: 5000
    }],
    
    ['pwd', {
      command: 'pwd',
      category: 'SAFE',
      parameters: [],
      maxExecutionTime: 1000
    }],
    
    ['cat', {
      command: 'cat',
      category: 'RESTRICTED',
      parameters: [
        {
          name: 'file',
          type: 'path',
          required: true,
          validation: /^[a-zA-Z0-9\/\._-]+$/,
          sanitizer: (value) => this.sanitizePath(value)
        }
      ],
      conditions: ['file_size_limit', 'file_type_check'],
      maxExecutionTime: 10000,
      requiresConfirmation: true
    }],
    
    ['grep', {
      command: 'grep',
      category: 'RESTRICTED',
      parameters: [
        {
          name: 'flags',
          type: 'flag',
          required: false,
          validation: /^-[Ein]*$/,
          sanitizer: (value) => value.replace(/[^-Ein]/g, '')
        },
        {
          name: 'pattern',
          type: 'string',
          required: true,
          validation: /^[a-zA-Z0-9\s\.\-_]*$/,
          sanitizer: (value) => this.sanitizePattern(value)
        },
        {
          name: 'file',
          type: 'path',
          required: true,
          validation: /^[a-zA-Z0-9\/\._-]+$/,
          sanitizer: (value) => this.sanitizePath(value)
        }
      ],
      maxExecutionTime: 15000
    }],
    
    ['tmux', {
      command: 'tmux',
      category: 'RESTRICTED',
      parameters: [
        {
          name: 'subcommand',
          type: 'string',
          required: true,
          validation: ['list-sessions', 'list-windows', 'capture-pane', 'show-session'],
          sanitizer: (value) => value.toLowerCase().trim()
        }
      ],
      conditions: ['tmux_session_access'],
      maxExecutionTime: 5000
    }]
  ]);
  
  // ENFORCE: Forbidden commands that should never execute
  private readonly FORBIDDEN_COMMANDS = new Set([
    'rm', 'rmdir', 'del', 'delete',
    'sudo', 'su', 'doas',
    'chmod', 'chown', 'chgrp',
    'kill', 'killall', 'pkill',
    'exec', 'eval', 'source',
    'bash', 'sh', 'zsh', 'fish',
    'python', 'node', 'ruby', 'perl',
    'curl', 'wget', 'nc', 'netcat',
    'ssh', 'scp', 'rsync',
    'mount', 'umount',
    'systemctl', 'service',
    'crontab', 'at',
    'passwd', 'adduser', 'userdel'
  ]);
  
  // ENFORCE: Dangerous patterns that indicate injection attempts
  private readonly DANGEROUS_PATTERNS = [
    /[;&|`$(){}[\]\\]/,           // Shell metacharacters
    /\$\([^)]*\)/,                // Command substitution
    /`[^`]*`/,                    // Backtick command substitution
    /\|\s*(bash|sh|python|node)/, // Pipe to interpreter
    />\s*\/dev\/null/,            // Output redirection
    /<\s*\/dev\/random/,          // Input redirection
    /2>&1/,                       // Error redirection
    /&\s*$/,                      // Background execution
    /\\\\/,                       // Escape sequences
    /(^|\s)\.\.\/+/              // Directory traversal
  ];
  
  async validateAndExecuteCommand(
    rawCommand: string,
    context: SecurityContext
  ): Promise<CommandResult> {
    try {
      // PARSE: Command structure
      const parsed = this.parseCommand(rawCommand);
      
      // VALIDATE: Command safety
      const validation = await this.validateCommand(parsed, context);
      if (!validation.safe) {
        throw new CommandSecurityError(
          validation.reason,
          validation.threat,
          'COMMAND_BLOCKED'
        );
      }
      
      // EXECUTE: Safe command with monitoring
      const result = await this.executeSafeCommand(
        validation.sanitizedCommand,
        context
      );
      
      return result;
      
    } catch (error) {
      this.auditCommandEvent('COMMAND_FAILED', {
        command: rawCommand,
        error: error.message,
        userId: context.userId,
        timestamp: Date.now()
      });
      throw error;
    }
  }
  
  private parseCommand(rawCommand: string): ParsedCommand {
    // SANITIZE: Input command
    const sanitized = rawCommand
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 256); // Limit length
    
    // PARSE: Command parts
    const parts = this.parseCommandParts(sanitized);
    
    if (parts.length === 0) {
      throw new CommandSecurityError('Empty command', 'EMPTY_COMMAND');
    }
    
    const [baseCommand, ...args] = parts;
    
    return {
      original: rawCommand,
      sanitized,
      baseCommand: baseCommand.toLowerCase(),
      arguments: args,
      fullCommand: parts.join(' ')
    };
  }
  
  private async validateCommand(
    parsed: ParsedCommand,
    context: SecurityContext
  ): Promise<CommandValidationResult> {
    // CHECK: Forbidden commands
    if (this.FORBIDDEN_COMMANDS.has(parsed.baseCommand)) {
      this.auditCommandEvent('FORBIDDEN_COMMAND_ATTEMPTED', {
        command: parsed.baseCommand,
        fullCommand: parsed.original,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      return {
        safe: false,
        reason: 'Command is forbidden',
        threat: 'FORBIDDEN_COMMAND',
        severity: 'CRITICAL'
      };
    }
    
    // CHECK: Dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(parsed.original)) {
        this.auditCommandEvent('DANGEROUS_PATTERN_DETECTED', {
          command: parsed.original,
          pattern: pattern.source,
          userId: context.userId,
          timestamp: Date.now()
        });
        
        return {
          safe: false,
          reason: 'Dangerous pattern detected',
          threat: 'COMMAND_INJECTION',
          severity: 'CRITICAL'
        };
      }
    }
    
    // CHECK: Allowlist validation
    const commandRule = this.SAFE_COMMANDS.get(parsed.baseCommand);
    if (!commandRule) {
      this.auditCommandEvent('COMMAND_NOT_ALLOWLISTED', {
        command: parsed.baseCommand,
        fullCommand: parsed.original,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      return {
        safe: false,
        reason: 'Command not in allowlist',
        threat: 'UNKNOWN_COMMAND',
        severity: 'HIGH'
      };
    }
    
    // VALIDATE: Parameters
    const paramValidation = await this.validateParameters(
      parsed.arguments,
      commandRule.parameters || [],
      context
    );
    
    if (!paramValidation.valid) {
      return {
        safe: false,
        reason: paramValidation.reason,
        threat: 'INVALID_PARAMETERS',
        severity: 'HIGH'
      };
    }
    
    // CHECK: Conditions
    if (commandRule.conditions) {
      const conditionsOk = await this.checkConditions(
        commandRule.conditions,
        parsed,
        context
      );
      
      if (!conditionsOk.valid) {
        return {
          safe: false,
          reason: conditionsOk.reason,
          threat: 'CONDITIONS_NOT_MET',
          severity: 'MEDIUM'
        };
      }
    }
    
    // BUILD: Sanitized command
    const sanitizedCommand = this.buildSanitizedCommand(
      parsed.baseCommand,
      paramValidation.sanitizedParameters
    );
    
    return {
      safe: true,
      sanitizedCommand,
      rule: commandRule,
      maxExecutionTime: commandRule.maxExecutionTime || 30000
    };
  }
  
  private async validateParameters(
    args: string[],
    rules: ParameterRule[],
    context: SecurityContext
  ): Promise<ParameterValidationResult> {
    const sanitizedParams: string[] = [];
    const errors: string[] = [];
    
    // PARSE: Arguments according to rules
    let argIndex = 0;
    
    for (const rule of rules) {
      if (rule.required && argIndex >= args.length) {
        errors.push(`Required parameter '${rule.name}' missing`);
        continue;
      }
      
      if (argIndex < args.length) {
        const arg = args[argIndex];
        
        // VALIDATE: Parameter type and format
        const validation = this.validateParameter(arg, rule);
        if (!validation.valid) {
          errors.push(`Parameter '${rule.name}': ${validation.reason}`);
          continue;
        }
        
        sanitizedParams.push(validation.sanitizedValue);
        argIndex++;
      }
    }
    
    // CHECK: Extra arguments
    if (argIndex < args.length) {
      errors.push(`Unexpected arguments: ${args.slice(argIndex).join(' ')}`);
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        reason: errors.join('; '),
        sanitizedParameters: []
      };
    }
    
    return {
      valid: true,
      sanitizedParameters: sanitizedParams
    };
  }
  
  private validateParameter(value: string, rule: ParameterRule): {
    valid: boolean;
    reason?: string;
    sanitizedValue?: string;
  } {
    // VALIDATE: Against rule validation
    if (rule.validation instanceof RegExp) {
      if (!rule.validation.test(value)) {
        return {
          valid: false,
          reason: `Invalid format for ${rule.name}`
        };
      }
    } else if (Array.isArray(rule.validation)) {
      if (!rule.validation.includes(value)) {
        return {
          valid: false,
          reason: `Value must be one of: ${rule.validation.join(', ')}`
        };
      }
    }
    
    // SANITIZE: Parameter value
    const sanitized = rule.sanitizer ? rule.sanitizer(value) : value;
    
    return {
      valid: true,
      sanitizedValue: sanitized
    };
  }
  
  private async executeSafeCommand(
    command: string,
    context: SecurityContext
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // CREATE: Secure execution environment
      const execution = new SecureCommandExecution({
        command,
        timeout: 30000,
        userId: context.userId,
        sessionId: context.sessionId,
        workingDirectory: await this.getSecureWorkingDirectory(context),
        environment: this.getSecureEnvironment()
      });
      
      // EXECUTE: Command with monitoring
      const result = await execution.run();
      
      const duration = Date.now() - startTime;
      
      // AUDIT: Successful execution
      this.auditCommandEvent('COMMAND_EXECUTED', {
        command,
        userId: context.userId,
        duration,
        outputSize: result.output.length,
        exitCode: result.exitCode,
        timestamp: Date.now()
      });
      
      return {
        success: result.exitCode === 0,
        output: this.sanitizeOutput(result.output),
        error: result.error ? this.sanitizeOutput(result.error) : null,
        exitCode: result.exitCode,
        duration,
        timestamp: Date.now()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.auditCommandEvent('COMMAND_EXECUTION_FAILED', {
        command,
        error: error.message,
        userId: context.userId,
        duration,
        timestamp: Date.now()
      });
      
      throw new CommandSecurityError(
        'Command execution failed',
        'EXECUTION_FAILED',
        error.message
      );
    }
  }
  
  private sanitizePath(path: string): string {
    // REMOVE: Dangerous path elements
    return path
      .replace(/\.\./g, '')        // Remove directory traversal
      .replace(/[;&|`$()]/g, '')   // Remove shell metacharacters
      .replace(/\\/g, '/')         // Normalize path separators
      .replace(/\/+/g, '/')        // Remove duplicate slashes
      .slice(0, 256);              // Limit length
  }
  
  private sanitizePattern(pattern: string): string {
    // ESCAPE: Regex special characters for grep
    return pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .slice(0, 128);
  }
  
  private sanitizeOutput(output: string): string {
    // REMOVE: Potentially sensitive information from output
    return output
      .replace(/password[:\s]*[^\s\n]*/gi, 'password: [REDACTED]')
      .replace(/secret[:\s]*[^\s\n]*/gi, 'secret: [REDACTED]')
      .replace(/token[:\s]*[^\s\n]*/gi, 'token: [REDACTED]')
      .replace(/key[:\s]*[^\s\n]*/gi, 'key: [REDACTED]')
      .slice(0, 65536); // Limit output size
  }
}
```

### 2. SECURE COMMAND EXECUTION ENVIRONMENT

```typescript
// SECURE: Isolated command execution
class SecureCommandExecution {
  private readonly command: string;
  private readonly timeout: number;
  private readonly workingDirectory: string;
  private readonly environment: Record<string, string>;
  private readonly userId: string;
  
  constructor(config: SecureExecutionConfig) {
    this.command = config.command;
    this.timeout = config.timeout;
    this.workingDirectory = config.workingDirectory;
    this.environment = config.environment;
    this.userId = config.userId;
  }
  
  async run(): Promise<ExecutionResult> {
    // CREATE: Secure process options
    const options: SpawnOptions = {
      cwd: this.workingDirectory,
      env: this.environment,
      timeout: this.timeout,
      maxBuffer: 1024 * 1024, // 1MB max output
      stdio: ['ignore', 'pipe', 'pipe'], // No stdin, capture stdout/stderr
      shell: false, // CRITICAL: Never use shell
      windowsHide: true
    };
    
    // PARSE: Command and arguments safely
    const [cmd, ...args] = this.parseCommandSafely(this.command);
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      // SPAWN: Process without shell
      const child = spawn(cmd, args, options);
      
      // MONITOR: Process execution
      const monitor = new ProcessMonitor(child, this.userId);
      monitor.start();
      
      // CAPTURE: Output streams
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        // LIMIT: Output size
        if (stdout.length > 1024 * 1024) {
          child.kill('SIGTERM');
          reject(new Error('Output size limit exceeded'));
        }
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 1024 * 1024) {
          child.kill('SIGTERM');
          reject(new Error('Error output size limit exceeded'));
        }
      });
      
      // HANDLE: Process completion
      child.on('close', (code, signal) => {
        monitor.stop();
        
        const duration = Date.now() - startTime;
        
        resolve({
          output: stdout,
          error: stderr,
          exitCode: code || 0,
          signal,
          duration
        });
      });
      
      // HANDLE: Process errors
      child.on('error', (error) => {
        monitor.stop();
        reject(new CommandExecutionError('Process failed to start', error.message));
      });
      
      // TIMEOUT: Kill process if too long
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
          
          reject(new CommandExecutionError('Command timeout', 'TIMEOUT'));
        }
      }, this.timeout);
    });
  }
  
  private parseCommandSafely(command: string): string[] {
    // PARSE: Command without shell interpretation
    const parts = command.split(/\s+/).filter(part => part.length > 0);
    
    // VALIDATE: No shell metacharacters in any part
    for (const part of parts) {
      if (/[;&|`$(){}[\]\\]/.test(part)) {
        throw new CommandSecurityError(
          'Shell metacharacters detected',
          'SHELL_INJECTION'
        );
      }
    }
    
    return parts;
  }
}
```

### 3. TMUX INTEGRATION SECURITY

```typescript
// SECURE: Safe tmux command integration
class SecureTmuxController {
  private readonly allowedTmuxCommands = new Set([
    'list-sessions',
    'list-windows', 
    'list-panes',
    'capture-pane',
    'show-session',
    'display-message'
  ]);
  
  async executeTmuxCommand(
    subcommand: string,
    args: string[],
    context: SecurityContext
  ): Promise<TmuxResult> {
    // VALIDATE: Tmux subcommand
    if (!this.allowedTmuxCommands.has(subcommand)) {
      throw new CommandSecurityError(
        `Tmux subcommand '${subcommand}' not allowed`,
        'FORBIDDEN_TMUX_COMMAND'
      );
    }
    
    // VALIDATE: Arguments
    const validatedArgs = this.validateTmuxArgs(subcommand, args);
    
    // BUILD: Safe tmux command
    const command = ['tmux', subcommand, ...validatedArgs].join(' ');
    
    // EXECUTE: Through command safety engine
    const safetyEngine = new CommandSafetyEngine();
    return await safetyEngine.validateAndExecuteCommand(command, context);
  }
  
  private validateTmuxArgs(subcommand: string, args: string[]): string[] {
    const validatedArgs: string[] = [];
    
    switch (subcommand) {
      case 'capture-pane':
        // ONLY allow safe capture-pane options
        for (const arg of args) {
          if (arg.match(/^-[pSe]$/)) {
            validatedArgs.push(arg);
          } else if (arg.match(/^-t$/)) {
            validatedArgs.push(arg);
            // Next arg should be session/window identifier
          } else if (arg.match(/^[a-zA-Z0-9\-_.:]+$/)) {
            validatedArgs.push(arg);
          }
        }
        break;
        
      case 'list-sessions':
      case 'list-windows':
      case 'list-panes':
        // These commands take minimal safe arguments
        for (const arg of args) {
          if (arg.match(/^-[Ff]$/)) {
            validatedArgs.push(arg);
          }
        }
        break;
        
      default:
        // No arguments for other commands
        break;
    }
    
    return validatedArgs;
  }
  
  // SECURE: Send keys to tmux with strict validation
  async sendKeysToSession(
    sessionId: string,
    keys: string,
    context: SecurityContext
  ): Promise<void> {
    // VALIDATE: Session identifier
    if (!sessionId.match(/^[a-zA-Z0-9\-_]{1,32}$/)) {
      throw new CommandSecurityError('Invalid session ID', 'INVALID_SESSION');
    }
    
    // VALIDATE: Keys to send
    const validatedKeys = this.validateKeysToSend(keys);
    
    // CHECK: User has access to session
    const hasAccess = await this.checkSessionAccess(sessionId, context.userId);
    if (!hasAccess) {
      throw new CommandSecurityError('No access to session', 'ACCESS_DENIED');
    }
    
    // EXECUTE: Safe send-keys command
    const command = `tmux send-keys -t ${sessionId} "${validatedKeys}"`;
    const safetyEngine = new CommandSafetyEngine();
    await safetyEngine.validateAndExecuteCommand(command, context);
  }
  
  private validateKeysToSend(keys: string): string {
    // RESTRICT: Only allow safe key sequences
    const safeKeyPattern = /^[a-zA-Z0-9\s\.\-_\/]*$/;
    
    if (!safeKeyPattern.test(keys)) {
      throw new CommandSecurityError(
        'Invalid characters in key sequence',
        'INVALID_KEYS'
      );
    }
    
    // LIMIT: Key sequence length
    if (keys.length > 128) {
      throw new CommandSecurityError(
        'Key sequence too long',
        'KEYS_TOO_LONG'
      );
    }
    
    // ESCAPE: Special characters
    return keys
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }
}
```

## COMMAND SAFETY CONFIGURATION

### Command Safety Rules

```yaml
# command-safety-rules.yaml
command_safety:
  enforcement_mode: "strict" # strict, permissive, learning
  
  safe_commands:
    - command: "ls"
      category: "filesystem"
      max_execution_time: 5000
      parameters:
        - name: "flags"
          pattern: "^-[alhtSr]*$"
          required: false
        - name: "path"
          pattern: "^[a-zA-Z0-9/._-]*$"
          required: false
          max_length: 256
          
    - command: "pwd"
      category: "filesystem"
      max_execution_time: 1000
      parameters: []
      
    - command: "cat"
      category: "filesystem"
      max_execution_time: 10000
      requires_confirmation: true
      parameters:
        - name: "file"
          pattern: "^[a-zA-Z0-9/._-]+$"
          required: true
          max_length: 256
      conditions:
        - file_size_limit: 1048576 # 1MB
        - allowed_extensions: [".txt", ".log", ".md", ".json", ".yaml"]
        
  forbidden_commands:
    - "rm"
    - "rmdir" 
    - "sudo"
    - "su"
    - "chmod"
    - "kill"
    - "exec"
    - "eval"
    - "python"
    - "node"
    - "curl"
    - "wget"
    
  dangerous_patterns:
    - pattern: "[;&|`$(){}[\\]\\\\]"
      description: "Shell metacharacters"
      severity: "critical"
    - pattern: "\\$\\([^)]*\\)"
      description: "Command substitution"
      severity: "critical"
    - pattern: "`[^`]*`"
      description: "Backtick substitution"
      severity: "critical"
    - pattern: "\\|\\s*(bash|sh|python|node)"
      description: "Pipe to interpreter"
      severity: "critical"
      
  execution_limits:
    max_command_length: 256
    max_output_size: 1048576 # 1MB
    max_execution_time: 30000 # 30 seconds
    max_concurrent_commands: 3
    
  monitoring:
    log_all_commands: true
    log_blocked_commands: true
    alert_on_forbidden: true
    audit_retention_days: 90
```

### Tmux Safety Configuration

```yaml
# tmux-safety-config.yaml
tmux_security:
  allowed_subcommands:
    - "list-sessions"
    - "list-windows"
    - "list-panes"
    - "capture-pane"
    - "show-session"
    - "display-message"
    
  send_keys_safety:
    max_key_length: 128
    allowed_key_pattern: "^[a-zA-Z0-9\\s\\._/-]*$"
    forbidden_sequences:
      - "sudo"
      - "rm -rf"
      - "exec"
      - "eval"
      - "&& "
      - "; "
      - "| "
      
  session_access:
    require_session_ownership: true
    max_sessions_per_user: 10
    session_timeout: 3600000 # 1 hour
    
  capture_pane_limits:
    max_capture_size: 65536 # 64KB
    allowed_flags: ["-p", "-S", "-e"]
    require_target_validation: true
```

---

**IMPLEMENTATION STATUS**: Command Safety Engine - Emergency Deployment Ready
**SECURITY PRIORITY**: CRITICAL - Replace all command execution immediately  
**NEXT ACTIONS**: Deploy allowlist engine, implement secure execution environment

🚨 **COMMAND LOCKDOWN**: All command execution now restricted to safe allowlist only
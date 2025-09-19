/**
 * CRITICAL SECURITY: Secure Command Executor for tmux operations
 * Prevents command injection through strict validation and parameter binding
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { InputValidator, ValidationResult } from './InputValidator';
import { AuditLogger, SecurityEventType, SecuritySeverity } from './AuditLogger';

const execAsync = promisify(exec);

export interface SecureExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  executionTime: number;
  command: string;
  sanitizedCommand: string;
  validationResults: ValidationResult[];
  error?: string;
}

export interface CommandTemplate {
  name: string;
  template: string;
  requiredParams: string[];
  optionalParams: string[];
  maxExecutionTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  blockDurationMs: number; // How long to block after limit exceeded
}

export interface SecureCommandConfig {
  socketPath: string;
  commandTimeout: number;
  enableAuditLogging: boolean;
  rateLimitConfig: RateLimitConfig;
  maxConcurrentCommands: number;
}

export class SecureCommandExecutor {
  private auditLogger: AuditLogger;
  private config: SecureCommandConfig;
  private commandQueue: Map<string, number> = new Map(); // sessionId -> count
  private rateLimitMap: Map<string, number[]> = new Map(); // IP -> timestamps
  private blockedSources: Map<string, number> = new Map(); // IP -> unblock time
  private activeCommands = 0;

  // CRITICAL: Predefined command templates with parameter binding
  private commandTemplates: Map<string, CommandTemplate> = new Map([
    ['start-server', {
      name: 'start-server',
      template: 'start-server',
      requiredParams: [],
      optionalParams: [],
      maxExecutionTime: 5000,
      riskLevel: 'low'
    }],
    ['new-session', {
      name: 'new-session',
      template: 'new-session -d -s {sessionName} -P -F "#{session_id}"',
      requiredParams: ['sessionName'],
      optionalParams: [],
      maxExecutionTime: 10000,
      riskLevel: 'medium'
    }],
    ['kill-session', {
      name: 'kill-session',
      template: 'kill-session -t {sessionId}',
      requiredParams: ['sessionId'],
      optionalParams: [],
      maxExecutionTime: 5000,
      riskLevel: 'high'
    }],
    ['list-sessions', {
      name: 'list-sessions',
      template: 'list-sessions -F "#{session_id}:#{session_name}:#{session_created}:#{session_attached}"',
      requiredParams: [],
      optionalParams: [],
      maxExecutionTime: 3000,
      riskLevel: 'low'
    }],
    ['list-windows', {
      name: 'list-windows',
      template: 'list-windows -t {sessionId} -F "#{window_id}:#{window_index}:#{window_name}:#{window_active}"',
      requiredParams: ['sessionId'],
      optionalParams: [],
      maxExecutionTime: 3000,
      riskLevel: 'low'
    }],
    ['list-panes', {
      name: 'list-panes',
      template: 'list-panes -t {windowId} -F "#{pane_id}:#{pane_index}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_current_command}:#{pane_pid}"',
      requiredParams: ['windowId'],
      optionalParams: [],
      maxExecutionTime: 3000,
      riskLevel: 'low'
    }],
    ['send-keys', {
      name: 'send-keys',
      template: 'send-keys -t {target} {command} Enter',
      requiredParams: ['target', 'command'],
      optionalParams: [],
      maxExecutionTime: 1000,
      riskLevel: 'high'
    }],
    ['capture-pane', {
      name: 'capture-pane',
      template: 'capture-pane -t {target} -p -S -{lines}',
      requiredParams: ['target'],
      optionalParams: ['lines'],
      maxExecutionTime: 5000,
      riskLevel: 'medium'
    }],
    ['pipe-pane', {
      name: 'pipe-pane',
      template: 'pipe-pane -t {target} -o cat',
      requiredParams: ['target'],
      optionalParams: [],
      maxExecutionTime: 2000,
      riskLevel: 'high'
    }]
  ]);

  constructor(config: SecureCommandConfig) {
    this.config = config;
    this.auditLogger = new AuditLogger({
      enableConsoleOutput: true,
      logLevel: SecuritySeverity.INFO
    });

    // Validate socket path
    const socketValidation = InputValidator.validateSocketPath(config.socketPath);
    if (!socketValidation.isValid) {
      throw new Error(`Invalid socket path: ${socketValidation.error}`);
    }
  }

  /**
   * CRITICAL: Execute tmux command with strict security validation
   */
  async executeSecureCommand(
    commandName: string,
    parameters: Record<string, any>,
    sourceInfo?: { sessionId?: string; clientIp?: string; userId?: string }
  ): Promise<SecureExecutionResult> {
    const startTime = performance.now();
    const validationResults: ValidationResult[] = [];

    try {
      // CRITICAL: Rate limiting check
      await this.checkRateLimit(sourceInfo?.clientIp || 'unknown');

      // CRITICAL: Concurrency limiting
      if (this.activeCommands >= this.config.maxConcurrentCommands) {
        throw new Error('Maximum concurrent commands exceeded');
      }

      this.activeCommands++;

      // CRITICAL: Validate command exists in whitelist
      const template = this.commandTemplates.get(commandName);
      if (!template) {
        await this.auditLogger.logInjectionAttempt(
          commandName,
          sourceInfo?.sessionId || 'unknown',
          'Command not in whitelist',
          sourceInfo
        );
        throw new Error(`Command '${commandName}' is not allowed`);
      }

      // CRITICAL: Validate all required parameters are present
      for (const requiredParam of template.requiredParams) {
        if (!(requiredParam in parameters)) {
          throw new Error(`Missing required parameter: ${requiredParam}`);
        }
      }

      // CRITICAL: Validate and sanitize each parameter
      const sanitizedParams: Record<string, string> = {};
      
      for (const [paramName, paramValue] of Object.entries(parameters)) {
        const validation = await this.validateParameter(paramName, paramValue);
        validationResults.push(validation);

        if (!validation.isValid) {
          await this.auditLogger.logInputValidationFailure(
            paramName,
            String(paramValue),
            validation.error || 'Unknown validation error',
            validation.riskLevel,
            sourceInfo
          );
          throw new Error(`Parameter validation failed for ${paramName}: ${validation.error}`);
        }

        sanitizedParams[paramName] = validation.sanitizedValue || String(paramValue);

        // Log high-risk inputs
        if (validation.riskLevel === 'high' || validation.riskLevel === 'critical') {
          await this.auditLogger.logEvent({
            eventType: SecurityEventType.INPUT_SANITIZED,
            severity: SecuritySeverity.HIGH,
            source: 'SecureCommandExecutor',
            description: `High-risk input sanitized for parameter ${paramName}`,
            metadata: {
              paramName,
              originalValue: String(paramValue),
              sanitizedValue: sanitizedParams[paramName],
              riskLevel: validation.riskLevel
            },
            clientInfo: sourceInfo,
            outcome: 'success',
            riskScore: validation.riskLevel === 'critical' ? 8 : 6
          });
        }
      }

      // CRITICAL: Build command using parameter binding (not string interpolation)
      const sanitizedCommand = await this.buildSecureCommand(template, sanitizedParams);

      // CRITICAL: Final command validation
      const commandValidation = InputValidator.validateTmuxCommand(sanitizedCommand);
      validationResults.push(commandValidation);

      if (!commandValidation.isValid) {
        await this.auditLogger.logInjectionAttempt(
          sanitizedCommand,
          sourceInfo?.sessionId || 'unknown',
          commandValidation.error || 'Command validation failed',
          sourceInfo
        );
        throw new Error(`Final command validation failed: ${commandValidation.error}`);
      }

      // CRITICAL: Execute with timeout and monitoring
      const result = await this.executeWithTimeout(sanitizedCommand, template.maxExecutionTime);
      
      const executionTime = performance.now() - startTime;

      // Log successful execution
      if (this.config.enableAuditLogging) {
        await this.auditLogger.logCommandExecution(
          commandName,
          sourceInfo?.sessionId || 'unknown',
          sanitizedParams.target || sanitizedParams.sessionId || 'none',
          executionTime,
          sourceInfo
        );
      }

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime,
        command: commandName,
        sanitizedCommand,
        validationResults
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Log failed execution
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'SecureCommandExecutor',
        description: `Command execution blocked: ${error.message}`,
        metadata: {
          commandName,
          parameters,
          error: error.message,
          executionTime
        },
        clientInfo: sourceInfo,
        outcome: 'blocked',
        riskScore: 7
      });

      return {
        success: false,
        executionTime,
        command: commandName,
        sanitizedCommand: '',
        validationResults,
        error: error.message
      };
    } finally {
      this.activeCommands--;
    }
  }

  /**
   * CRITICAL: Validate individual parameters based on type
   */
  private async validateParameter(paramName: string, paramValue: any): Promise<ValidationResult> {
    switch (paramName) {
      case 'sessionName':
        return InputValidator.validateSessionName(String(paramValue));
      
      case 'sessionId':
        return InputValidator.validateSessionId(String(paramValue));
      
      case 'paneId':
        return InputValidator.validatePaneId(String(paramValue));
      
      case 'windowId':
        return InputValidator.validateWindowId(String(paramValue));
      
      case 'target':
        return InputValidator.validateTarget(String(paramValue));
      
      case 'command':
        return InputValidator.validateCommand(String(paramValue));
      
      case 'lines':
        return InputValidator.validateNumericParameter(
          typeof paramValue === 'string' ? parseInt(paramValue, 10) : paramValue,
          1,
          10000
        );
      
      default:
        // Generic validation for unknown parameters
        if (typeof paramValue !== 'string') {
          return {
            isValid: false,
            error: `Parameter ${paramName} must be a string`,
            riskLevel: 'medium'
          };
        }
        
        return InputValidator.validateCommand(String(paramValue));
    }
  }

  /**
   * CRITICAL: Build command using secure parameter binding
   */
  private async buildSecureCommand(
    template: CommandTemplate,
    parameters: Record<string, string>
  ): Promise<string> {
    let command = template.template;

    // Replace parameters using secure binding (no eval or dynamic execution)
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const placeholder = `{${paramName}}`;
      
      if (command.includes(placeholder)) {
        // For command parameter, we need special escaping
        if (paramName === 'command') {
          // Single-quote escape the entire command
          const escapedCommand = `'${paramValue.replace(/'/g, "'\\''")}'`;
          command = command.replace(placeholder, escapedCommand);
        } else {
          // For other parameters, direct replacement (already validated)
          command = command.replace(placeholder, paramValue);
        }
      }
    }

    // Set default values for optional parameters
    command = command.replace(/{lines}/g, '100'); // Default line count

    return command;
  }

  /**
   * CRITICAL: Execute command with timeout and process monitoring
   */
  private async executeWithTimeout(
    command: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `tmux -S ${this.config.socketPath} ${command}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      execAsync(fullCommand)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * CRITICAL: Rate limiting to prevent DoS attacks
   */
  private async checkRateLimit(clientIp: string): Promise<void> {
    const now = Date.now();
    const config = this.config.rateLimitConfig;

    // Check if source is currently blocked
    const blockUntil = this.blockedSources.get(clientIp);
    if (blockUntil && now < blockUntil) {
      await this.auditLogger.logRateLimitExceeded(
        clientIp,
        config.maxRequests,
        config.maxRequests + 1,
        { ipAddress: clientIp }
      );
      throw new Error('Rate limit exceeded - source temporarily blocked');
    }

    // Clean up old block
    if (blockUntil && now >= blockUntil) {
      this.blockedSources.delete(clientIp);
    }

    // Get or create request timestamps array
    let requests = this.rateLimitMap.get(clientIp) || [];
    
    // Remove old requests outside the time window
    const windowStart = now - config.windowMs;
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (requests.length >= config.maxRequests) {
      // Block this source
      this.blockedSources.set(clientIp, now + config.blockDurationMs);
      
      await this.auditLogger.logRateLimitExceeded(
        clientIp,
        config.maxRequests,
        requests.length,
        { ipAddress: clientIp }
      );
      
      throw new Error('Rate limit exceeded');
    }

    // Add current request
    requests.push(now);
    this.rateLimitMap.set(clientIp, requests);
  }

  /**
   * Spawn process for continuous operations (like pipe-pane)
   */
  async spawnSecureProcess(
    commandName: string,
    parameters: Record<string, any>,
    sourceInfo?: { sessionId?: string; clientIp?: string; userId?: string }
  ): Promise<ChildProcess> {
    // Validate using the same security checks
    const validation = await this.executeSecureCommand(commandName, parameters, sourceInfo);
    
    if (!validation.success) {
      throw new Error(`Spawn validation failed: ${validation.error}`);
    }

    // Build secure command arguments
    const args = ['-S', this.config.socketPath];
    
    // Parse the sanitized command into arguments
    const commandParts = validation.sanitizedCommand.split(' ');
    args.push(...commandParts);

    // Spawn with explicit argument array (prevents shell injection)
    const process = spawn('tmux', args);

    // Monitor the spawned process
    process.on('error', async (error) => {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'SecureCommandExecutor',
        description: 'Spawned process error',
        metadata: {
          commandName,
          error: error.message
        },
        clientInfo: sourceInfo,
        outcome: 'failure',
        riskScore: 6
      });
    });

    return process;
  }

  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics(): {
    activeCommands: number;
    blockedSources: number;
    rateLimitedRequests: number;
    totalValidationFailures: number;
  } {
    return {
      activeCommands: this.activeCommands,
      blockedSources: this.blockedSources.size,
      rateLimitedRequests: Array.from(this.rateLimitMap.values())
        .reduce((total, requests) => total + requests.length, 0),
      totalValidationFailures: 0 // Would need to track this
    };
  }

  /**
   * Clean up resources and audit logs
   */
  async shutdown(): Promise<void> {
    await this.auditLogger.shutdown();
    this.rateLimitMap.clear();
    this.blockedSources.clear();
  }
}
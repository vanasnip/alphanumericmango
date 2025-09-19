/**
 * CRITICAL SECURITY: Input Validator for tmux commands
 * Prevents command injection attacks through strict input validation
 */

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: string;
  error?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationRule {
  pattern: RegExp;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class InputValidator {
  // CRITICAL: Shell metacharacters that enable command injection
  private static readonly SHELL_METACHARACTERS = /[;&|`$(){}[\]<>'"\\*?~]/;
  
  // CRITICAL: Control characters that can manipulate terminal
  private static readonly CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/;
  
  // CRITICAL: Path traversal patterns
  private static readonly PATH_TRAVERSAL = /\.\./;
  
  // CRITICAL: Null byte injection (command termination)
  private static readonly NULL_BYTES = /\x00/;

  // Whitelist patterns for valid tmux identifiers
  private static readonly SESSION_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
  private static readonly SESSION_ID_PATTERN = /^\$[0-9]+$/;
  private static readonly PANE_ID_PATTERN = /^%[0-9]+$/;
  private static readonly WINDOW_ID_PATTERN = /^@[0-9]+$/;
  private static readonly SOCKET_PATH_PATTERN = /^\/[a-zA-Z0-9_\/.-]{1,256}$/;

  // Command whitelist - only these commands are allowed
  private static readonly ALLOWED_COMMANDS = new Set([
    'start-server',
    'new-session',
    'kill-session',
    'list-sessions',
    'list-windows', 
    'list-panes',
    'send-keys',
    'capture-pane',
    'pipe-pane'
  ]);

  /**
   * CRITICAL: Validates session names against strict whitelist
   */
  static validateSessionName(name: string): ValidationResult {
    if (!name || typeof name !== 'string') {
      return {
        isValid: false,
        error: 'Session name must be a non-empty string',
        riskLevel: 'high'
      };
    }

    if (name.length === 0 || name.length > 64) {
      return {
        isValid: false,
        error: 'Session name must be 1-64 characters',
        riskLevel: 'medium'
      };
    }

    // CRITICAL: Check for shell metacharacters
    if (InputValidator.SHELL_METACHARACTERS.test(name)) {
      return {
        isValid: false,
        error: 'Session name contains dangerous shell metacharacters',
        riskLevel: 'critical'
      };
    }

    // CRITICAL: Check for control characters
    if (InputValidator.CONTROL_CHARACTERS.test(name)) {
      return {
        isValid: false,
        error: 'Session name contains control characters',
        riskLevel: 'critical'
      };
    }

    // CRITICAL: Check for null bytes
    if (InputValidator.NULL_BYTES.test(name)) {
      return {
        isValid: false,
        error: 'Session name contains null bytes',
        riskLevel: 'critical'
      };
    }

    if (!InputValidator.SESSION_NAME_PATTERN.test(name)) {
      return {
        isValid: false,
        error: 'Session name must contain only alphanumeric characters, underscores, and hyphens',
        riskLevel: 'high'
      };
    }

    return {
      isValid: true,
      sanitizedValue: name,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates session IDs - must match tmux format exactly
   */
  static validateSessionId(id: string): ValidationResult {
    if (!id || typeof id !== 'string') {
      return {
        isValid: false,
        error: 'Session ID must be a non-empty string',
        riskLevel: 'high'
      };
    }

    // CRITICAL: Check for injection attempts (excluding valid $ prefix)
    // Remove the leading $ for session IDs and check the rest
    const idWithoutPrefix = id.startsWith('$') ? id.substring(1) : id;
    const dangerousPattern = /[;&|`(){}[\]<>'"\\*?~]/; // Shell metacharacters except $
    if (dangerousPattern.test(idWithoutPrefix)) {
      return {
        isValid: false,
        error: 'Session ID contains dangerous shell metacharacters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.CONTROL_CHARACTERS.test(id)) {
      return {
        isValid: false,
        error: 'Session ID contains control characters', 
        riskLevel: 'critical'
      };
    }

    if (InputValidator.NULL_BYTES.test(id)) {
      return {
        isValid: false,
        error: 'Session ID contains null bytes',
        riskLevel: 'critical'
      };
    }

    if (!InputValidator.SESSION_ID_PATTERN.test(id)) {
      return {
        isValid: false,
        error: 'Session ID must match tmux format: $[0-9]+',
        riskLevel: 'high'
      };
    }

    return {
      isValid: true,
      sanitizedValue: id,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates pane IDs - must match tmux format exactly
   */
  static validatePaneId(id: string): ValidationResult {
    if (!id || typeof id !== 'string') {
      return {
        isValid: false,
        error: 'Pane ID must be a non-empty string',
        riskLevel: 'high'
      };
    }

    // CRITICAL: Check for injection attempts (excluding valid % prefix)
    // Remove the leading % for pane IDs and check the rest
    const idWithoutPrefix = id.startsWith('%') ? id.substring(1) : id;
    const dangerousPattern = /[;&|`$(){}[\]<>'"\\*?~]/; // Shell metacharacters except %
    if (dangerousPattern.test(idWithoutPrefix)) {
      return {
        isValid: false,
        error: 'Pane ID contains dangerous shell metacharacters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.CONTROL_CHARACTERS.test(id)) {
      return {
        isValid: false,
        error: 'Pane ID contains control characters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.NULL_BYTES.test(id)) {
      return {
        isValid: false,
        error: 'Pane ID contains null bytes',
        riskLevel: 'critical'
      };
    }

    if (!InputValidator.PANE_ID_PATTERN.test(id)) {
      return {
        isValid: false,
        error: 'Pane ID must match tmux format: %[0-9]+',
        riskLevel: 'high'
      };
    }

    return {
      isValid: true,
      sanitizedValue: id,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates window IDs - must match tmux format exactly
   */
  static validateWindowId(id: string): ValidationResult {
    if (!id || typeof id !== 'string') {
      return {
        isValid: false,
        error: 'Window ID must be a non-empty string',
        riskLevel: 'high'
      };
    }

    // CRITICAL: Check for injection attempts (excluding valid @ prefix)
    // Remove the leading @ for window IDs and check the rest
    const idWithoutPrefix = id.startsWith('@') ? id.substring(1) : id;
    const dangerousPattern = /[;&|`$(){}[\]<>'"\\*?~]/; // Shell metacharacters except @
    if (dangerousPattern.test(idWithoutPrefix)) {
      return {
        isValid: false,
        error: 'Window ID contains dangerous shell metacharacters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.CONTROL_CHARACTERS.test(id)) {
      return {
        isValid: false,
        error: 'Window ID contains control characters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.NULL_BYTES.test(id)) {
      return {
        isValid: false,
        error: 'Window ID contains null bytes',
        riskLevel: 'critical'
      };
    }

    if (!InputValidator.WINDOW_ID_PATTERN.test(id)) {
      return {
        isValid: false,
        error: 'Window ID must match tmux format: @[0-9]+',
        riskLevel: 'high'
      };
    }

    return {
      isValid: true,
      sanitizedValue: id,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates socket paths for path traversal and injection
   */
  static validateSocketPath(path: string): ValidationResult {
    if (!path || typeof path !== 'string') {
      return {
        isValid: false,
        error: 'Socket path must be a non-empty string',
        riskLevel: 'high'
      };
    }

    // CRITICAL: Check for path traversal
    if (InputValidator.PATH_TRAVERSAL.test(path)) {
      return {
        isValid: false,
        error: 'Socket path contains path traversal sequences',
        riskLevel: 'critical'
      };
    }

    // CRITICAL: Check for shell metacharacters
    if (InputValidator.SHELL_METACHARACTERS.test(path)) {
      return {
        isValid: false,
        error: 'Socket path contains dangerous shell metacharacters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.CONTROL_CHARACTERS.test(path)) {
      return {
        isValid: false,
        error: 'Socket path contains control characters',
        riskLevel: 'critical'
      };
    }

    if (InputValidator.NULL_BYTES.test(path)) {
      return {
        isValid: false,
        error: 'Socket path contains null bytes',
        riskLevel: 'critical'
      };
    }

    if (!InputValidator.SOCKET_PATH_PATTERN.test(path)) {
      return {
        isValid: false,
        error: 'Socket path must be a valid absolute path',
        riskLevel: 'high'
      };
    }

    return {
      isValid: true,
      sanitizedValue: path,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates commands for shell injection
   * This is the most critical validation - prevents arbitrary command execution
   */
  static validateCommand(command: string): ValidationResult {
    if (!command || typeof command !== 'string') {
      return {
        isValid: false,
        error: 'Command must be a non-empty string',
        riskLevel: 'high'
      };
    }

    if (command.length === 0) {
      return {
        isValid: false,
        error: 'Command cannot be empty',
        riskLevel: 'medium'
      };
    }

    if (command.length > 8192) {
      return {
        isValid: false,
        error: 'Command exceeds maximum length (8192 characters)',
        riskLevel: 'high'
      };
    }

    // CRITICAL: Check for null bytes (command termination)
    if (InputValidator.NULL_BYTES.test(command)) {
      return {
        isValid: false,
        error: 'Command contains null bytes',
        riskLevel: 'critical'
      };
    }

    // CRITICAL: Check for control characters that could manipulate terminal
    if (InputValidator.CONTROL_CHARACTERS.test(command)) {
      return {
        isValid: false,
        error: 'Command contains control characters',
        riskLevel: 'critical'
      };
    }

    // MEDIUM: Log potentially dangerous characters but allow them
    // (commands legitimately may need some shell features)
    const hasDangerousChars = InputValidator.SHELL_METACHARACTERS.test(command);
    const riskLevel = hasDangerousChars ? 'medium' : 'low';

    // Escape the command for safe shell execution
    const sanitizedValue = InputValidator.escapeShellCommand(command);

    return {
      isValid: true,
      sanitizedValue,
      riskLevel,
      ...(hasDangerousChars && { 
        error: 'Command contains shell metacharacters - will be escaped' 
      })
    };
  }

  /**
   * CRITICAL: Validates tmux command names against whitelist
   */
  static validateTmuxCommand(command: string): ValidationResult {
    if (!command || typeof command !== 'string') {
      return {
        isValid: false,
        error: 'Tmux command must be a non-empty string',
        riskLevel: 'high'
      };
    }

    const commandName = command.split(' ')[0];
    
    if (!InputValidator.ALLOWED_COMMANDS.has(commandName)) {
      return {
        isValid: false,
        error: `Tmux command '${commandName}' is not in the allowed whitelist`,
        riskLevel: 'critical'
      };
    }

    return {
      isValid: true,
      sanitizedValue: command,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Validates numeric parameters
   */
  static validateNumericParameter(value: any, min?: number, max?: number): ValidationResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        error: 'Parameter must be a valid number',
        riskLevel: 'medium'
      };
    }

    if (min !== undefined && value < min) {
      return {
        isValid: false,
        error: `Parameter must be >= ${min}`,
        riskLevel: 'medium'
      };
    }

    if (max !== undefined && value > max) {
      return {
        isValid: false,
        error: `Parameter must be <= ${max}`,
        riskLevel: 'medium'
      };
    }

    return {
      isValid: true,
      sanitizedValue: value,
      riskLevel: 'low'
    };
  }

  /**
   * CRITICAL: Escapes shell commands to prevent injection
   */
  private static escapeShellCommand(command: string): string {
    // Replace single quotes with '\'' (end quote, escaped quote, start quote)
    return `'${command.replace(/'/g, "'\\''")}'`;
  }

  /**
   * CRITICAL: Validates target parameter (session/pane/window ID)
   */
  static validateTarget(target: string): ValidationResult {
    if (!target || typeof target !== 'string') {
      return {
        isValid: false,
        error: 'Target must be a non-empty string',
        riskLevel: 'high'
      };
    }

    // Try to validate as different ID types
    if (target.startsWith('$')) {
      return this.validateSessionId(target);
    } else if (target.startsWith('%')) {
      return this.validatePaneId(target);
    } else if (target.startsWith('@')) {
      return this.validateWindowId(target);
    } else {
      // Assume it's a session name
      return this.validateSessionName(target);
    }
  }
}
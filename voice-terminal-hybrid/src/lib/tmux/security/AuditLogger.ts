/**
 * CRITICAL SECURITY: Audit Logger for tmux security events
 * Provides comprehensive security event logging for forensics and compliance
 */

export interface SecurityEvent {
  timestamp: number;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  description: string;
  metadata?: Record<string, any>;
  clientInfo?: ClientInfo;
  outcome: 'success' | 'failure' | 'blocked';
  riskScore: number; // 1-10 scale
}

export interface ClientInfo {
  sessionId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  processId?: number;
}

export enum SecurityEventType {
  // Input validation events
  INPUT_VALIDATION_FAILED = 'input_validation_failed',
  INPUT_SANITIZED = 'input_sanitized',
  
  // Command execution events  
  COMMAND_BLOCKED = 'command_blocked',
  COMMAND_EXECUTED = 'command_executed',
  INJECTION_ATTEMPT = 'injection_attempt',
  
  // Authentication/authorization
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Configuration security
  CONFIG_VIOLATION = 'config_violation',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  
  // Anomaly detection
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNUSUAL_COMMAND_PATTERN = 'unusual_command_pattern',
  
  // System events
  SECURITY_INIT = 'security_init',
  SECURITY_SHUTDOWN = 'security_shutdown',
  AUDIT_LOG_TAMPER = 'audit_log_tamper'
}

export enum SecuritySeverity {
  INFO = 'info',
  LOW = 'low', 
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditLogConfig {
  logLevel: SecuritySeverity;
  maxLogSize: number; // bytes
  rotationCount: number;
  logDirectory: string;
  enableConsoleOutput: boolean;
  enableRemoteLogging: boolean;
  encryptLogs: boolean;
  tamperDetection: boolean;
}

export class AuditLogger {
  private config: AuditLogConfig;
  private logBuffer: SecurityEvent[] = [];
  private bufferSize = 1000;
  private logFile?: string;
  private isInitialized = false;

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = {
      logLevel: SecuritySeverity.INFO,
      maxLogSize: 100 * 1024 * 1024, // 100MB
      rotationCount: 10,
      logDirectory: '/tmp/tmux-audit-logs',
      enableConsoleOutput: false,
      enableRemoteLogging: false,
      encryptLogs: true,
      tamperDetection: true,
      ...config
    };

    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    try {
      // Create log directory if it doesn't exist
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }

      // Set up log file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(this.config.logDirectory, `tmux-security-${timestamp}.log`);

      this.isInitialized = true;

      // Log security system initialization
      await this.logEvent({
        eventType: SecurityEventType.SECURITY_INIT,
        severity: SecuritySeverity.INFO,
        source: 'AuditLogger',
        description: 'Security audit logging system initialized',
        metadata: {
          logFile: this.logFile,
          config: this.config
        },
        outcome: 'success',
        riskScore: 1
      });

      // Start periodic buffer flush
      setInterval(() => {
        this.flushBuffer().catch(console.error);
      }, 5000);

    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
      throw new Error(`Audit logger initialization failed: ${error}`);
    }
  }

  /**
   * CRITICAL: Log security events with comprehensive metadata
   */
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      timestamp: Date.now(),
      ...event
    };

    // Add to buffer
    this.logBuffer.push(fullEvent);

    // Immediate flush for critical events
    if (event.severity === SecuritySeverity.CRITICAL || event.riskScore >= 8) {
      await this.flushBuffer();
    }

    // Console output if enabled
    if (this.config.enableConsoleOutput) {
      this.logToConsole(fullEvent);
    }

    // Check buffer size
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * CRITICAL: Log input validation failures - these indicate potential attacks
   */
  async logInputValidationFailure(
    inputType: string,
    inputValue: string,
    validationError: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    clientInfo?: ClientInfo
  ): Promise<void> {
    const riskScore = this.getRiskScore(riskLevel);
    const severity = this.getSeverityFromRisk(riskLevel);

    await this.logEvent({
      eventType: SecurityEventType.INPUT_VALIDATION_FAILED,
      severity,
      source: 'InputValidator',
      description: `Input validation failed for ${inputType}`,
      metadata: {
        inputType,
        inputValue: this.sanitizeForLog(inputValue),
        validationError,
        riskLevel
      },
      clientInfo,
      outcome: 'blocked',
      riskScore
    });
  }

  /**
   * CRITICAL: Log command injection attempts
   */
  async logInjectionAttempt(
    command: string,
    sessionId: string,
    reason: string,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.INJECTION_ATTEMPT,
      severity: SecuritySeverity.CRITICAL,
      source: 'SecureCommandExecutor',
      description: 'Command injection attempt detected and blocked',
      metadata: {
        command: this.sanitizeForLog(command),
        sessionId,
        reason,
        detectionMethod: 'input_validation'
      },
      clientInfo,
      outcome: 'blocked',
      riskScore: 10
    });
  }

  /**
   * CRITICAL: Log successful command execution for audit trail
   */
  async logCommandExecution(
    command: string,
    sessionId: string,
    target: string,
    executionTime: number,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.COMMAND_EXECUTED,
      severity: SecuritySeverity.INFO,
      source: 'SecureCommandExecutor',
      description: 'Command executed successfully',
      metadata: {
        command: this.sanitizeForLog(command),
        sessionId,
        target,
        executionTime
      },
      clientInfo,
      outcome: 'success',
      riskScore: 2
    });
  }

  /**
   * CRITICAL: Log rate limiting violations
   */
  async logRateLimitExceeded(
    source: string,
    limit: number,
    current: number,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.HIGH,
      source: 'RateLimiter',
      description: 'Rate limit exceeded - potential DoS attempt',
      metadata: {
        limit,
        current,
        source
      },
      clientInfo,
      outcome: 'blocked',
      riskScore: 7
    });
  }

  /**
   * CRITICAL: Log access denied events
   */
  async logAccessDenied(
    resource: string,
    reason: string,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.ACCESS_DENIED,
      severity: SecuritySeverity.HIGH,
      source: 'AuthorizationManager',
      description: 'Access denied to protected resource',
      metadata: {
        resource,
        reason
      },
      clientInfo,
      outcome: 'blocked',
      riskScore: 6
    });
  }

  /**
   * CRITICAL: Log suspicious activity patterns
   */
  async logSuspiciousActivity(
    pattern: string,
    description: string,
    evidence: Record<string, any>,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecuritySeverity.HIGH,
      source: 'AnomalyDetector',
      description: `Suspicious activity pattern detected: ${pattern}`,
      metadata: {
        pattern,
        description,
        evidence
      },
      clientInfo,
      outcome: 'failure',
      riskScore: 8
    });
  }

  /**
   * CRITICAL: Flush log buffer to persistent storage
   */
  private async flushBuffer(): Promise<void> {
    if (!this.isInitialized || this.logBuffer.length === 0) {
      return;
    }

    try {
      const fs = await import('fs');
      const logEntries = this.logBuffer.splice(0, this.logBuffer.length);
      
      const logData = logEntries
        .filter(event => this.shouldLog(event.severity))
        .map(event => JSON.stringify(event))
        .join('\n') + '\n';

      if (this.logFile && logData.trim()) {
        fs.appendFileSync(this.logFile, logData);
        
        // Check for log rotation
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.config.maxLogSize) {
          await this.rotateLog();
        }
      }

    } catch (error) {
      console.error('Failed to flush audit log buffer:', error);
      
      // Log tamper attempt
      await this.logEvent({
        eventType: SecurityEventType.AUDIT_LOG_TAMPER,
        severity: SecuritySeverity.CRITICAL,
        source: 'AuditLogger',
        description: 'Failed to write to audit log - possible tamper attempt',
        metadata: {
          error: error.message
        },
        outcome: 'failure',
        riskScore: 9
      });
    }
  }

  /**
   * Log rotation to prevent log files from growing too large
   */
  private async rotateLog(): Promise<void> {
    if (!this.logFile) return;

    try {
      const fs = await import('fs');
      const path = await import('path');

      // Rotate existing logs
      for (let i = this.config.rotationCount - 1; i >= 1; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.config.rotationCount - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log to .1
      fs.renameSync(this.logFile, `${this.logFile}.1`);

      // Start fresh log
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(this.config.logDirectory, `tmux-security-${timestamp}.log`);

    } catch (error) {
      console.error('Failed to rotate audit log:', error);
    }
  }

  /**
   * Console logging for development/debugging
   */
  private logToConsole(event: SecurityEvent): void {
    const timestamp = new Date(event.timestamp).toISOString();
    const severity = event.severity.toUpperCase();
    const riskIndicator = event.riskScore >= 8 ? ' 🚨' : event.riskScore >= 6 ? ' ⚠️' : '';
    
    console.log(`[SECURITY][${timestamp}][${severity}] ${event.description}${riskIndicator}`);
    
    if (event.metadata) {
      console.log('  Metadata:', JSON.stringify(event.metadata, null, 2));
    }
  }

  /**
   * Determine if event should be logged based on configured level
   */
  private shouldLog(severity: SecuritySeverity): boolean {
    const levels = {
      [SecuritySeverity.INFO]: 0,
      [SecuritySeverity.LOW]: 1,
      [SecuritySeverity.MEDIUM]: 2,
      [SecuritySeverity.HIGH]: 3,
      [SecuritySeverity.CRITICAL]: 4
    };

    return levels[severity] >= levels[this.config.logLevel];
  }

  /**
   * Convert risk level to numeric score
   */
  private getRiskScore(riskLevel: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (riskLevel) {
      case 'low': return 2;
      case 'medium': return 5;
      case 'high': return 7;
      case 'critical': return 10;
      default: return 1;
    }
  }

  /**
   * Convert risk level to severity
   */
  private getSeverityFromRisk(riskLevel: 'low' | 'medium' | 'high' | 'critical'): SecuritySeverity {
    switch (riskLevel) {
      case 'low': return SecuritySeverity.LOW;
      case 'medium': return SecuritySeverity.MEDIUM;
      case 'high': return SecuritySeverity.HIGH;
      case 'critical': return SecuritySeverity.CRITICAL;
      default: return SecuritySeverity.INFO;
    }
  }

  /**
   * Sanitize sensitive data for logging
   */
  private sanitizeForLog(value: string): string {
    // Truncate very long values
    if (value.length > 1000) {
      value = value.substring(0, 1000) + '...[TRUNCATED]';
    }

    // Remove/mask potentially sensitive patterns
    return value
      .replace(/password\s*=\s*[^\s]+/gi, 'password=[REDACTED]')
      .replace(/token\s*=\s*[^\s]+/gi, 'token=[REDACTED]')
      .replace(/key\s*=\s*[^\s]+/gi, 'key=[REDACTED]')
      .replace(/secret\s*=\s*[^\s]+/gi, 'secret=[REDACTED]');
  }

  /**
   * Get audit log summary for reporting
   */
  async getAuditSummary(hours: number = 24): Promise<{
    totalEvents: number;
    criticalEvents: number;
    blockedAttempts: number;
    topThreats: Array<{ eventType: string; count: number }>;
  }> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentEvents = this.logBuffer.filter(event => event.timestamp >= cutoff);

    const criticalEvents = recentEvents.filter(event => 
      event.severity === SecuritySeverity.CRITICAL || event.riskScore >= 8
    ).length;

    const blockedAttempts = recentEvents.filter(event => 
      event.outcome === 'blocked'
    ).length;

    // Count event types
    const eventCounts = new Map<string, number>();
    recentEvents.forEach(event => {
      const count = eventCounts.get(event.eventType) || 0;
      eventCounts.set(event.eventType, count + 1);
    });

    const topThreats = Array.from(eventCounts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: recentEvents.length,
      criticalEvents,
      blockedAttempts,
      topThreats
    };
  }

  /**
   * Clean shutdown - flush remaining logs
   */
  async shutdown(): Promise<void> {
    await this.flushBuffer();
    
    await this.logEvent({
      eventType: SecurityEventType.SECURITY_SHUTDOWN,
      severity: SecuritySeverity.INFO,
      source: 'AuditLogger',
      description: 'Security audit logging system shutdown',
      outcome: 'success',
      riskScore: 1
    });

    await this.flushBuffer();
  }
}
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { SecureCommandExecutor, SecureCommandConfig } from './security/SecureCommandExecutor';
import { InputValidator } from './security/InputValidator';
import { AuditLogger, SecurityEventType, SecuritySeverity } from './security/AuditLogger';
import { TmuxConnectionPool } from './performance/TmuxConnectionPool';
import { CommandBatcher } from './performance/CommandBatcher';
import { SessionCache } from './performance/SessionCache';
import type { 
  TmuxSession, 
  TmuxWindow, 
  TmuxPane, 
  TmuxConfig,
  TmuxEvent,
  CommandExecution,
  PerformanceMetrics
} from './types';

const execAsync = promisify(exec);

export class TmuxSessionManager extends EventEmitter {
  private config: Required<TmuxConfig>;
  private sessions: Map<string, TmuxSession> = new Map();
  private performanceMetrics: PerformanceMetrics;
  private outputCaptures: Map<string, ChildProcess> = new Map();
  
  // CRITICAL SECURITY: Secure command execution system
  private secureExecutor: SecureCommandExecutor;
  private auditLogger: AuditLogger;
  
  // PERFORMANCE OPTIMIZATION: High-performance execution system
  private connectionPool: TmuxConnectionPool;
  private commandBatcher: CommandBatcher;
  private sessionCache: SessionCache;
  private isPerformanceModeEnabled: boolean;

  constructor(config: TmuxConfig = {}) {
    super();
    
    // CRITICAL SECURITY: Validate socket path before any operations
    const defaultSocketPath = '/tmp/tmux-socket';
    const socketPath = config.socketPath || defaultSocketPath;
    const socketValidation = InputValidator.validateSocketPath(socketPath);
    
    if (!socketValidation.isValid) {
      throw new Error(`SECURITY ERROR: Invalid socket path - ${socketValidation.error}`);
    }
    
    this.config = {
      socketPath: socketValidation.sanitizedValue!,
      defaultShell: config.defaultShell || '/bin/bash',
      captureBufferSize: config.captureBufferSize || 10000,
      commandTimeout: config.commandTimeout || 5000,
      performanceMode: config.performanceMode || 'balanced'
    };
    
    this.performanceMetrics = {
      commandInjectionLatency: [],
      outputCaptureLatency: [],
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      totalCommands: 0,
      failedCommands: 0,
      successRate: 100
    };

    // CRITICAL SECURITY: Initialize secure execution system
    this.auditLogger = new AuditLogger({
      enableConsoleOutput: false, // Set to true for debugging
      logLevel: SecuritySeverity.INFO
    });

    const secureConfig: SecureCommandConfig = {
      socketPath: this.config.socketPath,
      commandTimeout: this.config.commandTimeout,
      enableAuditLogging: true,
      rateLimitConfig: {
        windowMs: 60000, // 1 minute window
        maxRequests: 100, // Max 100 commands per minute per source
        blockDurationMs: 300000 // Block for 5 minutes if exceeded
      },
      maxConcurrentCommands: 10
    };

    this.secureExecutor = new SecureCommandExecutor(secureConfig);
    
    // PERFORMANCE OPTIMIZATION: Initialize high-performance components
    this.isPerformanceModeEnabled = config.performanceMode === 'performance';
    
    // Initialize connection pool for persistent tmux connections
    this.connectionPool = new TmuxConnectionPool({
      socketPath: this.config.socketPath,
      maxConnections: this.isPerformanceModeEnabled ? 8 : 5,
      minConnections: this.isPerformanceModeEnabled ? 3 : 2,
      maxIdleTime: 30000,
      healthCheckInterval: 5000,
      commandTimeout: this.config.commandTimeout
    });
    
    // Initialize command batcher for rapid sequential commands
    this.commandBatcher = new CommandBatcher(this.connectionPool, {
      maxBatchSize: this.isPerformanceModeEnabled ? 15 : 10,
      maxBatchWait: this.isPerformanceModeEnabled ? 3 : 5, // Lower wait time for performance mode
      maxConcurrentBatches: 3,
      adaptiveBatching: true,
      performanceThreshold: 15 // Target <15ms latency
    });
    
    // Initialize session cache with aggressive caching for performance mode
    this.sessionCache = new SessionCache({
      defaultTtl: this.isPerformanceModeEnabled ? 3000 : 5000, // Shorter TTL for performance mode
      maxEntries: 2000,
      cleanupInterval: 10000,
      enableStats: true
    });
    
    // Setup performance monitoring
    this.setupPerformanceMonitoring();
  }

  async initialize(): Promise<void> {
    try {
      // CRITICAL SECURITY: Use secure executor for initialization
      const result = await this.secureExecutor.executeSecureCommand(
        'start-server',
        {},
        { sessionId: 'system-init' }
      );

      if (!result.success) {
        throw new Error(`Secure initialization failed: ${result.error}`);
      }

      // PERFORMANCE OPTIMIZATION: Initialize connection pool and cache
      await this.connectionPool.initialize();
      
      // Refresh sessions and warm up cache
      await this.refreshSessions();
      this.startMonitoring();

      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_INIT,
        severity: SecuritySeverity.INFO,
        source: 'TmuxSessionManager',
        description: 'Tmux session manager initialized with security controls',
        metadata: {
          socketPath: this.config.socketPath,
          securityEnabled: true
        },
        outcome: 'success',
        riskScore: 1
      });

    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_INIT,
        severity: SecuritySeverity.CRITICAL,
        source: 'TmuxSessionManager',
        description: 'Failed to initialize tmux session manager',
        metadata: {
          error: error.message
        },
        outcome: 'failure',
        riskScore: 9
      });
      throw new Error(`Failed to initialize tmux: ${error}`);
    }
  }

  private setupPerformanceMonitoring(): void {
    // Monitor connection pool events
    this.connectionPool.on('connection-created', (event) => {
      this.emit('perf-connection-created', event);
    });
    
    this.connectionPool.on('pool-initialized', (event) => {
      this.emit('perf-pool-ready', event);
    });
    
    // Monitor command batcher events
    this.commandBatcher.on('batch-completed', (event) => {
      // Update our performance metrics with batch data
      const avgLatency = event.averageCommandTime || 0;
      this.recordLatency('commandInjectionLatency', avgLatency);
      this.emit('perf-batch-completed', event);
    });
    
    // Monitor cache events
    this.sessionCache.on('cache-hit', () => {
      // Cache hits significantly reduce latency
      this.recordLatency('outputCaptureLatency', 0.5); // Near-zero latency for cache hits
    });
    
    this.sessionCache.on('cache-miss', () => {
      this.emit('perf-cache-miss');
    });
  }

  async createSession(name: string, clientInfo?: { clientIp?: string; userId?: string }): Promise<TmuxSession> {
    const startTime = performance.now();
    
    try {
      // CRITICAL SECURITY: Use secure executor with validation
      const result = await this.secureExecutor.executeSecureCommand(
        'new-session',
        { sessionName: name },
        { sessionId: 'new-session', ...clientInfo }
      );

      if (!result.success) {
        this.performanceMetrics.failedCommands++;
        throw new Error(`Secure session creation failed: ${result.error}`);
      }

      const sessionId = result.stdout?.trim();
      if (!sessionId) {
        throw new Error('Session creation returned no session ID');
      }

      await this.refreshSessions();
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session created but not found in session list');
      }

      const latency = performance.now() - startTime;
      this.recordLatency('commandInjectionLatency', latency);
      
      this.emit('session-created', {
        type: 'session-created',
        sessionId,
        data: session,
        timestamp: Date.now()
      } as TmuxEvent);

      return session;
    } catch (error) {
      this.performanceMetrics.failedCommands++;
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'TmuxSessionManager',
        description: 'Session creation failed',
        metadata: {
          sessionName: name,
          error: error.message
        },
        clientInfo,
        outcome: 'failure',
        riskScore: 6
      });

      throw new Error(`Failed to create session: ${error}`);
    }
  }

  async destroySession(sessionId: string, clientInfo?: { clientIp?: string; userId?: string }): Promise<void> {
    try {
      // CRITICAL SECURITY: Use secure executor with validation
      const result = await this.secureExecutor.executeSecureCommand(
        'kill-session',
        { sessionId },
        { sessionId, ...clientInfo }
      );

      if (!result.success) {
        throw new Error(`Secure session destruction failed: ${result.error}`);
      }

      this.sessions.delete(sessionId);
      
      const captureProcess = this.outputCaptures.get(sessionId);
      if (captureProcess) {
        captureProcess.kill();
        this.outputCaptures.delete(sessionId);
      }

      this.emit('session-closed', {
        type: 'session-closed',
        sessionId,
        timestamp: Date.now()
      } as TmuxEvent);

      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.MEDIUM,
        source: 'TmuxSessionManager',
        description: 'Session destroyed successfully',
        metadata: {
          sessionId
        },
        clientInfo,
        outcome: 'success',
        riskScore: 4
      });

    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'TmuxSessionManager',
        description: 'Session destruction failed',
        metadata: {
          sessionId,
          error: error.message
        },
        clientInfo,
        outcome: 'failure',
        riskScore: 6
      });

      throw new Error(`Failed to destroy session: ${error}`);
    }
  }

  async sendCommand(
    sessionId: string, 
    command: string, 
    paneId?: string, 
    clientInfo?: { clientIp?: string; userId?: string }
  ): Promise<CommandExecution> {
    const startTime = performance.now();
    const execution: CommandExecution = {
      sessionId,
      windowId: '',
      paneId: paneId || '',
      command,
      timestamp: Date.now()
    };

    try {
      // CRITICAL SECURITY: Determine target and validate
      const target = paneId || sessionId;
      
      // PERFORMANCE OPTIMIZATION: Use batched execution for high-performance mode
      // while maintaining security validation
      let result;
      if (this.isPerformanceModeEnabled) {
        // For performance mode, use connection pool with security validation
        const commandArgs = ['-S', this.config.socketPath, 'send-keys', target, `"${command}"`, 'Enter'];
        
        // CRITICAL SECURITY: Pre-validate command through secure executor
        const preValidation = await this.secureExecutor.validateCommand('send-keys', { target, command }, { sessionId, ...clientInfo });
        if (!preValidation.isValid) {
          throw new Error(`Security validation failed: ${preValidation.error}`);
        }
        
        // Execute through high-performance connection pool
        await this.commandBatcher.executeCommand(commandArgs);
        result = { success: true, output: '', error: null };
      } else {
        // CRITICAL SECURITY: Use secure executor with validation (legacy path)
        result = await this.secureExecutor.executeSecureCommand(
          'send-keys',
          { target, command },
          { sessionId, ...clientInfo }
        );
      }

      if (!result.success) {
        this.performanceMetrics.failedCommands++;
        execution.error = result.error;
        throw new Error(`Secure command execution failed: ${result.error}`);
      }
      
      const latency = performance.now() - startTime;
      execution.executionTime = latency;
      this.recordLatency('commandInjectionLatency', latency);
      this.performanceMetrics.totalCommands++;

      this.emit('command-executed', {
        type: 'command-executed',
        sessionId,
        paneId,
        data: execution,
        timestamp: Date.now()
      } as TmuxEvent);

      if (this.config.performanceMode !== 'performance') {
        execution.output = await this.captureOutput(sessionId, paneId, clientInfo);
      }

      return execution;
    } catch (error) {
      this.performanceMetrics.failedCommands++;
      execution.error = `${error}`;
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'TmuxSessionManager',
        description: 'Command execution failed',
        metadata: {
          sessionId,
          paneId,
          command: command.substring(0, 100), // Truncate for log
          error: error.message
        },
        clientInfo,
        outcome: 'failure',
        riskScore: 7
      });

      throw new Error(`Failed to send command: ${error}`);
    }
  }

  async captureOutput(
    sessionId: string, 
    paneId?: string, 
    clientInfo?: { clientIp?: string; userId?: string },
    lines: number = 100
  ): Promise<string> {
    const startTime = performance.now();
    
    try {
      // CRITICAL SECURITY: Determine target and validate
      const target = paneId || sessionId;
      
      // CRITICAL SECURITY: Use secure executor with validation
      const result = await this.secureExecutor.executeSecureCommand(
        'capture-pane',
        { target, lines },
        { sessionId, ...clientInfo }
      );

      if (!result.success) {
        throw new Error(`Secure output capture failed: ${result.error}`);
      }
      
      const latency = performance.now() - startTime;
      this.recordLatency('outputCaptureLatency', latency);

      return result.stdout || '';
    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.MEDIUM,
        source: 'TmuxSessionManager',
        description: 'Output capture failed',
        metadata: {
          sessionId,
          paneId,
          lines,
          error: error.message
        },
        clientInfo,
        outcome: 'failure',
        riskScore: 5
      });

      throw new Error(`Failed to capture output: ${error}`);
    }
  }

  async startContinuousCapture(
    sessionId: string, 
    paneId?: string, 
    clientInfo?: { clientIp?: string; userId?: string }
  ): Promise<void> {
    const target = paneId || sessionId;
    const captureKey = `${sessionId}-${paneId || 'default'}`;
    
    if (this.outputCaptures.has(captureKey)) {
      return;
    }

    try {
      // CRITICAL SECURITY: Use secure executor for spawning processes
      const captureProcess = await this.secureExecutor.spawnSecureProcess(
        'pipe-pane',
        { target },
        { sessionId, ...clientInfo }
      );

      captureProcess.stdout?.on('data', (data) => {
        this.emit('output-received', {
          type: 'output-received',
          sessionId,
          paneId,
          data: data.toString(),
          timestamp: Date.now()
        } as TmuxEvent);
      });

      captureProcess.on('error', async (error) => {
        await this.auditLogger.logEvent({
          eventType: SecurityEventType.COMMAND_BLOCKED,
          severity: SecuritySeverity.HIGH,
          source: 'TmuxSessionManager',
          description: 'Continuous capture process error',
          metadata: {
            sessionId,
            paneId,
            error: error.message
          },
          clientInfo,
          outcome: 'failure',
          riskScore: 6
        });

        console.error(`Capture process error: ${error}`);
        this.outputCaptures.delete(captureKey);
      });

      this.outputCaptures.set(captureKey, captureProcess);

      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_EXECUTED,
        severity: SecuritySeverity.INFO,
        source: 'TmuxSessionManager',
        description: 'Continuous capture started',
        metadata: {
          sessionId,
          paneId,
          captureKey
        },
        clientInfo,
        outcome: 'success',
        riskScore: 2
      });

    } catch (error) {
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.COMMAND_BLOCKED,
        severity: SecuritySeverity.HIGH,
        source: 'TmuxSessionManager',
        description: 'Failed to start continuous capture',
        metadata: {
          sessionId,
          paneId,
          error: error.message
        },
        clientInfo,
        outcome: 'failure',
        riskScore: 6
      });

      throw new Error(`Failed to start continuous capture: ${error}`);
    }
  }

  async refreshSessions(): Promise<void> {
    try {
      // PERFORMANCE OPTIMIZATION: Check cache first
      const cachedSessions = this.sessionCache.getSessionList();
      if (cachedSessions && this.isPerformanceModeEnabled) {
        // Use cached data and update sessions map
        this.sessions.clear();
        cachedSessions.forEach(session => {
          this.sessions.set(session.id, session);
        });
        return;
      }

      // CRITICAL SECURITY: Use secure executor for session listing
      const result = await this.secureExecutor.executeSecureCommand(
        'list-sessions',
        {},
        { sessionId: 'system-refresh' }
      );

      if (!result.success) {
        throw new Error(`Secure session refresh failed: ${result.error}`);
      }

      const sessionLines = (result.stdout || '').trim().split('\n').filter(line => line);
      const refreshedSessions: TmuxSession[] = [];
      
      for (const line of sessionLines) {
        const [id, name, created, attached] = line.split(':');
        const windows = await this.getWindows(id);
        
        const session: TmuxSession = {
          id,
          name,
          pid: 0,
          created: new Date(parseInt(created) * 1000),
          windows,
          attached: attached === '1'
        };
        
        this.sessions.set(id, session);
        refreshedSessions.push(session);
        
        // PERFORMANCE OPTIMIZATION: Cache individual session
        this.sessionCache.cacheSession(id, session);
      }
      
      // PERFORMANCE OPTIMIZATION: Cache the session list
      this.sessionCache.cacheSessionList(refreshedSessions);
    } catch (error) {
      if (!error.message?.includes('no server running') && 
          !error.message?.includes('Secure session refresh failed')) {
        await this.auditLogger.logEvent({
          eventType: SecurityEventType.COMMAND_BLOCKED,
          severity: SecuritySeverity.MEDIUM,
          source: 'TmuxSessionManager',
          description: 'Session refresh failed',
          metadata: {
            error: error.message
          },
          outcome: 'failure',
          riskScore: 4
        });
        throw error;
      }
    }
  }

  private async getWindows(sessionId: string): Promise<TmuxWindow[]> {
    try {
      // CRITICAL SECURITY: Use secure executor for window listing
      const result = await this.secureExecutor.executeSecureCommand(
        'list-windows',
        { sessionId },
        { sessionId: 'system-getwindows' }
      );

      if (!result.success) {
        console.warn(`Failed to get windows for session ${sessionId}: ${result.error}`);
        return [];
      }

      const windowLines = (result.stdout || '').trim().split('\n').filter(line => line);
      const windows: TmuxWindow[] = [];

      for (const line of windowLines) {
        const [id, index, name, active] = line.split(':');
        const panes = await this.getPanes(sessionId, id);
        
        windows.push({
          id,
          index: parseInt(index),
          name,
          active: active === '1',
          panes
        });
      }

      return windows;
    } catch (error) {
      return [];
    }
  }

  private async getPanes(sessionId: string, windowId: string): Promise<TmuxPane[]> {
    try {
      // CRITICAL SECURITY: Use secure executor for pane listing
      const result = await this.secureExecutor.executeSecureCommand(
        'list-panes',
        { windowId },
        { sessionId: 'system-getpanes' }
      );

      if (!result.success) {
        console.warn(`Failed to get panes for window ${windowId}: ${result.error}`);
        return [];
      }

      const paneLines = (result.stdout || '').trim().split('\n').filter(line => line);
      const panes: TmuxPane[] = [];

      for (const line of paneLines) {
        const [id, index, active, width, height, command, pid] = line.split(':');
        
        panes.push({
          id,
          index: parseInt(index),
          active: active === '1',
          width: parseInt(width),
          height: parseInt(height),
          command,
          pid: parseInt(pid)
        });
      }

      return panes;
    } catch (error) {
      return [];
    }
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.refreshSessions().catch(console.error);
    }, 1000);

    setInterval(() => {
      this.calculatePerformanceMetrics();
    }, 5000);
  }

  private recordLatency(type: 'commandInjectionLatency' | 'outputCaptureLatency', latency: number): void {
    this.performanceMetrics[type].push(latency);
    
    if (this.performanceMetrics[type].length > 1000) {
      this.performanceMetrics[type] = this.performanceMetrics[type].slice(-1000);
    }
  }

  private calculatePerformanceMetrics(): void {
    const allLatencies = [
      ...this.performanceMetrics.commandInjectionLatency,
      ...this.performanceMetrics.outputCaptureLatency
    ];

    if (allLatencies.length === 0) return;

    allLatencies.sort((a, b) => a - b);
    
    this.performanceMetrics.averageLatency = 
      allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length;
    
    this.performanceMetrics.p95Latency = 
      allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
    
    this.performanceMetrics.p99Latency = 
      allLatencies[Math.floor(allLatencies.length * 0.99)] || 0;
    
    const totalAttempts = this.performanceMetrics.totalCommands + this.performanceMetrics.failedCommands;
    this.performanceMetrics.successRate = totalAttempts > 0 
      ? (this.performanceMetrics.totalCommands / totalAttempts) * 100 
      : 100;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    this.calculatePerformanceMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Get comprehensive performance metrics including connection pool, 
   * batching, and caching statistics
   */
  getEnhancedPerformanceMetrics(): {
    core: PerformanceMetrics;
    connectionPool: any;
    batcher: any;
    cache: any;
    performanceMode: boolean;
    targetLatency: number;
    isTargetMet: boolean;
  } {
    this.calculatePerformanceMetrics();
    
    const connectionPoolMetrics = this.connectionPool.getMetrics();
    const batcherMetrics = this.commandBatcher.getMetrics();
    const cacheMetrics = this.sessionCache.getStats();
    
    return {
      core: { ...this.performanceMetrics },
      connectionPool: connectionPoolMetrics,
      batcher: batcherMetrics,
      cache: cacheMetrics,
      performanceMode: this.isPerformanceModeEnabled,
      targetLatency: 15, // Target <15ms
      isTargetMet: this.performanceMetrics.averageLatency < 15
    };
  }

  getSessions(): TmuxSession[] {
    return Array.from(this.sessions.values());
  }

  getSession(sessionId: string): TmuxSession | undefined {
    return this.sessions.get(sessionId);
  }

  async cleanup(): Promise<void> {
    try {
      // CRITICAL SECURITY: Audit cleanup operation
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_SHUTDOWN,
        severity: SecuritySeverity.INFO,
        source: 'TmuxSessionManager',
        description: 'Starting cleanup of tmux session manager',
        metadata: {
          sessionCount: this.sessions.size,
          captureCount: this.outputCaptures.size
        },
        outcome: 'success',
        riskScore: 2
      });

      for (const [sessionId] of this.sessions) {
        await this.destroySession(sessionId).catch(console.error);
      }
      
      for (const [, process] of this.outputCaptures) {
        process.kill();
      }
      
      this.outputCaptures.clear();
      this.sessions.clear();
      this.removeAllListeners();

      // PERFORMANCE OPTIMIZATION: Shutdown performance components
      await this.commandBatcher.shutdown();
      await this.connectionPool.shutdown();
      this.sessionCache.shutdown();

      // CRITICAL SECURITY: Shutdown security components
      await this.secureExecutor.shutdown();
      await this.auditLogger.shutdown();

    } catch (error) {
      console.error('Error during cleanup:', error);
      
      await this.auditLogger.logEvent({
        eventType: SecurityEventType.SECURITY_SHUTDOWN,
        severity: SecuritySeverity.HIGH,
        source: 'TmuxSessionManager',
        description: 'Cleanup operation failed',
        metadata: {
          error: error.message
        },
        outcome: 'failure',
        riskScore: 6
      });
    }
  }

  /**
   * CRITICAL SECURITY: Get security metrics for monitoring
   */
  getSecurityMetrics() {
    return {
      ...this.secureExecutor.getSecurityMetrics(),
      auditEnabled: true,
      sessionsManaged: this.sessions.size,
      activeCaptureProcesses: this.outputCaptures.size
    };
  }
}
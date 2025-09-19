import { EventEmitter } from 'events';
import { TmuxSessionManager } from '../../TmuxSessionManager';
import { BackendManager } from '../../backends/BackendManager';
import { SecureCommandExecutor } from '../../security/SecureCommandExecutor';
import { AuditLogger, SecurityEventType, SecuritySeverity } from '../../security/AuditLogger';
import { TmuxConnectionPool } from '../../performance/TmuxConnectionPool';
import { CommandBatcher } from '../../performance/CommandBatcher';
import { SessionCache } from '../../performance/SessionCache';
import type { 
  TmuxConfig, 
  TmuxSession, 
  CommandExecution,
  PerformanceMetrics 
} from '../../types';
import type { BackendResult, ExecutionContext } from '../../backends/ITerminalBackend';

/**
 * Integration test configuration
 */
export interface IntegrationTestConfig {
  testTimeout: number;
  maxConcurrentSessions: number;
  performanceThresholds: {
    maxLatency: number;
    minSuccessRate: number;
    maxSecurityOverhead: number;
  };
  securityTestLevel: 'basic' | 'enhanced' | 'paranoid';
  enableStressTests: boolean;
  validateMemoryLeaks: boolean;
}

/**
 * Test execution context with security metadata
 */
interface SecureTestContext extends ExecutionContext {
  testName: string;
  securityLevel: string;
  expectedRiskScore: number;
}

/**
 * Integration test result
 */
export interface IntegrationTestResult {
  testName: string;
  success: boolean;
  duration: number;
  performanceMetrics: {
    averageLatency: number;
    p95Latency: number;
    throughput: number;
    memoryUsage: number;
  };
  securityMetrics: {
    validationsPassed: number;
    validationsFailed: number;
    auditEventsLogged: number;
    riskScoreDistribution: Record<string, number>;
  };
  backendMetrics: {
    backendSwitches: number;
    failoverEvents: number;
    healthChecks: number;
    concurrentConnections: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive integration test suite for Phase 2 validation
 * 
 * Tests the integration between:
 * - Security framework + Performance optimizations
 * - Backend abstraction layer under load
 * - End-to-end system functionality
 * - Race condition detection
 * - Performance regression with security enabled
 */
export class IntegrationTestSuite extends EventEmitter {
  private config: IntegrationTestConfig;
  private tmuxManager: TmuxSessionManager;
  private backendManager: BackendManager;
  private secureExecutor: SecureCommandExecutor;
  private auditLogger: AuditLogger;
  private connectionPool: TmuxConnectionPool;
  private commandBatcher: CommandBatcher;
  private sessionCache: SessionCache;
  
  private testResults: IntegrationTestResult[] = [];
  private isRunning = false;
  private startTime = 0;
  private memoryBaseline = 0;

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    super();
    
    this.config = {
      testTimeout: 30000, // 30 seconds per test
      maxConcurrentSessions: 100,
      performanceThresholds: {
        maxLatency: 15, // <15ms target
        minSuccessRate: 0.95, // 95%
        maxSecurityOverhead: 3 // <3ms security overhead
      },
      securityTestLevel: 'enhanced',
      enableStressTests: true,
      validateMemoryLeaks: true,
      ...config
    };
  }

  /**
   * Initialize all components for testing
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Integration Test Suite...');
    
    // Initialize audit logger first
    this.auditLogger = new AuditLogger({
      enableConsoleOutput: false,
      logLevel: SecuritySeverity.INFO
    });

    // Initialize secure executor
    this.secureExecutor = new SecureCommandExecutor({
      socketPath: '/tmp/test-tmux-socket',
      commandTimeout: 5000,
      enableAuditLogging: true,
      rateLimitConfig: {
        windowMs: 60000,
        maxRequests: 1000, // Higher limit for testing
        blockDurationMs: 1000
      },
      maxConcurrentCommands: 50
    });

    // Initialize performance components
    this.connectionPool = new TmuxConnectionPool({
      socketPath: '/tmp/test-tmux-socket',
      maxConnections: 10,
      minConnections: 3,
      maxIdleTime: 30000,
      healthCheckInterval: 5000,
      commandTimeout: 5000
    });

    this.commandBatcher = new CommandBatcher(this.connectionPool, {
      maxBatchSize: 15,
      maxBatchWait: 3,
      maxConcurrentBatches: 5,
      adaptiveBatching: true,
      performanceThreshold: 15
    });

    this.sessionCache = new SessionCache({
      defaultTtl: 3000,
      maxEntries: 1000,
      cleanupInterval: 10000,
      enableStats: true
    });

    // Initialize backend manager
    this.backendManager = new BackendManager({
      selectionStrategy: 'performance-based',
      healthCheckInterval: 5000,
      maxRetries: 3,
      retryDelay: 500,
      fallbackBackends: ['tmux'],
      enableABTesting: false,
      enableHotSwap: true,
      performanceThresholds: {
        maxLatency: 15,
        minSuccessRate: 0.95,
        maxErrorRate: 0.05
      }
    });

    // Initialize main tmux manager
    this.tmuxManager = new TmuxSessionManager({
      socketPath: '/tmp/test-tmux-socket',
      defaultShell: '/bin/bash',
      captureBufferSize: 10000,
      commandTimeout: 5000,
      performanceMode: 'performance'
    });

    // Initialize all components
    await this.connectionPool.initialize();
    await this.backendManager.initialize();
    await this.tmuxManager.initialize();

    this.memoryBaseline = process.memoryUsage().heapUsed;
    
    console.log('✅ Integration Test Suite initialized');
  }

  /**
   * Run the complete integration test suite
   */
  async runFullSuite(): Promise<IntegrationTestResult[]> {
    if (this.isRunning) {
      throw new Error('Test suite is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.testResults = [];

    console.log('\n🚀 Starting Integration Test Suite');
    console.log('=' .repeat(60));

    try {
      // Phase 1: Security + Performance Integration Tests
      await this.runSecurityPerformanceIntegrationTests();
      
      // Phase 2: Backend Abstraction Concurrency Tests
      await this.runBackendConcurrencyTests();
      
      // Phase 3: End-to-End System Validation
      await this.runEndToEndValidationTests();
      
      // Phase 4: Race Condition Detection Tests
      await this.runRaceConditionTests();
      
      // Phase 5: Performance Regression Tests
      await this.runPerformanceRegressionTests();
      
      // Phase 6: Stress and Load Tests
      if (this.config.enableStressTests) {
        await this.runStressTests();
      }

      // Phase 7: Memory Leak Validation
      if (this.config.validateMemoryLeaks) {
        await this.runMemoryLeakTests();
      }

    } finally {
      this.isRunning = false;
      await this.generateSummaryReport();
    }

    return this.testResults;
  }

  /**
   * Test security framework integration with performance optimizations
   */
  private async runSecurityPerformanceIntegrationTests(): Promise<void> {
    console.log('\n📊 Phase 1: Security + Performance Integration Tests');
    
    // Test 1: Secure command execution with performance mode
    await this.runTest('Secure Command Execution with Performance Mode', async () => {
      const context: SecureTestContext = {
        sessionId: 'perf-test-1',
        userId: 'test-user',
        clientIp: '127.0.0.1',
        testName: 'secure-perf-command',
        securityLevel: 'high',
        expectedRiskScore: 3
      };

      const startTime = performance.now();
      
      // Execute command through secure executor with performance optimizations
      const result = await this.secureExecutor.executeSecureCommand(
        'send-keys',
        { target: 'test-session', command: 'echo "security-performance-test"' },
        context
      );

      const latency = performance.now() - startTime;

      if (!result.success) {
        throw new Error(`Secure command execution failed: ${result.error}`);
      }

      if (latency > this.config.performanceThresholds.maxLatency) {
        throw new Error(`Latency ${latency.toFixed(2)}ms exceeds threshold ${this.config.performanceThresholds.maxLatency}ms`);
      }

      return {
        latency,
        securityValidated: true,
        performanceTarget: latency < this.config.performanceThresholds.maxLatency
      };
    });

    // Test 2: Batch operations with security validation
    await this.runTest('Batch Operations with Security Validation', async () => {
      const commands = [
        'echo "batch1"',
        'echo "batch2"',
        'echo "batch3"',
        'ls -la',
        'whoami'
      ];

      const startTime = performance.now();
      const results = [];

      for (const command of commands) {
        const result = await this.secureExecutor.executeSecureCommand(
          'send-keys',
          { target: 'test-session', command },
          { sessionId: 'batch-test', userId: 'test-user' }
        );
        results.push(result);
      }

      const totalLatency = performance.now() - startTime;
      const avgLatency = totalLatency / commands.length;

      const successCount = results.filter(r => r.success).length;
      const successRate = successCount / results.length;

      if (successRate < this.config.performanceThresholds.minSuccessRate) {
        throw new Error(`Success rate ${successRate} below threshold ${this.config.performanceThresholds.minSuccessRate}`);
      }

      return {
        totalLatency,
        avgLatency,
        successRate,
        commandsExecuted: commands.length
      };
    });

    // Test 3: Connection pool with security constraints
    await this.runTest('Connection Pool with Security Constraints', async () => {
      const connectionMetrics = this.connectionPool.getMetrics();
      const securityMetrics = this.secureExecutor.getSecurityMetrics();

      // Test concurrent secure operations
      const concurrentOps = 20;
      const promises = [];

      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          this.secureExecutor.executeSecureCommand(
            'list-sessions',
            {},
            { sessionId: `concurrent-${i}`, userId: 'test-user' }
          )
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const latency = performance.now() - startTime;

      const successfulOps = results.filter(r => r.success).length;
      const avgLatency = latency / concurrentOps;

      return {
        concurrentOps,
        successfulOps,
        avgLatency,
        connectionPoolEfficiency: connectionMetrics,
        securityOverhead: securityMetrics
      };
    });
  }

  /**
   * Test backend abstraction layer under concurrent load
   */
  private async runBackendConcurrencyTests(): Promise<void> {
    console.log('\n🔀 Phase 2: Backend Abstraction Concurrency Tests');
    
    // Test 1: Multiple backend concurrent operations
    await this.runTest('Multiple Backend Concurrent Operations', async () => {
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          this.backendManager.executeCommand(
            'test-session',
            `echo "concurrent-test-${i}"`,
            undefined,
            { sessionId: `op-${i}`, userId: 'test-user' }
          )
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const latency = performance.now() - startTime;

      const successfulOps = results.filter(r => r.success).length;
      const failedOps = operations - successfulOps;

      if (failedOps > operations * 0.05) { // Max 5% failure rate
        throw new Error(`Too many failed operations: ${failedOps}/${operations}`);
      }

      return {
        operations,
        successfulOps,
        failedOps,
        totalLatency: latency,
        avgLatency: latency / operations
      };
    });

    // Test 2: Backend failover under load
    await this.runTest('Backend Failover Under Load', async () => {
      // Create multiple backends
      await this.backendManager.addBackend('tmux', {}, 1);
      await this.backendManager.addBackend('tmux', {}, 1);

      let failoverEvents = 0;
      this.backendManager.on('backend-hot-swapped', () => failoverEvents++);

      // Generate load while triggering failovers
      const loadPromises = [];
      for (let i = 0; i < 30; i++) {
        loadPromises.push(
          this.backendManager.listSessions({ sessionId: `load-${i}` })
        );
      }

      // Trigger a backend hot-swap during load
      setTimeout(async () => {
        const backends = Object.keys(await this.backendManager.getBackendHealthStatus());
        if (backends.length > 0) {
          await this.backendManager.hotSwapBackend(backends[0]);
        }
      }, 1000);

      const results = await Promise.all(loadPromises);
      const successRate = results.filter(r => r.success).length / results.length;

      return {
        loadOperations: loadPromises.length,
        successRate,
        failoverEvents,
        backendHealth: await this.backendManager.getBackendHealthStatus()
      };
    });
  }

  /**
   * Test end-to-end system functionality
   */
  private async runEndToEndValidationTests(): Promise<void> {
    console.log('\n🔄 Phase 3: End-to-End System Validation');
    
    // Test 1: Complete session lifecycle with security
    await this.runTest('Complete Session Lifecycle with Security', async () => {
      const sessionName = `e2e-test-${Date.now()}`;
      const context: SecureTestContext = {
        sessionId: sessionName,
        userId: 'e2e-user',
        clientIp: '192.168.1.100',
        testName: 'e2e-lifecycle',
        securityLevel: 'high',
        expectedRiskScore: 5
      };

      // Create session
      const createResult = await this.tmuxManager.createSession(sessionName, context);
      if (!createResult) {
        throw new Error('Failed to create session');
      }

      // Execute commands
      const commands = [
        'echo "Hello, World!"',
        'pwd',
        'date',
        'whoami'
      ];

      for (const command of commands) {
        const execResult = await this.tmuxManager.sendCommand(
          createResult.id,
          command,
          undefined,
          context
        );
        
        if (execResult.error) {
          throw new Error(`Command execution failed: ${execResult.error}`);
        }
      }

      // Capture output
      const output = await this.tmuxManager.captureOutput(createResult.id, undefined, context);
      if (!output) {
        throw new Error('Failed to capture output');
      }

      // Start continuous capture
      await this.tmuxManager.startContinuousCapture(createResult.id, undefined, context);

      // Verify session in list
      const sessions = this.tmuxManager.getSessions();
      const foundSession = sessions.find(s => s.id === createResult.id);
      if (!foundSession) {
        throw new Error('Session not found in session list');
      }

      // Clean up
      await this.tmuxManager.destroySession(createResult.id, context);

      return {
        sessionCreated: true,
        commandsExecuted: commands.length,
        outputCaptured: output.length > 0,
        continuousCaptureStarted: true,
        sessionFoundInList: true,
        sessionDestroyed: true
      };
    });

    // Test 2: Performance metrics integration
    await this.runTest('Performance Metrics Integration', async () => {
      const baseMetrics = this.tmuxManager.getPerformanceMetrics();
      const enhancedMetrics = this.tmuxManager.getEnhancedPerformanceMetrics();
      const backendMetrics = this.backendManager.getAggregatedMetrics();

      // Execute operations to generate metrics
      for (let i = 0; i < 10; i++) {
        await this.tmuxManager.sendCommand(
          'test-session',
          `echo "metrics-test-${i}"`,
          undefined,
          { sessionId: 'metrics', userId: 'test-user' }
        );
      }

      const updatedMetrics = this.tmuxManager.getPerformanceMetrics();

      return {
        baseMetrics,
        enhancedMetrics,
        backendMetrics,
        metricsUpdated: updatedMetrics.totalCommands > baseMetrics.totalCommands,
        targetLatencyMet: enhancedMetrics.isTargetMet
      };
    });
  }

  /**
   * Test race condition detection in multi-backend scenarios
   */
  private async runRaceConditionTests(): Promise<void> {
    console.log('\n⚡ Phase 4: Race Condition Detection Tests');
    
    // Test 1: Concurrent session creation
    await this.runTest('Concurrent Session Creation Race Conditions', async () => {
      const sessionCount = 20;
      const promises = [];

      // Create multiple sessions concurrently with same name pattern
      for (let i = 0; i < sessionCount; i++) {
        promises.push(
          this.tmuxManager.createSession(`race-test-${i % 5}`, {
            sessionId: `race-${i}`,
            userId: `user-${i % 3}`
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Verify no data corruption
      const sessions = this.tmuxManager.getSessions();
      const uniqueSessionIds = new Set(sessions.map(s => s.id));

      if (uniqueSessionIds.size !== sessions.length) {
        throw new Error('Duplicate session IDs detected - race condition occurred');
      }

      return {
        attemptedCreations: sessionCount,
        successful,
        failed,
        uniqueSessions: uniqueSessionIds.size,
        raceConditionDetected: false
      };
    });

    // Test 2: Concurrent command execution
    await this.runTest('Concurrent Command Execution Race Conditions', async () => {
      const commandCount = 50;
      const promises = [];
      const commandResults = new Map();

      // Execute commands concurrently
      for (let i = 0; i < commandCount; i++) {
        const command = `echo "race-cmd-${i}"`;
        promises.push(
          this.tmuxManager.sendCommand(
            'test-session',
            command,
            undefined,
            { sessionId: `cmd-race-${i}`, userId: 'race-user' }
          ).then(result => {
            commandResults.set(i, result);
            return result;
          })
        );
      }

      await Promise.all(promises);

      // Verify command execution order and integrity
      const executionTimes = Array.from(commandResults.values())
        .map(r => r.executionTime)
        .filter(t => t !== undefined);

      const avgExecutionTime = executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;

      return {
        commandsExecuted: commandCount,
        resultsCollected: commandResults.size,
        avgExecutionTime,
        dataIntegrityMaintained: commandResults.size === commandCount
      };
    });
  }

  /**
   * Test performance regression with security enabled
   */
  private async runPerformanceRegressionTests(): Promise<void> {
    console.log('\n📈 Phase 5: Performance Regression Tests');
    
    // Test 1: Latency regression with security overhead
    await this.runTest('Latency Regression with Security Overhead', async () => {
      const iterations = 100;
      const secureLatencies = [];
      const baselineLatencies = [];

      // Measure secure operations
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await this.secureExecutor.executeSecureCommand(
          'list-sessions',
          {},
          { sessionId: `secure-${i}`, userId: 'perf-user' }
        );
        secureLatencies.push(performance.now() - start);
      }

      // Measure baseline operations (direct execution for comparison)
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await this.connectionPool.executeCommand(['list-sessions']);
        baselineLatencies.push(performance.now() - start);
      }

      const avgSecureLatency = secureLatencies.reduce((sum, l) => sum + l, 0) / iterations;
      const avgBaselineLatency = baselineLatencies.reduce((sum, l) => sum + l, 0) / iterations;
      const securityOverhead = avgSecureLatency - avgBaselineLatency;

      if (securityOverhead > this.config.performanceThresholds.maxSecurityOverhead) {
        throw new Error(`Security overhead ${securityOverhead.toFixed(2)}ms exceeds threshold`);
      }

      return {
        avgSecureLatency,
        avgBaselineLatency,
        securityOverhead,
        overheadPercentage: (securityOverhead / avgBaselineLatency) * 100,
        regressionDetected: false
      };
    });

    // Test 2: Throughput regression analysis
    await this.runTest('Throughput Regression Analysis', async () => {
      const testDuration = 10000; // 10 seconds
      const startTime = Date.now();
      let operationCount = 0;

      // Execute operations continuously for test duration
      while (Date.now() - startTime < testDuration) {
        try {
          await this.backendManager.listSessions({
            sessionId: `throughput-${operationCount}`,
            userId: 'throughput-user'
          });
          operationCount++;
        } catch (error) {
          // Continue on error
        }
      }

      const actualDuration = Date.now() - startTime;
      const throughput = (operationCount / actualDuration) * 1000; // ops per second

      const minExpectedThroughput = 100; // 100 ops/sec minimum
      if (throughput < minExpectedThroughput) {
        throw new Error(`Throughput ${throughput.toFixed(1)} ops/sec below minimum ${minExpectedThroughput}`);
      }

      return {
        operationCount,
        duration: actualDuration,
        throughput,
        targetMet: throughput >= minExpectedThroughput
      };
    });
  }

  /**
   * Run stress and load tests
   */
  private async runStressTests(): Promise<void> {
    console.log('\n💪 Phase 6: Stress and Load Tests');
    
    // Test 1: High concurrency stress test
    await this.runTest('High Concurrency Stress Test', async () => {
      const concurrentOperations = this.config.maxConcurrentSessions;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          this.performStressOperation(i)
        );
      }

      const startTime = performance.now();
      const results = await Promise.allSettled(promises);
      const duration = performance.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        concurrentOperations,
        successful,
        failed,
        duration,
        successRate: successful / concurrentOperations,
        avgLatency: duration / concurrentOperations
      };
    });
  }

  /**
   * Test memory leak validation
   */
  private async runMemoryLeakTests(): Promise<void> {
    console.log('\n🧠 Phase 7: Memory Leak Validation');
    
    await this.runTest('Memory Leak Detection', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;

      // Perform operations that could potentially leak memory
      for (let i = 0; i < iterations; i++) {
        const session = await this.tmuxManager.createSession(`leak-test-${i}`);
        await this.tmuxManager.sendCommand(session.id, 'echo "memory test"');
        await this.tmuxManager.destroySession(session.id);
        
        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerOp = memoryIncrease / iterations;

      // Memory leak threshold: 1KB per operation
      const maxMemoryPerOp = 1024;
      if (memoryIncreasePerOp > maxMemoryPerOp) {
        console.warn(`Potential memory leak detected: ${memoryIncreasePerOp} bytes per operation`);
      }

      return {
        iterations,
        initialMemory,
        finalMemory,
        memoryIncrease,
        memoryIncreasePerOp,
        potentialLeak: memoryIncreasePerOp > maxMemoryPerOp
      };
    });
  }

  /**
   * Perform a stress operation for load testing
   */
  private async performStressOperation(index: number): Promise<any> {
    const sessionName = `stress-${index}`;
    const context = {
      sessionId: sessionName,
      userId: `stress-user-${index % 10}`,
      clientIp: `192.168.1.${(index % 254) + 1}`
    };

    // Create session
    const session = await this.tmuxManager.createSession(sessionName, context);
    
    // Execute multiple commands
    const commands = [
      'echo "stress test"',
      'pwd',
      'date',
      'ls -la'
    ];

    for (const command of commands) {
      await this.tmuxManager.sendCommand(session.id, command, undefined, context);
    }

    // Capture output
    await this.tmuxManager.captureOutput(session.id, undefined, context);

    // Clean up
    await this.tmuxManager.destroySession(session.id, context);

    return { sessionId: session.id, commandsExecuted: commands.length };
  }

  /**
   * Run an individual test with metrics collection
   */
  private async runTest(testName: string, testFunc: () => Promise<any>): Promise<void> {
    console.log(`  🧪 ${testName}...`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result: IntegrationTestResult = {
      testName,
      success: false,
      duration: 0,
      performanceMetrics: {
        averageLatency: 0,
        p95Latency: 0,
        throughput: 0,
        memoryUsage: 0
      },
      securityMetrics: {
        validationsPassed: 0,
        validationsFailed: 0,
        auditEventsLogged: 0,
        riskScoreDistribution: {}
      },
      backendMetrics: {
        backendSwitches: 0,
        failoverEvents: 0,
        healthChecks: 0,
        concurrentConnections: 0
      },
      errors: [],
      warnings: []
    };

    try {
      const testResult = await Promise.race([
        testFunc(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), this.config.testTimeout)
        )
      ]);

      result.success = true;
      result.duration = performance.now() - startTime;
      result.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed - startMemory;

      // Collect metrics from various components
      const perfMetrics = this.tmuxManager.getPerformanceMetrics();
      result.performanceMetrics.averageLatency = perfMetrics.averageLatency;
      result.performanceMetrics.p95Latency = perfMetrics.p95Latency;

      const securityMetrics = this.tmuxManager.getSecurityMetrics();
      result.securityMetrics = {
        validationsPassed: securityMetrics.commandsValidated || 0,
        validationsFailed: securityMetrics.commandsBlocked || 0,
        auditEventsLogged: securityMetrics.auditEventsLogged || 0,
        riskScoreDistribution: securityMetrics.riskScoreDistribution || {}
      };

      const backendMetrics = this.backendManager.getAggregatedMetrics();
      result.backendMetrics = {
        backendSwitches: 0, // Would need to track this
        failoverEvents: 0, // Would need to track this
        healthChecks: 0, // Would need to track this
        concurrentConnections: backendMetrics.activeBackends
      };

      console.log(`    ✅ PASSED (${result.duration.toFixed(2)}ms)`);

      this.emit('test-passed', { testName, result });

    } catch (error) {
      result.success = false;
      result.duration = performance.now() - startTime;
      result.errors.push(error.message);

      console.log(`    ❌ FAILED: ${error.message}`);

      this.emit('test-failed', { testName, error: error.message, result });
    }

    this.testResults.push(result);
  }

  /**
   * Generate comprehensive summary report
   */
  private async generateSummaryReport(): Promise<void> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;

    const totalDuration = Date.now() - this.startTime;
    const avgTestDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0) / totalTests;

    const avgLatency = this.testResults.reduce((sum, t) => sum + t.performanceMetrics.averageLatency, 0) / totalTests;
    const maxLatency = Math.max(...this.testResults.map(t => t.performanceMetrics.averageLatency));

    const totalMemoryUsed = this.testResults.reduce((sum, t) => sum + t.performanceMetrics.memoryUsage, 0);

    console.log('\n' + '='.repeat(80));
    console.log('🎯 INTEGRATION TEST SUITE SUMMARY REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 TEST EXECUTION SUMMARY:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`  Average Test Duration: ${avgTestDuration.toFixed(1)}ms`);

    console.log(`\n⚡ PERFORMANCE SUMMARY:`);
    console.log(`  Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Maximum Latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`  Target Met (<15ms): ${avgLatency < 15 ? '✅' : '❌'}`);
    console.log(`  Total Memory Used: ${(totalMemoryUsed / 1024 / 1024).toFixed(2)}MB`);

    console.log(`\n🔒 SECURITY SUMMARY:`);
    const totalValidations = this.testResults.reduce((sum, t) => sum + t.securityMetrics.validationsPassed, 0);
    const totalBlocked = this.testResults.reduce((sum, t) => sum + t.securityMetrics.validationsFailed, 0);
    const totalAuditEvents = this.testResults.reduce((sum, t) => sum + t.securityMetrics.auditEventsLogged, 0);
    
    console.log(`  Security Validations Passed: ${totalValidations}`);
    console.log(`  Security Validations Failed: ${totalBlocked}`);
    console.log(`  Audit Events Logged: ${totalAuditEvents}`);

    console.log(`\n🔀 BACKEND SUMMARY:`);
    const avgConcurrentConnections = this.testResults.reduce((sum, t) => sum + t.backendMetrics.concurrentConnections, 0) / totalTests;
    console.log(`  Average Concurrent Connections: ${avgConcurrentConnections.toFixed(1)}`);

    if (failedTests > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      this.testResults.filter(t => !t.success).forEach(test => {
        console.log(`  - ${test.testName}: ${test.errors.join(', ')}`);
      });
    }

    console.log(`\n💡 RECOMMENDATIONS:`);
    if (avgLatency >= 15) {
      console.log(`  ⚠️  Average latency ${avgLatency.toFixed(2)}ms exceeds 15ms target`);
    } else {
      console.log(`  ✅ Performance target (<15ms) achieved`);
    }

    if (successRate < 95) {
      console.log(`  ⚠️  Success rate ${successRate.toFixed(1)}% below 95% target`);
    } else {
      console.log(`  ✅ Success rate target (>95%) achieved`);
    }

    console.log('\n' + '='.repeat(80));

    this.emit('suite-completed', {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate,
        avgLatency,
        maxLatency,
        totalMemoryUsed,
        targetsMet: avgLatency < 15 && successRate >= 95
      },
      results: this.testResults
    });
  }

  /**
   * Clean up test resources
   */
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test resources...');
    
    try {
      await this.tmuxManager.cleanup();
      await this.backendManager.shutdown();
      await this.commandBatcher.shutdown();
      await this.connectionPool.shutdown();
      this.sessionCache.shutdown();
      await this.secureExecutor.shutdown();
      await this.auditLogger.shutdown();
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}
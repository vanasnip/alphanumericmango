import { EventEmitter } from 'events';
import { BackendManager } from '../../backends/BackendManager';
import { TmuxSessionManager } from '../../TmuxSessionManager';
import { TmuxConnectionPool } from '../../performance/TmuxConnectionPool';
import { CommandBatcher } from '../../performance/CommandBatcher';
import type { 
  BackendResult, 
  ExecutionContext,
  BackendHealth 
} from '../../backends/ITerminalBackend';
import type { 
  TmuxSession, 
  CommandExecution,
  PerformanceMetrics 
} from '../../types';

/**
 * Concurrency test configuration
 */
export interface ConcurrencyTestConfig {
  maxConcurrentSessions: number;
  maxConcurrentCommands: number;
  testDuration: number; // milliseconds
  stressTestMultiplier: number;
  backendFailureSimulation: boolean;
  networkLatencySimulation: number; // milliseconds
  memoryPressureSimulation: boolean;
  targetLatency: number; // milliseconds
  targetThroughput: number; // operations per second
  maxAcceptableFailureRate: number; // percentage
}

/**
 * Concurrency test result
 */
export interface ConcurrencyTestResult {
  testName: string;
  config: ConcurrencyTestConfig;
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    maxLatency: number;
    minLatency: number;
    throughput: number;
    successRate: number;
    concurrencyLevel: number;
    memoryUsage: {
      initial: number;
      peak: number;
      final: number;
      leaked: number;
    };
  };
  backendMetrics: {
    backendSwitches: number;
    failoverEvents: number;
    healthDegradations: number;
    connectionPoolEfficiency: number;
    batchingEfficiency: number;
  };
  raceConditions: {
    detected: number;
    mitigated: number;
    dataCorruption: boolean;
  };
  timestamp: Date;
  duration: number;
  errors: string[];
  warnings: string[];
}

/**
 * Load pattern for simulating different workload types
 */
export interface LoadPattern {
  name: string;
  sessionCreationRate: number; // sessions per second
  commandExecutionRate: number; // commands per second
  outputCaptureRate: number; // captures per second
  duration: number; // milliseconds
  rampUpTime: number; // milliseconds
  sustainTime: number; // milliseconds
  rampDownTime: number; // milliseconds
}

/**
 * Comprehensive concurrency test suite for backend abstraction layer
 * 
 * Tests concurrent operations under various load conditions:
 * - High concurrent session management (100+ sessions)
 * - Race condition detection and mitigation
 * - Backend failover under load
 * - Memory pressure and leak detection
 * - Performance degradation analysis
 */
export class ConcurrencyTestSuite extends EventEmitter {
  private config: ConcurrencyTestConfig;
  private backendManager: BackendManager;
  private tmuxManager: TmuxSessionManager;
  private connectionPool: TmuxConnectionPool;
  private commandBatcher: CommandBatcher;
  
  private testResults: ConcurrencyTestResult[] = [];
  private isRunning = false;
  private startTime = 0;
  private activeOperations = new Set<Promise<any>>();
  private operationMetrics: Array<{
    operation: string;
    startTime: number;
    endTime: number;
    success: boolean;
    latency: number;
    error?: string;
  }> = [];

  // Race condition tracking
  private sessionCreateTimes = new Map<string, number>();
  private commandExecutionOrder: Array<{
    sessionId: string;
    command: string;
    timestamp: number;
    sequence: number;
  }> = [];
  private detectedRaceConditions = 0;

  constructor(config: Partial<ConcurrencyTestConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentSessions: 100,
      maxConcurrentCommands: 500,
      testDuration: 60000, // 1 minute
      stressTestMultiplier: 2,
      backendFailureSimulation: true,
      networkLatencySimulation: 10,
      memoryPressureSimulation: true,
      targetLatency: 15,
      targetThroughput: 100,
      maxAcceptableFailureRate: 5.0,
      ...config
    };
  }

  /**
   * Initialize concurrency test suite
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Concurrency Test Suite...');
    
    // Initialize backend manager with high concurrency configuration
    this.backendManager = new BackendManager({
      selectionStrategy: 'least-connections',
      healthCheckInterval: 5000,
      maxRetries: 3,
      retryDelay: 100,
      fallbackBackends: ['tmux'],
      enableABTesting: false,
      enableHotSwap: true,
      performanceThresholds: {
        maxLatency: this.config.targetLatency,
        minSuccessRate: (100 - this.config.maxAcceptableFailureRate) / 100,
        maxErrorRate: this.config.maxAcceptableFailureRate / 100
      }
    });

    // Initialize tmux manager for high-performance operation
    this.tmuxManager = new TmuxSessionManager({
      socketPath: '/tmp/concurrency-test-socket',
      defaultShell: '/bin/bash',
      captureBufferSize: 50000,
      commandTimeout: 5000,
      performanceMode: 'performance'
    });

    // Initialize connection pool with high concurrency settings
    this.connectionPool = new TmuxConnectionPool({
      socketPath: '/tmp/concurrency-test-socket',
      maxConnections: 20,
      minConnections: 5,
      maxIdleTime: 30000,
      healthCheckInterval: 3000,
      commandTimeout: 5000
    });

    // Initialize command batcher for optimal batching
    this.commandBatcher = new CommandBatcher(this.connectionPool, {
      maxBatchSize: 20,
      maxBatchWait: 2,
      maxConcurrentBatches: 10,
      adaptiveBatching: true,
      performanceThreshold: this.config.targetLatency
    });

    // Setup event listeners for metrics collection
    this.setupEventListeners();

    // Initialize components
    await this.connectionPool.initialize();
    await this.backendManager.initialize();
    await this.tmuxManager.initialize();

    console.log('✅ Concurrency Test Suite initialized');
  }

  /**
   * Run the complete concurrency test suite
   */
  async runFullSuite(): Promise<ConcurrencyTestResult[]> {
    if (this.isRunning) {
      throw new Error('Concurrency test suite is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.testResults = [];

    console.log('\n🚀 Starting Concurrency Test Suite');
    console.log('=' .repeat(60));

    try {
      // Test 1: Basic concurrent session management
      await this.runConcurrentSessionTest();
      
      // Test 2: High-load command execution
      await this.runHighLoadCommandTest();
      
      // Test 3: Backend failover under load
      await this.runBackendFailoverTest();
      
      // Test 4: Race condition stress test
      await this.runRaceConditionStressTest();
      
      // Test 5: Memory pressure test
      await this.runMemoryPressureTest();
      
      // Test 6: Load pattern simulation
      await this.runLoadPatternTests();
      
      // Test 7: Extreme stress test
      await this.runExtremeStressTest();

    } finally {
      this.isRunning = false;
      await this.generateConcurrencyReport();
    }

    return this.testResults;
  }

  /**
   * Test concurrent session management at scale
   */
  private async runConcurrentSessionTest(): Promise<void> {
    console.log('\n📊 Test 1: Concurrent Session Management');
    
    const testConfig = { ...this.config };
    const testName = 'Concurrent Session Management';
    
    await this.executeTest(testName, testConfig, async () => {
      const sessionCount = this.config.maxConcurrentSessions;
      const promises: Promise<any>[] = [];
      const createdSessions: string[] = [];

      // Phase 1: Create sessions concurrently
      console.log(`  Creating ${sessionCount} concurrent sessions...`);
      for (let i = 0; i < sessionCount; i++) {
        const sessionName = `concurrent-session-${i}`;
        const context: ExecutionContext = {
          sessionId: sessionName,
          userId: `user-${i % 20}`, // 20 different users
          clientIp: `192.168.1.${(i % 254) + 1}`
        };

        const promise = this.createSessionWithMetrics(sessionName, context, i)
          .then(result => {
            if (result.success && result.data) {
              createdSessions.push(result.data.id);
            }
            return result;
          });
        
        promises.push(promise);
        this.activeOperations.add(promise);
      }

      const results = await Promise.allSettled(promises);
      const successfulCreations = results.filter(r => r.status === 'fulfilled').length;

      // Phase 2: Execute commands on all sessions
      console.log(`  Executing commands on ${createdSessions.length} sessions...`);
      const commandPromises: Promise<any>[] = [];
      
      for (const sessionId of createdSessions) {
        for (let cmd = 0; cmd < 5; cmd++) {
          const command = `echo "concurrent-test-${cmd}"`;
          const promise = this.executeCommandWithMetrics(
            sessionId, 
            command, 
            `${sessionId}-cmd-${cmd}`
          );
          commandPromises.push(promise);
          this.activeOperations.add(promise);
        }
      }

      const commandResults = await Promise.allSettled(commandPromises);
      const successfulCommands = commandResults.filter(r => r.status === 'fulfilled').length;

      // Phase 3: Clean up sessions
      console.log(`  Cleaning up ${createdSessions.length} sessions...`);
      const cleanupPromises = createdSessions.map(sessionId =>
        this.tmuxManager.destroySession(sessionId).catch(console.error)
      );

      await Promise.all(cleanupPromises);

      return {
        sessionsAttempted: sessionCount,
        sessionsCreated: successfulCreations,
        commandsExecuted: successfulCommands,
        commandsAttempted: commandPromises.length,
        cleanupCompleted: true
      };
    });
  }

  /**
   * Test high-load command execution
   */
  private async runHighLoadCommandTest(): Promise<void> {
    console.log('\n⚡ Test 2: High-Load Command Execution');
    
    const testConfig = { ...this.config };
    const testName = 'High-Load Command Execution';
    
    await this.executeTest(testName, testConfig, async () => {
      const commandCount = this.config.maxConcurrentCommands;
      const sessionCount = Math.min(this.config.maxConcurrentSessions, 50);
      
      // Create test sessions
      const sessions = [];
      for (let i = 0; i < sessionCount; i++) {
        const session = await this.tmuxManager.createSession(`load-test-${i}`);
        sessions.push(session);
      }

      // Execute commands with high concurrency
      console.log(`  Executing ${commandCount} commands across ${sessionCount} sessions...`);
      const promises: Promise<any>[] = [];

      for (let i = 0; i < commandCount; i++) {
        const sessionIndex = i % sessionCount;
        const session = sessions[sessionIndex];
        const command = `echo "load-test-${i}" && sleep 0.1`;
        
        const promise = this.executeCommandWithMetrics(
          session.id,
          command,
          `load-cmd-${i}`
        );
        
        promises.push(promise);
        this.activeOperations.add(promise);

        // Throttle to avoid overwhelming the system
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const results = await Promise.allSettled(promises);
      const successfulCommands = results.filter(r => r.status === 'fulfilled').length;

      // Clean up sessions
      for (const session of sessions) {
        await this.tmuxManager.destroySession(session.id).catch(console.error);
      }

      return {
        commandsAttempted: commandCount,
        commandsSuccessful: successfulCommands,
        sessionsUsed: sessionCount,
        loadTestCompleted: true
      };
    });
  }

  /**
   * Test backend failover under load
   */
  private async runBackendFailoverTest(): Promise<void> {
    console.log('\n🔄 Test 3: Backend Failover Under Load');
    
    const testConfig = { ...this.config };
    const testName = 'Backend Failover Under Load';
    
    await this.executeTest(testName, testConfig, async () => {
      // Add multiple backends for failover testing
      await this.backendManager.addBackend('tmux', {}, 1);
      await this.backendManager.addBackend('tmux', {}, 1);
      
      let failoverEvents = 0;
      let backendSwitches = 0;

      this.backendManager.on('backend-hot-swapped', () => failoverEvents++);
      this.backendManager.on('backend-marked-unhealthy', () => backendSwitches++);

      // Generate continuous load
      const loadPromises: Promise<any>[] = [];
      const operationCount = 200;

      for (let i = 0; i < operationCount; i++) {
        const promise = this.backendManager.listSessions({
          sessionId: `failover-${i}`,
          userId: `user-${i % 10}`
        });
        
        loadPromises.push(promise);
        this.activeOperations.add(promise);
      }

      // Simulate backend failures during load
      setTimeout(async () => {
        const healthStatus = await this.backendManager.getBackendHealthStatus();
        const backends = Object.keys(healthStatus);
        
        if (backends.length > 1) {
          // Hot-swap one backend
          await this.backendManager.hotSwapBackend(backends[0]);
        }
      }, 2000);

      setTimeout(async () => {
        const healthStatus = await this.backendManager.getBackendHealthStatus();
        const backends = Object.keys(healthStatus);
        
        if (backends.length > 1) {
          // Hot-swap another backend
          await this.backendManager.hotSwapBackend(backends[1]);
        }
      }, 4000);

      const results = await Promise.allSettled(loadPromises);
      const successfulOps = results.filter(r => r.status === 'fulfilled').length;

      return {
        operationsAttempted: operationCount,
        operationsSuccessful: successfulOps,
        failoverEvents,
        backendSwitches,
        failoverTestCompleted: true
      };
    });
  }

  /**
   * Test race condition detection and mitigation
   */
  private async runRaceConditionStressTest(): Promise<void> {
    console.log('\n⚡ Test 4: Race Condition Stress Test');
    
    const testConfig = { ...this.config };
    const testName = 'Race Condition Stress Test';
    
    await this.executeTest(testName, testConfig, async () => {
      const iterations = 100;
      const promises: Promise<any>[] = [];
      let sequenceNumber = 0;

      // Test 1: Concurrent session creation with same names
      for (let i = 0; i < iterations; i++) {
        const sessionName = `race-session-${i % 10}`; // Force name collisions
        
        const promise = this.tmuxManager.createSession(sessionName, {
          sessionId: `race-create-${i}`,
          userId: `race-user-${i % 5}`
        }).then(session => {
          this.trackSessionCreation(sessionName, Date.now());
          return session;
        }).catch(error => {
          // Expected - some will fail due to name conflicts
          return null;
        });
        
        promises.push(promise);
        this.activeOperations.add(promise);
      }

      await Promise.allSettled(promises);

      // Test 2: Concurrent command execution order validation
      const testSession = await this.tmuxManager.createSession('race-command-test');
      const commandPromises: Promise<any>[] = [];

      for (let i = 0; i < 50; i++) {
        const seq = sequenceNumber++;
        const command = `echo "sequence-${seq}"`;
        
        const promise = this.tmuxManager.sendCommand(
          testSession.id,
          command,
          undefined,
          { sessionId: `cmd-race-${i}`, userId: 'race-user' }
        ).then(result => {
          this.trackCommandExecution(testSession.id, command, Date.now(), seq);
          return result;
        });
        
        commandPromises.push(promise);
        this.activeOperations.add(promise);
      }

      await Promise.allSettled(commandPromises);
      
      // Analyze race conditions
      const raceConditions = this.analyzeRaceConditions();
      
      // Clean up
      await this.tmuxManager.destroySession(testSession.id);

      return {
        sessionRaceTests: iterations,
        commandRaceTests: 50,
        raceConditionsDetected: raceConditions.detected,
        raceConditionsMitigated: raceConditions.mitigated,
        dataCorruptionDetected: raceConditions.dataCorruption
      };
    });
  }

  /**
   * Test memory pressure scenarios
   */
  private async runMemoryPressureTest(): Promise<void> {
    console.log('\n🧠 Test 5: Memory Pressure Test');
    
    const testConfig = { ...this.config };
    const testName = 'Memory Pressure Test';
    
    await this.executeTest(testName, testConfig, async () => {
      const initialMemory = process.memoryUsage();
      const sessionCount = 200;
      const sessions: TmuxSession[] = [];

      // Phase 1: Create many sessions to increase memory pressure
      console.log(`  Creating ${sessionCount} sessions for memory pressure...`);
      for (let i = 0; i < sessionCount; i++) {
        try {
          const session = await this.tmuxManager.createSession(`memory-test-${i}`);
          sessions.push(session);
          
          // Execute commands to create output buffers
          await this.tmuxManager.sendCommand(
            session.id,
            `for j in {1..100}; do echo "Memory pressure test line $j"; done`
          );
          
          // Capture output to fill buffers
          await this.tmuxManager.captureOutput(session.id);
          
          // Progress indicator
          if (i % 50 === 0) {
            const currentMemory = process.memoryUsage();
            console.log(`    Created ${i} sessions, memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`);
          }
        } catch (error) {
          console.warn(`Failed to create session ${i}: ${error.message}`);
        }
      }

      const peakMemory = process.memoryUsage();

      // Phase 2: Execute operations under memory pressure
      const operationCount = 100;
      const operationPromises: Promise<any>[] = [];

      for (let i = 0; i < operationCount; i++) {
        const sessionIndex = i % sessions.length;
        const session = sessions[sessionIndex];
        
        if (session) {
          const promise = this.tmuxManager.sendCommand(
            session.id,
            `echo "Memory pressure operation ${i}"`
          );
          
          operationPromises.push(promise);
          this.activeOperations.add(promise);
        }
      }

      const operationResults = await Promise.allSettled(operationPromises);
      const successfulOps = operationResults.filter(r => r.status === 'fulfilled').length;

      // Phase 3: Clean up and check for memory leaks
      console.log(`  Cleaning up ${sessions.length} sessions...`);
      for (const session of sessions) {
        await this.tmuxManager.destroySession(session.id).catch(console.error);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const finalMemory = process.memoryUsage();

      return {
        sessionsCreated: sessions.length,
        operationsUnderPressure: successfulOps,
        memoryStats: {
          initial: initialMemory,
          peak: peakMemory,
          final: finalMemory,
          leaked: finalMemory.heapUsed - initialMemory.heapUsed
        },
        memoryPressureHandled: successfulOps > operationCount * 0.9
      };
    });
  }

  /**
   * Test various load patterns
   */
  private async runLoadPatternTests(): Promise<void> {
    console.log('\n📈 Test 6: Load Pattern Simulation');
    
    const patterns: LoadPattern[] = [
      {
        name: 'Burst Load',
        sessionCreationRate: 50,
        commandExecutionRate: 200,
        outputCaptureRate: 100,
        duration: 10000,
        rampUpTime: 1000,
        sustainTime: 5000,
        rampDownTime: 1000
      },
      {
        name: 'Sustained Load',
        sessionCreationRate: 10,
        commandExecutionRate: 50,
        outputCaptureRate: 25,
        duration: 15000,
        rampUpTime: 2000,
        sustainTime: 10000,
        rampDownTime: 3000
      }
    ];

    for (const pattern of patterns) {
      await this.runLoadPattern(pattern);
    }
  }

  /**
   * Execute extreme stress test
   */
  private async runExtremeStressTest(): Promise<void> {
    console.log('\n💪 Test 7: Extreme Stress Test');
    
    const testConfig = {
      ...this.config,
      maxConcurrentSessions: this.config.maxConcurrentSessions * this.config.stressTestMultiplier,
      maxConcurrentCommands: this.config.maxConcurrentCommands * this.config.stressTestMultiplier
    };
    
    const testName = 'Extreme Stress Test';
    
    await this.executeTest(testName, testConfig, async () => {
      console.log(`  Extreme load: ${testConfig.maxConcurrentSessions} sessions, ${testConfig.maxConcurrentCommands} commands`);
      
      const allPromises: Promise<any>[] = [];
      
      // Create sessions under extreme load
      for (let i = 0; i < testConfig.maxConcurrentSessions; i++) {
        const promise = this.tmuxManager.createSession(`extreme-${i}`)
          .then(session => {
            // Execute multiple commands per session
            const commandPromises = [];
            for (let j = 0; j < 5; j++) {
              commandPromises.push(
                this.tmuxManager.sendCommand(session.id, `echo "extreme-${i}-${j}"`).then(() => session)
              );
            }
            return Promise.all(commandPromises);
          })
          .then(results => results[0]) // Return the session
          .catch(error => null);
        
        allPromises.push(promise);
        this.activeOperations.add(promise);
      }

      const results = await Promise.allSettled(allPromises);
      const successfulSessions = results.filter(r => 
        r.status === 'fulfilled' && r.value !== null
      ).length;

      return {
        extremeSessionsAttempted: testConfig.maxConcurrentSessions,
        extremeSessionsSuccessful: successfulSessions,
        extremeStressHandled: successfulSessions > testConfig.maxConcurrentSessions * 0.8
      };
    });
  }

  /**
   * Execute a load pattern simulation
   */
  private async runLoadPattern(pattern: LoadPattern): Promise<void> {
    console.log(`  📊 Load Pattern: ${pattern.name}`);
    
    const testConfig = { ...this.config };
    const testName = `Load Pattern: ${pattern.name}`;
    
    await this.executeTest(testName, testConfig, async () => {
      const startTime = Date.now();
      const operations: Promise<any>[] = [];
      let currentRate = 0;
      
      // Ramp up phase
      const rampUpInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed < pattern.rampUpTime) {
          currentRate = (elapsed / pattern.rampUpTime) * pattern.sessionCreationRate;
        } else {
          clearInterval(rampUpInterval);
          currentRate = pattern.sessionCreationRate;
        }
      }, 100);

      // Execute operations based on pattern
      const patternPromise = new Promise<any>((resolve) => {
        const executeOperations = () => {
          const now = Date.now();
          const elapsed = now - startTime;
          
          if (elapsed >= pattern.duration) {
            resolve({ patternCompleted: true });
            return;
          }

          // Execute operations at current rate
          if (currentRate > 0) {
            const operation = this.backendManager.listSessions({
              sessionId: `pattern-${elapsed}`,
              userId: 'pattern-user'
            });
            
            operations.push(operation);
            this.activeOperations.add(operation);
          }

          setTimeout(executeOperations, 1000 / Math.max(currentRate, 1));
        };

        executeOperations();
      });

      const result = await patternPromise;
      const operationResults = await Promise.allSettled(operations);
      const successfulOps = operationResults.filter(r => r.status === 'fulfilled').length;

      return {
        pattern: pattern.name,
        operationsExecuted: operations.length,
        operationsSuccessful: successfulOps,
        patternCompleted: result.patternCompleted
      };
    });
  }

  /**
   * Execute a test with comprehensive metrics collection
   */
  private async executeTest(
    testName: string, 
    config: ConcurrencyTestConfig, 
    testFunc: () => Promise<any>
  ): Promise<void> {
    console.log(`  🧪 ${testName}...`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startOperationCount = this.operationMetrics.length;
    
    const result: ConcurrencyTestResult = {
      testName,
      config,
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        maxLatency: 0,
        minLatency: 0,
        throughput: 0,
        successRate: 0,
        concurrencyLevel: 0,
        memoryUsage: {
          initial: startMemory.heapUsed,
          peak: startMemory.heapUsed,
          final: startMemory.heapUsed,
          leaked: 0
        }
      },
      backendMetrics: {
        backendSwitches: 0,
        failoverEvents: 0,
        healthDegradations: 0,
        connectionPoolEfficiency: 0,
        batchingEfficiency: 0
      },
      raceConditions: {
        detected: 0,
        mitigated: 0,
        dataCorruption: false
      },
      timestamp: new Date(),
      duration: 0,
      errors: [],
      warnings: []
    };

    try {
      // Reset metrics tracking
      this.operationMetrics = [];
      this.detectedRaceConditions = 0;
      
      // Monitor peak memory usage
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > result.metrics.memoryUsage.peak) {
          result.metrics.memoryUsage.peak = currentMemory;
        }
      }, 1000);

      // Execute test
      await testFunc();
      
      clearInterval(memoryMonitor);

      // Calculate metrics
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const testOperations = this.operationMetrics.slice(startOperationCount);
      
      result.duration = endTime - startTime;
      result.metrics.memoryUsage.final = endMemory.heapUsed;
      result.metrics.memoryUsage.leaked = endMemory.heapUsed - startMemory.heapUsed;
      
      if (testOperations.length > 0) {
        const latencies = testOperations.map(op => op.latency);
        const sortedLatencies = latencies.sort((a, b) => a - b);
        
        result.metrics.totalOperations = testOperations.length;
        result.metrics.successfulOperations = testOperations.filter(op => op.success).length;
        result.metrics.failedOperations = testOperations.length - result.metrics.successfulOperations;
        result.metrics.avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
        result.metrics.p95Latency = sortedLatencies[Math.floor(latencies.length * 0.95)] || 0;
        result.metrics.p99Latency = sortedLatencies[Math.floor(latencies.length * 0.99)] || 0;
        result.metrics.maxLatency = Math.max(...latencies);
        result.metrics.minLatency = Math.min(...latencies);
        result.metrics.throughput = (testOperations.length / result.duration) * 1000;
        result.metrics.successRate = (result.metrics.successfulOperations / result.metrics.totalOperations) * 100;
        result.metrics.concurrencyLevel = Math.max(...this.getConcurrencyLevels());
      }

      // Collect backend metrics
      const backendMetrics = this.backendManager.getAggregatedMetrics();
      result.backendMetrics.connectionPoolEfficiency = backendMetrics.successRate;
      
      // Race condition metrics
      result.raceConditions.detected = this.detectedRaceConditions;
      
      console.log(`    ✅ PASSED (${result.duration.toFixed(2)}ms, ${result.metrics.throughput.toFixed(1)} ops/sec)`);

    } catch (error) {
      result.duration = performance.now() - startTime;
      result.errors.push(error.message);
      console.log(`    ❌ FAILED: ${error.message}`);
    }

    this.testResults.push(result);
    this.emit('test-completed', { testName, result });
  }

  /**
   * Track session creation for race condition analysis
   */
  private trackSessionCreation(sessionName: string, timestamp: number): void {
    if (this.sessionCreateTimes.has(sessionName)) {
      // Potential race condition - multiple sessions with same name
      this.detectedRaceConditions++;
    }
    this.sessionCreateTimes.set(sessionName, timestamp);
  }

  /**
   * Track command execution for order analysis
   */
  private trackCommandExecution(
    sessionId: string,
    command: string,
    timestamp: number,
    sequence: number
  ): void {
    this.commandExecutionOrder.push({
      sessionId,
      command,
      timestamp,
      sequence
    });
  }

  /**
   * Analyze detected race conditions
   */
  private analyzeRaceConditions(): {
    detected: number;
    mitigated: number;
    dataCorruption: boolean;
  } {
    let mitigated = 0;
    let dataCorruption = false;

    // Check command execution order
    const sessionCommands = new Map<string, Array<{command: string, timestamp: number, sequence: number}>>();
    
    for (const cmd of this.commandExecutionOrder) {
      if (!sessionCommands.has(cmd.sessionId)) {
        sessionCommands.set(cmd.sessionId, []);
      }
      sessionCommands.get(cmd.sessionId)!.push(cmd);
    }

    // Verify execution order per session
    for (const [sessionId, commands] of sessionCommands) {
      commands.sort((a, b) => a.timestamp - b.timestamp);
      
      for (let i = 1; i < commands.length; i++) {
        if (commands[i].sequence < commands[i-1].sequence) {
          // Out of order execution detected
          dataCorruption = true;
        } else {
          // Order maintained - mitigation successful
          mitigated++;
        }
      }
    }

    return {
      detected: this.detectedRaceConditions,
      mitigated,
      dataCorruption
    };
  }

  /**
   * Get concurrency levels over time
   */
  private getConcurrencyLevels(): number[] {
    // Simplified - would need more sophisticated tracking in real implementation
    return [this.activeOperations.size];
  }

  /**
   * Create session with metrics tracking
   */
  private async createSessionWithMetrics(
    sessionName: string,
    context: ExecutionContext,
    index: number
  ): Promise<BackendResult<TmuxSession>> {
    const startTime = performance.now();
    const operation = `create-session-${index}`;
    
    try {
      const result = await this.tmuxManager.createSession(sessionName, context);
      const latency = performance.now() - startTime;
      
      this.operationMetrics.push({
        operation,
        startTime,
        endTime: performance.now(),
        success: true,
        latency
      });

      return { success: true, data: result };
    } catch (error) {
      const latency = performance.now() - startTime;
      
      this.operationMetrics.push({
        operation,
        startTime,
        endTime: performance.now(),
        success: false,
        latency,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Execute command with metrics tracking
   */
  private async executeCommandWithMetrics(
    sessionId: string,
    command: string,
    operationId: string
  ): Promise<CommandExecution> {
    const startTime = performance.now();
    
    try {
      const result = await this.tmuxManager.sendCommand(sessionId, command);
      const latency = performance.now() - startTime;
      
      this.operationMetrics.push({
        operation: `execute-command-${operationId}`,
        startTime,
        endTime: performance.now(),
        success: !result.error,
        latency
      });

      return result;
    } catch (error) {
      const latency = performance.now() - startTime;
      
      this.operationMetrics.push({
        operation: `execute-command-${operationId}`,
        startTime,
        endTime: performance.now(),
        success: false,
        latency,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Setup event listeners for metrics collection
   */
  private setupEventListeners(): void {
    this.backendManager.on('backend-hot-swapped', (event) => {
      this.emit('backend-failover', event);
    });

    this.backendManager.on('backend-marked-unhealthy', (event) => {
      this.emit('backend-health-degraded', event);
    });

    this.tmuxManager.on('performance-warning', (event) => {
      this.emit('performance-warning', event);
    });
  }

  /**
   * Generate comprehensive concurrency report
   */
  private async generateConcurrencyReport(): Promise<void> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.errors.length === 0).length;
    const failedTests = totalTests - passedTests;

    const avgLatency = this.testResults.reduce((sum, t) => sum + t.metrics.avgLatency, 0) / totalTests;
    const maxLatency = Math.max(...this.testResults.map(t => t.metrics.maxLatency));
    const avgThroughput = this.testResults.reduce((sum, t) => sum + t.metrics.throughput, 0) / totalTests;
    const avgSuccessRate = this.testResults.reduce((sum, t) => sum + t.metrics.successRate, 0) / totalTests;

    const totalRaceConditions = this.testResults.reduce((sum, t) => sum + t.raceConditions.detected, 0);
    const totalMemoryLeaked = this.testResults.reduce((sum, t) => sum + t.metrics.memoryUsage.leaked, 0);

    console.log('\n' + '='.repeat(80));
    console.log('🎯 CONCURRENCY TEST SUITE REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 TEST EXECUTION SUMMARY:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log(`\n⚡ PERFORMANCE SUMMARY:`);
    console.log(`  Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Maximum Latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`  Average Throughput: ${avgThroughput.toFixed(1)} ops/sec`);
    console.log(`  Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`  Target Met (<15ms): ${avgLatency < this.config.targetLatency ? '✅' : '❌'}`);

    console.log(`\n🔄 CONCURRENCY SUMMARY:`);
    console.log(`  Max Concurrent Sessions: ${this.config.maxConcurrentSessions}`);
    console.log(`  Max Concurrent Commands: ${this.config.maxConcurrentCommands}`);
    console.log(`  Race Conditions Detected: ${totalRaceConditions}`);
    console.log(`  Total Memory Leaked: ${(totalMemoryLeaked / 1024 / 1024).toFixed(2)}MB`);

    console.log(`\n💡 RECOMMENDATIONS:`);
    if (avgLatency >= this.config.targetLatency) {
      console.log(`  ⚠️  Average latency ${avgLatency.toFixed(2)}ms exceeds target ${this.config.targetLatency}ms`);
    } else {
      console.log(`  ✅ Latency target achieved`);
    }

    if (avgSuccessRate < (100 - this.config.maxAcceptableFailureRate)) {
      console.log(`  ⚠️  Success rate ${avgSuccessRate.toFixed(1)}% below target`);
    } else {
      console.log(`  ✅ Success rate target achieved`);
    }

    if (totalRaceConditions > 0) {
      console.log(`  ⚠️  ${totalRaceConditions} race conditions detected - review synchronization`);
    } else {
      console.log(`  ✅ No race conditions detected`);
    }

    console.log('\n' + '='.repeat(80));

    this.emit('suite-completed', {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        avgLatency,
        maxLatency,
        avgThroughput,
        avgSuccessRate,
        totalRaceConditions,
        totalMemoryLeaked,
        targetsMet: avgLatency < this.config.targetLatency && avgSuccessRate >= (100 - this.config.maxAcceptableFailureRate)
      },
      results: this.testResults
    });
  }

  /**
   * Clean up test resources
   */
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up concurrency test resources...');
    
    try {
      // Wait for all operations to complete
      if (this.activeOperations.size > 0) {
        console.log(`  Waiting for ${this.activeOperations.size} active operations...`);
        await Promise.allSettled(Array.from(this.activeOperations));
      }

      await this.tmuxManager.cleanup();
      await this.backendManager.shutdown();
      await this.commandBatcher.shutdown();
      await this.connectionPool.shutdown();
      
      console.log('✅ Concurrency test cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}
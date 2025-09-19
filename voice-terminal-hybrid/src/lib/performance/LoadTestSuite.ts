/**
 * Enterprise Load Testing Suite
 * Comprehensive testing framework for 10,000+ concurrent users with realistic scenarios
 * 
 * TEST TARGETS:
 * - Concurrent Users: 10,000+ simultaneous connections
 * - System Throughput: 10,000+ commands/second
 * - Memory Under Load: <50MB per 1000 sessions
 * - CPU Under Load: <20% for 1000 users
 * - Response Time: P99 <100ms under full load
 * - Error Rate: <0.1% under normal load
 */

import { AdvancedOptimizer } from './AdvancedOptimizer.js';
import type { TerminalWebSocketClient } from '../websocket/TerminalWebSocketClient.js';

// Load test configuration
interface LoadTestConfig {
  // User simulation
  maxConcurrentUsers: number;
  rampUpDuration: number;        // Seconds to reach max users
  testDuration: number;          // Total test duration in seconds
  rampDownDuration: number;      // Seconds to wind down
  
  // Traffic patterns
  userProfiles: UserProfile[];
  commandDistribution: CommandDistribution;
  sessionBehavior: SessionBehavior;
  
  // Performance thresholds
  thresholds: PerformanceThresholds;
  
  // Test scenarios
  scenarios: LoadTestScenario[];
  
  // Monitoring
  metricsCollection: MetricsConfig;
  realTimeMonitoring: boolean;
}

interface UserProfile {
  name: string;
  percentage: number;           // Percentage of total users
  commandsPerMinute: number;    // Average commands per minute
  sessionDuration: number;      // Average session duration in minutes
  thinkTime: number;           // Pause between commands in seconds
  commands: string[];          // Command types this profile uses
}

interface CommandDistribution {
  simple: number;              // echo, pwd, ls (70%)
  medium: number;              // grep, find, ps (20%)
  complex: number;             // large outputs, file operations (10%)
}

interface SessionBehavior {
  averageSessionDuration: number;
  sessionVariability: number;    // Standard deviation
  reconnectionRate: number;      // Percentage of users who reconnect
  concurrentSessions: number;    // Sessions per user
}

interface PerformanceThresholds {
  maxResponseTime: number;       // P99 response time threshold
  maxErrorRate: number;          // Maximum acceptable error rate
  maxMemoryPerSession: number;   // Memory threshold per session
  maxCpuUsage: number;          // CPU usage threshold
  minThroughput: number;        // Minimum commands/second
}

interface LoadTestScenario {
  name: string;
  description: string;
  duration: number;
  users: number;
  profile: string;
  stressType: 'sustained' | 'burst' | 'spike' | 'gradual' | 'chaos';
  customConfig?: Partial<LoadTestConfig>;
}

interface MetricsConfig {
  interval: number;             // Collection interval in milliseconds
  retention: number;            // How long to keep metrics in memory
  aggregation: 'raw' | 'bucketed' | 'sampled';
  exportFormat: 'json' | 'csv' | 'prometheus';
}

// Test execution and results
interface TestExecution {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'starting' | 'ramping-up' | 'running' | 'ramping-down' | 'completed' | 'failed';
  currentUsers: number;
  totalCommands: number;
  errors: number;
  scenario: LoadTestScenario;
}

interface VirtualUser {
  id: string;
  profile: UserProfile;
  client: TerminalWebSocketClient | null;
  sessionId: string;
  startTime: Date;
  lastCommand: Date;
  commandCount: number;
  errorCount: number;
  isActive: boolean;
  currentThinkTime: number;
}

interface LoadTestMetrics {
  timestamp: Date;
  activeUsers: number;
  commandsPerSecond: number;
  responseTimes: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    mean: number;
  };
  errorRate: number;
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    connectionCount: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
  };
}

interface LoadTestReport {
  execution: TestExecution;
  metrics: LoadTestMetrics[];
  summary: {
    duration: number;
    totalUsers: number;
    totalCommands: number;
    totalErrors: number;
    averageResponseTime: number;
    peakThroughput: number;
    thresholdViolations: string[];
    recommendations: string[];
  };
  performance: {
    memoryEfficiency: number;
    cpuEfficiency: number;
    networkEfficiency: number;
    cacheEfficiency: number;
  };
}

/**
 * Enterprise-grade load testing suite for terminal system
 */
export class LoadTestSuite {
  private config: LoadTestConfig;
  private optimizer: AdvancedOptimizer;
  
  // Test execution state
  private currentExecution: TestExecution | null = null;
  private virtualUsers = new Map<string, VirtualUser>();
  private userQueue: VirtualUser[] = [];
  
  // Metrics collection
  private metrics: LoadTestMetrics[] = [];
  private metricsInterval: number | null = null;
  
  // Real-time monitoring
  private realtimeCallbacks: ((metrics: LoadTestMetrics) => void)[] = [];
  
  // User simulation timers
  private userTimers = new Map<string, number>();
  private rampTimers: number[] = [];

  constructor(config: Partial<LoadTestConfig> = {}, optimizer?: AdvancedOptimizer) {
    this.config = {
      maxConcurrentUsers: 10000,
      rampUpDuration: 300,       // 5 minutes
      testDuration: 1800,        // 30 minutes
      rampDownDuration: 180,     // 3 minutes
      
      userProfiles: [
        {
          name: 'Light User',
          percentage: 50,
          commandsPerMinute: 2,
          sessionDuration: 15,
          thinkTime: 30,
          commands: ['echo', 'pwd', 'ls']
        },
        {
          name: 'Moderate User',
          percentage: 30,
          commandsPerMinute: 5,
          sessionDuration: 30,
          thinkTime: 12,
          commands: ['echo', 'pwd', 'ls', 'ps', 'grep', 'find']
        },
        {
          name: 'Power User',
          percentage: 15,
          commandsPerMinute: 10,
          sessionDuration: 60,
          thinkTime: 6,
          commands: ['echo', 'pwd', 'ls', 'ps', 'grep', 'find', 'cat', 'tail', 'top']
        },
        {
          name: 'Heavy User',
          percentage: 5,
          commandsPerMinute: 20,
          sessionDuration: 120,
          thinkTime: 3,
          commands: ['echo', 'pwd', 'ls', 'ps', 'grep', 'find', 'cat', 'tail', 'top', 'du', 'df', 'netstat']
        }
      ],
      
      commandDistribution: {
        simple: 0.7,
        medium: 0.2,
        complex: 0.1
      },
      
      sessionBehavior: {
        averageSessionDuration: 45,
        sessionVariability: 15,
        reconnectionRate: 0.05,
        concurrentSessions: 1.2
      },
      
      thresholds: {
        maxResponseTime: 100,      // 100ms P99
        maxErrorRate: 0.001,       // 0.1%
        maxMemoryPerSession: 50 * 1024, // 50KB
        maxCpuUsage: 20,          // 20%
        minThroughput: 10000      // 10K commands/second
      },
      
      scenarios: [
        {
          name: 'Sustained Load',
          description: 'Constant load at target capacity',
          duration: 1800,
          users: 10000,
          profile: 'mixed',
          stressType: 'sustained'
        },
        {
          name: 'Burst Load',
          description: 'Sudden spike to maximum capacity',
          duration: 600,
          users: 15000,
          profile: 'heavy',
          stressType: 'burst'
        },
        {
          name: 'Gradual Ramp',
          description: 'Slow increase to test scaling',
          duration: 3600,
          users: 20000,
          profile: 'mixed',
          stressType: 'gradual'
        }
      ],
      
      metricsCollection: {
        interval: 1000,           // 1 second
        retention: 7200000,       // 2 hours
        aggregation: 'bucketed',
        exportFormat: 'json'
      },
      
      realTimeMonitoring: true,
      ...config
    };

    this.optimizer = optimizer || new AdvancedOptimizer();
  }

  /**
   * Run comprehensive load test suite
   */
  async runFullTestSuite(): Promise<LoadTestReport[]> {
    console.log('🚀 Starting Enterprise Load Test Suite...');
    
    const reports: LoadTestReport[] = [];
    
    // Initialize optimizer
    await this.optimizer.initialize();
    
    // Run each scenario
    for (const scenario of this.config.scenarios) {
      console.log(`\n📊 Running scenario: ${scenario.name}`);
      const report = await this.runScenario(scenario);
      reports.push(report);
      
      // Break between scenarios for system recovery
      if (scenario !== this.config.scenarios[this.config.scenarios.length - 1]) {
        console.log('⏸️ Cooling down between scenarios...');
        await this.sleep(60000); // 1 minute break
      }
    }
    
    console.log('\n✅ Load test suite completed');
    return reports;
  }

  /**
   * Run specific load test scenario
   */
  async runScenario(scenario: LoadTestScenario): Promise<LoadTestReport> {
    // Merge scenario config with base config
    const testConfig = scenario.customConfig 
      ? { ...this.config, ...scenario.customConfig }
      : this.config;
    
    // Create test execution record
    const execution: TestExecution = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      status: 'starting',
      currentUsers: 0,
      totalCommands: 0,
      errors: 0,
      scenario
    };
    
    this.currentExecution = execution;
    
    try {
      // Start metrics collection
      await this.startMetricsCollection();
      
      // Execute test phases
      execution.status = 'ramping-up';
      await this.rampUpUsers(scenario, testConfig);
      
      execution.status = 'running';
      await this.maintainLoad(scenario, testConfig);
      
      execution.status = 'ramping-down';
      await this.rampDownUsers(testConfig);
      
      execution.status = 'completed';
      execution.endTime = new Date();
      
      // Stop metrics collection
      await this.stopMetricsCollection();
      
      // Generate report
      return this.generateReport(execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      console.error('Load test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Run quick validation test
   */
  async runQuickValidation(): Promise<LoadTestReport> {
    const quickScenario: LoadTestScenario = {
      name: 'Quick Validation',
      description: 'Fast validation test with 1000 users',
      duration: 300,           // 5 minutes
      users: 1000,
      profile: 'mixed',
      stressType: 'sustained',
      customConfig: {
        rampUpDuration: 60,    // 1 minute
        rampDownDuration: 30   // 30 seconds
      }
    };
    
    return this.runScenario(quickScenario);
  }

  /**
   * Add real-time monitoring callback
   */
  onMetricsUpdate(callback: (metrics: LoadTestMetrics) => void): void {
    this.realtimeCallbacks.push(callback);
  }

  /**
   * Get current test status
   */
  getCurrentStatus(): TestExecution | null {
    return this.currentExecution;
  }

  /**
   * Stop current test
   */
  async stopTest(): Promise<void> {
    if (this.currentExecution) {
      this.currentExecution.status = 'ramping-down';
      await this.rampDownUsers(this.config);
      await this.cleanup();
    }
  }

  /**
   * Ramp up users according to scenario
   */
  private async rampUpUsers(scenario: LoadTestScenario, config: LoadTestConfig): Promise<void> {
    const targetUsers = scenario.users;
    const rampDuration = config.rampUpDuration * 1000; // Convert to milliseconds
    const userInterval = rampDuration / targetUsers;
    
    console.log(`📈 Ramping up to ${targetUsers} users over ${config.rampUpDuration} seconds`);
    
    let usersCreated = 0;
    
    const createUser = async () => {
      if (usersCreated >= targetUsers) return;
      
      const profile = this.selectUserProfile(config.userProfiles);
      const user = await this.createVirtualUser(profile);
      
      if (user) {
        this.virtualUsers.set(user.id, user);
        this.startUserSimulation(user);
        usersCreated++;
        
        if (this.currentExecution) {
          this.currentExecution.currentUsers = usersCreated;
        }
        
        // Progress indicator
        if (usersCreated % Math.floor(targetUsers / 10) === 0) {
          const progress = Math.round((usersCreated / targetUsers) * 100);
          console.log(`  Progress: ${progress}% (${usersCreated}/${targetUsers} users)`);
        }
      }
      
      // Schedule next user creation
      if (usersCreated < targetUsers) {
        const timer = setTimeout(createUser, userInterval);
        this.rampTimers.push(timer);
      }
    };
    
    // Start creating users
    createUser();
    
    // Wait for ramp-up to complete
    await this.sleep(rampDuration);
    
    console.log(`✅ Ramp-up completed: ${usersCreated} users active`);
  }

  /**
   * Maintain load during test duration
   */
  private async maintainLoad(scenario: LoadTestScenario, config: LoadTestConfig): Promise<void> {
    const testDuration = scenario.duration * 1000;
    console.log(`⏱️ Maintaining load for ${scenario.duration} seconds`);
    
    const startTime = Date.now();
    
    // Monitor and maintain user count
    const maintainInterval = setInterval(() => {
      this.maintainUserCount(scenario.users, config);
      this.checkThresholds(config.thresholds);
    }, 10000); // Check every 10 seconds
    
    // Wait for test duration
    await this.sleep(testDuration);
    
    clearInterval(maintainInterval);
    console.log('✅ Load maintenance completed');
  }

  /**
   * Ramp down users
   */
  private async rampDownUsers(config: LoadTestConfig): Promise<void> {
    const rampDuration = config.rampDownDuration * 1000;
    const totalUsers = this.virtualUsers.size;
    
    if (totalUsers === 0) return;
    
    console.log(`📉 Ramping down ${totalUsers} users over ${config.rampDownDuration} seconds`);
    
    const userInterval = rampDuration / totalUsers;
    const users = Array.from(this.virtualUsers.values());
    
    let usersRemoved = 0;
    
    const removeUser = async () => {
      if (usersRemoved >= users.length) return;
      
      const user = users[usersRemoved];
      await this.removeVirtualUser(user);
      usersRemoved++;
      
      if (this.currentExecution) {
        this.currentExecution.currentUsers = totalUsers - usersRemoved;
      }
      
      // Schedule next user removal
      if (usersRemoved < users.length) {
        const timer = setTimeout(removeUser, userInterval);
        this.rampTimers.push(timer);
      }
    };
    
    // Start removing users
    removeUser();
    
    // Wait for ramp-down to complete
    await this.sleep(rampDuration);
    
    console.log('✅ Ramp-down completed');
  }

  /**
   * Create virtual user
   */
  private async createVirtualUser(profile: UserProfile): Promise<VirtualUser | null> {
    try {
      // Create WebSocket client
      const client = new (await import('../websocket/TerminalWebSocketClient.js')).TerminalWebSocketClient({
        url: 'ws://localhost:8080/terminal',
        timeout: 10000,
        reconnectInterval: 5000,
        maxReconnectAttempts: 3
      });
      
      // Register with optimizer
      this.optimizer.registerWebSocketClient(client);
      
      // Connect
      await client.connect();
      
      // Create session
      const sessions = await client.listSessions();
      let sessionId = sessions.length > 0 ? sessions[0].id : `session-${Date.now()}`;
      
      const user: VirtualUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        profile,
        client,
        sessionId,
        startTime: new Date(),
        lastCommand: new Date(),
        commandCount: 0,
        errorCount: 0,
        isActive: true,
        currentThinkTime: this.calculateThinkTime(profile.thinkTime)
      };
      
      return user;
      
    } catch (error) {
      console.error('Failed to create virtual user:', error);
      return null;
    }
  }

  /**
   * Remove virtual user
   */
  private async removeVirtualUser(user: VirtualUser): Promise<void> {
    user.isActive = false;
    
    // Clear user timer
    const timer = this.userTimers.get(user.id);
    if (timer) {
      clearTimeout(timer);
      this.userTimers.delete(user.id);
    }
    
    // Disconnect client
    if (user.client) {
      this.optimizer.unregisterWebSocketClient(user.client);
      user.client.disconnect();
    }
    
    // Remove from map
    this.virtualUsers.delete(user.id);
  }

  /**
   * Start user command simulation
   */
  private startUserSimulation(user: VirtualUser): void {
    if (!user.isActive || !user.client?.isConnected()) {
      return;
    }
    
    const executeCommand = async () => {
      if (!user.isActive) return;
      
      try {
        // Select and execute command
        const command = this.selectCommand(user.profile);
        const startTime = performance.now();
        
        await this.optimizer.executeOptimizedCommand(
          user.id,
          user.sessionId,
          command,
          { priority: 'normal' }
        );
        
        const responseTime = performance.now() - startTime;
        
        // Update user statistics
        user.commandCount++;
        user.lastCommand = new Date();
        
        // Update test statistics
        if (this.currentExecution) {
          this.currentExecution.totalCommands++;
        }
        
        // Record metrics
        this.recordCommandMetrics(responseTime, true);
        
        // Schedule next command
        user.currentThinkTime = this.calculateThinkTime(user.profile.thinkTime);
        const timer = setTimeout(executeCommand, user.currentThinkTime * 1000);
        this.userTimers.set(user.id, timer);
        
      } catch (error) {
        user.errorCount++;
        if (this.currentExecution) {
          this.currentExecution.errors++;
        }
        
        this.recordCommandMetrics(0, false);
        
        // Continue simulation even after error
        const timer = setTimeout(executeCommand, user.currentThinkTime * 1000);
        this.userTimers.set(user.id, timer);
      }
    };
    
    // Start command execution
    const initialDelay = Math.random() * user.profile.thinkTime * 1000;
    const timer = setTimeout(executeCommand, initialDelay);
    this.userTimers.set(user.id, timer);
  }

  /**
   * Select user profile based on distribution
   */
  private selectUserProfile(profiles: UserProfile[]): UserProfile {
    const random = Math.random();
    let cumulative = 0;
    
    for (const profile of profiles) {
      cumulative += profile.percentage / 100;
      if (random <= cumulative) {
        return profile;
      }
    }
    
    return profiles[profiles.length - 1]; // Fallback
  }

  /**
   * Select command for user profile
   */
  private selectCommand(profile: UserProfile): string {
    const commands = profile.commands;
    const randomIndex = Math.floor(Math.random() * commands.length);
    
    // Add some complexity based on command distribution
    const baseCommand = commands[randomIndex];
    const complexity = Math.random();
    
    if (complexity < this.config.commandDistribution.simple) {
      return baseCommand;
    } else if (complexity < this.config.commandDistribution.simple + this.config.commandDistribution.medium) {
      return `${baseCommand} | head -20`;
    } else {
      return `${baseCommand} && echo "complex operation" && sleep 0.1`;
    }
  }

  /**
   * Calculate think time with variation
   */
  private calculateThinkTime(baseThinkTime: number): number {
    // Add ±25% variation
    const variation = (Math.random() - 0.5) * 0.5;
    return Math.max(1, baseThinkTime * (1 + variation));
  }

  /**
   * Maintain user count during test
   */
  private maintainUserCount(targetUsers: number, config: LoadTestConfig): void {
    const currentUsers = this.virtualUsers.size;
    
    if (currentUsers < targetUsers * 0.95) { // Maintain at least 95% of target
      const usersToAdd = Math.floor((targetUsers - currentUsers) / 10); // Add 10% of deficit
      
      for (let i = 0; i < usersToAdd; i++) {
        const profile = this.selectUserProfile(config.userProfiles);
        this.createVirtualUser(profile).then(user => {
          if (user) {
            this.virtualUsers.set(user.id, user);
            this.startUserSimulation(user);
          }
        });
      }
    }
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(thresholds: PerformanceThresholds): void {
    const currentMetrics = this.getCurrentMetrics();
    
    if (currentMetrics.responseTimes.p99 > thresholds.maxResponseTime) {
      console.warn(`⚠️ P99 response time exceeded: ${currentMetrics.responseTimes.p99}ms > ${thresholds.maxResponseTime}ms`);
    }
    
    if (currentMetrics.errorRate > thresholds.maxErrorRate) {
      console.warn(`⚠️ Error rate exceeded: ${currentMetrics.errorRate} > ${thresholds.maxErrorRate}`);
    }
    
    if (currentMetrics.system.cpuUsage > thresholds.maxCpuUsage) {
      console.warn(`⚠️ CPU usage exceeded: ${currentMetrics.system.cpuUsage}% > ${thresholds.maxCpuUsage}%`);
    }
  }

  /**
   * Start metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    this.metricsInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);
      
      // Notify real-time callbacks
      for (const callback of this.realtimeCallbacks) {
        callback(metrics);
      }
      
      // Limit metrics retention
      const maxMetrics = Math.floor(this.config.metricsCollection.retention / this.config.metricsCollection.interval);
      if (this.metrics.length > maxMetrics) {
        this.metrics.shift();
      }
      
    }, this.config.metricsCollection.interval);
  }

  /**
   * Stop metrics collection
   */
  private async stopMetricsCollection(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): LoadTestMetrics {
    return this.getCurrentMetrics();
  }

  /**
   * Get current system metrics
   */
  private getCurrentMetrics(): LoadTestMetrics {
    const now = new Date();
    const activeUsers = Array.from(this.virtualUsers.values()).filter(u => u.isActive).length;
    
    // Calculate response times from recent data
    const recentMetrics = this.metrics.slice(-60); // Last minute
    const responseTimes = recentMetrics.length > 0 
      ? this.calculateResponseTimePercentiles(recentMetrics)
      : { p50: 0, p90: 0, p95: 0, p99: 0, mean: 0 };
    
    // Calculate error rate
    const totalCommands = this.currentExecution?.totalCommands || 0;
    const totalErrors = this.currentExecution?.errors || 0;
    const errorRate = totalCommands > 0 ? totalErrors / totalCommands : 0;
    
    // Get system metrics from optimizer
    const optimizerMetrics = this.optimizer.getCurrentMetrics();
    
    return {
      timestamp: now,
      activeUsers,
      commandsPerSecond: this.calculateCommandsPerSecond(),
      responseTimes,
      errorRate,
      throughput: {
        messagesPerSecond: optimizerMetrics.throughput.messagesPerSecond,
        bytesPerSecond: optimizerMetrics.throughput.bytesPerSecond
      },
      system: {
        memoryUsage: optimizerMetrics.memory.heapUsed,
        cpuUsage: optimizerMetrics.cpu.usage,
        connectionCount: optimizerMetrics.connections.active
      },
      cache: {
        hitRate: optimizerMetrics.cache.hitRate,
        missRate: optimizerMetrics.cache.missRate
      }
    };
  }

  /**
   * Calculate commands per second
   */
  private calculateCommandsPerSecond(): number {
    const recentMetrics = this.metrics.slice(-10); // Last 10 seconds
    if (recentMetrics.length < 2) return 0;
    
    const startTime = recentMetrics[0].timestamp.getTime();
    const endTime = recentMetrics[recentMetrics.length - 1].timestamp.getTime();
    const duration = (endTime - startTime) / 1000; // seconds
    
    const commandsInPeriod = recentMetrics.reduce((sum, m) => sum + m.commandsPerSecond, 0);
    return duration > 0 ? commandsInPeriod / duration : 0;
  }

  /**
   * Calculate response time percentiles
   */
  private calculateResponseTimePercentiles(metrics: LoadTestMetrics[]): {
    p50: number; p90: number; p95: number; p99: number; mean: number;
  } {
    // In a real implementation, this would aggregate actual response times
    // For simulation, derive from existing metrics
    const times = metrics.map(m => m.responseTimes.mean).filter(t => t > 0);
    if (times.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, mean: 0 };
    
    times.sort((a, b) => a - b);
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    
    return {
      p50: times[Math.floor(times.length * 0.5)] || 0,
      p90: times[Math.floor(times.length * 0.9)] || 0,
      p95: times[Math.floor(times.length * 0.95)] || 0,
      p99: times[Math.floor(times.length * 0.99)] || 0,
      mean
    };
  }

  /**
   * Record command execution metrics
   */
  private recordCommandMetrics(responseTime: number, success: boolean): void {
    // This would record individual command metrics for aggregation
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(execution: TestExecution): LoadTestReport {
    const duration = execution.endTime 
      ? (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
      : 0;
    
    const totalCommands = execution.totalCommands;
    const totalErrors = execution.errors;
    const errorRate = totalCommands > 0 ? totalErrors / totalCommands : 0;
    
    // Calculate summary statistics
    const responseTimes = this.metrics.map(m => m.responseTimes.mean).filter(t => t > 0);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;
    
    const throughputs = this.metrics.map(m => m.commandsPerSecond);
    const peakThroughput = Math.max(...throughputs, 0);
    
    // Check threshold violations
    const thresholdViolations: string[] = [];
    const finalMetrics = this.metrics[this.metrics.length - 1];
    
    if (finalMetrics) {
      if (finalMetrics.responseTimes.p99 > this.config.thresholds.maxResponseTime) {
        thresholdViolations.push(`P99 response time: ${finalMetrics.responseTimes.p99}ms > ${this.config.thresholds.maxResponseTime}ms`);
      }
      if (errorRate > this.config.thresholds.maxErrorRate) {
        thresholdViolations.push(`Error rate: ${(errorRate * 100).toFixed(2)}% > ${(this.config.thresholds.maxErrorRate * 100).toFixed(2)}%`);
      }
      if (finalMetrics.system.cpuUsage > this.config.thresholds.maxCpuUsage) {
        thresholdViolations.push(`CPU usage: ${finalMetrics.system.cpuUsage}% > ${this.config.thresholds.maxCpuUsage}%`);
      }
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(thresholdViolations, finalMetrics);
    
    return {
      execution,
      metrics: this.metrics,
      summary: {
        duration,
        totalUsers: execution.scenario.users,
        totalCommands,
        totalErrors,
        averageResponseTime,
        peakThroughput,
        thresholdViolations,
        recommendations
      },
      performance: {
        memoryEfficiency: this.calculateMemoryEfficiency(),
        cpuEfficiency: this.calculateCpuEfficiency(),
        networkEfficiency: this.calculateNetworkEfficiency(),
        cacheEfficiency: finalMetrics?.cache.hitRate || 0
      }
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(violations: string[], metrics: LoadTestMetrics | undefined): string[] {
    const recommendations: string[] = [];
    
    if (violations.length === 0) {
      recommendations.push('✅ All performance thresholds met - system performing optimally');
    } else {
      recommendations.push('❌ Performance thresholds violated - optimization needed');
    }
    
    if (metrics) {
      if (metrics.cache.hitRate < 0.8) {
        recommendations.push('🔄 Cache hit rate below 80% - consider increasing cache size or TTL');
      }
      
      if (metrics.system.cpuUsage > 80) {
        recommendations.push('🔄 High CPU usage - consider horizontal scaling or optimization');
      }
      
      if (metrics.responseTimes.p99 > 50) {
        recommendations.push('⚡ P99 latency high - enable performance mode and increase connection pooling');
      }
      
      if (metrics.errorRate > 0.005) {
        recommendations.push('🔧 Error rate elevated - investigate connection stability and timeout settings');
      }
    }
    
    return recommendations;
  }

  /**
   * Calculate efficiency metrics
   */
  private calculateMemoryEfficiency(): number {
    const avgMemory = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.system.memoryUsage, 0) / this.metrics.length
      : 0;
    const avgUsers = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.activeUsers, 0) / this.metrics.length
      : 1;
    
    const memoryPerUser = avgUsers > 0 ? avgMemory / avgUsers : 0;
    return Math.max(0, 1 - (memoryPerUser / this.config.thresholds.maxMemoryPerSession));
  }

  private calculateCpuEfficiency(): number {
    const avgCpu = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.system.cpuUsage, 0) / this.metrics.length
      : 0;
    return Math.max(0, 1 - (avgCpu / 100));
  }

  private calculateNetworkEfficiency(): number {
    const avgThroughput = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.throughput.bytesPerSecond, 0) / this.metrics.length
      : 0;
    const avgUsers = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.activeUsers, 0) / this.metrics.length
      : 1;
    
    const throughputPerUser = avgUsers > 0 ? avgThroughput / avgUsers : 0;
    const targetThroughputPerUser = 10 * 1024; // 10KB/s per user
    return Math.min(1, targetThroughputPerUser / Math.max(throughputPerUser, 1));
  }

  /**
   * Cleanup test resources
   */
  private async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.userTimers.values()) {
      clearTimeout(timer);
    }
    this.userTimers.clear();
    
    for (const timer of this.rampTimers) {
      clearTimeout(timer);
    }
    this.rampTimers = [];
    
    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    // Remove all virtual users
    const users = Array.from(this.virtualUsers.values());
    for (const user of users) {
      await this.removeVirtualUser(user);
    }
    
    // Clear current execution
    this.currentExecution = null;
    
    console.log('🧹 Load test cleanup completed');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export test results
   */
  async exportResults(report: LoadTestReport, format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else {
      // CSV export implementation
      const csvLines = ['timestamp,activeUsers,commandsPerSecond,responseTime,errorRate,memoryUsage,cpuUsage'];
      
      for (const metric of report.metrics) {
        csvLines.push([
          metric.timestamp.toISOString(),
          metric.activeUsers,
          metric.commandsPerSecond,
          metric.responseTimes.mean,
          metric.errorRate,
          metric.system.memoryUsage,
          metric.system.cpuUsage
        ].join(','));
      }
      
      return csvLines.join('\n');
    }
  }

  /**
   * Print test report
   */
  printReport(report: LoadTestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 LOAD TEST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 TEST: ${report.execution.scenario.name}`);
    console.log(`  Description: ${report.execution.scenario.description}`);
    console.log(`  Duration: ${report.summary.duration.toFixed(0)} seconds`);
    console.log(`  Users: ${report.summary.totalUsers.toLocaleString()}`);
    console.log(`  Status: ${report.execution.status}`);
    
    console.log(`\n📈 PERFORMANCE SUMMARY:`);
    console.log(`  Total Commands: ${report.summary.totalCommands.toLocaleString()}`);
    console.log(`  Total Errors: ${report.summary.totalErrors.toLocaleString()}`);
    console.log(`  Error Rate: ${(report.summary.totalErrors / Math.max(report.summary.totalCommands, 1) * 100).toFixed(3)}%`);
    console.log(`  Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`  Peak Throughput: ${report.summary.peakThroughput.toFixed(0)} commands/sec`);
    
    console.log(`\n⚡ EFFICIENCY METRICS:`);
    console.log(`  Memory Efficiency: ${(report.performance.memoryEfficiency * 100).toFixed(1)}%`);
    console.log(`  CPU Efficiency: ${(report.performance.cpuEfficiency * 100).toFixed(1)}%`);
    console.log(`  Network Efficiency: ${(report.performance.networkEfficiency * 100).toFixed(1)}%`);
    console.log(`  Cache Efficiency: ${(report.performance.cacheEfficiency * 100).toFixed(1)}%`);
    
    if (report.summary.thresholdViolations.length > 0) {
      console.log(`\n❌ THRESHOLD VIOLATIONS:`);
      for (const violation of report.summary.thresholdViolations) {
        console.log(`  ${violation}`);
      }
    }
    
    console.log(`\n💡 RECOMMENDATIONS:`);
    for (const recommendation of report.summary.recommendations) {
      console.log(`  ${recommendation}`);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}
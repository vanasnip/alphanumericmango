#!/usr/bin/env node

import { TmuxIntegration } from './TmuxIntegration';
import { performance } from 'perf_hooks';

interface ConcurrencyTestResult {
  testName: string;
  passed: boolean;
  raceCondition?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: string;
  metrics?: {
    executionTime: number;
    successfulOperations: number;
    failedOperations: number;
    dataCorruption: boolean;
  };
}

export class TmuxConcurrencyTests {
  private integrations: TmuxIntegration[] = [];
  private results: ConcurrencyTestResult[] = [];

  constructor(instanceCount: number = 5) {
    for (let i = 0; i < instanceCount; i++) {
      this.integrations.push(new TmuxIntegration({
        performanceMode: 'reliability',
        commandTimeout: 10000
      }));
    }
  }

  async runConcurrencyTestSuite(): Promise<ConcurrencyTestResult[]> {
    console.log('🔀 Running tmux Concurrency Test Suite...\n');
    
    // Initialize all integrations
    await Promise.all(this.integrations.map(integration => integration.initialize()));

    // Test concurrent session creation
    await this.testConcurrentSessionCreation();
    
    // Test concurrent command execution
    await this.testConcurrentCommandExecution();
    
    // Test command queue corruption
    await this.testCommandQueueIntegrity();
    
    // Test session state corruption
    await this.testSessionStateCorruption();
    
    // Test output buffer conflicts
    await this.testOutputBufferConflicts();
    
    // Test rapid session switching
    await this.testRapidSessionSwitching();
    
    // Test concurrent cleanup operations
    await this.testConcurrentCleanup();
    
    // Test resource contention
    await this.testResourceContention();

    // Cleanup all integrations
    await Promise.all(this.integrations.map(integration => integration.cleanup()));
    
    return this.results;
  }

  private async testConcurrentSessionCreation(): Promise<void> {
    console.log('Testing concurrent session creation...');
    
    const sessionPromises: Promise<any>[] = [];
    const createdSessions: string[] = [];
    const errors: Error[] = [];
    
    const startTime = performance.now();
    
    // Create sessions concurrently from multiple integrations
    for (let i = 0; i < this.integrations.length; i++) {
      for (let j = 0; j < 5; j++) {
        const sessionName = `concurrent-session-${i}-${j}`;
        const promise = this.integrations[i].createSession(sessionName)
          .then(session => {
            createdSessions.push(session.id);
          })
          .catch(error => {
            errors.push(error);
          });
        sessionPromises.push(promise);
      }
    }
    
    await Promise.all(sessionPromises);
    const executionTime = performance.now() - startTime;
    
    // Check for duplicate session IDs (race condition indicator)
    const uniqueSessions = new Set(createdSessions);
    const hasDuplicates = uniqueSessions.size !== createdSessions.length;
    
    // Check if all integrations can see all sessions
    const allSessions = this.integrations[0].getSessions();
    const sessionVisibilityCorrect = allSessions.length >= createdSessions.length;
    
    this.results.push({
      testName: 'Concurrent Session Creation',
      passed: !hasDuplicates && sessionVisibilityCorrect && errors.length === 0,
      raceCondition: hasDuplicates ? 'Duplicate session IDs generated' : 
                    !sessionVisibilityCorrect ? 'Session visibility inconsistency' : undefined,
      severity: 'critical',
      details: `Created ${createdSessions.length} sessions, Duplicates: ${hasDuplicates}, Errors: ${errors.length}`,
      metrics: {
        executionTime,
        successfulOperations: createdSessions.length,
        failedOperations: errors.length,
        dataCorruption: hasDuplicates
      }
    });
  }

  private async testConcurrentCommandExecution(): Promise<void> {
    console.log('Testing concurrent command execution...');
    
    // Create a shared session
    const sharedSession = await this.integrations[0].createSession('shared-concurrent-session');
    
    const commandPromises: Promise<any>[] = [];
    const results: any[] = [];
    const errors: Error[] = [];
    
    const startTime = performance.now();
    
    // Execute commands concurrently on the same session
    for (let i = 0; i < this.integrations.length; i++) {
      for (let j = 0; j < 10; j++) {
        const command = `echo "Integration-${i}-Command-${j}-${Date.now()}"`;
        const promise = this.integrations[i].executeCommand(command, sharedSession.id)
          .then(result => {
            results.push(result);
          })
          .catch(error => {
            errors.push(error);
          });
        commandPromises.push(promise);
      }
    }
    
    await Promise.all(commandPromises);
    const executionTime = performance.now() - startTime;
    
    // Check for command execution order consistency
    const executionTimes = results
      .filter(r => r.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const hasOrderingIssues = executionTimes.some((result, index) => {
      if (index === 0) return false;
      return result.timestamp < executionTimes[index - 1].timestamp;
    });
    
    // Check for output corruption
    const output = await this.integrations[0].getOutput(100, sharedSession.id);
    const outputLines = output.split('\n').filter(line => line.includes('Integration-'));
    const expectedLines = results.length;
    const hasOutputCorruption = outputLines.length !== expectedLines;
    
    this.results.push({
      testName: 'Concurrent Command Execution',
      passed: !hasOrderingIssues && !hasOutputCorruption && errors.length === 0,
      raceCondition: hasOrderingIssues ? 'Command execution ordering issues' : 
                    hasOutputCorruption ? 'Output corruption detected' : undefined,
      severity: 'high',
      details: `Executed ${results.length} commands, Ordering issues: ${hasOrderingIssues}, Output corruption: ${hasOutputCorruption}`,
      metrics: {
        executionTime,
        successfulOperations: results.length,
        failedOperations: errors.length,
        dataCorruption: hasOutputCorruption
      }
    });
  }

  private async testCommandQueueIntegrity(): Promise<void> {
    console.log('Testing command queue integrity...');
    
    const testSession = await this.integrations[0].createSession('queue-test-session');
    
    // Rapidly submit commands to test queue management
    const rapidCommands: Promise<any>[] = [];
    const commandIds: string[] = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      const commandId = `queue-test-${i}-${Date.now()}`;
      commandIds.push(commandId);
      
      const promise = this.integrations[0].executeCommand(`echo "${commandId}"`, testSession.id);
      rapidCommands.push(promise);
      
      // Add small random delays to simulate real-world timing
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      }
    }
    
    const results = await Promise.allSettled(rapidCommands);
    const executionTime = performance.now() - startTime;
    
    // Check if all commands were processed
    const successfulCommands = results.filter(r => r.status === 'fulfilled').length;
    const failedCommands = results.filter(r => r.status === 'rejected').length;
    
    // Check output consistency
    const output = await this.integrations[0].getOutput(200, testSession.id);
    const outputLines = output.split('\n').filter(line => line.includes('queue-test-'));
    
    // Verify all command IDs appear in output
    const missingCommands = commandIds.filter(id => !output.includes(id));
    const queueIntegrityOk = missingCommands.length === 0;
    
    this.results.push({
      testName: 'Command Queue Integrity',
      passed: queueIntegrityOk && failedCommands === 0,
      raceCondition: !queueIntegrityOk ? 'Command queue corruption detected' : undefined,
      severity: 'critical',
      details: `Processed ${successfulCommands}/${commandIds.length} commands, Missing: ${missingCommands.length}`,
      metrics: {
        executionTime,
        successfulOperations: successfulCommands,
        failedOperations: failedCommands,
        dataCorruption: !queueIntegrityOk
      }
    });
  }

  private async testSessionStateCorruption(): Promise<void> {
    console.log('Testing session state corruption...');
    
    const sessionOperations: Promise<any>[] = [];
    const createdSessions: string[] = [];
    const errors: Error[] = [];
    
    const startTime = performance.now();
    
    // Rapidly create and destroy sessions
    for (let i = 0; i < 20; i++) {
      const sessionName = `state-test-${i}`;
      
      // Create session
      const createPromise = this.integrations[0].createSession(sessionName)
        .then(session => {
          createdSessions.push(session.id);
          
          // Immediately try to use the session
          return this.integrations[0].executeCommand('echo "session_active"', session.id);
        })
        .catch(error => {
          errors.push(error);
        });
      
      sessionOperations.push(createPromise);
      
      // Add rapid session switching
      if (i % 3 === 0 && createdSessions.length > 0) {
        const switchPromise = this.integrations[0].switchSession(createdSessions[createdSessions.length - 1])
          .catch(error => {
            errors.push(error);
          });
        sessionOperations.push(switchPromise);
      }
    }
    
    await Promise.allSettled(sessionOperations);
    const executionTime = performance.now() - startTime;
    
    // Check session state consistency
    const allSessions = this.integrations[0].getSessions();
    const activeSession = this.integrations[0].getActiveSession();
    
    const stateConsistent = allSessions.length >= createdSessions.length && 
                           activeSession !== null &&
                           allSessions.some(s => s.id === activeSession.id);
    
    this.results.push({
      testName: 'Session State Corruption',
      passed: stateConsistent && errors.length === 0,
      raceCondition: !stateConsistent ? 'Session state inconsistency detected' : undefined,
      severity: 'high',
      details: `Created ${createdSessions.length} sessions, State consistent: ${stateConsistent}, Errors: ${errors.length}`,
      metrics: {
        executionTime,
        successfulOperations: createdSessions.length,
        failedOperations: errors.length,
        dataCorruption: !stateConsistent
      }
    });
  }

  private async testOutputBufferConflicts(): Promise<void> {
    console.log('Testing output buffer conflicts...');
    
    const testSession = await this.integrations[0].createSession('buffer-test-session');
    
    // Generate output in the session
    await this.integrations[0].executeCommand('seq 1 100', testSession.id);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Concurrently capture output from multiple integrations
    const capturePromises: Promise<string>[] = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < this.integrations.length; i++) {
      for (let j = 0; j < 5; j++) {
        capturePromises.push(
          this.integrations[i].getOutput(50, testSession.id)
        );
      }
    }
    
    const captureResults = await Promise.allSettled(capturePromises);
    const executionTime = performance.now() - startTime;
    
    const successfulCaptures = captureResults.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<string>[];
    const failedCaptures = captureResults.filter(r => r.status === 'rejected').length;
    
    // Check if all captures got the same content
    const firstCapture = successfulCaptures[0]?.value || '';
    const allCapturesIdentical = successfulCaptures.every(capture => capture.value === firstCapture);
    
    // Check for buffer corruption indicators
    const hasEmptyCaptures = successfulCaptures.some(capture => capture.value.length === 0);
    const hasPartialCaptures = successfulCaptures.some(capture => 
      capture.value.length > 0 && capture.value.length < firstCapture.length * 0.5
    );
    
    const bufferIntegrityOk = allCapturesIdentical && !hasEmptyCaptures && !hasPartialCaptures;
    
    this.results.push({
      testName: 'Output Buffer Conflicts',
      passed: bufferIntegrityOk && failedCaptures === 0,
      raceCondition: !bufferIntegrityOk ? 'Output buffer corruption detected' : undefined,
      severity: 'medium',
      details: `Captured ${successfulCaptures.length} outputs, Identical: ${allCapturesIdentical}, Failed: ${failedCaptures}`,
      metrics: {
        executionTime,
        successfulOperations: successfulCaptures.length,
        failedOperations: failedCaptures,
        dataCorruption: !bufferIntegrityOk
      }
    });
  }

  private async testRapidSessionSwitching(): Promise<void> {
    console.log('Testing rapid session switching...');
    
    // Create multiple sessions
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      const session = await this.integrations[0].createSession(`switch-test-${i}`);
      sessions.push(session);
    }
    
    const switchPromises: Promise<any>[] = [];
    const errors: Error[] = [];
    const switchResults: string[] = [];
    
    const startTime = performance.now();
    
    // Rapidly switch between sessions
    for (let i = 0; i < 50; i++) {
      const targetSession = sessions[i % sessions.length];
      
      const switchPromise = this.integrations[0].switchSession(targetSession.id)
        .then(() => {
          const activeSession = this.integrations[0].getActiveSession();
          switchResults.push(activeSession?.id || 'null');
        })
        .catch(error => {
          errors.push(error);
        });
      
      switchPromises.push(switchPromise);
    }
    
    await Promise.allSettled(switchPromises);
    const executionTime = performance.now() - startTime;
    
    // Check if final active session is consistent
    const finalActiveSession = this.integrations[0].getActiveSession();
    const finalSessionIsValid = sessions.some(s => s.id === finalActiveSession?.id);
    
    // Check for race conditions in session switching
    const hasNullSwitches = switchResults.includes('null');
    const switchingConsistent = !hasNullSwitches && finalSessionIsValid;
    
    this.results.push({
      testName: 'Rapid Session Switching',
      passed: switchingConsistent && errors.length === 0,
      raceCondition: !switchingConsistent ? 'Session switching race condition' : undefined,
      severity: 'medium',
      details: `Performed ${switchResults.length} switches, Consistent: ${switchingConsistent}, Errors: ${errors.length}`,
      metrics: {
        executionTime,
        successfulOperations: switchResults.length,
        failedOperations: errors.length,
        dataCorruption: hasNullSwitches
      }
    });
  }

  private async testConcurrentCleanup(): Promise<void> {
    console.log('Testing concurrent cleanup operations...');
    
    // Create sessions across all integrations
    const sessions = [];
    for (let i = 0; i < this.integrations.length; i++) {
      const session = await this.integrations[i].createSession(`cleanup-test-${i}`);
      sessions.push({ integration: i, session });
    }
    
    const cleanupPromises: Promise<any>[] = [];
    const errors: Error[] = [];
    
    const startTime = performance.now();
    
    // Trigger cleanup from multiple integrations simultaneously
    for (let i = 0; i < this.integrations.length; i++) {
      const cleanupPromise = this.integrations[i].cleanup()
        .catch(error => {
          errors.push(error);
        });
      cleanupPromises.push(cleanupPromise);
    }
    
    await Promise.allSettled(cleanupPromises);
    const executionTime = performance.now() - startTime;
    
    // Re-initialize to test if cleanup was complete
    await Promise.all(this.integrations.map(integration => integration.initialize()));
    
    // Check if any sessions remain after cleanup
    const remainingSessions = this.integrations[0].getSessions();
    const cleanupComplete = remainingSessions.length === 0 || 
                           !remainingSessions.some(s => s.name.includes('cleanup-test-'));
    
    this.results.push({
      testName: 'Concurrent Cleanup Operations',
      passed: cleanupComplete && errors.length === 0,
      raceCondition: !cleanupComplete ? 'Incomplete cleanup detected' : undefined,
      severity: 'high',
      details: `Cleanup completed: ${cleanupComplete}, Remaining sessions: ${remainingSessions.length}, Errors: ${errors.length}`,
      metrics: {
        executionTime,
        successfulOperations: this.integrations.length,
        failedOperations: errors.length,
        dataCorruption: !cleanupComplete
      }
    });
  }

  private async testResourceContention(): Promise<void> {
    console.log('Testing resource contention...');
    
    const operationPromises: Promise<any>[] = [];
    const errors: Error[] = [];
    let successfulOperations = 0;
    
    const startTime = performance.now();
    
    // Create heavy load with multiple operations
    for (let i = 0; i < this.integrations.length; i++) {
      // Session creation
      operationPromises.push(
        this.integrations[i].createSession(`contention-session-${i}`)
          .then(() => successfulOperations++)
          .catch(error => errors.push(error))
      );
      
      // Command execution
      operationPromises.push(
        this.integrations[i].executeCommand('echo "contention_test"')
          .then(() => successfulOperations++)
          .catch(error => errors.push(error))
      );
      
      // Output capture
      operationPromises.push(
        this.integrations[i].getOutput(10)
          .then(() => successfulOperations++)
          .catch(error => errors.push(error))
      );
    }
    
    await Promise.allSettled(operationPromises);
    const executionTime = performance.now() - startTime;
    
    // Check for deadlocks (indicated by very long execution time)
    const possibleDeadlock = executionTime > 30000; // 30 seconds
    
    // Check error patterns that might indicate resource contention
    const resourceErrors = errors.filter(error => 
      error.message.includes('timeout') || 
      error.message.includes('busy') ||
      error.message.includes('locked')
    );
    
    const contentionHandled = !possibleDeadlock && resourceErrors.length === 0;
    
    this.results.push({
      testName: 'Resource Contention Handling',
      passed: contentionHandled,
      raceCondition: !contentionHandled ? 'Resource contention detected' : undefined,
      severity: 'high',
      details: `Operations: ${successfulOperations}, Deadlock: ${possibleDeadlock}, Resource errors: ${resourceErrors.length}`,
      metrics: {
        executionTime,
        successfulOperations,
        failedOperations: errors.length,
        dataCorruption: possibleDeadlock
      }
    });
  }

  generateConcurrencyReport(): string {
    const criticalIssues = this.results.filter(r => r.severity === 'critical' && !r.passed);
    const highIssues = this.results.filter(r => r.severity === 'high' && !r.passed);
    const allPassed = this.results.every(r => r.passed);
    
    let report = '# tmux Integration Concurrency Assessment\n\n';
    
    report += '## Executive Summary\n\n';
    if (allPassed) {
      report += '✅ **CONCURRENCY ASSESSMENT: PASS** - No race conditions detected\n\n';
    } else if (criticalIssues.length === 0) {
      report += '⚠️ **CONCURRENCY ASSESSMENT: CONDITIONAL PASS** - No critical race conditions, but issues exist\n\n';
    } else {
      report += '❌ **CONCURRENCY ASSESSMENT: FAIL** - Critical race conditions detected\n\n';
    }
    
    report += `- **Critical Race Conditions**: ${criticalIssues.length}\n`;
    report += `- **High Priority Issues**: ${highIssues.length}\n`;
    report += `- **Total Tests**: ${this.results.length}\n`;
    report += `- **Success Rate**: ${((this.results.filter(r => r.passed).length / this.results.length) * 100).toFixed(1)}%\n\n`;
    
    if (criticalIssues.length > 0) {
      report += '## 🚨 Critical Race Conditions\n\n';
      for (const issue of criticalIssues) {
        report += `### ${issue.testName}\n`;
        report += `- **Race Condition**: ${issue.raceCondition}\n`;
        report += `- **Details**: ${issue.details}\n`;
        if (issue.metrics) {
          report += `- **Data Corruption**: ${issue.metrics.dataCorruption}\n`;
          report += `- **Execution Time**: ${issue.metrics.executionTime.toFixed(2)}ms\n`;
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
        report += `   Execution time: ${result.metrics.executionTime.toFixed(2)}ms, Data corruption: ${result.metrics.dataCorruption}\n`;
      }
      report += '\n';
    }
    
    report += '## Recommendations\n\n';
    if (criticalIssues.length > 0) {
      report += '### Immediate Actions Required\n';
      report += '1. **DO NOT DEPLOY** until critical race conditions are resolved\n';
      report += '2. Implement proper locking mechanisms\n';
      report += '3. Add atomic operations for shared state\n';
      report += '4. Implement command queue synchronization\n\n';
    }
    
    report += '### General Concurrency Improvements\n';
    report += '1. Implement thread-safe data structures\n';
    report += '2. Add timeout mechanisms for all operations\n';
    report += '3. Implement graceful degradation under load\n';
    report += '4. Add deadlock detection and recovery\n';
    report += '5. Regular load testing and stress testing\n\n';
    
    return report;
  }
}

export async function runConcurrencyTests(): Promise<void> {
  const concurrencyTests = new TmuxConcurrencyTests(5);
  
  try {
    const results = await concurrencyTests.runConcurrencyTestSuite();
    const report = concurrencyTests.generateConcurrencyReport();
    
    console.log(report);
    
    const fs = await import('fs/promises');
    await fs.writeFile('tmux-concurrency-report.md', report);
    console.log('\n📄 Concurrency report saved to tmux-concurrency-report.md');
    
    // Exit with error code if critical issues found
    const criticalIssues = results.filter(r => r.severity === 'critical' && !r.passed);
    if (criticalIssues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Concurrency testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runConcurrencyTests();
}
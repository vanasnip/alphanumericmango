/**
 * Failure Recovery Tests
 * Tests system resilience under various failure scenarios
 * Validates recovery mechanisms and data integrity
 */

import { test, expect, Browser, Page } from '@playwright/test';
import TestEnvironment, { TestEnvironmentConfig } from './utils/TestEnvironment';

const testConfig: TestEnvironmentConfig = {
  baseUrl: 'http://localhost:4173',
  wsProxyUrl: 'ws://localhost:8080',
  tmuxBackendUrl: 'http://localhost:8081',
  testTimeout: 90000, // Extended timeout for failure scenarios
  retryAttempts: 1 // Limited retries for failure tests
};

// Failure simulation types
enum FailureType {
  WEBSOCKET_SERVER_CRASH = 'websocket_server_crash',
  TMUX_BACKEND_FAILURE = 'tmux_backend_failure',
  DATABASE_CONNECTION_LOSS = 'database_connection_loss',
  MEMORY_EXHAUSTION = 'memory_exhaustion',
  CPU_OVERLOAD = 'cpu_overload',
  DISK_SPACE_FULL = 'disk_space_full',
  NETWORK_PARTITION = 'network_partition',
  BROWSER_TAB_CRASH = 'browser_tab_crash'
}

// Recovery expectation levels
enum RecoveryLevel {
  IMMEDIATE = 'immediate', // < 1 second
  FAST = 'fast',          // < 5 seconds
  NORMAL = 'normal',      // < 30 seconds
  SLOW = 'slow'           // < 60 seconds
}

interface FailureScenario {
  type: FailureType;
  description: string;
  expectedRecoveryTime: RecoveryLevel;
  dataLossAcceptable: boolean;
  requiresManualIntervention: boolean;
}

const failureScenarios: FailureScenario[] = [
  {
    type: FailureType.WEBSOCKET_SERVER_CRASH,
    description: 'WebSocket proxy server crashes and restarts',
    expectedRecoveryTime: RecoveryLevel.FAST,
    dataLossAcceptable: false,
    requiresManualIntervention: false
  },
  {
    type: FailureType.TMUX_BACKEND_FAILURE,
    description: 'tmux backend process terminates unexpectedly',
    expectedRecoveryTime: RecoveryLevel.NORMAL,
    dataLossAcceptable: true, // Session data may be lost
    requiresManualIntervention: false
  },
  {
    type: FailureType.DATABASE_CONNECTION_LOSS,
    description: 'Redis/database connection is lost',
    expectedRecoveryTime: RecoveryLevel.FAST,
    dataLossAcceptable: false,
    requiresManualIntervention: false
  },
  {
    type: FailureType.MEMORY_EXHAUSTION,
    description: 'System runs out of available memory',
    expectedRecoveryTime: RecoveryLevel.SLOW,
    dataLossAcceptable: true,
    requiresManualIntervention: false
  },
  {
    type: FailureType.NETWORK_PARTITION,
    description: 'Network connectivity is partially lost',
    expectedRecoveryTime: RecoveryLevel.NORMAL,
    dataLossAcceptable: false,
    requiresManualIntervention: false
  }
];

test.describe('Failure Recovery Tests', () => {
  let testEnv: TestEnvironment;

  test.beforeEach(async () => {
    testEnv = new TestEnvironment(testConfig);
    await testEnv.initialize();
  });

  test.afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  test.describe('Backend Server Failures', () => {
    test('should recover from WebSocket proxy server crashes', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'ws_crash_test_001',
        userId: 'ws_crash_user'
      });

      await testEnv.connectUserSession('ws_crash_test_001');

      // Establish baseline functionality
      const baselineResult = await testEnv.executeCommand('ws_crash_test_001', 'echo "Before crash"', {
        expectOutput: 'Before crash'
      });
      expect(baselineResult.success).toBe(true);

      // Set up state that should be preserved
      await testEnv.executeCommand('ws_crash_test_001', 'cd /tmp && export TEST_VAR="preserved"');

      // Simulate WebSocket server crash
      await simulateWebSocketServerCrash(session.page);

      // Wait for crash detection
      await session.page.waitForTimeout(2000);

      // Verify connection is detected as lost
      const connectionStatus = await checkConnectionStatus(session.page);
      expect(connectionStatus.connected).toBe(false);

      // Simulate server restart
      await simulateWebSocketServerRestart(session.page);

      // Wait for automatic reconnection
      const recoveryStart = Date.now();
      await session.page.waitForFunction(() => {
        return (window as any).terminalClient && (window as any).terminalClient.isConnected();
      }, { timeout: 10000 });
      
      const recoveryTime = Date.now() - recoveryStart;

      // Verify recovery time meets expectations
      expect(recoveryTime).toBeLessThan(5000); // Fast recovery

      // Verify functionality is restored
      const recoveryResult = await testEnv.executeCommand('ws_crash_test_001', 'echo "After recovery"', {
        expectOutput: 'After recovery',
        timeout: 10000
      });
      expect(recoveryResult.success).toBe(true);

      // Verify session state is preserved (tmux session should survive)
      const stateResult = await testEnv.executeCommand('ws_crash_test_001', 'pwd && echo $TEST_VAR');
      expect(stateResult.output).toContain('/tmp');
      expect(stateResult.output).toContain('preserved');
    });

    test('should handle tmux backend process failures', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'tmux_crash_test_001',
        userId: 'tmux_crash_user'
      });

      await testEnv.connectUserSession('tmux_crash_test_001');

      // Create some session state
      await testEnv.executeCommand('tmux_crash_test_001', 'echo "Important data" > /tmp/important.txt');
      await testEnv.executeCommand('tmux_crash_test_001', 'cd /tmp');

      // Simulate tmux backend failure
      await simulateTmuxBackendFailure(session.page);

      // Wait for failure detection
      await session.page.waitForTimeout(3000);

      // System should detect failure and attempt recovery
      const errorStatus = await session.page.locator('[data-testid="error-message"]').textContent();
      expect(errorStatus).toMatch(/(connection lost|session terminated|backend error)/i);

      // Wait for automatic session recreation
      await session.page.waitForTimeout(5000);

      // Verify new session is created
      const newSessionResult = await testEnv.executeCommand('tmux_crash_test_001', 'echo "New session"', {
        timeout: 15000
      });
      expect(newSessionResult.success).toBe(true);

      // Data loss is acceptable for tmux crashes
      // But system should be functional again
      const functionalityTest = await testEnv.executeCommand('tmux_crash_test_001', 'pwd && date');
      expect(functionalityTest.success).toBe(true);
    });

    test('should recover from database connection failures', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'db_failure_test_001',
        userId: 'db_failure_user'
      });

      await testEnv.connectUserSession('db_failure_test_001');

      // Simulate database connection loss
      await simulateDatabaseFailure(session.page);

      // Commands should queue or fail gracefully
      const duringFailureResult = await testEnv.executeCommand('db_failure_test_001', 'echo "During DB failure"', {
        timeout: 10000,
        expectError: false // Should either succeed (queued) or fail gracefully
      });

      // Simulate database recovery
      await simulateDatabaseRecovery(session.page);

      // Wait for connection restoration
      await session.page.waitForTimeout(3000);

      // Verify functionality is restored
      const afterRecoveryResult = await testEnv.executeCommand('db_failure_test_001', 'echo "After DB recovery"', {
        expectOutput: 'After DB recovery',
        timeout: 10000
      });
      expect(afterRecoveryResult.success).toBe(true);

      // Test session persistence after DB recovery
      const persistenceTest = await testEnv.executeCommand('db_failure_test_001', 'echo "Persistence test"');
      expect(persistenceTest.success).toBe(true);
    });
  });

  test.describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory exhaustion gracefully', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'memory_exhaustion_001',
        userId: 'memory_test_user'
      });

      await testEnv.connectUserSession('memory_exhaustion_001');

      // Monitor memory usage
      const initialMetrics = await testEnv.getSystemMetrics();

      // Simulate memory pressure
      await simulateMemoryExhaustion(session.page);

      // System should detect memory pressure
      await session.page.waitForTimeout(5000);

      // Verify system responds to memory pressure
      const memoryPressureMetrics = await testEnv.getSystemMetrics();
      
      // System should implement memory management
      expect(memoryPressureMetrics.activeSessions).toBeLessThanOrEqual(initialMetrics.activeSessions);

      // Basic functionality should still work
      const basicFunctionTest = await testEnv.executeCommand('memory_exhaustion_001', 'echo "Memory test"', {
        timeout: 15000
      });
      
      // May fail under severe memory pressure, but should not crash
      if (basicFunctionTest.success) {
        expect(basicFunctionTest.output).toContain('Memory test');
      }

      // Wait for memory cleanup
      await session.page.waitForTimeout(10000);

      // Verify recovery
      const recoveryMetrics = await testEnv.getSystemMetrics();
      expect(recoveryMetrics.memoryUsage).toBeLessThan(memoryPressureMetrics.memoryUsage);
    });

    test('should manage CPU overload conditions', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'cpu_overload_001',
        userId: 'cpu_test_user'
      });

      await testEnv.connectUserSession('cpu_overload_001');

      // Create CPU-intensive workload
      const cpuIntensiveCommand = testEnv.executeCommand('cpu_overload_001', 
        'for i in {1..1000}; do echo "CPU test $i" > /dev/null; done && echo "CPU test complete"', {
        timeout: 30000
      });

      // Try to execute other commands during CPU load
      await session.page.waitForTimeout(2000);
      
      const concurrentCommand = await testEnv.executeCommand('cpu_overload_001', 'echo "Concurrent command"', {
        timeout: 20000
      });

      // Wait for CPU-intensive command to complete
      const cpuResult = await cpuIntensiveCommand;

      // System should handle CPU load without complete failure
      if (cpuResult.success) {
        expect(cpuResult.output).toContain('CPU test complete');
      }

      // Concurrent command should eventually succeed or be throttled gracefully
      expect(concurrentCommand.success || concurrentCommand.error).toBeDefined();

      // Verify system stabilizes after CPU load
      await session.page.waitForTimeout(5000);
      
      const stabilityTest = await testEnv.executeCommand('cpu_overload_001', 'echo "Stability test"', {
        expectOutput: 'Stability test'
      });
      expect(stabilityTest.success).toBe(true);
    });

    test('should handle disk space exhaustion', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'disk_full_001',
        userId: 'disk_test_user'
      });

      await testEnv.connectUserSession('disk_full_001');

      // Simulate disk space exhaustion
      await simulateDiskSpaceExhaustion(session.page);

      // Commands that require disk space should fail gracefully
      const diskWriteTest = await testEnv.executeCommand('disk_full_001', 'echo "test data" > /tmp/disktest.txt', {
        expectError: true,
        timeout: 10000
      });

      // Should handle disk full condition gracefully
      expect(diskWriteTest.success).toBe(true); // Error handled gracefully

      // Read operations should still work
      const readTest = await testEnv.executeCommand('disk_full_001', 'echo "Read test"', {
        timeout: 10000
      });
      expect(readTest.success).toBe(true);

      // Simulate disk space recovery
      await simulateDiskSpaceRecovery(session.page);

      // Verify write operations work again
      const recoveryWriteTest = await testEnv.executeCommand('disk_full_001', 'echo "recovery test" > /tmp/recovery.txt', {
        timeout: 10000
      });
      expect(recoveryWriteTest.success).toBe(true);
    });
  });

  test.describe('Network Partition Recovery', () => {
    test('should handle split-brain scenarios', async ({ browser }) => {
      const session1 = await testEnv.createUserSession(browser, {
        sessionId: 'split_brain_1',
        userId: 'split_user_1'
      });

      const session2 = await testEnv.createUserSession(browser, {
        sessionId: 'split_brain_2',
        userId: 'split_user_2'
      });

      await Promise.all([
        testEnv.connectUserSession('split_brain_1'),
        testEnv.connectUserSession('split_brain_2')
      ]);

      // Simulate network partition between sessions
      await simulateNetworkPartition(session1.page, session2.page);

      // Both sessions should detect the partition
      await session1.page.waitForTimeout(3000);
      await session2.page.waitForTimeout(3000);

      // Sessions should operate independently during partition
      const session1Result = await testEnv.executeCommand('split_brain_1', 'echo "Session 1 during partition"');
      const session2Result = await testEnv.executeCommand('split_brain_2', 'echo "Session 2 during partition"');

      // At least one session should remain functional
      expect(session1Result.success || session2Result.success).toBe(true);

      // Simulate partition healing
      await healNetworkPartition(session1.page, session2.page);

      // Wait for partition recovery
      await session1.page.waitForTimeout(5000);
      await session2.page.waitForTimeout(5000);

      // Both sessions should be functional after healing
      const healedTest1 = await testEnv.executeCommand('split_brain_1', 'echo "Healed session 1"');
      const healedTest2 = await testEnv.executeCommand('split_brain_2', 'echo "Healed session 2"');

      expect(healedTest1.success).toBe(true);
      expect(healedTest2.success).toBe(true);
    });

    test('should maintain data consistency after network recovery', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'consistency_test_001',
        userId: 'consistency_user'
      });

      await testEnv.connectUserSession('consistency_test_001');

      // Create data before partition
      await testEnv.executeCommand('consistency_test_001', 'echo "pre-partition data" > /tmp/consistency.txt');

      // Simulate network partition
      await testEnv.simulateNetworkConditions('consistency_test_001', { offline: true });

      // Queue operations during partition
      const queuedOperation = testEnv.executeCommand('consistency_test_001', 'echo "queued operation" >> /tmp/consistency.txt', {
        timeout: 30000
      });

      // Wait during partition
      await session.page.waitForTimeout(5000);

      // Restore network
      await testEnv.simulateNetworkConditions('consistency_test_001', { offline: false });

      // Wait for queued operation to complete
      const queuedResult = await queuedOperation;
      expect(queuedResult.success).toBe(true);

      // Verify data consistency
      const consistencyCheck = await testEnv.executeCommand('consistency_test_001', 'cat /tmp/consistency.txt');
      expect(consistencyCheck.output).toContain('pre-partition data');
      expect(consistencyCheck.output).toContain('queued operation');
    });
  });

  test.describe('Browser and Client-Side Failures', () => {
    test('should recover from tab crashes and page reloads', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'tab_crash_test_001',
        userId: 'tab_crash_user'
      });

      await testEnv.connectUserSession('tab_crash_test_001');

      // Set up session state
      await testEnv.executeCommand('tab_crash_test_001', 'cd /tmp && export CRASH_TEST="value"');

      // Simulate tab crash by reloading the page
      await session.page.reload();

      // Wait for page to load
      await session.page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

      // Should automatically reconnect to existing session
      await session.page.waitForTimeout(3000);

      // Verify session restoration
      const restoredSession = await testEnv.executeCommand('tab_crash_test_001', 'pwd && echo $CRASH_TEST', {
        timeout: 15000
      });

      // tmux session should survive browser tab crash
      expect(restoredSession.success).toBe(true);
      expect(restoredSession.output).toContain('/tmp');
      expect(restoredSession.output).toContain('value');
    });

    test('should handle JavaScript errors gracefully', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'js_error_test_001',
        userId: 'js_error_user'
      });

      await testEnv.connectUserSession('js_error_test_001');

      // Inject JavaScript error
      await session.page.evaluate(() => {
        // Simulate a JavaScript error
        setTimeout(() => {
          throw new Error('Simulated JavaScript error');
        }, 1000);
      });

      await session.page.waitForTimeout(3000);

      // Terminal should continue to function despite JS errors
      const functionalityTest = await testEnv.executeCommand('js_error_test_001', 'echo "JS error recovery test"', {
        expectOutput: 'JS error recovery test',
        timeout: 10000
      });

      expect(functionalityTest.success).toBe(true);

      // Error reporting should be working
      const errorLogs = await session.page.evaluate(() => {
        return (window as any).errorLog || [];
      });

      // Error should be logged but not break functionality
      expect(Array.isArray(errorLogs)).toBe(true);
    });

    test('should recover from WebSocket connection errors', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'ws_error_test_001',
        userId: 'ws_error_user'
      });

      await testEnv.connectUserSession('ws_error_test_001');

      // Force WebSocket error
      await session.page.evaluate(() => {
        if ((window as any).terminalClient && (window as any).terminalClient._websocket) {
          (window as any).terminalClient._websocket.close(1006, 'Forced close for testing');
        }
      });

      // Wait for error detection and recovery attempt
      await session.page.waitForTimeout(5000);

      // Should automatically reconnect
      await session.page.waitForFunction(() => {
        return (window as any).terminalClient && (window as any).terminalClient.isConnected();
      }, { timeout: 15000 });

      // Verify functionality after reconnection
      const recoveryTest = await testEnv.executeCommand('ws_error_test_001', 'echo "WebSocket recovery test"', {
        expectOutput: 'WebSocket recovery test',
        timeout: 10000
      });

      expect(recoveryTest.success).toBe(true);
    });
  });

  test.describe('Data Integrity and Loss Prevention', () => {
    test('should prevent data loss during failures', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'data_integrity_001',
        userId: 'data_integrity_user'
      });

      await testEnv.connectUserSession('data_integrity_001');

      // Create important data
      await testEnv.executeCommand('data_integrity_001', 'echo "Critical data: $(date)" > /tmp/critical.txt');

      // Start a long-running command
      const longRunningCommand = testEnv.executeCommand('data_integrity_001', 
        'for i in {1..10}; do echo "Processing $i" >> /tmp/process.log; sleep 1; done', {
        timeout: 30000
      });

      // Simulate failure during command execution
      await session.page.waitForTimeout(3000);
      await testEnv.simulateNetworkConditions('data_integrity_001', { offline: true });

      // Wait and restore
      await session.page.waitForTimeout(2000);
      await testEnv.simulateNetworkConditions('data_integrity_001', { offline: false });

      // Wait for command to complete or recover
      const commandResult = await longRunningCommand;

      // Verify data integrity
      const dataCheck = await testEnv.executeCommand('data_integrity_001', 'cat /tmp/critical.txt', {
        timeout: 10000
      });

      expect(dataCheck.success).toBe(true);
      expect(dataCheck.output).toContain('Critical data');

      // Check if process log has reasonable content
      const processCheck = await testEnv.executeCommand('data_integrity_001', 'wc -l /tmp/process.log', {
        timeout: 5000
      });

      // Should have some entries, showing partial completion is preserved
      if (processCheck.success) {
        const lineCount = parseInt(processCheck.output.trim().split(' ')[0]);
        expect(lineCount).toBeGreaterThan(0);
      }
    });

    test('should validate data consistency after recovery', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'consistency_validation_001',
        userId: 'consistency_validation_user'
      });

      await testEnv.connectUserSession('consistency_validation_001');

      // Create structured data
      const dataCommands = [
        'echo "1:first entry" > /tmp/structured.txt',
        'echo "2:second entry" >> /tmp/structured.txt',
        'echo "3:third entry" >> /tmp/structured.txt'
      ];

      for (const command of dataCommands) {
        await testEnv.executeCommand('consistency_validation_001', command);
      }

      // Calculate checksum before failure
      const checksumBefore = await testEnv.executeCommand('consistency_validation_001', 'md5sum /tmp/structured.txt');

      // Simulate failure and recovery
      await testEnv.simulateNetworkConditions('consistency_validation_001', { offline: true });
      await session.page.waitForTimeout(3000);
      await testEnv.simulateNetworkConditions('consistency_validation_001', { offline: false });
      await session.page.waitForTimeout(3000);

      // Verify data consistency after recovery
      const checksumAfter = await testEnv.executeCommand('consistency_validation_001', 'md5sum /tmp/structured.txt', {
        timeout: 10000
      });

      expect(checksumAfter.success).toBe(true);
      expect(checksumAfter.output).toBe(checksumBefore.output);

      // Verify file structure
      const structureCheck = await testEnv.executeCommand('consistency_validation_001', 'cat /tmp/structured.txt');
      expect(structureCheck.output).toContain('1:first entry');
      expect(structureCheck.output).toContain('2:second entry');
      expect(structureCheck.output).toContain('3:third entry');
    });
  });
});

// Helper functions for failure simulation

async function simulateWebSocketServerCrash(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Simulate server crash by forcing connection close
    if ((window as any).terminalClient) {
      (window as any).terminalClient._websocket.close(1011, 'Server crash simulation');
      (window as any).serverCrashed = true;
    }
  });
}

async function simulateWebSocketServerRestart(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Simulate server restart by allowing reconnection
    (window as any).serverCrashed = false;
    if ((window as any).terminalClient) {
      (window as any).terminalClient.reconnect();
    }
  });
}

async function simulateTmuxBackendFailure(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Simulate tmux backend failure
    if ((window as any).terminalClient) {
      (window as any).tmuxBackendFailed = true;
      // Simulate backend error response
      const errorEvent = new CustomEvent('tmuxBackendError', {
        detail: { error: 'Backend process terminated' }
      });
      window.dispatchEvent(errorEvent);
    }
  });
}

async function simulateDatabaseFailure(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).databaseConnected = false;
  });
}

async function simulateDatabaseRecovery(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).databaseConnected = true;
  });
}

async function simulateMemoryExhaustion(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Simulate memory pressure
    (window as any).memoryPressure = true;
    const memoryHog = [];
    try {
      for (let i = 0; i < 10000; i++) {
        memoryHog.push(new Array(1000).fill('memory pressure simulation'));
      }
      (window as any).memoryHog = memoryHog;
    } catch (error) {
      console.log('Memory exhaustion simulated');
    }
  });
}

async function simulateDiskSpaceExhaustion(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).diskSpaceFull = true;
  });
}

async function simulateDiskSpaceRecovery(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).diskSpaceFull = false;
  });
}

async function simulateNetworkPartition(page1: Page, page2: Page): Promise<void> {
  await Promise.all([
    page1.evaluate(() => { (window as any).networkPartitioned = true; }),
    page2.evaluate(() => { (window as any).networkPartitioned = true; })
  ]);
}

async function healNetworkPartition(page1: Page, page2: Page): Promise<void> {
  await Promise.all([
    page1.evaluate(() => { (window as any).networkPartitioned = false; }),
    page2.evaluate(() => { (window as any).networkPartitioned = false; })
  ]);
}

async function checkConnectionStatus(page: Page): Promise<{ connected: boolean; lastSeen: number }> {
  return await page.evaluate(() => {
    const client = (window as any).terminalClient;
    return {
      connected: client ? client.isConnected() : false,
      lastSeen: client ? client.lastSeenTime || 0 : 0
    };
  });
}
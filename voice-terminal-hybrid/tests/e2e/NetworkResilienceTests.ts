/**
 * Network Resilience Tests
 * Tests connection drops, reconnection, slow networks, packet loss
 * Validates system behavior under various network conditions
 */

import { test, expect, Browser, Page } from '@playwright/test';
import TestEnvironment, { TestEnvironmentConfig } from './utils/TestEnvironment';

const testConfig: TestEnvironmentConfig = {
  baseUrl: 'http://localhost:4173',
  wsProxyUrl: 'ws://localhost:8080',
  tmuxBackendUrl: 'http://localhost:8081',
  testTimeout: 60000,
  retryAttempts: 3
};

// Network condition profiles for testing
const networkProfiles = {
  '3G': {
    downloadThroughput: 1600 * 1024, // 1.6 Mbps
    uploadThroughput: 750 * 1024,    // 750 Kbps
    latency: 300 // 300ms
  },
  '4G': {
    downloadThroughput: 9000 * 1024, // 9 Mbps
    uploadThroughput: 2000 * 1024,   // 2 Mbps
    latency: 150 // 150ms
  },
  'WiFi': {
    downloadThroughput: 30000 * 1024, // 30 Mbps
    uploadThroughput: 15000 * 1024,   // 15 Mbps
    latency: 28 // 28ms
  },
  'PoorConnectivity': {
    downloadThroughput: 256 * 1024, // 256 Kbps
    uploadThroughput: 128 * 1024,   // 128 Kbps
    latency: 2000 // 2s
  }
};

test.describe('Network Resilience Tests', () => {
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

  test.describe('Connection Drop Recovery', () => {
    test('should recover from WebSocket connection drops', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'connection_drop_001',
        userId: 'drop_test_user'
      });

      await testEnv.connectUserSession('connection_drop_001');

      // Establish baseline connectivity
      const baselineResult = await testEnv.executeCommand('connection_drop_001', 'echo "Before drop"', {
        expectOutput: 'Before drop'
      });
      expect(baselineResult.success).toBe(true);

      // Simulate connection drop by going offline
      await testEnv.simulateNetworkConditions('connection_drop_001', { offline: true });
      
      // Wait for connection to be detected as lost
      await session.page.waitForTimeout(3000);

      // Verify connection status
      const connectionStatus = await session.page.evaluate(() => {
        return (window as any).terminalClient ? (window as any).terminalClient.isConnected() : false;
      });
      expect(connectionStatus).toBe(false);

      // Restore connectivity
      await testEnv.simulateNetworkConditions('connection_drop_001', { offline: false });

      // Wait for automatic reconnection
      await session.page.waitForTimeout(5000);

      // Verify reconnection and functionality
      const recoveryResult = await testEnv.executeCommand('connection_drop_001', 'echo "After recovery"', {
        expectOutput: 'After recovery',
        timeout: 10000
      });
      expect(recoveryResult.success).toBe(true);

      // Verify session state preservation
      const stateResult = await testEnv.executeCommand('connection_drop_001', 'pwd');
      expect(stateResult.success).toBe(true);
    });

    test('should handle multiple rapid connection drops', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'rapid_drops_001',
        userId: 'rapid_drop_user'
      });

      await testEnv.connectUserSession('rapid_drops_001');

      // Perform multiple connection drops and recoveries
      for (let i = 0; i < 5; i++) {
        // Drop connection
        await testEnv.simulateNetworkConditions('rapid_drops_001', { offline: true });
        await session.page.waitForTimeout(1000);

        // Restore connection
        await testEnv.simulateNetworkConditions('rapid_drops_001', { offline: false });
        await session.page.waitForTimeout(2000);

        // Test functionality after each recovery
        const testResult = await testEnv.executeCommand('rapid_drops_001', `echo "Drop test ${i + 1}"`, {
          timeout: 8000
        });
        expect(testResult.success).toBe(true);
      }
    });

    test('should maintain command queue during disconnection', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'command_queue_001',
        userId: 'queue_test_user'
      });

      await testEnv.connectUserSession('command_queue_001');

      // Send command and immediately disconnect
      const commandPromise = testEnv.executeCommand('command_queue_001', 'sleep 2 && echo "Queued command"', {
        timeout: 15000
      });

      // Disconnect after starting command
      await session.page.waitForTimeout(500);
      await testEnv.simulateNetworkConditions('command_queue_001', { offline: true });
      
      // Wait briefly then reconnect
      await session.page.waitForTimeout(3000);
      await testEnv.simulateNetworkConditions('command_queue_001', { offline: false });

      // Wait for command completion
      const result = await commandPromise;
      expect(result.success).toBe(true);
      expect(result.output).toContain('Queued command');
    });
  });

  test.describe('Network Condition Testing', () => {
    Object.entries(networkProfiles).forEach(([profileName, profile]) => {
      test(`should function correctly under ${profileName} conditions`, async ({ browser }) => {
        const session = await testEnv.createUserSession(browser, {
          sessionId: `network_${profileName.toLowerCase()}_001`,
          userId: `${profileName.toLowerCase()}_user`
        });

        // Apply network conditions before connecting
        await testEnv.simulateNetworkConditions(`network_${profileName.toLowerCase()}_001`, profile);
        
        await testEnv.connectUserSession(`network_${profileName.toLowerCase()}_001`);

        // Test basic functionality under these conditions
        const basicTests = [
          { command: 'echo "Network test"', expectOutput: 'Network test' },
          { command: 'pwd', expectOutput: '/' },
          { command: 'ls', expectOutput: '' }
        ];

        const results = [];
        for (const test of basicTests) {
          const startTime = Date.now();
          const result = await testEnv.executeCommand(`network_${profileName.toLowerCase()}_001`, test.command, {
            timeout: getTimeoutForProfile(profileName),
            expectOutput: test.expectOutput
          });
          const responseTime = Date.now() - startTime;
          
          results.push({
            command: test.command,
            success: result.success,
            responseTime,
            expectedLatency: profile.latency
          });
        }

        // Verify all commands succeeded
        results.forEach(result => {
          expect(result.success).toBe(true);
          
          // Verify response times are reasonable for the network condition
          const expectedMaxTime = result.expectedLatency * 3 + 2000; // 3x latency + 2s buffer
          expect(result.responseTime).toBeLessThan(expectedMaxTime);
        });

        // Test file transfer under network conditions
        await testFileTransferUnderConditions(session.page, profileName, profile);
      });
    });

    test('should adapt to changing network conditions', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'adaptive_network_001',
        userId: 'adaptive_user'
      });

      await testEnv.connectUserSession('adaptive_network_001');

      // Start with good conditions
      await testEnv.simulateNetworkConditions('adaptive_network_001', networkProfiles.WiFi);
      const goodResult = await testEnv.executeCommand('adaptive_network_001', 'echo "Good network"');
      expect(goodResult.success).toBe(true);
      expect(goodResult.executionTime).toBeLessThan(1000);

      // Degrade to 3G
      await testEnv.simulateNetworkConditions('adaptive_network_001', networkProfiles['3G']);
      const degradedResult = await testEnv.executeCommand('adaptive_network_001', 'echo "Degraded network"', {
        timeout: 5000
      });
      expect(degradedResult.success).toBe(true);

      // Further degrade to poor connectivity
      await testEnv.simulateNetworkConditions('adaptive_network_001', networkProfiles.PoorConnectivity);
      const poorResult = await testEnv.executeCommand('adaptive_network_001', 'echo "Poor network"', {
        timeout: 15000
      });
      expect(poorResult.success).toBe(true);

      // Return to good conditions
      await testEnv.simulateNetworkConditions('adaptive_network_001', networkProfiles.WiFi);
      const recoveredResult = await testEnv.executeCommand('adaptive_network_001', 'echo "Recovered network"');
      expect(recoveredResult.success).toBe(true);
      expect(recoveredResult.executionTime).toBeLessThan(2000);
    });
  });

  test.describe('Packet Loss Tolerance', () => {
    test('should handle intermittent packet loss', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'packet_loss_001',
        userId: 'packet_loss_user'
      });

      await testEnv.connectUserSession('packet_loss_001');

      // Simulate packet loss by intermittently blocking network
      let packetLossCount = 0;
      const packetLossInterval = setInterval(async () => {
        if (packetLossCount < 10) {
          // Brief network interruption
          await testEnv.simulateNetworkConditions('packet_loss_001', { offline: true });
          setTimeout(async () => {
            await testEnv.simulateNetworkConditions('packet_loss_001', { offline: false });
          }, 200);
          packetLossCount++;
        } else {
          clearInterval(packetLossInterval);
        }
      }, 1000);

      // Execute commands during packet loss simulation
      const commands = [
        'echo "Command 1"',
        'date',
        'echo "Command 2"',
        'pwd',
        'echo "Command 3"'
      ];

      const results = [];
      for (const command of commands) {
        const result = await testEnv.executeCommand('packet_loss_001', command, {
          timeout: 10000
        });
        results.push(result);
      }

      // Clear interval and restore normal conditions
      clearInterval(packetLossInterval);
      await testEnv.simulateNetworkConditions('packet_loss_001', { offline: false });

      // Verify most commands succeeded despite packet loss
      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    test('should retry failed transmissions', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'retry_test_001',
        userId: 'retry_user'
      });

      await testEnv.connectUserSession('retry_test_001');

      // Monitor retry attempts
      const retryStats = await session.page.evaluate(() => {
        let retryCount = 0;
        const originalSend = WebSocket.prototype.send;
        
        WebSocket.prototype.send = function(data) {
          try {
            return originalSend.call(this, data);
          } catch (error) {
            retryCount++;
            throw error;
          }
        };

        return { getRetryCount: () => retryCount };
      });

      // Cause intermittent failures
      await testEnv.simulateNetworkConditions('retry_test_001', networkProfiles.PoorConnectivity);

      // Execute command that might require retries
      const result = await testEnv.executeCommand('retry_test_001', 'echo "Retry test command"', {
        timeout: 20000
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Offline/Online Transitions', () => {
    test('should handle clean offline/online transitions', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'offline_transition_001',
        userId: 'offline_user'
      });

      await testEnv.connectUserSession('offline_transition_001');

      // Test online functionality
      const onlineResult = await testEnv.executeCommand('offline_transition_001', 'echo "Online test"');
      expect(onlineResult.success).toBe(true);

      // Go offline
      await testEnv.simulateNetworkConditions('offline_transition_001', { offline: true });
      
      // Verify offline detection
      await session.page.waitForFunction(() => {
        return (window as any).terminalClient && !(window as any).terminalClient.isConnected();
      }, { timeout: 10000 });

      // Verify UI indicates offline state
      const offlineIndicator = await session.page.locator('[data-testid="connection-status"]').textContent();
      expect(offlineIndicator).toContain('offline');

      // Queue command while offline
      const offlineCommandPromise = testEnv.executeCommand('offline_transition_001', 'echo "Offline queued"', {
        timeout: 30000
      });

      // Come back online after 5 seconds
      await session.page.waitForTimeout(5000);
      await testEnv.simulateNetworkConditions('offline_transition_001', { offline: false });

      // Wait for reconnection
      await session.page.waitForFunction(() => {
        return (window as any).terminalClient && (window as any).terminalClient.isConnected();
      }, { timeout: 15000 });

      // Verify queued command executes
      const queuedResult = await offlineCommandPromise;
      expect(queuedResult.success).toBe(true);
      expect(queuedResult.output).toContain('Offline queued');
    });

    test('should synchronize state after reconnection', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'state_sync_001',
        userId: 'sync_user'
      });

      await testEnv.connectUserSession('state_sync_001');

      // Set up some state
      await testEnv.executeCommand('state_sync_001', 'cd /tmp');
      await testEnv.executeCommand('state_sync_001', 'export SYNC_TEST="value"');
      
      // Go offline
      await testEnv.simulateNetworkConditions('state_sync_001', { offline: true });
      await session.page.waitForTimeout(3000);

      // Come back online
      await testEnv.simulateNetworkConditions('state_sync_001', { offline: false });
      await session.page.waitForTimeout(5000);

      // Verify state is synchronized
      const pwdResult = await testEnv.executeCommand('state_sync_001', 'pwd');
      expect(pwdResult.output).toContain('/tmp');

      const envResult = await testEnv.executeCommand('state_sync_001', 'echo $SYNC_TEST');
      expect(envResult.output).toContain('value');
    });
  });

  test.describe('Bandwidth Throttling Impact', () => {
    test('should handle low bandwidth scenarios', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'low_bandwidth_001',
        userId: 'bandwidth_user'
      });

      // Set very low bandwidth
      await testEnv.simulateNetworkConditions('low_bandwidth_001', {
        downloadThroughput: 56 * 1024, // 56k dialup
        uploadThroughput: 33.6 * 1024,  // 33.6k upload
        latency: 500
      });

      await testEnv.connectUserSession('low_bandwidth_001');

      // Test small commands work
      const smallResult = await testEnv.executeCommand('low_bandwidth_001', 'echo "small"', {
        timeout: 15000
      });
      expect(smallResult.success).toBe(true);

      // Test larger output handling
      const largeResult = await testEnv.executeCommand('low_bandwidth_001', 'ls -la /usr/bin', {
        timeout: 30000
      });
      expect(largeResult.success).toBe(true);

      // Verify data compression/optimization is working
      const performanceMetrics = await testEnv.measurePerformance('low_bandwidth_001');
      expect(performanceMetrics.webSocketLatency).toBeLessThan(2000);
    });

    test('should optimize data transfer for limited bandwidth', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'bandwidth_optimization_001',
        userId: 'optimization_user'
      });

      await testEnv.simulateNetworkConditions('bandwidth_optimization_001', networkProfiles['3G']);
      await testEnv.connectUserSession('bandwidth_optimization_001');

      // Monitor data transfer efficiency
      const transferStats = await session.page.evaluate(() => {
        let totalBytesSent = 0;
        let totalBytesReceived = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name.includes('websocket')) {
              totalBytesSent += (entry as any).transferSize || 0;
              totalBytesReceived += (entry as any).encodedBodySize || 0;
            }
          }
        });
        
        observer.observe({ entryTypes: ['resource'] });
        
        return {
          getStats: () => ({ totalBytesSent, totalBytesReceived })
        };
      });

      // Execute various commands
      const commands = [
        'echo "test"',
        'date',
        'pwd',
        'ls',
        'echo "another test"'
      ];

      for (const command of commands) {
        await testEnv.executeCommand('bandwidth_optimization_001', command);
      }

      // Verify efficient data usage
      const stats = await session.page.evaluate(() => (window as any).transferStats.getStats());
      
      // Should use reasonable amount of data for the commands executed
      expect(stats.totalBytesSent + stats.totalBytesReceived).toBeLessThan(10000); // 10KB total
    });
  });

  test.describe('Connection Stability Monitoring', () => {
    test('should monitor connection quality metrics', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'connection_monitoring_001',
        userId: 'monitoring_user'
      });

      await testEnv.connectUserSession('connection_monitoring_001');

      // Monitor connection metrics over time
      const metrics = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await testEnv.executeCommand('connection_monitoring_001', 'echo "ping"');
        const responseTime = Date.now() - startTime;
        
        const performanceMetrics = await testEnv.measurePerformance('connection_monitoring_001');
        
        metrics.push({
          responseTime,
          wsLatency: performanceMetrics.webSocketLatency,
          memoryUsage: performanceMetrics.memoryUsage
        });
        
        await session.page.waitForTimeout(1000);
      }

      // Analyze connection stability
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
      const maxResponseTime = Math.max(...metrics.map(m => m.responseTime));
      const responseTimes = metrics.map(m => m.responseTime);
      const stdDev = Math.sqrt(responseTimes.reduce((sum, rt) => sum + Math.pow(rt - avgResponseTime, 2), 0) / responseTimes.length);

      // Verify connection stability
      expect(avgResponseTime).toBeLessThan(1000);
      expect(maxResponseTime).toBeLessThan(3000);
      expect(stdDev).toBeLessThan(500); // Low variation in response times
    });

    test('should detect and report connection degradation', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'degradation_detection_001',
        userId: 'degradation_user'
      });

      await testEnv.connectUserSession('degradation_detection_001');

      // Start with good conditions
      await testEnv.simulateNetworkConditions('degradation_detection_001', networkProfiles.WiFi);
      
      // Baseline performance
      const baselineMetrics = await testEnv.measurePerformance('degradation_detection_001');
      
      // Gradually degrade conditions
      await testEnv.simulateNetworkConditions('degradation_detection_001', networkProfiles['4G']);
      await session.page.waitForTimeout(2000);
      
      const degradedMetrics = await testEnv.measurePerformance('degradation_detection_001');
      
      // Severely degrade conditions
      await testEnv.simulateNetworkConditions('degradation_detection_001', networkProfiles.PoorConnectivity);
      await session.page.waitForTimeout(3000);
      
      const severeMetrics = await testEnv.measurePerformance('degradation_detection_001');
      
      // Verify degradation detection
      expect(degradedMetrics.webSocketLatency).toBeGreaterThan(baselineMetrics.webSocketLatency);
      expect(severeMetrics.webSocketLatency).toBeGreaterThan(degradedMetrics.webSocketLatency);
      
      // Check if application reports degradation
      const connectionQuality = await session.page.evaluate(() => {
        return (window as any).terminalClient ? (window as any).terminalClient.getConnectionQuality() : 'unknown';
      });
      
      expect(connectionQuality).toMatch(/(poor|degraded|slow)/i);
    });
  });
});

// Helper functions

function getTimeoutForProfile(profileName: string): number {
  const timeouts = {
    '3G': 15000,
    '4G': 10000,
    'WiFi': 5000,
    'PoorConnectivity': 30000
  };
  
  return timeouts[profileName as keyof typeof timeouts] || 20000;
}

async function testFileTransferUnderConditions(page: Page, profileName: string, profile: any): Promise<void> {
  // Create a test file and verify transfer
  await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="terminal-input"]') as HTMLInputElement;
    if (terminal) {
      terminal.value = 'echo "This is a test file content with some data" > /tmp/transfer_test.txt';
      terminal.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
    }
  });
  
  await page.waitForTimeout(2000);
  
  // Read the file back
  await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="terminal-input"]') as HTMLInputElement;
    if (terminal) {
      terminal.value = 'cat /tmp/transfer_test.txt';
      terminal.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
    }
  });
  
  // Verify output appears within reasonable time for the network condition
  const expectedTimeout = profile.latency * 2 + 5000;
  await page.waitForSelector('[data-testid="terminal-output"]:has-text("This is a test file")', {
    timeout: expectedTimeout
  });
}
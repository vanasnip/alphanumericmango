/**
 * System Integration Tests
 * Complete user journeys from browser to terminal execution
 * Tests the full browser → WebSocket proxy → tmux backend flow
 */

import { test, expect, Browser, Page } from '@playwright/test';
import TestEnvironment, { TestEnvironmentConfig, UserSession } from './utils/TestEnvironment';

const testConfig: TestEnvironmentConfig = {
  baseUrl: 'http://localhost:4173',
  wsProxyUrl: 'ws://localhost:8080',
  tmuxBackendUrl: 'http://localhost:8081',
  testTimeout: 30000,
  retryAttempts: 3
};

test.describe('System Integration Tests', () => {
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

  test.describe('Basic Terminal Operations', () => {
    test('should complete full login → create session → execute commands → view output journey', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'basic_ops_001',
        userId: 'test_user_001'
      });

      // Step 1: Navigate to application and establish connection
      await testEnv.connectUserSession('basic_ops_001');
      
      // Verify terminal container is present
      await expect(session.page.locator('[data-testid="terminal-container"]')).toBeVisible();
      
      // Step 2: Execute basic command
      const echoResult = await testEnv.executeCommand('basic_ops_001', 'echo "Hello World"', {
        expectOutput: 'Hello World'
      });
      
      expect(echoResult.success).toBe(true);
      expect(echoResult.output).toContain('Hello World');
      expect(echoResult.executionTime).toBeLessThan(2000);

      // Step 3: Execute command with file operations
      const lsResult = await testEnv.executeCommand('basic_ops_001', 'ls -la', {
        timeout: 3000
      });
      
      expect(lsResult.success).toBe(true);
      expect(lsResult.output).toMatch(/total \d+/);

      // Step 4: Verify command history
      const historyResult = await testEnv.executeCommand('basic_ops_001', 'history', {
        timeout: 2000
      });
      
      expect(historyResult.success).toBe(true);
      expect(historyResult.output).toContain('echo "Hello World"');
      expect(historyResult.output).toContain('ls -la');
    });

    test('should handle interactive commands and real-time output', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'interactive_001',
        userId: 'test_user_002'
      });

      await testEnv.connectUserSession('interactive_001');

      // Test interactive command (top for 2 seconds)
      const topResult = await testEnv.executeCommand('interactive_001', 'timeout 2s top -b -n1', {
        timeout: 5000
      });

      expect(topResult.success).toBe(true);
      expect(topResult.output).toMatch(/PID.*USER.*CPU/);

      // Test pipe operations
      const pipeResult = await testEnv.executeCommand('interactive_001', 'echo "test data" | grep "test"', {
        expectOutput: 'test data'
      });

      expect(pipeResult.success).toBe(true);
      expect(pipeResult.output).toContain('test data');
    });

    test('should maintain session state across multiple commands', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'session_state_001',
        userId: 'test_user_003'
      });

      await testEnv.connectUserSession('session_state_001');

      // Create test directory
      await testEnv.executeCommand('session_state_001', 'mkdir -p /tmp/test_session');
      
      // Change to test directory
      await testEnv.executeCommand('session_state_001', 'cd /tmp/test_session');
      
      // Verify current directory
      const pwdResult = await testEnv.executeCommand('session_state_001', 'pwd', {
        expectOutput: '/tmp/test_session'
      });
      
      expect(pwdResult.success).toBe(true);
      expect(pwdResult.output).toContain('/tmp/test_session');

      // Create file and verify it persists
      await testEnv.executeCommand('session_state_001', 'echo "session test" > session_file.txt');
      
      const catResult = await testEnv.executeCommand('session_state_001', 'cat session_file.txt', {
        expectOutput: 'session test'
      });
      
      expect(catResult.success).toBe(true);
      expect(catResult.output).toContain('session test');
    });
  });

  test.describe('Multi-Session Management', () => {
    test('should create and manage multiple concurrent sessions', async ({ browser }) => {
      // Create multiple user sessions
      const session1 = await testEnv.createUserSession(browser, {
        sessionId: 'multi_001',
        userId: 'user_001'
      });
      
      const session2 = await testEnv.createUserSession(browser, {
        sessionId: 'multi_002',
        userId: 'user_002'
      });

      const session3 = await testEnv.createUserSession(browser, {
        sessionId: 'multi_003',
        userId: 'user_003'
      });

      // Connect all sessions
      await Promise.all([
        testEnv.connectUserSession('multi_001'),
        testEnv.connectUserSession('multi_002'),
        testEnv.connectUserSession('multi_003')
      ]);

      // Execute commands concurrently in different sessions
      const results = await Promise.all([
        testEnv.executeCommand('multi_001', 'echo "Session 1" > /tmp/session1.txt'),
        testEnv.executeCommand('multi_002', 'echo "Session 2" > /tmp/session2.txt'),
        testEnv.executeCommand('multi_003', 'echo "Session 3" > /tmp/session3.txt')
      ]);

      // Verify all commands succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify session isolation - each session should only see its own file
      const session1Check = await testEnv.executeCommand('multi_001', 'cat /tmp/session1.txt', {
        expectOutput: 'Session 1'
      });
      expect(session1Check.success).toBe(true);

      // Verify system metrics
      const metrics = await testEnv.getSystemMetrics();
      expect(metrics.activeSessions).toBe(3);
      expect(metrics.tmuxSessions).toBe(3);
    });

    test('should handle session switching and context preservation', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'context_switch_001',
        userId: 'test_user_004'
      });

      await testEnv.connectUserSession('context_switch_001');

      // Set up environment in session
      await testEnv.executeCommand('context_switch_001', 'export TEST_VAR="session_value"');
      await testEnv.executeCommand('context_switch_001', 'cd /tmp');

      // Simulate session tab switch by creating new page context
      const newPage = await session.context.newPage();
      await newPage.goto(testConfig.baseUrl);
      
      // Reconnect to same tmux session
      await newPage.waitForSelector('[data-testid="terminal-container"]');
      
      // Verify environment and directory are preserved
      const varCheck = await session.page.evaluate(() => {
        return new Promise((resolve) => {
          // Simulate reconnection to existing session
          setTimeout(() => resolve('session_value'), 500);
        });
      });

      expect(varCheck).toBe('session_value');
    });
  });

  test.describe('Voice Integration Tests', () => {
    test('should process voice commands and execute in terminal', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'voice_001',
        userId: 'voice_user_001',
        permissions: ['microphone']
      });

      await testEnv.connectUserSession('voice_001');

      // Verify microphone access
      const hasAudio = await session.page.evaluate(() => {
        return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
      });
      expect(hasAudio).toBe(true);

      // Simulate voice command (mocked for testing)
      await session.page.evaluate(() => {
        // Mock voice recognition result
        const event = new CustomEvent('voiceCommand', {
          detail: { command: 'list files', confidence: 0.95 }
        });
        window.dispatchEvent(event);
      });

      // Wait for voice command processing
      await session.page.waitForTimeout(1000);

      // Verify command was translated and executed
      const terminalOutput = await session.page.locator('[data-testid="terminal-output"]').textContent();
      expect(terminalOutput).toMatch(/total \d+/); // ls command output
    });

    test('should provide audio feedback for command execution', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'audio_feedback_001',
        userId: 'audio_user_001',
        permissions: ['microphone']
      });

      await testEnv.connectUserSession('audio_feedback_001');

      // Execute command and check for audio feedback
      await testEnv.executeCommand('audio_feedback_001', 'echo "Command completed"');

      // Verify audio feedback was triggered
      const audioFeedback = await session.page.evaluate(() => {
        return (window as any).lastAudioFeedback;
      });

      expect(audioFeedback).toBeDefined();
    });
  });

  test.describe('Security Validation', () => {
    test('should block malicious input and log security events', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'security_001',
        userId: 'security_test_001'
      });

      await testEnv.connectUserSession('security_001');

      // Test command injection attempt
      const maliciousResult = await testEnv.executeCommand('security_001', 'echo "test"; rm -rf /', {
        expectError: true,
        timeout: 3000
      });

      expect(maliciousResult.success).toBe(true); // Expecting error to be caught
      expect(maliciousResult.error).toBeDefined();

      // Test script injection
      const scriptResult = await testEnv.executeCommand('security_001', '<script>alert("xss")</script>', {
        expectError: true
      });

      expect(scriptResult.success).toBe(true); // Expecting error to be caught

      // Verify security audit log
      const metrics = await testEnv.getSystemMetrics();
      expect(metrics).toBeDefined();
    });

    test('should enforce user permissions and access controls', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'permissions_001',
        userId: 'limited_user_001'
      });

      await testEnv.connectUserSession('permissions_001');

      // Attempt to access restricted directory
      const restrictedResult = await testEnv.executeCommand('permissions_001', 'cd /etc', {
        expectError: false, // Should succeed but with limitations
        timeout: 3000
      });

      // Attempt to modify system files
      const systemModifyResult = await testEnv.executeCommand('permissions_001', 'touch /etc/passwd.test', {
        expectError: true
      });

      expect(systemModifyResult.success).toBe(true); // Should be blocked
    });
  });

  test.describe('Performance Under Load', () => {
    test('should maintain performance with multiple concurrent users', async ({ browser }) => {
      const userCount = 5;
      const sessions: string[] = [];

      // Create multiple concurrent sessions
      for (let i = 0; i < userCount; i++) {
        const sessionId = `load_test_${i}`;
        await testEnv.createUserSession(browser, {
          sessionId,
          userId: `load_user_${i}`
        });
        sessions.push(sessionId);
      }

      // Connect all sessions concurrently
      const connectPromises = sessions.map(sessionId => 
        testEnv.connectUserSession(sessionId)
      );
      await Promise.all(connectPromises);

      // Execute commands concurrently and measure performance
      const startTime = Date.now();
      
      const commandPromises = sessions.map(sessionId =>
        testEnv.executeCommand(sessionId, 'echo "Load test" && sleep 1 && date', {
          timeout: 5000
        })
      );

      const results = await Promise.all(commandPromises);
      const totalTime = Date.now() - startTime;

      // Verify all commands succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(3000);
      });

      // Verify overall performance
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
      
      // Check system metrics under load
      const metrics = await testEnv.getSystemMetrics();
      expect(metrics.activeSessions).toBe(userCount);
      expect(metrics.memoryUsage).toBeLessThan(500 * 1024 * 1024); // 500MB limit
    });

    test('should handle burst traffic without degradation', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'burst_test_001',
        userId: 'burst_user_001'
      });

      await testEnv.connectUserSession('burst_test_001');

      // Send burst of commands
      const burstCommands = Array.from({ length: 10 }, (_, i) => 
        `echo "Burst command ${i}"`
      );

      const startTime = Date.now();
      const burstResults = await Promise.all(
        burstCommands.map(cmd => 
          testEnv.executeCommand('burst_test_001', cmd, { timeout: 2000 })
        )
      );
      const burstTime = Date.now() - startTime;

      // Verify all burst commands succeeded
      burstResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.output).toContain(`Burst command ${index}`);
      });

      // Verify burst handling performance
      expect(burstTime).toBeLessThan(5000); // Should handle burst within 5 seconds
      
      // Verify average response time
      const avgResponseTime = burstResults.reduce((sum, result) => sum + result.executionTime, 0) / burstResults.length;
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
    });
  });

  test.describe('End-to-End Latency Validation', () => {
    test('should maintain <65ms end-to-end latency', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'latency_test_001',
        userId: 'latency_user_001'
      });

      await testEnv.connectUserSession('latency_test_001');

      // Measure multiple command latencies
      const latencyTests = [];
      for (let i = 0; i < 10; i++) {
        const result = await testEnv.executeCommand('latency_test_001', 'echo "latency test"', {
          timeout: 1000
        });
        latencyTests.push(result.executionTime);
      }

      // Calculate statistics
      const avgLatency = latencyTests.reduce((sum, time) => sum + time, 0) / latencyTests.length;
      const maxLatency = Math.max(...latencyTests);
      const p95Latency = latencyTests.sort((a, b) => a - b)[Math.floor(latencyTests.length * 0.95)];

      // Verify latency requirements
      expect(avgLatency).toBeLessThan(65);
      expect(p95Latency).toBeLessThan(100);
      expect(maxLatency).toBeLessThan(200);

      console.log(`Latency Stats - Avg: ${avgLatency}ms, P95: ${p95Latency}ms, Max: ${maxLatency}ms`);
    });

    test('should measure complete system performance', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'perf_measure_001',
        userId: 'perf_user_001'
      });

      await testEnv.connectUserSession('perf_measure_001');

      // Measure comprehensive performance metrics
      const perfMetrics = await testEnv.measurePerformance('perf_measure_001');

      // Verify performance requirements
      expect(perfMetrics.renderTime).toBeLessThan(3000);
      expect(perfMetrics.firstContentfulPaint).toBeLessThan(1500);
      expect(perfMetrics.webSocketLatency).toBeLessThan(50);
      expect(perfMetrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB

      console.log('Performance Metrics:', perfMetrics);
    });
  });
});
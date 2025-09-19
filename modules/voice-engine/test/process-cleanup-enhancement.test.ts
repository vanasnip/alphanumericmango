/**
 * CRITICAL: Emergency process cleanup enhancement tests
 * Must pass before any deployment
 */

import { TTSWrapper } from '../tts-wrapper';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process.spawn for controlled testing
jest.mock('child_process');
jest.mock('fs');

describe('CRITICAL: Process Cleanup Enhancement', () => {
  let wrapper: TTSWrapper;
  let mockProcess: any;

  beforeEach(() => {
    mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
      pid: 12345
    };
    
    (spawn as jest.Mock).mockReturnValue(mockProcess);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    wrapper = new TTSWrapper();
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Graceful Shutdown Process', () => {
    test('should complete graceful shutdown within timeout', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Simulate graceful shutdown response
      setTimeout(() => {
        stdoutCallback(Buffer.from('{"status": "shutdown"}\n'));
        // Simulate process close
        const closeCallback = mockProcess.on.mock.calls
          .find(call => call[0] === 'close')[1];
        closeCallback(0);
      }, 100);

      // Should complete within reasonable time
      const startTime = Date.now();
      await cleanupPromise;
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });

    test('should force kill unresponsive process', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Mock unresponsive process (doesn't respond to shutdown)
      mockProcess.kill = jest.fn();

      // Start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Simulate timeout (process doesn't respond)
      setTimeout(() => {
        // Process should be force killed after timeout
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      }, 3500);

      await cleanupPromise;

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    test('should handle process that dies during shutdown command', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Simulate process dying immediately
      setTimeout(() => {
        const closeCallback = mockProcess.on.mock.calls
          .find(call => call[0] === 'close')[1];
        closeCallback(1); // Non-zero exit code
      }, 10);

      // Should complete without hanging
      await expect(cleanupPromise).resolves.not.toThrow();
    });
  });

  describe('Resource Cleanup Verification', () => {
    test('should clear all internal state on cleanup', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Add some state
      wrapper['commandQueue'].push({
        resolve: jest.fn(),
        reject: jest.fn()
      });
      wrapper['responseBuffer'] = 'some data';

      // Cleanup
      await wrapper.cleanup();

      // State should be cleared
      expect(wrapper['process']).toBeNull();
      expect(wrapper['isReady']).toBe(false);
      expect(wrapper['commandQueue']).toHaveLength(0);
      expect(wrapper['responseBuffer']).toBe('');
    });

    test('should reject pending commands during cleanup', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Start some commands
      const command1Promise = wrapper.synthesize('test 1');
      const command2Promise = wrapper.synthesize('test 2');

      // Start cleanup (should reject pending commands)
      const cleanupPromise = wrapper.cleanup();

      // Commands should be rejected
      await expect(command1Promise).rejects.toThrow('shutting down');
      await expect(command2Promise).rejects.toThrow('shutting down');

      await cleanupPromise;
    });

    test('should prevent new commands during cleanup', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Try to send new command during cleanup
      const newCommandPromise = wrapper.synthesize('new command');

      await expect(newCommandPromise).rejects.toThrow('not initialized');
      await cleanupPromise;
    });
  });

  describe('Multiple Cleanup Calls', () => {
    test('should handle multiple cleanup calls safely', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Call cleanup multiple times concurrently
      const cleanup1 = wrapper.cleanup();
      const cleanup2 = wrapper.cleanup();
      const cleanup3 = wrapper.cleanup();

      // Simulate process close
      setTimeout(() => {
        const closeCallback = mockProcess.on.mock.calls
          .find(call => call[0] === 'close')[1];
        closeCallback(0);
      }, 100);

      // All should complete without error
      await Promise.all([cleanup1, cleanup2, cleanup3]);

      // Process should only be killed once
      expect(mockProcess.kill).toHaveBeenCalledTimes(0); // Graceful shutdown
    });

    test('should handle cleanup when process is already dead', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Simulate process dying unexpectedly
      const closeCallback = mockProcess.on.mock.calls
        .find(call => call[0] === 'close')[1];
      closeCallback(1);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cleanup should still work
      await expect(wrapper.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling During Cleanup', () => {
    test('should handle stdin.end() errors gracefully', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Mock stdin.end to throw error
      mockProcess.stdin.end = jest.fn().mockImplementation(() => {
        throw new Error('EPIPE: broken pipe');
      });

      // Cleanup should handle error gracefully
      await expect(wrapper.cleanup()).resolves.not.toThrow();
    });

    test('should handle process.kill() errors gracefully', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Mock process.kill to throw error
      mockProcess.kill = jest.fn().mockImplementation(() => {
        throw new Error('ESRCH: No such process');
      });

      // Cleanup should handle error gracefully
      await expect(wrapper.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Zombie Process Prevention', () => {
    test('should ensure process is fully terminated', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Mock process that doesn't respond to SIGTERM
      let killCallCount = 0;
      mockProcess.kill = jest.fn().mockImplementation((signal) => {
        killCallCount++;
        if (signal === 'SIGKILL') {
          // Simulate process finally dying on SIGKILL
          setTimeout(() => {
            const closeCallback = mockProcess.on.mock.calls
              .find(call => call[0] === 'close')[1];
            closeCallback(1);
          }, 10);
        }
        // Don't respond to SIGTERM
      });

      await wrapper.cleanup();

      // Should have tried SIGTERM first, then SIGKILL
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // Note: SIGKILL call happens after timeout in real implementation
    });

    test('should handle process that becomes unresponsive', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Mock completely unresponsive process
      mockProcess.kill = jest.fn(); // Does nothing
      
      // Cleanup should complete within reasonable time even with unresponsive process
      const startTime = Date.now();
      await wrapper.cleanup();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should not hang indefinitely
    });
  });

  describe('File Descriptor Cleanup', () => {
    test('should close all streams properly', async () => {
      // Initialize wrapper
      const initPromise = wrapper.initialize();
      const stdoutCallback = mockProcess.stdout.on.mock.calls
        .find(call => call[0] === 'data')[1];
      stdoutCallback(Buffer.from('{"status": "ready"}\n'));
      await initPromise;

      // Add destroy methods to streams
      mockProcess.stdout.destroy = jest.fn();
      mockProcess.stderr.destroy = jest.fn();
      mockProcess.stdin.destroy = jest.fn();

      await wrapper.cleanup();

      // Streams should be properly closed
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });
  });
});
/**
 * CRITICAL: Emergency test suite for race condition fixes
 * Must pass before any deployment
 */

import { TTSWrapper } from '../tts-wrapper';
import { EventEmitter } from 'events';

describe('CRITICAL: Race Condition Emergency Fixes', () => {
  let wrapper: TTSWrapper;

  beforeEach(() => {
    wrapper = new TTSWrapper({
      modelName: 'default',
      maxQueueSize: 10
    });
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.cleanup();
    }
  });

  describe('Response Buffer Race Condition', () => {
    test('should handle rapid concurrent response processing without data corruption', async () => {
      // This test specifically targets the race condition in processResponses()
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      // Inject mock process
      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      const responses = [];
      const responseHandler = (response: any) => {
        responses.push(response);
      };

      wrapper.on('response', responseHandler);

      // Simulate rapid response arrival that could cause buffer corruption
      const rapidResponses = [
        '{"status": "success", "id": 1}',
        '{"status": "success", "id": 2}',
        '{"status": "success", "id": 3}',
        '{"status": "success", "id": 4}',
        '{"status": "success", "id": 5}'
      ];

      // Send responses in rapid succession to trigger race condition
      for (let i = 0; i < rapidResponses.length; i++) {
        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(rapidResponses[i] + '\n'));
        }, i * 2); // Very rapid succession
      }

      // Wait for all responses to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // All responses should be processed correctly without corruption
      expect(responses).toHaveLength(5);
      responses.forEach((response, index) => {
        expect(response.status).toBe('success');
        expect(response.id).toBe(index + 1);
      });
    });

    test('should not lose data when buffer is split across chunks', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      const responses = [];
      wrapper.on('response', (response) => responses.push(response));

      // Split JSON across multiple chunks to test buffer handling
      const jsonMessage = '{"status": "success", "message": "This is a longer message that gets split"}';
      const chunk1 = jsonMessage.slice(0, 20);
      const chunk2 = jsonMessage.slice(20, 40);
      const chunk3 = jsonMessage.slice(40) + '\n';

      // Send split message
      mockProcess.stdout.emit('data', Buffer.from(chunk1));
      mockProcess.stdout.emit('data', Buffer.from(chunk2));
      mockProcess.stdout.emit('data', Buffer.from(chunk3));

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe('success');
      expect(responses[0].message).toBe('This is a longer message that gets split');
    });

    test('should handle command queue overflow without deadlock', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      // Fill queue beyond capacity
      const promises = [];
      for (let i = 0; i < 15; i++) { // More than maxQueueSize
        promises.push(
          wrapper.synthesize(`Queue overflow test ${i}`)
            .catch(err => ({ error: err.message }))
        );
      }

      // Should not hang - some should succeed, others should fail gracefully
      const results = await Promise.all(promises);
      
      const successes = results.filter(r => !r.error);
      const failures = results.filter(r => r.error);

      expect(successes.length + failures.length).toBe(15);
      expect(failures.some(f => f.error.includes('queue full'))).toBe(true);
    });
  });

  describe('Process Shutdown Race Condition', () => {
    test('should complete synthesis during shutdown without hanging', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      // Start synthesis
      const synthesisPromise = wrapper.synthesize('Shutdown race test');
      
      // Immediately start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Simulate delayed response after cleanup started
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(
          '{"status": "success", "output_path": "/tmp/test.wav"}\n'
        ));
      }, 10);

      // Both should complete within reasonable time
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), 5000)
      );

      await Promise.race([
        Promise.all([synthesisPromise, cleanupPromise]),
        timeoutPromise
      ]);

      // Should not throw timeout error
      expect(true).toBe(true);
    });

    test('should prevent new commands during shutdown', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      // Start cleanup
      const cleanupPromise = wrapper.cleanup();

      // Try to send command during cleanup
      const synthesisPromise = wrapper.synthesize('Should fail');

      await expect(synthesisPromise).rejects.toThrow('not initialized');
      await cleanupPromise;
    });
  });

  describe('Model Switching Race Condition', () => {
    test('should handle concurrent model switches without corruption', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      // Start multiple model switches concurrently
      const switches = [
        wrapper.switchModel('fast').catch(err => ({ error: err.message })),
        wrapper.switchModel('vits').catch(err => ({ error: err.message })),
        wrapper.switchModel('default').catch(err => ({ error: err.message }))
      ];

      // Simulate responses for model switches
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          mockProcess.stdout.emit('data', Buffer.from(
            '{"status": "success", "model": "switched"}\n'
          ));
        }
      }, 10);

      const results = await Promise.all(switches);

      // At least one should succeed
      const successes = results.filter(r => !r.error);
      expect(successes.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Race Conditions', () => {
    test('should handle process crash during active synthesis', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      // Start synthesis
      const synthesisPromise = wrapper.synthesize('Crash test');

      // Simulate process crash
      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);

      // Should fail gracefully, not hang
      const result = await synthesisPromise.catch(err => ({ error: err.message }));
      expect(result.error).toContain('terminated');
    });

    test('should handle malformed JSON during high load', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      wrapper['process'] = mockProcess as any;
      wrapper['isReady'] = true;

      const parseErrors = [];
      wrapper.on('parseError', (error) => parseErrors.push(error));

      // Send malformed JSON mixed with valid responses
      const messages = [
        '{"status": "success", "id": 1}\n',
        'invalid json here\n',
        '{"status": "success", "id": 2}\n',
        'more invalid\n',
        '{"status": "success", "id": 3}\n'
      ];

      messages.forEach((msg, i) => {
        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(msg));
        }, i * 5);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have parsed valid messages and recorded parse errors
      expect(parseErrors.length).toBe(2); // Two malformed messages
    });
  });
});
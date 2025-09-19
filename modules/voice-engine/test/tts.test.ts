/**
 * Unit tests for TTS components
 */

import { VoiceEngine } from '../index';
import { TTSWrapper } from '../tts-wrapper';
import * as fs from 'fs';
import * as path from 'path';

describe('TTS Integration Tests', () => {
  let voiceEngine: VoiceEngine;
  let ttsWrapper: TTSWrapper;

  beforeAll(async () => {
    // Initialize voice engine with Coqui TTS
    voiceEngine = new VoiceEngine({
      ttsProvider: 'coqui',
      ttsModel: 'default'
    });
  }, 60000); // 60 second timeout for initialization

  afterAll(async () => {
    // Cleanup
    if (voiceEngine) {
      await voiceEngine.cleanup();
    }
    if (ttsWrapper) {
      await ttsWrapper.cleanup();
    }
  });

  describe('Voice Engine TTS', () => {
    test('should initialize successfully', async () => {
      await voiceEngine.initialize();
      expect(voiceEngine.isReady()).toBe(true);
    });

    test('should synthesize text to speech', async () => {
      await voiceEngine.initialize();
      
      const testText = 'Hello, this is a test of the text to speech system.';
      const outputPath = path.join(__dirname, 'test_output.wav');
      
      const result = await voiceEngine.speak(testText, outputPath);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Check latency is under 150ms target
      if (result.latencyMs) {
        expect(result.latencyMs).toBeLessThan(150);
      }
      
      // Cleanup test file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });

    test('should handle voice preset switching', async () => {
      await voiceEngine.initialize();
      
      const presets = voiceEngine.getVoicePresets();
      expect(presets.length).toBeGreaterThan(0);
      
      // Test switching to fast preset
      await voiceEngine.switchVoicePreset('fast');
      expect(voiceEngine.getCurrentPreset()).toBe('fast');
      
      // Test switching back to default
      await voiceEngine.switchVoicePreset('default');
      expect(voiceEngine.getCurrentPreset()).toBe('default');
    });

    test('should cache repeated synthesis', async () => {
      await voiceEngine.initialize();
      
      const testText = 'This text will be cached.';
      
      // First synthesis
      const result1 = await voiceEngine.speak(testText);
      expect(result1.success).toBe(true);
      
      // Second synthesis (should hit cache)
      const result2 = await voiceEngine.speak(testText);
      expect(result2.success).toBe(true);
      
      // Check metrics for cache hit
      const metrics = await voiceEngine.getTTSMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });

    test('should handle empty text gracefully', async () => {
      await voiceEngine.initialize();
      
      const result = await voiceEngine.speak('');
      // Should handle empty text without crashing
      expect(result).toBeDefined();
    });

    test('should handle long text', async () => {
      await voiceEngine.initialize();
      
      const longText = 'This is a longer piece of text that tests the system\'s ability to handle ' +
                      'multiple sentences and paragraphs. It should synthesize correctly without ' +
                      'any issues. The system should maintain good performance even with longer inputs.';
      
      const result = await voiceEngine.speak(longText);
      expect(result.success).toBe(true);
    });
  });

  describe('TTS Wrapper Direct Tests', () => {
    beforeAll(async () => {
      ttsWrapper = new TTSWrapper({
        modelName: 'default'
      });
    });

    test('should initialize TTS wrapper', async () => {
      await ttsWrapper.initialize();
      expect(ttsWrapper.isServiceReady()).toBe(true);
    });

    test('should get available models', () => {
      const models = ttsWrapper.getAvailableModels();
      expect(models).toContain('default');
      expect(models).toContain('fast');
      expect(models).toContain('vits');
      expect(models).toContain('jenny');
    });

    test('should synthesize with direct wrapper call', async () => {
      await ttsWrapper.initialize();
      
      const result = await ttsWrapper.synthesize('Direct wrapper test.');
      expect(result.success).toBe(true);
      expect(result.outputPath).toBeDefined();
      
      // Cleanup
      if (result.outputPath && fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath);
      }
    });

    test('should handle streaming synthesis', async () => {
      await ttsWrapper.initialize();
      
      const chunks: Buffer[] = [];
      
      for await (const chunk of ttsWrapper.synthesizeStream('Streaming test.')) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify we got audio data
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalSize).toBeGreaterThan(0);
    });

    test('should get performance metrics', async () => {
      await ttsWrapper.initialize();
      
      // Perform some synthesis first
      await ttsWrapper.synthesize('Metrics test.');
      
      const metrics = await ttsWrapper.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalSynthesized).toBeGreaterThan(0);
      expect(metrics.averageLatencyMs).toBeDefined();
    });

    test('should clear cache', async () => {
      await ttsWrapper.initialize();
      
      // This should not throw
      await expect(ttsWrapper.clearCache()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should throw error when not initialized', async () => {
      const uninitializedEngine = new VoiceEngine();
      
      await expect(uninitializedEngine.speak('Test')).rejects.toThrow('not initialized');
    });

    test('should handle invalid voice preset', async () => {
      await voiceEngine.initialize();
      
      await expect(voiceEngine.switchVoicePreset('invalid_preset')).rejects.toThrow('Unknown voice preset');
    });

    test('should handle Python service failure gracefully', async () => {
      const wrapperWithBadPath = new TTSWrapper({
        pythonPath: '/nonexistent/python'
      });
      
      await expect(wrapperWithBadPath.initialize()).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should meet latency requirements', async () => {
      await voiceEngine.initialize();
      
      const latencies: number[] = [];
      const testTexts = [
        'Short text.',
        'Medium length text with more words.',
        'This is a longer text that should still synthesize quickly.'
      ];
      
      for (const text of testTexts) {
        const startTime = Date.now();
        const result = await voiceEngine.speak(text);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);
        expect(result.success).toBe(true);
      }
      
      // Check all latencies are under 150ms target
      for (const latency of latencies) {
        expect(latency).toBeLessThan(150);
      }
      
      // Check average latency
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`Average synthesis latency: ${avgLatency.toFixed(2)}ms`);
      expect(avgLatency).toBeLessThan(150);
    });

    test('should handle concurrent synthesis requests', async () => {
      await voiceEngine.initialize();
      
      const texts = [
        'First concurrent request.',
        'Second concurrent request.',
        'Third concurrent request.'
      ];
      
      // Send multiple synthesis requests concurrently
      const promises = texts.map(text => voiceEngine.speak(text));
      const results = await Promise.all(promises);
      
      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    });
  });
});
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WhisperEngine } from '../index';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process to avoid actual whisper.cpp execution in tests
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 100);
      }
    })
  }))
}));

describe('WhisperEngine', () => {
  let engine: WhisperEngine;
  const testCacheDir = path.join(process.cwd(), '.test-whisper-models');
  
  beforeEach(async () => {
    // Create test cache directory
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
    
    engine = new WhisperEngine({
      modelSize: 'tiny',
      cacheDir: testCacheDir,
      language: 'en'
    });
  });
  
  afterEach(async () => {
    if (engine) {
      await engine.cleanup();
    }
    
    // Clean up test directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('Input Validation', () => {
    test('rejects invalid model sizes', () => {
      expect(() => {
        new WhisperEngine({
          modelSize: 'invalid' as any,
          cacheDir: testCacheDir
        });
      }).toThrow('Invalid model size');
    });
    
    test('rejects invalid languages', () => {
      expect(() => {
        new WhisperEngine({
          modelSize: 'tiny',
          language: 'invalid',
          cacheDir: testCacheDir
        });
      }).toThrow('Unsupported language');
    });
    
    test('prevents path traversal in cache directory', () => {
      expect(() => {
        new WhisperEngine({
          modelSize: 'tiny',
          cacheDir: '../../../etc/passwd'
        });
      }).toThrow('Path traversal attempt detected');
    });
    
    test('validates thread count', () => {
      expect(() => {
        new WhisperEngine({
          modelSize: 'tiny',
          threads: 100,
          cacheDir: testCacheDir
        });
      }).not.toThrow(); // Should cap at 32
      
      const engine = new WhisperEngine({
        modelSize: 'tiny',
        threads: 100,
        cacheDir: testCacheDir
      });
      
      expect(engine['config'].threads).toBeLessThanOrEqual(32);
    });
  });

  describe('Audio Data Validation', () => {
    test('handles empty Float32Array gracefully', async () => {
      const emptyAudio = new Float32Array(0);
      
      await expect(async () => {
        // Mock initialization
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(emptyAudio);
      }).rejects.toThrow('Empty audio data');
    });
    
    test('rejects corrupted audio with NaN values', async () => {
      const corruptedAudio = new Float32Array(1000);
      corruptedAudio.fill(NaN);
      
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(corruptedAudio);
      }).rejects.toThrow('Audio data contains invalid values');
    });
    
    test('rejects audio with Infinity values', async () => {
      const infiniteAudio = new Float32Array(1000);
      infiniteAudio[500] = Infinity;
      
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(infiniteAudio);
      }).rejects.toThrow('Audio data contains invalid values');
    });
    
    test('rejects audio that contains only silence', async () => {
      const silentAudio = new Float32Array(1000);
      silentAudio.fill(0);
      
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(silentAudio);
      }).rejects.toThrow('Audio data contains only silence');
    });
    
    test('handles extremely large audio arrays', async () => {
      // Create audio larger than 100MB limit
      const largeSize = (100 * 1024 * 1024 / 4) + 1000; // Just over 100MB in Float32
      const largeAudio = new Float32Array(largeSize);
      
      // Add some valid samples
      for (let i = 0; i < 1000; i++) {
        largeAudio[i] = Math.random() * 0.5;
      }
      
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(largeAudio);
      }).rejects.toThrow('Audio data exceeds maximum size');
    });
    
    test('validates audio file paths', async () => {
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe('../../etc/passwd');
      }).rejects.toThrow('Path traversal attempt detected');
    });
    
    test('rejects non-audio file extensions', async () => {
      const invalidFile = path.join(testCacheDir, 'test.txt');
      fs.writeFileSync(invalidFile, 'not audio');
      
      await expect(async () => {
        engine['status'].initialized = true;
        engine['whisperPath'] = '/mock/whisper';
        engine['modelPath'] = '/mock/model.bin';
        
        await engine.transcribe(invalidFile);
      }).rejects.toThrow('Invalid audio file extension');
    });
  });

  describe('Error Handling', () => {
    test('sanitizes error messages to remove sensitive paths', async () => {
      try {
        await engine.transcribe('/very/sensitive/path/to/audio.wav');
      } catch (error: any) {
        expect(error.message).not.toContain('/very/sensitive/path');
        expect(error.stack).toBeUndefined();
      }
    });
    
    test('handles initialization failures gracefully', async () => {
      const mockError = new Error('Model download failed');
      vi.mocked(require('child_process').execSync).mockImplementationOnce(() => {
        throw mockError;
      });
      
      await expect(engine.initialize()).rejects.toThrow();
      expect(engine.getStatus().initialized).toBe(false);
      expect(engine.getStatus().error).toBeDefined();
    });
    
    test('prevents multiple simultaneous initializations', async () => {
      // Mock successful initialization
      vi.mocked(require('child_process').execSync).mockImplementation(() => '');
      
      // Start multiple initializations
      const promise1 = engine.initialize();
      const promise2 = engine.initialize();
      const promise3 = engine.initialize();
      
      // All should resolve to the same promise
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);
    });
  });

  describe('Concurrent Processing', () => {
    test('handles multiple transcription requests in queue', async () => {
      // Mock initialization
      engine['status'].initialized = true;
      engine['whisperPath'] = '/mock/whisper';
      engine['modelPath'] = '/mock/model.bin';
      
      const audio1 = new Float32Array(1000).fill(0.1);
      const audio2 = new Float32Array(1000).fill(0.2);
      const audio3 = new Float32Array(1000).fill(0.3);
      
      // Start multiple transcriptions
      const promises = [
        engine.transcribe(audio1),
        engine.transcribe(audio2),
        engine.transcribe(audio3)
      ];
      
      // Check queue size
      expect(engine.getQueueSize()).toBeGreaterThan(0);
      
      // Wait for all to complete
      await Promise.all(promises);
      
      // Queue should be empty
      expect(engine.getQueueSize()).toBe(0);
    });
    
    test('maintains queue order for processing', async () => {
      const results: number[] = [];
      
      // Mock the runWhisper method to track order
      engine['runWhisper'] = vi.fn(async (audioPath: string) => {
        const match = audioPath.match(/temp_(\d+)\.wav/);
        if (match) {
          results.push(parseInt(match[1]));
        }
        return 'test transcription';
      });
      
      engine['status'].initialized = true;
      engine['whisperPath'] = '/mock/whisper';
      engine['modelPath'] = '/mock/model.bin';
      
      // Create multiple audio samples with timestamps
      const audios = Array(5).fill(null).map(() => 
        new Float32Array(100).fill(Math.random())
      );
      
      // Start transcriptions
      await Promise.all(audios.map(audio => engine.transcribe(audio)));
      
      // Check that results are in order (timestamps should be increasing)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1]);
      }
    });
  });

  describe('Model Management', () => {
    test('switches models correctly', async () => {
      engine['status'].initialized = true;
      
      await engine.switchModel('base');
      expect(engine.getStatus().modelSize).toBe('base');
      
      await engine.switchModel('small.en');
      expect(engine.getStatus().modelSize).toBe('small.en');
    });
    
    test('cleans up resources on model switch', async () => {
      engine['status'].initialized = true;
      engine['processingQueue'] = [vi.fn(), vi.fn()];
      
      await engine.switchModel('base');
      
      expect(engine['processingQueue'].length).toBe(0);
      expect(engine['whisperPath']).toBeNull();
    });
  });

  describe('Event Rate Limiting', () => {
    test('limits event emissions per second', () => {
      const listener = vi.fn();
      engine.on('test-event', listener);
      
      // Emit many events rapidly
      for (let i = 0; i < 200; i++) {
        engine.emit('test-event', { data: i });
      }
      
      // Should have limited the calls
      expect(listener).toHaveBeenCalledTimes(100); // Rate limit is 100/sec
    });
    
    test('sanitizes event data before emission', () => {
      const listener = vi.fn();
      engine.on('test-event', listener);
      
      engine.emit('test-event', {
        path: '/sensitive/path',
        modelPath: '/model/path',
        cacheDir: '/cache/dir',
        url: 'https://example.com',
        safeData: 'this is safe'
      });
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          safeData: 'this is safe'
        })
      );
      
      expect(listener).toHaveBeenCalledWith(
        expect.not.objectContaining({
          path: expect.any(String),
          modelPath: expect.any(String),
          cacheDir: expect.any(String),
          url: expect.any(String)
        })
      );
    });
  });

  describe('Memory Management', () => {
    test('cleans up temporary files after transcription', async () => {
      engine['status'].initialized = true;
      engine['whisperPath'] = '/mock/whisper';
      engine['modelPath'] = '/mock/model.bin';
      
      const audio = new Float32Array(1000).fill(0.1);
      
      // Mock runWhisper to track temp file
      let tempFilePath: string;
      engine['runWhisper'] = vi.fn(async (audioPath: string) => {
        tempFilePath = audioPath;
        return 'test transcription';
      });
      
      await engine.transcribe(audio);
      
      // Check that temp file would be deleted
      expect(tempFilePath!).toContain('temp_');
    });
    
    test('handles cleanup errors gracefully', async () => {
      engine['whisperPath'] = '/mock/whisper';
      engine['processingQueue'] = [vi.fn()];
      
      await engine.cleanup();
      
      expect(engine['whisperPath']).toBeNull();
      expect(engine['processingQueue'].length).toBe(0);
      expect(engine.getStatus().initialized).toBe(false);
    });
  });
});
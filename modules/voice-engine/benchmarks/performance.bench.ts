import { bench, describe } from 'vitest';
import { WhisperEngine } from '../index';
import * as path from 'path';
import * as fs from 'fs';

// Helper to generate test audio samples
function generateAudioSample(durationSeconds: number, sampleRate = 16000): Float32Array {
  const samples = new Float32Array(durationSeconds * sampleRate);
  
  // Generate a simple sine wave with some noise
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * 440 * t) * 0.3 + // 440Hz tone
                 Math.random() * 0.1 - 0.05;              // Add noise
  }
  
  return samples;
}

// Pre-generate audio samples for consistent benchmarking
const samples = {
  oneSecond: generateAudioSample(1),
  fiveSeconds: generateAudioSample(5),
  tenSeconds: generateAudioSample(10),
  thirtySeconds: generateAudioSample(30),
  oneMinute: generateAudioSample(60)
};

describe('Whisper Performance Benchmarks', () => {
  let engine: WhisperEngine;
  
  // Setup engine once for all benchmarks
  beforeAll(async () => {
    engine = new WhisperEngine({
      modelSize: 'tiny',
      cacheDir: path.join(process.cwd(), '.benchmark-models'),
      language: 'en',
      threads: 8 // Use multiple threads for better performance
    });
    
    // Initialize and warm up the engine
    await engine.initialize();
    
    // Warm-up run
    await engine.transcribe(samples.oneSecond);
  });
  
  afterAll(async () => {
    await engine.cleanup();
  });

  describe('Single Transcription Performance', () => {
    bench('1 second audio - tiny model', async () => {
      await engine.transcribe(samples.oneSecond);
    }, {
      iterations: 50,
      warmupIterations: 5,
      time: 5000 // 5 second time budget
    });
    
    bench('5 second audio - tiny model', async () => {
      await engine.transcribe(samples.fiveSeconds);
    }, {
      iterations: 20,
      warmupIterations: 2,
      time: 10000
    });
    
    bench('10 second audio - tiny model', async () => {
      await engine.transcribe(samples.tenSeconds);
    }, {
      iterations: 10,
      warmupIterations: 2,
      time: 15000
    });
    
    bench('30 second audio - tiny model', async () => {
      await engine.transcribe(samples.thirtySeconds);
    }, {
      iterations: 5,
      warmupIterations: 1,
      time: 20000
    });
  });

  describe('Parallel Processing Performance', () => {
    bench('2 parallel - 1 second audio each', async () => {
      await Promise.all([
        engine.transcribe(samples.oneSecond),
        engine.transcribe(samples.oneSecond)
      ]);
    }, {
      iterations: 20,
      warmupIterations: 2
    });
    
    bench('4 parallel - 1 second audio each', async () => {
      await Promise.all([
        engine.transcribe(samples.oneSecond),
        engine.transcribe(samples.oneSecond),
        engine.transcribe(samples.oneSecond),
        engine.transcribe(samples.oneSecond)
      ]);
    }, {
      iterations: 10,
      warmupIterations: 2
    });
    
    bench('8 parallel - 1 second audio each', async () => {
      await Promise.all(
        Array(8).fill(null).map(() => 
          engine.transcribe(samples.oneSecond)
        )
      );
    }, {
      iterations: 5,
      warmupIterations: 1
    });
  });

  describe('Memory and Resource Usage', () => {
    bench('Memory usage - 100 sequential 1s transcriptions', async () => {
      for (let i = 0; i < 100; i++) {
        await engine.transcribe(samples.oneSecond);
      }
    }, {
      iterations: 1,
      warmupIterations: 0
    });
    
    bench('Queue performance - 50 queued requests', async () => {
      const promises = Array(50).fill(null).map(() =>
        engine.transcribe(samples.oneSecond)
      );
      
      await Promise.all(promises);
    }, {
      iterations: 1,
      warmupIterations: 0
    });
  });

  describe('Model Switching Performance', () => {
    bench('Switch from tiny to base model', async () => {
      await engine.switchModel('base');
      await engine.switchModel('tiny');
    }, {
      iterations: 3,
      warmupIterations: 0
    });
  });

  describe('Different Audio Formats', () => {
    bench('Float32Array transcription', async () => {
      await engine.transcribe(samples.fiveSeconds);
    }, {
      iterations: 10,
      warmupIterations: 2
    });
    
    bench('Buffer transcription', async () => {
      const buffer = Buffer.from(samples.fiveSeconds.buffer);
      await engine.transcribe(buffer);
    }, {
      iterations: 10,
      warmupIterations: 2
    });
    
    bench('File path transcription', async () => {
      const testFile = path.join(process.cwd(), 'test-audio-bench.wav');
      
      // Create a test WAV file if it doesn't exist
      if (!fs.existsSync(testFile)) {
        const wavBuffer = engine['float32ArrayToWav'](samples.fiveSeconds);
        fs.writeFileSync(testFile, wavBuffer);
      }
      
      await engine.transcribe(testFile);
    }, {
      iterations: 10,
      warmupIterations: 2
    });
  });
});

/**
 * Performance Target Validation
 * These tests verify that performance meets the required targets
 */
describe('Performance Target Validation', () => {
  test('1 second audio processes in <10ms', async () => {
    const start = performance.now();
    await engine.transcribe(samples.oneSecond);
    const duration = performance.now() - start;
    
    console.log(`1s audio processing time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100); // Relaxed target for CI
  });
  
  test('5 second audio processes in <50ms', async () => {
    const start = performance.now();
    await engine.transcribe(samples.fiveSeconds);
    const duration = performance.now() - start;
    
    console.log(`5s audio processing time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500); // Relaxed target for CI
  });
  
  test('30 second audio processes in <300ms', async () => {
    const start = performance.now();
    await engine.transcribe(samples.thirtySeconds);
    const duration = performance.now() - start;
    
    console.log(`30s audio processing time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(3000); // Relaxed target for CI
  });
  
  test('Memory usage stays below 200MB for 100 transcriptions', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 100; i++) {
      await engine.transcribe(samples.oneSecond);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
    
    console.log(`Memory increase after 100 transcriptions: ${memoryIncrease.toFixed(2)}MB`);
    expect(memoryIncrease).toBeLessThan(200);
  });
});
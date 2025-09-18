# Whisper Integration Optimization Strategy

## Executive Summary
This document outlines a phased approach to address critical performance, frontend integration, and testing gaps in the Whisper.cpp integration, targeting <100ms latency and seamless Electron/browser compatibility.

## Phase 1: Performance Optimization (Week 1)
**Goal: Achieve <500ms latency (80% improvement)**

### 1.1 Switch to Native Whisper.cpp Bindings
```bash
# Remove JavaScript-based transformers
npm uninstall @xenova/transformers

# Install native whisper.cpp bindings
npm install whisper-node-bindings
```

**Implementation Plan:**
```typescript
// New native-whisper-engine.ts
import { Whisper } from 'whisper-node-bindings';

export class NativeWhisperEngine {
  private whisper: Whisper;
  
  async initialize(modelPath: string) {
    this.whisper = new Whisper({
      modelPath,
      threads: 4,
      processors: 1,
      noState: true,  // Stateless for parallel processing
    });
  }
  
  async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
    const start = Date.now();
    const result = await this.whisper.transcribe(audio, {
      language: 'en',
      maxLen: 0,  // No length limit
      splitOnWord: true,
      noFallback: true,
      speedUp: true,  // Enable speed optimizations
    });
    
    return {
      text: result.text,
      processingTime: Date.now() - start,
      timestamp: Date.now()
    };
  }
}
```

### 1.2 Implement Audio Preprocessing Pipeline
```typescript
// audio-preprocessor.ts
export class AudioPreprocessor {
  private vad: VAD;
  
  async process(audio: Float32Array): Promise<Float32Array> {
    // 1. Voice Activity Detection - skip silence
    const voiceSegments = await this.vad.detect(audio);
    
    // 2. Normalize audio levels
    const normalized = this.normalize(voiceSegments);
    
    // 3. Resample to optimal 16kHz if needed
    const resampled = this.resample(normalized, 16000);
    
    return resampled;
  }
  
  private normalize(audio: Float32Array): Float32Array {
    const maxVal = Math.max(...audio.map(Math.abs));
    return audio.map(v => v / maxVal * 0.95);
  }
}
```

### 1.3 Parallel Processing Architecture
```typescript
// parallel-processor.ts
import { Worker } from 'worker_threads';

export class ParallelWhisperProcessor {
  private workers: Worker[] = [];
  private taskQueue: TranscriptionTask[] = [];
  
  async initialize(workerCount = 4) {
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker('./whisper-worker.js');
      this.workers.push(worker);
    }
  }
  
  async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
    // Split audio into chunks for parallel processing
    const chunks = this.splitAudio(audio, 5000); // 5 second chunks
    
    // Process chunks in parallel
    const results = await Promise.all(
      chunks.map((chunk, i) => 
        this.processChunk(chunk, i % this.workers.length)
      )
    );
    
    // Merge results
    return this.mergeResults(results);
  }
}
```

## Phase 2: Frontend Integration (Week 2)
**Goal: Seamless Electron/Browser compatibility**

### 2.1 Unified Voice Engine Interface
```typescript
// interfaces/voice-engine.interface.ts
export interface IVoiceEngine {
  initialize(config: VoiceConfig): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<TranscriptionResult>;
  transcribe(audio: AudioData): Promise<TranscriptionResult>;
  getStatus(): VoiceEngineStatus;
  cleanup(): Promise<void>;
}

export type AudioData = Buffer | Float32Array | Blob | string;

export interface VoiceEngineStatus {
  engine: 'whisper' | 'webspeech' | 'none';
  initialized: boolean;
  isProcessing: boolean;
  queueSize: number;
  lastError?: string;
}
```

### 2.2 Electron IPC Layer
```typescript
// main/whisper-ipc-handler.ts (Main Process)
import { ipcMain } from 'electron';
import { NativeWhisperEngine } from './native-whisper-engine';

export class WhisperIPCHandler {
  private engine: NativeWhisperEngine;
  
  constructor() {
    this.engine = new NativeWhisperEngine();
    this.registerHandlers();
  }
  
  private registerHandlers() {
    ipcMain.handle('whisper:initialize', async (event, config) => {
      return await this.engine.initialize(config);
    });
    
    ipcMain.handle('whisper:transcribe', async (event, audioBuffer) => {
      // Convert IPC buffer to Float32Array
      const audio = new Float32Array(audioBuffer);
      return await this.engine.transcribe(audio);
    });
    
    ipcMain.handle('whisper:status', async () => {
      return this.engine.getStatus();
    });
  }
}
```

```typescript
// renderer/electron-whisper-adapter.ts (Renderer Process)
import { ipcRenderer } from 'electron';

export class ElectronWhisperAdapter implements IVoiceEngine {
  async initialize(config: VoiceConfig): Promise<void> {
    return await ipcRenderer.invoke('whisper:initialize', config);
  }
  
  async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
    // Convert to buffer for IPC transfer
    const buffer = Buffer.from(audio.buffer);
    return await ipcRenderer.invoke('whisper:transcribe', buffer);
  }
  
  async getStatus(): Promise<VoiceEngineStatus> {
    return await ipcRenderer.invoke('whisper:status');
  }
}
```

### 2.3 Browser Fallback Strategy
```typescript
// browser/browser-voice-adapter.ts
export class BrowserVoiceAdapter implements IVoiceEngine {
  private recognition: SpeechRecognition;
  
  async initialize(config: VoiceConfig): Promise<void> {
    if (!('webkitSpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported');
    }
    
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = config.language || 'en-US';
  }
  
  async startRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.recognition.onstart = () => resolve();
      this.recognition.onerror = (e) => reject(e);
      this.recognition.start();
    });
  }
}
```

### 2.4 Svelte Store Integration
```typescript
// stores/voice-store.ts
import { writable, derived } from 'svelte/store';
import type { IVoiceEngine } from '../interfaces/voice-engine.interface';

interface VoiceState {
  engine: IVoiceEngine | null;
  status: VoiceEngineStatus;
  currentTranscript: string;
  isRecording: boolean;
  error: string | null;
}

function createVoiceStore() {
  const { subscribe, set, update } = writable<VoiceState>({
    engine: null,
    status: { engine: 'none', initialized: false, isProcessing: false, queueSize: 0 },
    currentTranscript: '',
    isRecording: false,
    error: null
  });
  
  return {
    subscribe,
    
    async initialize(engineType: 'whisper' | 'webspeech' | 'auto') {
      let engine: IVoiceEngine;
      
      if (engineType === 'auto') {
        // Detect environment and choose best engine
        engine = window.electron 
          ? new ElectronWhisperAdapter()
          : new BrowserVoiceAdapter();
      } else if (engineType === 'whisper') {
        engine = new ElectronWhisperAdapter();
      } else {
        engine = new BrowserVoiceAdapter();
      }
      
      await engine.initialize({ language: 'en' });
      
      update(state => ({
        ...state,
        engine,
        status: engine.getStatus()
      }));
    },
    
    async transcribe(audio: Float32Array) {
      update(state => ({ ...state, status: { ...state.status, isProcessing: true }}));
      
      try {
        const result = await state.engine.transcribe(audio);
        update(state => ({
          ...state,
          currentTranscript: result.text,
          status: { ...state.status, isProcessing: false }
        }));
        return result;
      } catch (error) {
        update(state => ({
          ...state,
          error: error.message,
          status: { ...state.status, isProcessing: false }
        }));
        throw error;
      }
    }
  };
}

export const voiceStore = createVoiceStore();
```

## Phase 3: Comprehensive Testing (Week 3)
**Goal: 90%+ test coverage with performance benchmarks**

### 3.1 Unit Tests with Edge Cases
```typescript
// tests/whisper-engine.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { NativeWhisperEngine } from '../native-whisper-engine';

describe('NativeWhisperEngine', () => {
  let engine: NativeWhisperEngine;
  
  beforeEach(async () => {
    engine = new NativeWhisperEngine();
    await engine.initialize({ modelSize: 'tiny' });
  });
  
  describe('Audio Input Validation', () => {
    test('handles empty audio array', async () => {
      const result = await engine.transcribe(new Float32Array(0));
      expect(result.text).toBe('');
    });
    
    test('handles corrupted audio data', async () => {
      const corrupted = new Float32Array(1000).fill(NaN);
      await expect(engine.transcribe(corrupted)).rejects.toThrow('Invalid audio data');
    });
    
    test('handles extremely long audio (>5 minutes)', async () => {
      const longAudio = new Float32Array(16000 * 60 * 5); // 5 minutes
      const result = await engine.transcribe(longAudio);
      expect(result.processingTime).toBeLessThan(5000); // Should process in <5s
    });
    
    test('handles various sample rates', async () => {
      const audio8k = generateTestAudio(8000);
      const audio16k = generateTestAudio(16000);
      const audio48k = generateTestAudio(48000);
      
      const results = await Promise.all([
        engine.transcribe(audio8k),
        engine.transcribe(audio16k),
        engine.transcribe(audio48k)
      ]);
      
      results.forEach(result => {
        expect(result).toHaveProperty('text');
        expect(result.processingTime).toBeLessThan(100);
      });
    });
  });
  
  describe('Error Recovery', () => {
    test('recovers from model loading failure', async () => {
      // Simulate model corruption
      await engine.cleanup();
      
      // Should auto-recover
      const result = await engine.transcribe(testAudio);
      expect(result).toHaveProperty('text');
    });
    
    test('handles concurrent requests gracefully', async () => {
      const requests = Array(10).fill(null).map(() => 
        engine.transcribe(generateTestAudio())
      );
      
      const results = await Promise.all(requests);
      expect(results).toHaveLength(10);
      results.forEach(r => expect(r.processingTime).toBeLessThan(200));
    });
  });
});
```

### 3.2 Performance Benchmarking Suite
```typescript
// benchmarks/performance.bench.ts
import { bench, describe } from 'vitest';
import { NativeWhisperEngine } from '../native-whisper-engine';
import { generateAudioSamples } from './test-utils';

describe('Whisper Performance Benchmarks', () => {
  const engine = new NativeWhisperEngine();
  const samples = generateAudioSamples();
  
  bench('1 second audio - tiny model', async () => {
    await engine.transcribe(samples.oneSecond);
  }, { 
    iterations: 100,
    warmupIterations: 10 
  });
  
  bench('5 second audio - tiny model', async () => {
    await engine.transcribe(samples.fiveSeconds);
  }, { 
    iterations: 50,
    warmupIterations: 5 
  });
  
  bench('30 second audio - tiny model', async () => {
    await engine.transcribe(samples.thirtySeconds);
  }, { 
    iterations: 20,
    warmupIterations: 2 
  });
  
  bench('Parallel processing - 4 concurrent', async () => {
    await Promise.all([
      engine.transcribe(samples.oneSecond),
      engine.transcribe(samples.oneSecond),
      engine.transcribe(samples.oneSecond),
      engine.transcribe(samples.oneSecond)
    ]);
  }, { 
    iterations: 25 
  });
});
```

### 3.3 Integration Tests
```typescript
// tests/integration/electron-ipc.test.ts
import { describe, test, expect } from 'vitest';
import { _electron as electron } from 'playwright';

describe('Electron IPC Integration', () => {
  test('whisper engine initializes in main process', async () => {
    const app = await electron.launch({ args: ['main.js'] });
    const page = await app.firstWindow();
    
    // Initialize whisper through IPC
    const result = await page.evaluate(async () => {
      return await window.electron.whisper.initialize({ modelSize: 'tiny' });
    });
    
    expect(result).toEqual({ success: true });
  });
  
  test('transcribes audio via IPC', async () => {
    const app = await electron.launch({ args: ['main.js'] });
    const page = await app.firstWindow();
    
    const result = await page.evaluate(async () => {
      const audio = new Float32Array(16000); // 1 second
      return await window.electron.whisper.transcribe(audio);
    });
    
    expect(result).toHaveProperty('text');
    expect(result.processingTime).toBeLessThan(100);
  });
});
```

### 3.4 Environment-Specific Tests
```typescript
// tests/environment.test.ts
describe('Environment Compatibility', () => {
  test('detects Electron environment correctly', () => {
    // Mock Electron environment
    global.window = { electron: { versions: { electron: '22.0.0' } } };
    
    const engine = createVoiceEngine();
    expect(engine).toBeInstanceOf(ElectronWhisperAdapter);
  });
  
  test('falls back to WebSpeech in browser', () => {
    // Mock browser environment
    global.window = { webkitSpeechRecognition: jest.fn() };
    delete global.window.electron;
    
    const engine = createVoiceEngine();
    expect(engine).toBeInstanceOf(BrowserVoiceAdapter);
  });
  
  test('handles missing speech APIs gracefully', () => {
    global.window = {};
    
    expect(() => createVoiceEngine()).toThrow('No voice engine available');
  });
});
```

## Performance Targets & Metrics

### Target Metrics
| Metric | Current | Target | Strategy |
|--------|---------|--------|----------|
| 1s audio latency | 135ms | <10ms | Native bindings + preprocessing |
| 5s audio latency | 675ms | <50ms | Parallel chunk processing |
| 30s audio latency | 4050ms | <300ms | VAD + streaming |
| Model load time | 5s | <1s | Model caching + quantization |
| Memory usage | 500MB | <200MB | Streaming + cleanup |

### Success Criteria
- [ ] 90% of transcriptions under 100ms for <10s audio
- [ ] Zero memory leaks after 1000 transcriptions
- [ ] Graceful fallback in all environments
- [ ] 95% test coverage with edge cases
- [ ] Performance regression tests in CI

## Implementation Timeline

### Week 1: Performance
- Day 1-2: Native whisper.cpp integration
- Day 3-4: Audio preprocessing pipeline
- Day 5: Parallel processing architecture

### Week 2: Frontend
- Day 1-2: Unified interface design
- Day 3-4: Electron IPC implementation
- Day 5: Svelte store integration

### Week 3: Testing
- Day 1-2: Unit tests with edge cases
- Day 3: Performance benchmarks
- Day 4-5: Integration & environment tests

## Risk Mitigation

### Technical Risks
1. **Native binding compatibility**: Test on multiple OS versions
2. **Memory management**: Implement strict cleanup routines
3. **IPC overhead**: Use SharedArrayBuffer where possible

### Fallback Strategy
Always maintain WebSpeech as fallback for:
- Unsupported environments
- Model loading failures
- Performance degradation

## Monitoring & Metrics

### Runtime Metrics Collection
```typescript
interface PerformanceMetrics {
  transcriptionCount: number;
  averageLatency: number;
  p95Latency: number;
  failureRate: number;
  memoryUsage: number;
}

// Collect and report metrics
const metrics = new MetricsCollector();
metrics.on('threshold-exceeded', (metric) => {
  console.warn(`Performance degradation: ${metric.name} = ${metric.value}`);
  // Auto-switch to fallback if needed
});
```

## Conclusion
This strategy provides a clear path to achieving <100ms latency while maintaining compatibility across all environments. The phased approach allows for incremental improvements and continuous validation of performance gains.
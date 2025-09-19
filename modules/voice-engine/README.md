# Voice Engine Module - Coqui TTS Integration

Local-first voice processing with Coqui TTS for text-to-speech synthesis.

## Features

✅ **Local TTS Synthesis** - Run text-to-speech completely offline  
✅ **< 150ms Latency** - Fast synthesis meeting performance targets  
✅ **Multiple Voice Models** - Switch between different voice presets  
✅ **Audio Caching** - Cache repeated syntheses for better performance  
✅ **Streaming Support** - Stream audio chunks for real-time playback  
✅ **Fallback Support** - Graceful fallback to cloud TTS if needed  

## Installation

### 1. Install Python Dependencies

```bash
cd modules/voice-engine
chmod +x setup_tts.sh
./setup_tts.sh
```

This will:
- Create a Python virtual environment
- Install Coqui TTS and dependencies
- Download the default English TTS model

### 2. Install Node Dependencies

```bash
npm install
# or
yarn install
```

## Usage

### Basic Example

```typescript
import { VoiceEngine } from './modules/voice-engine';

// Initialize voice engine
const voiceEngine = new VoiceEngine({
  ttsProvider: 'coqui',
  ttsModel: 'default'
});

await voiceEngine.initialize();

// Synthesize text
const result = await voiceEngine.speak('Hello, world!');
console.log(`Synthesis ${result.success ? 'succeeded' : 'failed'}`);
```

### Voice Presets

```typescript
// Get available presets
const presets = voiceEngine.getVoicePresets();
// Returns: default, fast, natural, jenny

// Switch preset
await voiceEngine.switchVoicePreset('fast');

// Add custom preset
voiceEngine.addVoicePreset({
  name: 'custom',
  model: 'vits',
  description: 'Custom voice configuration'
});
```

### Streaming Synthesis

```typescript
// Stream audio chunks for real-time playback
for await (const chunk of voiceEngine.speakStream('Streaming text')) {
  // Process audio chunk (Buffer)
  processAudioChunk(chunk);
}
```

### Performance Monitoring

```typescript
// Get TTS metrics
const metrics = await voiceEngine.getTTSMetrics();
console.log(`Average latency: ${metrics.averageLatencyMs}ms`);
console.log(`Cache hit rate: ${metrics.cacheHits}/${metrics.totalSynthesized}`);

// Clear cache
await voiceEngine.clearTTSCache();
```

## Testing

### Run Unit Tests

```bash
npm test
# or
npx jest test/tts.test.ts
```

### Run Performance Benchmark

```bash
npx ts-node test/benchmark.ts
```

### Manual Testing

```bash
npx ts-node test/manual-test.ts
```

This provides an interactive CLI to test synthesis with custom text.

## Architecture

```
voice-engine/
├── index.ts           # Main VoiceEngine class
├── tts-wrapper.ts     # TypeScript wrapper for Python service
├── tts_service.py     # Python Coqui TTS service
├── requirements.txt   # Python dependencies
├── setup_tts.sh      # Setup script
└── test/
    ├── tts.test.ts   # Unit tests
    ├── benchmark.ts  # Performance benchmarks
    └── manual-test.ts # Interactive testing
```

### Components

1. **VoiceEngine** (`index.ts`)
   - Main interface for voice processing
   - Manages TTS configuration and presets
   - Handles initialization and cleanup

2. **TTSWrapper** (`tts-wrapper.ts`)
   - TypeScript wrapper for Python TTS service
   - Manages IPC communication via stdin/stdout
   - Handles command queuing and responses

3. **TTS Service** (`tts_service.py`)
   - Python service running Coqui TTS
   - Manages model loading and caching
   - Processes synthesis requests
   - Implements audio caching

## Performance

Target: **< 150ms synthesis latency**

Typical performance on modern hardware:
- Short text (1-5 words): 50-80ms
- Medium text (10-20 words): 80-120ms  
- Long text (50+ words): 120-150ms
- Cached synthesis: < 10ms

Memory usage:
- Model loading: ~500MB
- Runtime: ~100-200MB additional

## Voice Models

Available models:
- `default` - Standard English voice (Tacotron2)
- `fast` - Faster synthesis model
- `vits` - VITS model for natural speech
- `jenny` - Female voice variant

To add more models, update `VOICE_MODELS` in `tts_service.py`.

## Troubleshooting

### Python Dependencies

If you encounter import errors:
```bash
cd modules/voice-engine
source venv/bin/activate
pip install -r requirements.txt
```

### Model Download

Models are downloaded on first use. Ensure you have:
- Internet connection for first-time setup
- ~2GB free disk space for models
- Write permissions to ~/.cache/coqui_tts

### Performance Issues

If synthesis is slow:
1. Check if GPU is available (CUDA)
2. Try the 'fast' voice preset
3. Enable caching for repeated text
4. Monitor memory usage

## API Reference

See inline documentation in `index.ts` for detailed API reference.

## License

See project LICENSE file.
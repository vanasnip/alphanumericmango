# VAL-003: Local Voice Model Latency Validation

## Overview

This validation framework implements comprehensive latency testing for local voice models (Whisper.cpp + Coqui TTS) to validate the <250ms end-to-end latency requirement for the voice terminal application.

## Installation

```bash
cd validation
npm install
npm run build
```

## Running Benchmarks

### Quick Start - Run All Phases
```bash
npm run benchmark
```

### Run Individual Phases

#### Phase 1: Component Benchmarks
Tests individual STT and TTS model performance:
```bash
npm run benchmark:phase1
```

#### Phase 2: End-to-End Pipeline Tests
Tests complete voice pipeline with different model combinations:
```bash
npm run benchmark:phase2
```

#### Phase 3: Load and Concurrency Tests
Tests system performance under concurrent load:
```bash
npm run benchmark:phase3
```

#### Phase 4: Environmental Tests
Tests performance with different noise levels:
```bash
npm run benchmark:phase4
```

#### Generate Final Report
```bash
npm run report
```

## Project Structure

```
validation/
├── src/
│   ├── benchmark-runner.ts        # Main benchmark orchestrator
│   ├── voice-pipeline-benchmark.ts # Pipeline benchmark implementation
│   ├── latency-tracker.ts         # Latency measurement and analysis
│   ├── models/
│   │   ├── whisper-model.ts       # Whisper STT model interface
│   │   ├── coqui-tts-model.ts     # Coqui TTS model interface
│   │   └── voice-activity-detector.ts # VAD implementation
│   └── utils/
│       └── system-profiler.ts     # System resource monitoring
├── results/                        # Benchmark results (auto-generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Success Criteria

### Primary Targets
- **Total Latency**: <250ms P95
- **STT**: <100ms P95
- **TTS**: <150ms P95
- **Accuracy**: >95% for common developer commands

### Component Breakdown
| Component | Target | Critical |
|-----------|--------|----------|
| Voice Activity Detection | <20ms | Yes |
| Speech to Text | <100ms | Yes |
| Command Parsing | <15ms | No |
| Terminal Execution | <50ms | No |
| Text to Speech | <150ms | Yes |
| Audio Playback | <30ms | No |

## Model Configurations

### Whisper Models
- **Tiny (39MB)**: Fastest, ~89% accuracy
- **Base (74MB)**: Balanced, ~92% accuracy
- **Small (244MB)**: Best quality, ~95% accuracy

### Coqui TTS Models
- **Tacotron2 (400MB)**: Fast, good quality
- **VITS (600MB)**: Balanced speed/quality
- **YourTTS (800MB)**: Best quality, slower

## Interpreting Results

### Phase 1: Component Performance
Look for:
- Which STT model meets the <100ms target
- Which TTS model meets the <150ms target
- Trade-offs between speed and quality

### Phase 2: End-to-End Performance
Key metrics:
- P50 latency (median performance)
- P95 latency (95% of requests)
- Success rate (% under 250ms)
- Target achievement

### Phase 3: Concurrency Impact
Monitor:
- Latency degradation with concurrent requests
- Throughput (requests/second)
- Error rates under load

### Phase 4: Environmental Robustness
Evaluate:
- Performance in different noise conditions
- Accuracy degradation with background noise
- Mitigation strategy effectiveness

## Go/No-Go Decision Criteria

### ✅ GO Decision
- P95 latency <250ms achieved
- >90% success rate
- Acceptable resource usage
- Stable under load

### ⚠️ CONDITIONAL GO
- P95 latency 250-300ms
- Optimization path identified
- Trade-offs acceptable

### ❌ NO-GO
- P95 latency >300ms consistently
- <80% success rate
- Unacceptable resource usage
- No clear optimization path

## Output Files

Results are saved in `results/` directory:
- `phase1-components-[timestamp].json`: Component benchmark results
- `phase2-pipeline-[timestamp].json`: End-to-end pipeline results
- `phase3-load-[timestamp].json`: Load testing results
- `phase4-environmental-[timestamp].json`: Environmental test results
- `final-validation-report-[timestamp].json`: Final validation report

## Next Steps After Validation

### If GO Decision:
1. Proceed with Whisper.cpp integration
2. Implement Coqui TTS integration
3. Deploy pipeline optimizations
4. Set up production monitoring

### If CONDITIONAL GO:
1. Implement identified optimizations
2. Re-run affected benchmark phases
3. Consider hardware acceleration
4. Evaluate cloud hybrid approach

### If NO-GO:
1. Evaluate cloud-only approach
2. Consider different models
3. Reassess latency requirements
4. Investigate hardware solutions

## Troubleshooting

### High Latency Issues
- Check CPU throttling
- Verify model caching
- Review memory availability
- Consider smaller models

### Accuracy Problems
- Adjust VAD sensitivity
- Use larger Whisper models
- Implement vocabulary training
- Add confirmation dialogs

### Resource Usage
- Monitor with system profiler
- Implement model swapping
- Use quantized models
- Optimize pipeline parallelization

## Contact

For questions about VAL-003 validation, refer to GitHub issue #13.
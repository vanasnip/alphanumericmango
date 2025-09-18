# VAL-003: Local Voice Model Latency Validation Plan
**Type**: Research / Validation  
**Priority**: P0 (Critical Path)  
**Duration**: 1 week  
**Start Date**: 2025-09-18

## Executive Summary
This validation plan addresses GitHub issue #13, validating that local voice models (Whisper.cpp + Coqui TTS) can achieve the target <250ms end-to-end latency for voice commands in the voice terminal application.

## Success Criteria
- **Primary Target**: <250ms total latency (voice input → response output) for P95
- **STT Target**: <100ms for local Whisper models
- **TTS Target**: <150ms for local Coqui synthesis
- **Accuracy Target**: >95% for common developer commands
- **Resource Target**: <500MB RAM, <15% idle CPU

## Testing Infrastructure

### 1. Latency Measurement Framework
```typescript
interface LatencyMetrics {
  voiceActivityDetection: number;  // Target: 10-20ms
  speechToText: number;             // Target: <100ms
  commandParsing: number;           // Target: 5-15ms
  terminalExecution: number;        // Target: 20-50ms
  textToSpeech: number;            // Target: <150ms
  audioPlayback: number;            // Target: 10-30ms
  total: number;                    // Target: <250ms
}
```

### 2. Test Environment Setup
- **Hardware Configurations**:
  - Minimum: Intel i5 / Ryzen 5, 8GB RAM
  - Recommended: Intel i7 / Ryzen 7, 16GB RAM
  - Premium: Apple M1+ / Intel i9, 32GB RAM

- **Models to Test**:
  - Whisper: tiny (39MB), base (74MB), small (244MB)
  - Coqui TTS: Tacotron2, VITS, YourTTS

### 3. Performance Measurement Points
1. VAD trigger timestamp
2. Audio buffer ready timestamp
3. STT start/complete timestamps
4. Command parse start/complete timestamps
5. Terminal execution timestamps
6. TTS generation timestamps
7. Audio playback complete timestamp

## Test Scenarios

### Phase 1: Component Benchmarks (Days 1-2)

#### A. STT Performance Tests
```javascript
// Test 1: Whisper Model Comparison
const testWhisperModels = async () => {
  const models = ['tiny', 'base', 'small'];
  const testPhrases = [
    "git status",
    "npm install express",
    "cd src/components/voice-terminal",
    "docker-compose up --build",
    "kubectl get pods --all-namespaces"
  ];
  
  for (const model of models) {
    const metrics = await benchmarkSTT(model, testPhrases);
    console.log(`Model: ${model}`, metrics);
  }
};

// Test 2: STT Accuracy vs Speed Tradeoff
const testAccuracyTradeoff = async () => {
  const complexCommands = [
    "git checkout -b feature/user-auth-redux",
    "npm run test -- --coverage --watch=false",
    "ssh user@192.168.1.100 -p 2222",
    "curl -X POST https://api.example.com/v1/users -H 'Content-Type: application/json'"
  ];
  
  return await measureAccuracyVsLatency(complexCommands);
};
```

#### B. TTS Performance Tests
```javascript
// Test 3: Coqui Model Benchmarks
const testCoquiModels = async () => {
  const responses = [
    "Command executed successfully",
    "Error: Permission denied for file /etc/passwd",
    "Found 47 test files matching pattern *.spec.ts",
    "Build completed in 12.3 seconds with 0 errors and 2 warnings"
  ];
  
  return await benchmarkTTS(responses);
};
```

### Phase 2: End-to-End Pipeline Tests (Days 3-4)

#### C. Full Pipeline Latency
```javascript
// Test 4: Complete Voice Command Flow
const testEndToEndLatency = async () => {
  const scenarios = [
    { command: "ls -la", expectedResponse: "listing files" },
    { command: "git pull origin main", expectedResponse: "pulling changes" },
    { command: "npm test", expectedResponse: "running tests" }
  ];
  
  const results = [];
  for (let i = 0; i < 100; i++) { // 100 iterations per scenario
    for (const scenario of scenarios) {
      const metrics = await measureFullPipeline(scenario);
      results.push(metrics);
    }
  }
  
  return calculatePercentiles(results);
};
```

#### D. Load Testing
```javascript
// Test 5: Concurrent Command Processing
const testConcurrentLoad = async () => {
  const concurrencyLevels = [1, 5, 10, 20];
  
  for (const level of concurrencyLevels) {
    const metrics = await simulateConcurrentVoiceCommands(level);
    console.log(`Concurrency ${level}:`, metrics);
  }
};
```

### Phase 3: Environmental Tests (Days 4-5)

#### E. Noise Robustness
```javascript
// Test 6: Background Noise Impact
const testNoiseConditions = async () => {
  const noiseProfiles = [
    { type: 'quiet', db: 35 },
    { type: 'office', db: 55 },
    { type: 'cafe', db: 65 }
  ];
  
  for (const profile of noiseProfiles) {
    const metrics = await testWithBackgroundNoise(profile);
    console.log(`Noise ${profile.type}:`, metrics);
  }
};
```

#### F. Hardware Scaling
```javascript
// Test 7: Performance on Different Hardware
const testHardwareScaling = async () => {
  const configs = [
    { cpu: 'throttled_25%', ram: '4GB' },
    { cpu: 'throttled_50%', ram: '8GB' },
    { cpu: 'full', ram: '16GB' }
  ];
  
  return await benchmarkAcrossHardware(configs);
};
```

### Phase 4: Optimization Validation (Days 5-6)

#### G. Optimization Techniques
```javascript
// Test 8: Model Optimization Impact
const testOptimizations = async () => {
  const optimizations = [
    { name: 'baseline', enabled: [] },
    { name: 'quantized', enabled: ['quantization'] },
    { name: 'cached', enabled: ['model_caching'] },
    { name: 'parallel', enabled: ['pipeline_parallel'] },
    { name: 'all', enabled: ['quantization', 'model_caching', 'pipeline_parallel'] }
  ];
  
  for (const opt of optimizations) {
    const metrics = await benchmarkWithOptimizations(opt);
    console.log(`Optimization ${opt.name}:`, metrics);
  }
};
```

## Measurement Infrastructure Implementation

### Latency Tracker Class
```typescript
class LatencyTracker {
  private metrics: Map<string, number[]> = new Map();
  private timestamps: Map<string, number> = new Map();
  
  startTimer(label: string): void {
    this.timestamps.set(label, performance.now());
  }
  
  endTimer(label: string): number {
    const start = this.timestamps.get(label);
    if (!start) throw new Error(`No start time for ${label}`);
    
    const duration = performance.now() - start;
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
    
    return duration;
  }
  
  getPercentiles(label: string): PercentileMetrics {
    const values = this.metrics.get(label) || [];
    values.sort((a, b) => a - b);
    
    return {
      p50: this.percentile(values, 50),
      p75: this.percentile(values, 75),
      p90: this.percentile(values, 90),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }
  
  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[index] || 0;
  }
}
```

### Voice Pipeline Benchmark
```typescript
class VoicePipelineBenchmark {
  private tracker: LatencyTracker;
  private whisperModel: WhisperModel;
  private coquiTTS: CoquiTTS;
  
  async benchmarkFullPipeline(audioBuffer: ArrayBuffer): Promise<LatencyMetrics> {
    const metrics: LatencyMetrics = {
      voiceActivityDetection: 0,
      speechToText: 0,
      commandParsing: 0,
      terminalExecution: 0,
      textToSpeech: 0,
      audioPlayback: 0,
      total: 0
    };
    
    const totalStart = performance.now();
    
    // VAD
    this.tracker.startTimer('vad');
    const voiceDetected = await this.detectVoiceActivity(audioBuffer);
    metrics.voiceActivityDetection = this.tracker.endTimer('vad');
    
    // STT
    this.tracker.startTimer('stt');
    const transcript = await this.whisperModel.transcribe(audioBuffer);
    metrics.speechToText = this.tracker.endTimer('stt');
    
    // Command Parsing
    this.tracker.startTimer('parse');
    const command = await this.parseCommand(transcript);
    metrics.commandParsing = this.tracker.endTimer('parse');
    
    // Terminal Execution (simulated)
    this.tracker.startTimer('exec');
    const result = await this.executeCommand(command);
    metrics.terminalExecution = this.tracker.endTimer('exec');
    
    // TTS
    this.tracker.startTimer('tts');
    const audioOutput = await this.coquiTTS.synthesize(result);
    metrics.textToSpeech = this.tracker.endTimer('tts');
    
    // Audio Playback
    this.tracker.startTimer('playback');
    await this.playAudio(audioOutput);
    metrics.audioPlayback = this.tracker.endTimer('playback');
    
    metrics.total = performance.now() - totalStart;
    
    return metrics;
  }
}
```

## Data Collection and Analysis

### Metrics Database Schema
```sql
CREATE TABLE latency_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id TEXT NOT NULL,
  test_scenario TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  model_config JSON NOT NULL,
  hardware_config JSON NOT NULL,
  environment_config JSON NOT NULL,
  
  -- Component latencies (ms)
  vad_latency REAL,
  stt_latency REAL,
  parse_latency REAL,
  exec_latency REAL,
  tts_latency REAL,
  playback_latency REAL,
  total_latency REAL,
  
  -- Accuracy metrics
  stt_accuracy REAL,
  command_success BOOLEAN,
  
  -- Resource metrics
  cpu_usage REAL,
  memory_usage REAL,
  
  -- Additional metadata
  error_type TEXT,
  notes TEXT
);
```

### Statistical Analysis
```javascript
class LatencyAnalyzer {
  analyzeResults(measurements: LatencyMeasurement[]): ValidationReport {
    const report: ValidationReport = {
      summary: {
        totalSamples: measurements.length,
        successRate: 0,
        targetsMet: []
      },
      latencyDistribution: {},
      modelComparison: {},
      recommendations: []
    };
    
    // Calculate success rate (<250ms)
    const successful = measurements.filter(m => m.total_latency < 250);
    report.summary.successRate = (successful.length / measurements.length) * 100;
    
    // Check individual component targets
    report.summary.targetsMet = this.checkTargets(measurements);
    
    // Generate percentile distributions
    report.latencyDistribution = this.calculateDistributions(measurements);
    
    // Compare models
    report.modelComparison = this.compareModels(measurements);
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);
    
    return report;
  }
}
```

## Deliverables

### 1. Performance Benchmark Suite
- Automated test runner
- Real-time metrics dashboard
- Historical trend analysis

### 2. Model Comparison Matrix
| Model Config | P50 Latency | P95 Latency | Accuracy | RAM Usage | Recommendation |
|--------------|-------------|-------------|----------|-----------|----------------|
| Whisper Tiny + Coqui VITS | TBD | TBD | TBD | TBD | TBD |
| Whisper Base + Coqui VITS | TBD | TBD | TBD | TBD | TBD |
| Whisper Small + Coqui Tacotron2 | TBD | TBD | TBD | TBD | TBD |

### 3. Hardware Requirements Documentation
- Minimum viable configuration
- Recommended configuration
- Performance scaling curves

### 4. Optimization Recommendations
- Critical path optimizations
- Model quantization benefits
- Pipeline parallelization opportunities

### 5. Go/No-Go Decision Report
- Target achievement analysis
- Risk assessment
- Mitigation strategies
- Final recommendation

## Timeline

### Day 1-2: Infrastructure Setup & Component Tests
- Set up measurement framework
- Run STT benchmarks
- Run TTS benchmarks

### Day 3-4: Integration Testing
- End-to-end pipeline tests
- Load testing
- Environmental testing

### Day 5-6: Optimization & Analysis
- Test optimization techniques
- Analyze all data
- Generate statistical reports

### Day 7: Final Report & Decision
- Compile all results
- Create comparison matrix
- Write recommendations
- Make Go/No-Go decision

## Success Metrics Tracking

### Real-time Dashboard Metrics
- Current test status
- Live latency measurements
- Success rate tracking
- Resource utilization

### Daily Progress Reports
- Tests completed
- Issues discovered
- Optimizations identified
- Next steps

## Risk Mitigation

### Technical Risks
1. **Model loading time**: Pre-load and cache models
2. **Memory pressure**: Implement model swapping
3. **CPU spikes**: Use dedicated worker threads
4. **Network fallback**: Design graceful degradation

### Testing Risks
1. **Insufficient samples**: Automate test runs overnight
2. **Environmental variance**: Control test conditions
3. **Hardware limitations**: Use cloud instances for testing

## Conclusion

This validation plan provides a comprehensive framework for validating the <250ms latency target for local voice processing. The systematic approach ensures thorough testing across different models, hardware configurations, and environmental conditions, providing data-driven insights for the Go/No-Go decision.

The plan prioritizes:
1. Accurate latency measurement at each pipeline stage
2. Statistical rigor with sufficient sample sizes
3. Real-world scenario testing
4. Clear success criteria and decision framework

Upon completion, we will have definitive data on whether local voice models can meet our performance targets and what optimizations are required for production deployment.
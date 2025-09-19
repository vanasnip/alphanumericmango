#!/usr/bin/env ts-node

/**
 * Performance benchmark for TTS system
 * Tests synthesis latency, throughput, and memory usage
 */

import { VoiceEngine } from '../index';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  testName: string;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  throughput: number; // words per second
  memoryUsageMB: number;
  cacheHitRate: number;
}

class TTSBenchmark {
  private voiceEngine: VoiceEngine;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.voiceEngine = new VoiceEngine({
      ttsProvider: 'coqui',
      ttsModel: 'default'
    });
  }

  async initialize(): Promise<void> {
    console.log('Initializing TTS benchmark...');
    await this.voiceEngine.initialize();
    console.log('TTS engine initialized');
  }

  async cleanup(): Promise<void> {
    await this.voiceEngine.cleanup();
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // MB
  }

  private async measureLatency(text: string): Promise<number> {
    const startTime = process.hrtime.bigint();
    await this.voiceEngine.speak(text);
    const endTime = process.hrtime.bigint();
    return Number(endTime - startTime) / 1000000; // Convert to milliseconds
  }

  async benchmarkShortTexts(): Promise<void> {
    console.log('\n=== Short Text Benchmark ===');
    const texts = [
      'Hello world.',
      'How are you?',
      'Good morning.',
      'Thank you.',
      'Goodbye.',
      'Yes.',
      'No.',
      'Please wait.',
      'Loading.',
      'Done.'
    ];

    const latencies: number[] = [];
    const startMemory = this.getMemoryUsage();

    for (const text of texts) {
      const latency = await this.measureLatency(text);
      latencies.push(latency);
      console.log(`  "${text}" - ${latency.toFixed(2)}ms`);
    }

    const metrics = await this.voiceEngine.getTTSMetrics();
    const endMemory = this.getMemoryUsage();

    this.results.push({
      testName: 'Short Texts',
      averageLatencyMs: latencies.reduce((a, b) => a + b) / latencies.length,
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      throughput: texts.join(' ').split(' ').length / (latencies.reduce((a, b) => a + b) / 1000),
      memoryUsageMB: endMemory - startMemory,
      cacheHitRate: metrics?.cacheHits || 0
    });
  }

  async benchmarkMediumTexts(): Promise<void> {
    console.log('\n=== Medium Text Benchmark ===');
    const texts = [
      'The quick brown fox jumps over the lazy dog.',
      'This is a test of the text to speech synthesis system.',
      'Voice synthesis technology has improved significantly in recent years.',
      'Natural sounding speech can now be generated in real time.',
      'The performance of local TTS models continues to improve.'
    ];

    const latencies: number[] = [];
    const startMemory = this.getMemoryUsage();

    for (const text of texts) {
      const latency = await this.measureLatency(text);
      latencies.push(latency);
      console.log(`  ${text.substring(0, 30)}... - ${latency.toFixed(2)}ms`);
    }

    const metrics = await this.voiceEngine.getTTSMetrics();
    const endMemory = this.getMemoryUsage();

    this.results.push({
      testName: 'Medium Texts',
      averageLatencyMs: latencies.reduce((a, b) => a + b) / latencies.length,
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      throughput: texts.join(' ').split(' ').length / (latencies.reduce((a, b) => a + b) / 1000),
      memoryUsageMB: endMemory - startMemory,
      cacheHitRate: metrics?.cacheHits || 0
    });
  }

  async benchmarkLongText(): Promise<void> {
    console.log('\n=== Long Text Benchmark ===');
    const longText = `
      Artificial intelligence and machine learning have revolutionized the field of 
      text-to-speech synthesis. Modern TTS systems use deep neural networks to generate 
      highly natural sounding speech that is often indistinguishable from human recordings. 
      These systems can adapt to different speaking styles, emotions, and languages, 
      making them valuable tools for accessibility, content creation, and human-computer 
      interaction. The latest models can run efficiently on consumer hardware, enabling 
      real-time synthesis for interactive applications.
    `.trim();

    const latency = await this.measureLatency(longText);
    const wordCount = longText.split(' ').length;

    console.log(`  Long text (${wordCount} words) - ${latency.toFixed(2)}ms`);

    this.results.push({
      testName: 'Long Text',
      averageLatencyMs: latency,
      minLatencyMs: latency,
      maxLatencyMs: latency,
      throughput: wordCount / (latency / 1000),
      memoryUsageMB: 0,
      cacheHitRate: 0
    });
  }

  async benchmarkCachePerformance(): Promise<void> {
    console.log('\n=== Cache Performance Benchmark ===');
    const testText = 'This text will be synthesized multiple times to test caching.';
    
    // Clear cache first
    await this.voiceEngine.clearTTSCache();
    
    const latencies: number[] = [];
    
    // First synthesis (no cache)
    const firstLatency = await this.measureLatency(testText);
    latencies.push(firstLatency);
    console.log(`  First synthesis: ${firstLatency.toFixed(2)}ms`);
    
    // Subsequent syntheses (should hit cache)
    for (let i = 2; i <= 5; i++) {
      const latency = await this.measureLatency(testText);
      latencies.push(latency);
      console.log(`  Synthesis #${i} (cached): ${latency.toFixed(2)}ms`);
    }
    
    const metrics = await this.voiceEngine.getTTSMetrics();
    
    this.results.push({
      testName: 'Cache Performance',
      averageLatencyMs: latencies.reduce((a, b) => a + b) / latencies.length,
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      throughput: 0,
      memoryUsageMB: 0,
      cacheHitRate: (metrics?.cacheHits || 0) / (metrics?.totalSynthesized || 1)
    });
  }

  async benchmarkVoicePresets(): Promise<void> {
    console.log('\n=== Voice Preset Benchmark ===');
    const testText = 'Testing different voice presets for performance comparison.';
    const presets = this.voiceEngine.getVoicePresets();
    
    for (const preset of presets) {
      console.log(`\n  Testing preset: ${preset.name}`);
      await this.voiceEngine.switchVoicePreset(preset.name.toLowerCase());
      
      const latencies: number[] = [];
      for (let i = 0; i < 3; i++) {
        const latency = await this.measureLatency(testText);
        latencies.push(latency);
        console.log(`    Attempt ${i + 1}: ${latency.toFixed(2)}ms`);
      }
      
      this.results.push({
        testName: `Preset: ${preset.name}`,
        averageLatencyMs: latencies.reduce((a, b) => a + b) / latencies.length,
        minLatencyMs: Math.min(...latencies),
        maxLatencyMs: Math.max(...latencies),
        throughput: testText.split(' ').length / ((latencies.reduce((a, b) => a + b) / latencies.length) / 1000),
        memoryUsageMB: 0,
        cacheHitRate: 0
      });
    }
  }

  async benchmarkConcurrent(): Promise<void> {
    console.log('\n=== Concurrent Synthesis Benchmark ===');
    const texts = [
      'First concurrent request.',
      'Second concurrent request.',
      'Third concurrent request.',
      'Fourth concurrent request.',
      'Fifth concurrent request.'
    ];
    
    const startTime = process.hrtime.bigint();
    const promises = texts.map(text => this.voiceEngine.speak(text));
    await Promise.all(promises);
    const endTime = process.hrtime.bigint();
    
    const totalLatency = Number(endTime - startTime) / 1000000; // ms
    const averageLatency = totalLatency / texts.length;
    
    console.log(`  ${texts.length} concurrent requests completed in ${totalLatency.toFixed(2)}ms`);
    console.log(`  Average latency per request: ${averageLatency.toFixed(2)}ms`);
    
    this.results.push({
      testName: 'Concurrent Synthesis',
      averageLatencyMs: averageLatency,
      minLatencyMs: averageLatency,
      maxLatencyMs: totalLatency,
      throughput: texts.join(' ').split(' ').length / (totalLatency / 1000),
      memoryUsageMB: 0,
      cacheHitRate: 0
    });
  }

  printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('                        BENCHMARK RESULTS');
    console.log('='.repeat(80));
    
    // Check if we meet the <150ms target
    const targetMet = this.results.every(r => r.averageLatencyMs < 150);
    
    console.log(`\nTarget Latency: <150ms - ${targetMet ? '✅ PASSED' : '❌ FAILED'}\n`);
    
    // Print detailed results
    console.log('Test Name                    | Avg (ms) | Min (ms) | Max (ms) | Words/sec');
    console.log('-'.repeat(76));
    
    for (const result of this.results) {
      const name = result.testName.padEnd(28);
      const avg = result.averageLatencyMs.toFixed(2).padStart(8);
      const min = result.minLatencyMs.toFixed(2).padStart(8);
      const max = result.maxLatencyMs.toFixed(2).padStart(8);
      const throughput = result.throughput > 0 ? result.throughput.toFixed(1).padStart(9) : '    -    ';
      
      console.log(`${name} | ${avg} | ${min} | ${max} | ${throughput}`);
    }
    
    // Print summary statistics
    const allLatencies = this.results.map(r => r.averageLatencyMs);
    const overallAverage = allLatencies.reduce((a, b) => a + b) / allLatencies.length;
    
    console.log('\n' + '='.repeat(80));
    console.log(`Overall Average Latency: ${overallAverage.toFixed(2)}ms`);
    
    // Get final metrics
    this.voiceEngine.getTTSMetrics().then(metrics => {
      if (metrics) {
        console.log(`Total Syntheses: ${metrics.totalSynthesized}`);
        console.log(`Cache Hits: ${metrics.cacheHits}`);
        console.log(`Cache Hit Rate: ${((metrics.cacheHits / metrics.totalSynthesized) * 100).toFixed(1)}%`);
      }
    });
  }

  async runAllBenchmarks(): Promise<void> {
    console.log('Starting TTS Performance Benchmarks...');
    console.log('=' . repeat(80));
    
    await this.benchmarkShortTexts();
    await this.benchmarkMediumTexts();
    await this.benchmarkLongText();
    await this.benchmarkCachePerformance();
    await this.benchmarkVoicePresets();
    await this.benchmarkConcurrent();
    
    this.printResults();
  }
}

// Main execution
async function main() {
  const benchmark = new TTSBenchmark();
  
  try {
    await benchmark.initialize();
    await benchmark.runAllBenchmarks();
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { TTSBenchmark, BenchmarkResult };
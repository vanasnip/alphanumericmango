#!/usr/bin/env ts-node

/**
 * Manual test script for TTS integration
 * Run this to verify the Coqui TTS integration is working correctly
 */

import { VoiceEngine } from '../index';
import * as readline from 'readline';

async function main() {
  console.log('='.repeat(60));
  console.log('       Coqui TTS Integration Manual Test');
  console.log('='.repeat(60));
  console.log('');

  // Create voice engine
  const voiceEngine = new VoiceEngine({
    ttsProvider: 'coqui',
    ttsModel: 'default'
  });

  try {
    // Initialize
    console.log('🔧 Initializing voice engine with Coqui TTS...');
    await voiceEngine.initialize();
    console.log('✅ Voice engine initialized successfully!');
    console.log('');

    // Check if ready
    if (!voiceEngine.isReady()) {
      throw new Error('Voice engine not ready after initialization');
    }

    // Test samples
    const testSamples = [
      'Hello! This is a test of the Coqui text to speech system.',
      'The quick brown fox jumps over the lazy dog.',
      'Testing short text.',
      'Natural voice synthesis is now running locally on your machine.',
      'Voice presets can be switched to change the speaking style.'
    ];

    // Show available presets
    console.log('📢 Available voice presets:');
    const presets = voiceEngine.getVoicePresets();
    for (const preset of presets) {
      console.log(`   - ${preset.name}: ${preset.description || 'No description'}`);
    }
    console.log('');

    // Test each sample
    console.log('🎤 Testing synthesis with sample texts...');
    console.log('-'.repeat(60));

    for (let i = 0; i < testSamples.length; i++) {
      const text = testSamples[i];
      console.log(`\nTest ${i + 1}/${testSamples.length}:`);
      console.log(`Text: "${text}"`);
      
      const startTime = Date.now();
      const result = await voiceEngine.speak(text, `test_output_${i}.wav`);
      const latency = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Success! Latency: ${latency}ms`);
        console.log(`   Output: ${result.outputPath}`);
        
        // Check if we meet the <150ms target
        if (latency < 150) {
          console.log(`   🎯 Meets <150ms target!`);
        } else {
          console.log(`   ⚠️  Exceeds 150ms target`);
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    }

    // Test voice preset switching
    console.log('\n' + '-'.repeat(60));
    console.log('🔄 Testing voice preset switching...');
    
    const testText = 'Testing different voice presets.';
    for (const preset of ['default', 'fast']) {
      console.log(`\nSwitching to "${preset}" preset...`);
      await voiceEngine.switchVoicePreset(preset);
      
      const result = await voiceEngine.speak(testText, `test_${preset}.wav`);
      if (result.success) {
        console.log(`✅ "${preset}" preset synthesis successful!`);
      }
    }

    // Show metrics
    console.log('\n' + '-'.repeat(60));
    console.log('📊 Performance Metrics:');
    const metrics = await voiceEngine.getTTSMetrics();
    if (metrics) {
      console.log(`   Total synthesized: ${metrics.totalSynthesized}`);
      console.log(`   Average latency: ${metrics.averageLatencyMs.toFixed(2)}ms`);
      console.log(`   Cache hits: ${metrics.cacheHits}`);
      if (metrics.totalSynthesized > 0) {
        const cacheHitRate = (metrics.cacheHits / metrics.totalSynthesized * 100).toFixed(1);
        console.log(`   Cache hit rate: ${cacheHitRate}%`);
      }
    }

    // Interactive mode
    console.log('\n' + '='.repeat(60));
    console.log('💬 Interactive Mode');
    console.log('Type text to synthesize, or commands:');
    console.log('  /preset <name> - Switch voice preset');
    console.log('  /metrics - Show performance metrics');
    console.log('  /clear - Clear audio cache');
    console.log('  /exit - Exit the program');
    console.log('='.repeat(60));
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('> ', async (input) => {
        if (input.trim() === '/exit') {
          rl.close();
          return;
        }

        if (input.startsWith('/preset ')) {
          const presetName = input.substring(8).trim();
          try {
            await voiceEngine.switchVoicePreset(presetName);
            console.log(`✅ Switched to "${presetName}" preset`);
          } catch (error) {
            console.log(`❌ Error: ${error}`);
          }
        } else if (input === '/metrics') {
          const m = await voiceEngine.getTTSMetrics();
          console.log('Performance Metrics:', m);
        } else if (input === '/clear') {
          await voiceEngine.clearTTSCache();
          console.log('✅ Cache cleared');
        } else if (input.trim()) {
          // Synthesize the input text
          const startTime = Date.now();
          const result = await voiceEngine.speak(input);
          const latency = Date.now() - startTime;

          if (result.success) {
            console.log(`✅ Synthesized in ${latency}ms`);
          } else {
            console.log(`❌ Error: ${result.error}`);
          }
        }

        prompt();
      });
    };

    prompt();

    // Handle cleanup on exit
    rl.on('close', async () => {
      console.log('\n🧹 Cleaning up...');
      await voiceEngine.cleanup();
      console.log('✅ Cleanup complete. Goodbye!');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error during testing:', error);
    await voiceEngine.cleanup();
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

export default main;
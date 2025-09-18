import { WhisperEngine } from './index';
import * as path from 'path';
import * as fs from 'fs';

async function quickTest() {
  console.log('🚀 Quick Whisper.cpp Performance Test\n');

  const engine = new WhisperEngine({
    modelSize: 'tiny',
    cacheDir: path.join(process.cwd(), '.whisper-models'),
    language: 'en',
    threads: 8,  // Use more threads for better performance
    coreMLEnabled: process.platform === 'darwin'
  });

  try {
    console.log('Initializing engine...');
    await engine.initialize();
    console.log('✅ Engine initialized\n');

    const harvardPath = path.join(process.cwd(), 'harvard.wav');
    
    if (!fs.existsSync(harvardPath)) {
      console.log('⚠️  harvard.wav not found');
      return;
    }

    console.log('Testing transcription speed with harvard.wav...');
    console.log('File size:', (fs.statSync(harvardPath).size / 1024).toFixed(2), 'KB\n');

    // Test direct file path (fastest method)
    console.log('Testing with direct file path...');
    const start = Date.now();
    const result = await engine.transcribe(harvardPath);
    const time = Date.now() - start;
    
    console.log(`  Time: ${time}ms`);
    console.log(`  Text (first 100 chars): ${result.text.substring(0, 100)}...`);
    
    console.log('\n📊 Results:');
    console.log(`  Processing time: ${result.processingTime}ms`);
    console.log(`  Target: <100ms`);
    console.log(`  Status: ${result.processingTime < 100 ? '✅ MEETS REQUIREMENT' : '⚠️  NEEDS OPTIMIZATION'}`);
    
    // Check audio duration to calculate real-time factor
    const audioDuration = fs.statSync(harvardPath).size / (16000 * 2); // Assuming 16kHz 16-bit mono
    const realtimeFactor = result.processingTime / 1000 / audioDuration;
    console.log(`  Real-time factor: ${realtimeFactor.toFixed(2)}x (${realtimeFactor < 1 ? 'faster' : 'slower'} than real-time)`);
    
    await engine.cleanup();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickTest().catch(console.error);
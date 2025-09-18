import { WhisperEngine, initializeWhisper } from './index';
import * as fs from 'fs';
import * as path from 'path';

async function testWhisperIntegration() {
  console.log('🎤 Starting Whisper.cpp Integration Tests\n');
  
  let engine: WhisperEngine | null = null;
  
  try {
    console.log('1. Initializing Whisper Engine with tiny model...');
    const startInit = Date.now();
    
    engine = new WhisperEngine({
      modelSize: 'tiny',
      cacheDir: path.join(process.cwd(), '.whisper-models'),
      language: 'en'
    });
    
    engine.on('initialization:start', (data) => {
      console.log('   📦 Starting initialization:', data);
    });
    
    engine.on('model:download-start', (data) => {
      console.log(`   ⬇️  Downloading model from: ${data.url}`);
    });
    
    engine.on('model:download-complete', (data) => {
      console.log(`   ✅ Model downloaded to: ${data.path}`);
    });
    
    engine.on('model:found', (data) => {
      console.log(`   📦 Using cached model: ${data.path}`);
    });
    
    engine.on('initialization:complete', (status) => {
      console.log('   ✅ Initialization complete:', status);
    });
    
    engine.on('initialization:error', (error) => {
      console.error('   ❌ Initialization error:', error);
    });
    
    await engine.initialize();
    const initTime = Date.now() - startInit;
    console.log(`   ⏱️  Initialization took: ${initTime}ms\n`);
    
    console.log('2. Checking engine status...');
    const status = engine.getStatus();
    console.log('   Status:', status);
    console.log('   Is Ready:', engine.isReady());
    console.log('   Queue Size:', engine.getQueueSize(), '\n');
    
    if (engine.isReady()) {
      console.log('3. Looking for test audio file...');
      const harvardPath = path.join(process.cwd(), 'harvard.wav');
      const testAudioPath = fs.existsSync(harvardPath) ? harvardPath : path.join(process.cwd(), 'test-audio.wav');
      
      if (!fs.existsSync(testAudioPath)) {
        console.log('   ⚠️  No test audio file found');
        console.log('   ℹ️  Please provide harvard.wav or test-audio.wav to test transcription');
        console.log('   You can record one using: ffmpeg -f avfoundation -i ":0" -t 5 test-audio.wav\n');
      } else {
        console.log('   Found test audio file:', testAudioPath);
        
        console.log('\n4. Testing transcription...');
        engine.on('transcription:start', () => {
          console.log('   🎯 Transcription started...');
        });
        
        engine.on('transcription:complete', (result) => {
          console.log('   ✅ Transcription complete!');
        });
        
        engine.on('transcription:error', (error) => {
          console.error('   ❌ Transcription error:', error);
        });
        
        const startTranscribe = Date.now();
        const result = await engine.transcribe(testAudioPath);
        
        console.log('\n📊 Transcription Results:');
        console.log('   Text:', result.text || '(empty)');
        console.log('   Language:', result.language);
        console.log('   Processing Time:', `${result.processingTime}ms`);
        console.log('   Latency Target: <100ms');
        console.log('   Status:', result.processingTime < 100 ? '✅ PASS' : '⚠️  ABOVE TARGET');
      }
    }
    
    console.log('\n5. Testing model switching...');
    console.log('   Switching to base.en model...');
    const switchStart = Date.now();
    await engine.switchModel('base.en');
    const switchTime = Date.now() - switchStart;
    console.log(`   ✅ Model switched in ${switchTime}ms`);
    console.log('   New status:', engine.getStatus());
    
    console.log('\n6. Testing multiple model sizes...');
    const models: Array<'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en'> = ['tiny', 'tiny.en', 'base.en'];
    for (const model of models) {
      console.log(`   Testing ${model} model...`);
      await engine.switchModel(model);
      if (fs.existsSync(testAudioPath)) {
        const result = await engine.transcribe(testAudioPath);
        console.log(`   ✅ ${model}: ${result.processingTime}ms - ${result.text?.substring(0, 50)}...`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    if (engine) {
      console.log('\n7. Cleaning up...');
      await engine.cleanup();
      console.log('   ✅ Cleanup complete');
    }
  }
  
  console.log('\n🎉 Test suite complete!');
}

if (require.main === module) {
  testWhisperIntegration().catch(console.error);
}

export { testWhisperIntegration };
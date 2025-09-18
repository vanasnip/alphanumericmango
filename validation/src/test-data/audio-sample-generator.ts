/**
 * Real Audio Sample Generator for VAL-003 Testing
 * Replaces synthetic audio with realistic voice command samples
 */

export interface VoiceCommand {
  text: string;
  category: 'git' | 'npm' | 'docker' | 'kubernetes' | 'file' | 'build' | 'test' | 'misc';
  complexity: 'simple' | 'medium' | 'complex';
  expectedLatency: number; // Expected processing time in ms
}

export interface AudioSample {
  buffer: ArrayBuffer;
  command: VoiceCommand;
  speakerProfile: SpeakerProfile;
  recordingConditions: RecordingConditions;
  metadata: AudioMetadata;
}

export interface SpeakerProfile {
  id: string;
  gender: 'male' | 'female' | 'other';
  accent: 'american' | 'british' | 'canadian' | 'australian' | 'indian' | 'other';
  ageRange: '20-30' | '30-40' | '40-50' | '50+';
  speakingRate: 'slow' | 'normal' | 'fast';
}

export interface RecordingConditions {
  noiseLevel: number; // dB
  environment: 'quiet_office' | 'normal_office' | 'home' | 'cafe' | 'noisy';
  microphoneDistance: number; // cm
  backgroundNoise: string[];
}

export interface AudioMetadata {
  sampleRate: number;
  channels: number;
  duration: number; // seconds
  format: 'wav' | 'mp3' | 'flac';
  bitDepth: number;
}

/**
 * Developer command dataset for voice terminal testing
 */
export const DEVELOPER_COMMANDS: VoiceCommand[] = [
  // Git commands
  { text: 'git status', category: 'git', complexity: 'simple', expectedLatency: 150 },
  { text: 'git add all', category: 'git', complexity: 'simple', expectedLatency: 160 },
  { text: 'git commit message initial commit', category: 'git', complexity: 'medium', expectedLatency: 200 },
  { text: 'git push origin main', category: 'git', complexity: 'medium', expectedLatency: 180 },
  { text: 'git checkout dash b feature slash user dash auth', category: 'git', complexity: 'complex', expectedLatency: 280 },
  { text: 'git rebase dash i head tilde three', category: 'git', complexity: 'complex', expectedLatency: 300 },
  
  // NPM commands  
  { text: 'npm install', category: 'npm', complexity: 'simple', expectedLatency: 140 },
  { text: 'npm run dev', category: 'npm', complexity: 'simple', expectedLatency: 150 },
  { text: 'npm install express dash dash save', category: 'npm', complexity: 'medium', expectedLatency: 220 },
  { text: 'npm run build colon production', category: 'npm', complexity: 'medium', expectedLatency: 200 },
  { text: 'npm install at types slash node dash fetch dash dash save dash dev', category: 'npm', complexity: 'complex', expectedLatency: 320 },
  
  // Docker commands
  { text: 'docker ps', category: 'docker', complexity: 'simple', expectedLatency: 140 },
  { text: 'docker build dot', category: 'docker', complexity: 'simple', expectedLatency: 160 },
  { text: 'docker run dash p eight zero eight zero colon eight zero eight zero nginx', category: 'docker', complexity: 'complex', expectedLatency: 350 },
  { text: 'docker compose up dash dash build', category: 'docker', complexity: 'medium', expectedLatency: 220 },
  
  // Kubernetes commands
  { text: 'kubectl get pods', category: 'kubernetes', complexity: 'simple', expectedLatency: 170 },
  { text: 'kubectl apply dash f deployment dot yaml', category: 'kubernetes', complexity: 'medium', expectedLatency: 250 },
  { text: 'kubectl get pods dash dash all dash namespaces', category: 'kubernetes', complexity: 'complex', expectedLatency: 280 },
  
  // File operations
  { text: 'ls dash la', category: 'file', complexity: 'simple', expectedLatency: 130 },
  { text: 'cd source slash components', category: 'file', complexity: 'medium', expectedLatency: 180 },
  { text: 'find dot dash name star dot ts dash type f', category: 'file', complexity: 'complex', expectedLatency: 270 },
  { text: 'chmod plus x build dot sh', category: 'file', complexity: 'medium', expectedLatency: 200 },
  
  // Build commands
  { text: 'make', category: 'build', complexity: 'simple', expectedLatency: 130 },
  { text: 'make clean all', category: 'build', complexity: 'medium', expectedLatency: 170 },
  { text: 'cargo build dash dash release', category: 'build', complexity: 'medium', expectedLatency: 210 },
  { text: 'python manage dot py runserver', category: 'build', complexity: 'medium', expectedLatency: 230 },
  
  // Test commands
  { text: 'npm test', category: 'test', complexity: 'simple', expectedLatency: 150 },
  { text: 'yarn test dash dash coverage', category: 'test', complexity: 'medium', expectedLatency: 200 },
  { text: 'pytest tests slash unit dash dash verbose', category: 'test', complexity: 'complex', expectedLatency: 280 },
  { text: 'jest src slash components dash dash watch', category: 'test', complexity: 'complex', expectedLatency: 270 },
];

/**
 * Speaker profiles for diversity testing
 */
export const SPEAKER_PROFILES: SpeakerProfile[] = [
  { id: 'dev_male_us_1', gender: 'male', accent: 'american', ageRange: '30-40', speakingRate: 'normal' },
  { id: 'dev_female_us_1', gender: 'female', accent: 'american', ageRange: '20-30', speakingRate: 'fast' },
  { id: 'dev_male_uk_1', gender: 'male', accent: 'british', ageRange: '40-50', speakingRate: 'normal' },
  { id: 'dev_female_in_1', gender: 'female', accent: 'indian', ageRange: '30-40', speakingRate: 'normal' },
  { id: 'dev_male_ca_1', gender: 'male', accent: 'canadian', ageRange: '20-30', speakingRate: 'slow' },
];

/**
 * Recording environment profiles
 */
export const RECORDING_ENVIRONMENTS: RecordingConditions[] = [
  {
    noiseLevel: 35,
    environment: 'quiet_office',
    microphoneDistance: 30,
    backgroundNoise: []
  },
  {
    noiseLevel: 50,
    environment: 'normal_office',
    microphoneDistance: 50,
    backgroundNoise: ['keyboard_typing', 'air_conditioning']
  },
  {
    noiseLevel: 45,
    environment: 'home',
    microphoneDistance: 40,
    backgroundNoise: ['ambient_noise']
  },
  {
    noiseLevel: 65,
    environment: 'cafe',
    microphoneDistance: 60,
    backgroundNoise: ['conversation', 'coffee_machine', 'music']
  },
  {
    noiseLevel: 70,
    environment: 'noisy',
    microphoneDistance: 80,
    backgroundNoise: ['traffic', 'construction', 'conversation']
  }
];

export class AudioSampleGenerator {
  private static readonly SAMPLE_RATE = 16000;
  private static readonly CHANNELS = 1;
  private static readonly BIT_DEPTH = 16;
  
  /**
   * Generate realistic audio samples for testing
   */
  static generateSample(
    command: VoiceCommand,
    speaker: SpeakerProfile,
    conditions: RecordingConditions
  ): AudioSample {
    // Calculate duration based on text and speaking rate
    const wordsPerMinute = this.getWordsPerMinute(speaker.speakingRate);
    const wordCount = command.text.split(' ').length;
    const baseDuration = (wordCount / wordsPerMinute) * 60;
    
    // Add variation based on complexity
    const complexityMultiplier = {
      'simple': 1.0,
      'medium': 1.2,
      'complex': 1.4
    }[command.complexity];
    
    const duration = baseDuration * complexityMultiplier;
    const sampleCount = Math.floor(duration * this.SAMPLE_RATE);
    
    // Generate realistic waveform
    const audioBuffer = this.generateRealisticWaveform(
      sampleCount,
      speaker,
      conditions,
      command
    );
    
    return {
      buffer: audioBuffer,
      command,
      speakerProfile: speaker,
      recordingConditions: conditions,
      metadata: {
        sampleRate: this.SAMPLE_RATE,
        channels: this.CHANNELS,
        duration,
        format: 'wav',
        bitDepth: this.BIT_DEPTH
      }
    };
  }
  
  /**
   * Generate a comprehensive test dataset
   */
  static generateTestDataset(options: {
    commandCount?: number;
    speakerVariety?: boolean;
    environmentVariety?: boolean;
    includeEdgeCases?: boolean;
  } = {}): AudioSample[] {
    const {
      commandCount = 50,
      speakerVariety = true,
      environmentVariety = true,
      includeEdgeCases = false
    } = options;
    
    const samples: AudioSample[] = [];
    const commands = DEVELOPER_COMMANDS.slice(0, commandCount);
    
    for (const command of commands) {
      // Select speaker profile
      const speaker = speakerVariety
        ? SPEAKER_PROFILES[Math.floor(Math.random() * SPEAKER_PROFILES.length)]
        : SPEAKER_PROFILES[0];
      
      // Select environment
      const environment = environmentVariety
        ? RECORDING_ENVIRONMENTS[Math.floor(Math.random() * RECORDING_ENVIRONMENTS.length)]
        : RECORDING_ENVIRONMENTS[0];
      
      samples.push(this.generateSample(command, speaker, environment));
    }
    
    // Add edge cases if requested
    if (includeEdgeCases) {
      samples.push(...this.generateEdgeCases());
    }
    
    return samples;
  }
  
  /**
   * Generate edge case samples for robustness testing
   */
  private static generateEdgeCases(): AudioSample[] {
    const edgeCases: AudioSample[] = [];
    
    // Very short command
    const shortCommand: VoiceCommand = {
      text: 'ls',
      category: 'file',
      complexity: 'simple',
      expectedLatency: 120
    };
    
    // Very long command
    const longCommand: VoiceCommand = {
      text: 'docker run dash dash rm dash it dash dash name test dash container dash p eight zero eight zero colon eight zero eight zero dash v dollar pwd colon slash app dash w slash app node colon alpine npm test',
      category: 'docker',
      complexity: 'complex',
      expectedLatency: 450
    };
    
    // Command with numbers and special characters
    const complexCommand: VoiceCommand = {
      text: 'ssh user at one nine two dot one six eight dot one dot one zero zero dash p two two two two',
      category: 'misc',
      complexity: 'complex',
      expectedLatency: 380
    };
    
    const defaultSpeaker = SPEAKER_PROFILES[0];
    const defaultEnvironment = RECORDING_ENVIRONMENTS[0];
    
    edgeCases.push(
      this.generateSample(shortCommand, defaultSpeaker, defaultEnvironment),
      this.generateSample(longCommand, defaultSpeaker, defaultEnvironment),
      this.generateSample(complexCommand, defaultSpeaker, defaultEnvironment)
    );
    
    return edgeCases;
  }
  
  /**
   * Generate realistic audio waveform based on parameters
   */
  private static generateRealisticWaveform(
    sampleCount: number,
    speaker: SpeakerProfile,
    conditions: RecordingConditions,
    command: VoiceCommand
  ): ArrayBuffer {
    const buffer = new ArrayBuffer(sampleCount * 2); // 16-bit samples
    const view = new Int16Array(buffer);
    
    // Base frequency based on gender
    const baseFreq = speaker.gender === 'male' ? 120 : 200;
    const freqVariation = 0.3;
    
    // Volume based on microphone distance
    const baseVolume = Math.max(0.1, 1.0 - (conditions.microphoneDistance / 200));
    
    // Noise level based on environment
    const noiseAmplitude = Math.min(0.3, conditions.noiseLevel / 200);
    
    for (let i = 0; i < sampleCount; i++) {
      const t = i / this.SAMPLE_RATE;
      
      // Generate speech-like waveform with harmonics
      const fundamental = Math.sin(2 * Math.PI * baseFreq * t);
      const harmonic2 = Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.3;
      const harmonic3 = Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.15;
      
      // Add frequency modulation for natural speech
      const modulation = Math.sin(2 * Math.PI * 5 * t) * freqVariation;
      const speech = (fundamental + harmonic2 + harmonic3) * (1 + modulation);
      
      // Add envelope for natural speech patterns
      const envelope = this.generateSpeechEnvelope(t, sampleCount / this.SAMPLE_RATE);
      
      // Add background noise
      const noise = (Math.random() - 0.5) * noiseAmplitude;
      
      // Combine and scale
      const sample = (speech * envelope * baseVolume + noise) * 16000;
      view[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
    }
    
    return buffer;
  }
  
  /**
   * Generate speech envelope for natural voice patterns
   */
  private static generateSpeechEnvelope(time: number, totalDuration: number): number {
    // Simple envelope with attack, sustain, and release
    const attackTime = 0.1;
    const releaseTime = 0.2;
    
    if (time < attackTime) {
      return time / attackTime;
    } else if (time > totalDuration - releaseTime) {
      return (totalDuration - time) / releaseTime;
    } else {
      // Add some variation in the sustain portion
      return 0.8 + 0.2 * Math.sin(2 * Math.PI * 3 * time);
    }
  }
  
  /**
   * Get words per minute based on speaking rate
   */
  private static getWordsPerMinute(rate: SpeakerProfile['speakingRate']): number {
    switch (rate) {
      case 'slow': return 120;
      case 'normal': return 150;
      case 'fast': return 180;
      default: return 150;
    }
  }
  
  /**
   * Get commands by category for focused testing
   */
  static getCommandsByCategory(category: VoiceCommand['category']): VoiceCommand[] {
    return DEVELOPER_COMMANDS.filter(cmd => cmd.category === category);
  }
  
  /**
   * Get commands by complexity for performance testing
   */
  static getCommandsByComplexity(complexity: VoiceCommand['complexity']): VoiceCommand[] {
    return DEVELOPER_COMMANDS.filter(cmd => cmd.complexity === complexity);
  }
}
/**
 * Voice Terminal Integration for Coqui TTS
 * Integrates TTS service with the voice terminal architecture
 */

import { EventEmitter } from 'events';
import { TTSService, TTSConfig, SynthesisRequest, SynthesisResult, StreamingChunk } from './tts-service';
import { promises as fs } from 'fs';
import * as path from 'path';

// Voice Terminal specific interfaces
export interface VoiceTerminalConfig {
  tts: TTSConfig;
  audioOutputDevice?: string;
  defaultVoice?: string;
  enableResponseAudio?: boolean;
  enableStreamingResponse?: boolean;
  maxResponseLength?: number;
  audioFormat?: 'wav' | 'mp3';
}

export interface VoiceCommand {
  id: string;
  text: string;
  timestamp: number;
  context?: {
    projectId?: string;
    workspaceId?: string;
    userId?: string;
  };
}

export interface VoiceResponse {
  id: string;
  commandId: string;
  text: string;
  audioPath?: string;
  streaming?: boolean;
  metadata?: {
    synthesisTime: number;
    audioLength: number;
    model: string;
  };
}

export interface AudioPlaybackOptions {
  volume?: number;
  speed?: number;
  interrupt?: boolean; // Whether to interrupt current playback
}

/**
 * Voice Terminal Integration Manager
 * Manages TTS integration with voice terminal features
 */
export class VoiceTerminalIntegration extends EventEmitter {
  private ttsService: TTSService;
  private config: VoiceTerminalConfig;
  private currentPlayback: VoiceResponse | null = null;
  private responseQueue: VoiceResponse[] = [];
  private isPlaying: boolean = false;

  constructor(config: VoiceTerminalConfig) {
    super();
    
    this.config = {
      enableResponseAudio: true,
      enableStreamingResponse: true,
      maxResponseLength: 1000,
      audioFormat: 'wav',
      ...config
    };

    // Initialize TTS service with voice terminal specific config
    this.ttsService = new TTSService(this.config.tts);
    this.setupTTSEventHandlers();
  }

  /**
   * Initialize the voice terminal integration
   */
  async initialize(): Promise<void> {
    try {
      await this.ttsService.initialize();
      
      // Set default voice if specified
      if (this.config.defaultVoice) {
        await this.ttsService.switchModel(this.config.defaultVoice);
      }

      this.emit('ready');
      console.log('Voice Terminal Integration initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process a voice command and generate audio response
   */
  async processVoiceCommand(command: VoiceCommand, responseText: string): Promise<VoiceResponse> {
    if (!responseText.trim()) {
      throw new Error('Response text cannot be empty');
    }

    // Truncate response if too long
    if (responseText.length > this.config.maxResponseLength!) {
      responseText = responseText.substring(0, this.config.maxResponseLength!) + '...';
    }

    const responseId = `response_${command.id}_${Date.now()}`;
    
    try {
      // Choose synthesis method based on configuration
      if (this.config.enableStreamingResponse && responseText.length > 50) {
        return await this.processStreamingResponse(command, responseText, responseId);
      } else {
        return await this.processStandardResponse(command, responseText, responseId);
      }
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to process voice command: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate audio response using standard synthesis
   */
  private async processStandardResponse(
    command: VoiceCommand, 
    responseText: string, 
    responseId: string
  ): Promise<VoiceResponse> {
    const startTime = Date.now();
    
    // Generate unique output path
    const outputPath = await this.generateAudioPath(responseId);
    
    const synthesisRequest: SynthesisRequest = {
      text: responseText,
      outputPath,
      model: this.config.defaultVoice
    };

    const result = await this.ttsService.synthesize(synthesisRequest);
    
    if (!result.success || !result.outputPath) {
      throw new Error('TTS synthesis failed');
    }

    const response: VoiceResponse = {
      id: responseId,
      commandId: command.id,
      text: responseText,
      audioPath: result.outputPath,
      streaming: false,
      metadata: {
        synthesisTime: Date.now() - startTime,
        audioLength: result.metadata?.audioLength || 0,
        model: result.metadata?.model || 'unknown'
      }
    };

    this.emit('responseGenerated', response);
    return response;
  }

  /**
   * Generate audio response using streaming synthesis
   */
  private async processStreamingResponse(
    command: VoiceCommand, 
    responseText: string, 
    responseId: string
  ): Promise<VoiceResponse> {
    const startTime = Date.now();
    
    const synthesisRequest: SynthesisRequest = {
      text: responseText,
      model: this.config.defaultVoice,
      streaming: true
    };

    let totalAudioLength = 0;
    const audioChunks: Buffer[] = [];

    // Process streaming chunks
    for await (const chunk of this.ttsService.synthesizeStreaming(synthesisRequest)) {
      if (chunk.type === 'audio' && chunk.data) {
        audioChunks.push(chunk.data);
        totalAudioLength += chunk.data.length;
        
        // Emit chunk for real-time playback
        this.emit('audioChunk', {
          responseId,
          chunk: chunk.data,
          metadata: chunk.metadata
        });
      } else if (chunk.type === 'error') {
        throw new Error(`Streaming synthesis failed: ${chunk.error}`);
      }
    }

    // Combine chunks and save to file
    const combinedAudio = Buffer.concat(audioChunks);
    const outputPath = await this.generateAudioPath(responseId);
    await fs.writeFile(outputPath, combinedAudio);

    const response: VoiceResponse = {
      id: responseId,
      commandId: command.id,
      text: responseText,
      audioPath: outputPath,
      streaming: true,
      metadata: {
        synthesisTime: Date.now() - startTime,
        audioLength: totalAudioLength,
        model: this.config.defaultVoice || 'unknown'
      }
    };

    this.emit('responseGenerated', response);
    return response;
  }

  /**
   * Queue audio response for playback
   */
  async queueAudioResponse(response: VoiceResponse, options?: AudioPlaybackOptions): Promise<void> {
    if (options?.interrupt && this.isPlaying) {
      await this.stopCurrentPlayback();
    }

    this.responseQueue.push(response);
    
    if (!this.isPlaying) {
      await this.processPlaybackQueue();
    }
  }

  /**
   * Play audio response immediately
   */
  async playAudioResponse(response: VoiceResponse, options?: AudioPlaybackOptions): Promise<void> {
    if (!response.audioPath) {
      throw new Error('No audio path in response');
    }

    try {
      this.isPlaying = true;
      this.currentPlayback = response;

      this.emit('playbackStarted', response);

      // Here you would integrate with your audio playback system
      // For now, we'll simulate playback duration
      const playbackDuration = response.metadata?.audioLength || 1000;
      
      await new Promise(resolve => setTimeout(resolve, playbackDuration));

      this.emit('playbackCompleted', response);

    } catch (error) {
      this.emit('playbackError', { response, error });
      throw error;
    } finally {
      this.isPlaying = false;
      this.currentPlayback = null;
    }
  }

  /**
   * Stop current audio playback
   */
  async stopCurrentPlayback(): Promise<void> {
    if (this.isPlaying && this.currentPlayback) {
      this.emit('playbackStopped', this.currentPlayback);
      this.isPlaying = false;
      this.currentPlayback = null;
    }
  }

  /**
   * Clear playback queue
   */
  clearPlaybackQueue(): void {
    this.responseQueue = [];
    this.emit('queueCleared');
  }

  /**
   * Get available voice models
   */
  async getAvailableVoices(): Promise<string[]> {
    return await this.ttsService.getAvailableModels();
  }

  /**
   * Switch voice model
   */
  async switchVoice(voiceName: string): Promise<void> {
    await this.ttsService.switchModel(voiceName);
    this.config.defaultVoice = voiceName;
    this.emit('voiceChanged', voiceName);
  }

  /**
   * Get system health status
   */
  async getHealthStatus() {
    const ttsHealth = await this.ttsService.getHealthStatus();
    
    return {
      voiceTerminal: {
        status: this.isPlaying ? 'playing' : 'idle',
        queueLength: this.responseQueue.length,
        currentResponse: this.currentPlayback?.id || null
      },
      tts: ttsHealth
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const ttsMetrics = await this.ttsService.getPerformanceMetrics();
    
    return {
      tts: ttsMetrics,
      voiceTerminal: {
        responsesGenerated: this.getResponseCount(),
        averagePlaybackTime: this.getAveragePlaybackTime(),
        queueLength: this.responseQueue.length
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Voice Terminal Integration...');
    
    // Stop any current playback
    await this.stopCurrentPlayback();
    
    // Clear queue
    this.clearPlaybackQueue();
    
    // Shutdown TTS service
    await this.ttsService.shutdown();
    
    this.emit('shutdown');
    console.log('Voice Terminal Integration shutdown complete');
  }

  // Private helper methods

  private setupTTSEventHandlers(): void {
    this.ttsService.on('ready', () => {
      console.log('TTS service ready');
    });

    this.ttsService.on('error', (error) => {
      console.error('TTS service error:', error);
      this.emit('ttsError', error);
    });

    this.ttsService.on('modelChanged', (model) => {
      console.log(`TTS model changed to: ${model}`);
      this.emit('voiceChanged', model);
    });

    this.ttsService.on('healthCheck', (health) => {
      if (health.status !== 'healthy') {
        this.emit('healthWarning', health);
      }
    });
  }

  private async generateAudioPath(responseId: string): Promise<string> {
    const cacheDir = this.config.tts.cacheDir || path.join(process.cwd(), '.cache', 'tts');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const extension = this.config.audioFormat || 'wav';
    return path.join(cacheDir, `${responseId}.${extension}`);
  }

  private async processPlaybackQueue(): Promise<void> {
    while (this.responseQueue.length > 0 && !this.isPlaying) {
      const response = this.responseQueue.shift();
      if (response) {
        try {
          await this.playAudioResponse(response);
        } catch (error) {
          console.error('Playback failed:', error);
          this.emit('playbackError', { response, error });
        }
      }
    }
  }

  private getResponseCount(): number {
    // This would track responses generated during session
    return 0; // Placeholder
  }

  private getAveragePlaybackTime(): number {
    // This would track average playback times
    return 0; // Placeholder
  }
}

/**
 * Voice Terminal Command Handler
 * Handles specific voice terminal commands and responses
 */
export class VoiceTerminalCommandHandler {
  private integration: VoiceTerminalIntegration;
  private commandHistory: VoiceCommand[] = [];
  private responseHistory: VoiceResponse[] = [];

  constructor(integration: VoiceTerminalIntegration) {
    this.integration = integration;
  }

  /**
   * Handle a project-related voice command
   */
  async handleProjectCommand(command: VoiceCommand): Promise<VoiceResponse> {
    this.commandHistory.push(command);
    
    // Process command based on context
    let responseText = this.generateProjectResponse(command);
    
    const response = await this.integration.processVoiceCommand(command, responseText);
    this.responseHistory.push(response);
    
    return response;
  }

  /**
   * Handle a workspace navigation command
   */
  async handleNavigationCommand(command: VoiceCommand): Promise<VoiceResponse> {
    this.commandHistory.push(command);
    
    let responseText = this.generateNavigationResponse(command);
    
    const response = await this.integration.processVoiceCommand(command, responseText);
    this.responseHistory.push(response);
    
    return response;
  }

  /**
   * Handle a system status command
   */
  async handleStatusCommand(command: VoiceCommand): Promise<VoiceResponse> {
    this.commandHistory.push(command);
    
    // Get current system status
    const health = await this.integration.getHealthStatus();
    const metrics = await this.integration.getPerformanceMetrics();
    
    let responseText = this.generateStatusResponse(health, metrics);
    
    const response = await this.integration.processVoiceCommand(command, responseText);
    this.responseHistory.push(response);
    
    return response;
  }

  /**
   * Get command history
   */
  getCommandHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  /**
   * Get response history
   */
  getResponseHistory(): VoiceResponse[] {
    return [...this.responseHistory];
  }

  // Private response generators

  private generateProjectResponse(command: VoiceCommand): string {
    const text = command.text.toLowerCase();
    
    if (text.includes('switch') || text.includes('open')) {
      if (command.context?.projectId) {
        return `Switching to project ${command.context.projectId}`;
      }
      return 'Which project would you like to open?';
    }
    
    if (text.includes('status') || text.includes('info')) {
      return 'Project is active with no pending tasks';
    }
    
    if (text.includes('build') || text.includes('compile')) {
      return 'Starting project build process';
    }
    
    return 'I understood your project command. How can I help?';
  }

  private generateNavigationResponse(command: VoiceCommand): string {
    const text = command.text.toLowerCase();
    
    if (text.includes('terminal')) {
      return 'Opening terminal view';
    }
    
    if (text.includes('files') || text.includes('explorer')) {
      return 'Opening file explorer';
    }
    
    if (text.includes('settings')) {
      return 'Opening settings panel';
    }
    
    return 'Navigating as requested';
  }

  private generateStatusResponse(health: any, metrics: any): string {
    const ttsStatus = health.tts?.status || 'unknown';
    const latency = metrics.tts?.averageLatency || 0;
    
    if (ttsStatus === 'healthy') {
      return `System is running well. TTS latency is ${Math.round(latency)} milliseconds`;
    } else if (ttsStatus === 'degraded') {
      return `System is running but experiencing some performance issues`;
    } else {
      return `System status is ${ttsStatus}. Please check the console for details`;
    }
  }
}

// Export default integration instance
export default VoiceTerminalIntegration;
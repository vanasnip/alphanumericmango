/**
 * Electron Main Process IPC Handlers for Voice Engine
 */

import { ipcMain } from 'electron';
import { WhisperAdapter } from '../adapters/WhisperAdapter';
import { IVoiceEngine, VoiceConfig, AudioData } from '../interfaces/IVoiceEngine';

export class WhisperIPCHandler {
  private engine: IVoiceEngine | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Initialize engine
    ipcMain.handle('whisper:initialize', async (event, config: VoiceConfig) => {
      try {
        if (this.initPromise) {
          await this.initPromise;
          return { success: true };
        }

        this.engine = new WhisperAdapter();
        
        // Forward events to renderer
        this.engine.on('ready', () => {
          event.sender.send('whisper:event', { type: 'ready' });
        });
        
        this.engine.on('error', (error) => {
          event.sender.send('whisper:event', { 
            type: 'error', 
            data: { message: error.message } 
          });
        });
        
        this.engine.on('recording-start', () => {
          event.sender.send('whisper:event', { type: 'recording-start' });
        });
        
        this.engine.on('recording-stop', () => {
          event.sender.send('whisper:event', { type: 'recording-stop' });
        });
        
        this.engine.on('transcription-start', () => {
          event.sender.send('whisper:event', { type: 'transcription-start' });
        });
        
        this.engine.on('transcription-complete', (result) => {
          event.sender.send('whisper:event', { 
            type: 'transcription-complete', 
            data: result 
          });
        });
        
        this.engine.on('interim-result', (text) => {
          event.sender.send('whisper:event', { 
            type: 'interim-result', 
            data: { text } 
          });
        });
        
        this.initPromise = this.engine.initialize(config);
        await this.initPromise;
        
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        return { success: false, error: errorMessage };
      }
    });

    // Cleanup engine
    ipcMain.handle('whisper:cleanup', async () => {
      try {
        if (this.engine) {
          await this.engine.cleanup();
          this.engine = null;
          this.initPromise = null;
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Start recording
    ipcMain.handle('whisper:startRecording', async () => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        await this.engine.startRecording();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Stop recording
    ipcMain.handle('whisper:stopRecording', async () => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        const result = await this.engine.stopRecording();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Cancel recording
    ipcMain.handle('whisper:cancelRecording', async () => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        await this.engine.cancelRecording();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Transcribe audio
    ipcMain.handle('whisper:transcribe', async (event, audioBuffer: Buffer) => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        
        // Convert IPC buffer to Float32Array if needed
        let audioData: AudioData;
        
        // Check if it's a Float32Array buffer
        if (audioBuffer.byteLength % 4 === 0) {
          audioData = new Float32Array(
            audioBuffer.buffer.slice(
              audioBuffer.byteOffset,
              audioBuffer.byteOffset + audioBuffer.byteLength
            )
          );
        } else {
          audioData = audioBuffer;
        }
        
        const result = await this.engine.transcribe(audioData);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Get status
    ipcMain.handle('whisper:getStatus', async () => {
      try {
        if (!this.engine) {
          return {
            success: true,
            data: {
              engine: 'whisper',
              initialized: false,
              isProcessing: false,
              isRecording: false,
              queueSize: 0
            }
          };
        }
        
        const status = this.engine.getStatus();
        return { success: true, data: status };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Get capabilities
    ipcMain.handle('whisper:getCapabilities', async () => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        
        const capabilities = this.engine.getCapabilities();
        return { success: true, data: capabilities };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Update configuration
    ipcMain.handle('whisper:updateConfig', async (event, config: Partial<VoiceConfig>) => {
      try {
        if (!this.engine) {
          throw new Error('Engine not initialized');
        }
        
        await this.engine.updateConfig(config);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
  }

  /**
   * Clean up handlers (call this when app is closing)
   */
  async cleanup(): Promise<void> {
    if (this.engine) {
      await this.engine.cleanup();
      this.engine = null;
    }
    
    // Remove all IPC handlers
    ipcMain.removeHandler('whisper:initialize');
    ipcMain.removeHandler('whisper:cleanup');
    ipcMain.removeHandler('whisper:startRecording');
    ipcMain.removeHandler('whisper:stopRecording');
    ipcMain.removeHandler('whisper:cancelRecording');
    ipcMain.removeHandler('whisper:transcribe');
    ipcMain.removeHandler('whisper:getStatus');
    ipcMain.removeHandler('whisper:getCapabilities');
    ipcMain.removeHandler('whisper:updateConfig');
  }
}

// Export singleton instance
export const whisperIPCHandler = new WhisperIPCHandler();
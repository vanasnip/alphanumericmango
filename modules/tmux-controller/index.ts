/**
 * Standalone tmux Controller Module
 * Can be developed and tested independently
 */

import { spawn, ChildProcess } from 'child_process';

export interface TmuxSession {
  id: string;
  name: string;
  created: Date;
  windowId: string;
}

export class TmuxController {
  private sessions: Map<string, TmuxSession> = new Map();
  
  /**
   * Create a new tmux session
   */
  async createSession(name: string): Promise<TmuxSession> {
    return new Promise((resolve, reject) => {
      const sessionName = `projectx-${name}-${Date.now()}`;
      
      const tmux = spawn('tmux', ['new-session', '-d', '-s', sessionName]);
      
      tmux.on('exit', (code) => {
        if (code === 0) {
          const session: TmuxSession = {
            id: sessionName,
            name: name,
            created: new Date(),
            windowId: '0'
          };
          this.sessions.set(sessionName, session);
          resolve(session);
        } else {
          reject(new Error(`Failed to create tmux session: ${code}`));
        }
      });
    });
  }
  
  /**
   * Send command to tmux session (target: <20ms)
   */
  async sendCommand(sessionId: string, command: string): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const tmux = spawn('tmux', [
        'send-keys',
        '-t', sessionId,
        command,
        'Enter'
      ]);
      
      tmux.on('exit', (code) => {
        const duration = Date.now() - startTime;
        console.log(`Command sent in ${duration}ms`);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to send command: ${code}`));
        }
      });
    });
  }
  
  /**
   * Capture output from tmux pane
   */
  async captureOutput(sessionId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tmux = spawn('tmux', [
        'capture-pane',
        '-t', sessionId,
        '-p'
      ]);
      
      let output = '';
      
      tmux.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      tmux.on('exit', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Failed to capture output: ${code}`));
        }
      });
    });
  }
  
  /**
   * Kill tmux session
   */
  async killSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tmux = spawn('tmux', ['kill-session', '-t', sessionId]);
      
      tmux.on('exit', (code) => {
        if (code === 0) {
          this.sessions.delete(sessionId);
          resolve();
        } else {
          reject(new Error(`Failed to kill session: ${code}`));
        }
      });
    });
  }
  
  /**
   * List all active sessions
   */
  getActiveSessions(): TmuxSession[] {
    return Array.from(this.sessions.values());
  }
}

// Export for testing
export default TmuxController;
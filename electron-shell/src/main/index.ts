/**
 * Flexible Electron Main Process
 * Can load either React or Svelte prototype for testing
 */

import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'path';
import { spawn } from 'child_process';

// Configuration
const CONFIG = {
  // Svelte terminal is the only option now
  port: 5173,  // SvelteKit default port
  
  performance: {
    // VS Code-inspired optimizations
    ipcBatchWindow: 50, // ms
    ipcBatchSize: 50,   // messages
  }
};

class MainApplication {
  private mainWindow: BrowserWindow | null = null;
  private devServer: any = null;
  private ipcBatchQueue: any[] = [];
  private ipcBatchTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupAppHandlers();
    this.setupIPCHandlers();
  }

  private setupAppHandlers() {
    app.whenReady().then(() => this.createWindow());
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private async createWindow() {
    // Process isolation pattern from VS Code
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,  // Security best practice
        nodeIntegration: false,  // Security best practice
        sandbox: true            // Process isolation
      },
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#1a1a1a'
    });

    // Development menu
    this.setupMenu();

    // Load the Svelte terminal
    await this.loadSvelteTerminal();

    // DevTools in development
    if (process.env.NODE_ENV !== 'production') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private async loadSvelteTerminal() {
    if (!this.mainWindow) return;

    const isDev = process.env.NODE_ENV !== 'production';
    
    if (isDev) {
      // Load from dev server
      const url = `http://localhost:${CONFIG.port}`;
      
      console.log(`Loading Svelte terminal from ${url}`);
      
      try {
        await this.mainWindow.loadURL(url);
      } catch (error) {
        console.error(`Failed to load ${url}. Is the dev server running?`);
        console.log(`Start it with:`);
        console.log(`  cd ../voice-terminal-hybrid && npm run dev`);
        
        // Show error in window
        this.mainWindow.loadURL(`data:text/html,
          <h1>Dev Server Not Running</h1>
          <p>Start the Svelte terminal dev server:</p>
          <pre>cd ../voice-terminal-hybrid && npm run dev</pre>
          <p>Then reload this window (Cmd+R)</p>
        `);
      }
    } else {
      // Load from built files
      const indexPath = path.join(__dirname, '../../renderer/build/index.html');
      this.mainWindow.loadFile(indexPath);
    }
  }

  private setupMenu() {
    const template: any[] = [
      {
        label: 'Terminal',
        submenu: [
          {
            label: 'Clear Terminal',
            accelerator: 'CmdOrCtrl+K',
            click: () => this.sendToRenderer('terminal:clear')
          },
          {
            label: 'Reset Session',
            click: () => this.sendToRenderer('terminal:reset')
          }
        ]
      },
      {
        label: 'Developer',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          {
            label: 'Show Performance Metrics',
            click: () => this.showPerformanceMetrics()
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private sendToRenderer(channel: string, data?: any) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private showPerformanceMetrics() {
    if (!this.mainWindow) return;
    
    const metrics = app.getAppMetrics();
    const memory = process.memoryUsage();
    
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'Performance Metrics',
      message: `Memory Usage:\nHeap: ${Math.round(memory.heapUsed / 1024 / 1024)}MB\nRSS: ${Math.round(memory.rss / 1024 / 1024)}MB\nCPU: ${metrics[0]?.cpu?.percentCPUUsage || 0}%`,
      buttons: ['OK']
    });
  }

  private setupIPCHandlers() {
    // IPC Batching pattern from research
    ipcMain.handle('batch-ipc', (event, messages) => {
      // Process batched messages
      return this.processBatchedMessages(messages);
    });

    // tmux integration
    ipcMain.handle('tmux:command', async (event, command) => {
      return this.executeTmuxCommand(command);
    });

    // Voice engine integration
    ipcMain.handle('voice:start', async () => {
      return this.startVoiceRecording();
    });

    ipcMain.handle('voice:stop', async () => {
      return this.stopVoiceRecording();
    });
  }

  private processBatchedMessages(messages: any[]) {
    // Process multiple IPC messages in one go
    const results = messages.map(msg => {
      // Process each message
      return { id: msg.id, result: 'processed' };
    });
    return results;
  }

  private async executeTmuxCommand(command: string) {
    // Placeholder for tmux integration
    console.log('tmux command:', command);
    return { success: true, output: 'tmux output placeholder' };
  }

  private async startVoiceRecording() {
    console.log('Starting voice recording...');
    return { recording: true };
  }

  private async stopVoiceRecording() {
    console.log('Stopping voice recording...');
    return { recording: false, text: 'voice transcription placeholder' };
  }
}

// Initialize application
const mainApp = new MainApplication();

// Performance optimization: V8 snapshots (if building for production)
if (process.env.NODE_ENV === 'production') {
  // V8 snapshot configuration would go here
  console.log('Production mode: V8 snapshots would be enabled');
}
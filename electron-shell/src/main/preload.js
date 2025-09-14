/**
 * Preload Script - Secure bridge between renderer and main process
 * Following Electron security best practices
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // tmux operations
  tmux: {
    sendCommand: (command) => ipcRenderer.invoke('tmux:command', command),
    getOutput: () => ipcRenderer.invoke('tmux:output')
  },
  
  // Voice operations
  voice: {
    start: () => ipcRenderer.invoke('voice:start'),
    stop: () => ipcRenderer.invoke('voice:stop'),
    onTranscription: (callback) => {
      ipcRenderer.on('voice:transcription', (event, data) => callback(data));
    }
  },
  
  // Batched IPC for performance
  batch: {
    send: (messages) => ipcRenderer.invoke('batch-ipc', messages)
  },
  
  // System info
  system: {
    platform: process.platform,
    version: process.versions.electron
  }
});

console.log('Preload script loaded - electronAPI available in renderer');
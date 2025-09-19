<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { terminalStore, activeSession } from '../stores/terminalStore.js';
  import { terminalWebSocketClient } from '../websocket/TerminalWebSocketClient.js';
  import { voiceNavigation } from '../voiceNavigation.js';
  import { createVoiceRecognition } from '../voiceRecognition.js';
  import SessionManager from './terminal/SessionManager.svelte';
  import type { VoiceRecognitionResult } from '../types.js';

  // Props
  export let enableVoiceCommands = true;
  export let enablePerformanceMonitoring = true;
  export let maxTerminalSessions = 10;
  export let autoConnectWebSocket = true;
  export let voiceLanguage = 'en-US';

  // Voice recognition state
  let voiceRecognition = createVoiceRecognition();
  let isVoiceListening = false;
  let lastVoiceCommand = '';
  let voiceError = '';
  let voiceConfidence = 0;

  // Integration state
  let isInitialized = false;
  let connectionStatus = 'disconnected';
  let lastCommandResult = '';
  let commandHistory: string[] = [];

  // Performance metrics
  let performanceMetrics = {
    commandLatency: 0,
    voiceProcessingTime: 0,
    totalCommands: 0,
    successfulCommands: 0
  };

  // Reactive statements
  $: currentSession = $activeSession;
  $: if (currentSession) {
    updateVoiceNavigationContext();
  }

  onMount(() => {
    initializeVoiceTerminalIntegration();
  });

  onDestroy(() => {
    cleanupVoiceTerminalIntegration();
  });

  // Initialize the voice terminal integration
  async function initializeVoiceTerminalIntegration() {
    try {
      // Setup voice command handling
      if (enableVoiceCommands) {
        setupVoiceCommandIntegration();
      }

      // Setup WebSocket connection
      if (autoConnectWebSocket) {
        await initializeWebSocketConnection();
      }

      // Setup performance monitoring
      if (enablePerformanceMonitoring) {
        setupPerformanceMonitoring();
      }

      // Setup global event listeners
      setupEventListeners();

      isInitialized = true;
      console.log('Voice Terminal Integration initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Voice Terminal Integration:', error);
      voiceError = `Initialization failed: ${error}`;
    }
  }

  // Setup voice command integration
  function setupVoiceCommandIntegration() {
    if (!voiceRecognition?.supported) {
      console.warn('Voice recognition not supported in this browser');
      return;
    }

    // Register terminal command callback with voice navigation
    voiceNavigation.setTerminalCommandCallback(handleVoiceTerminalCommand);

    // Setup voice recognition language
    if (voiceRecognition && voiceLanguage) {
      // Voice recognition language is set during initialization
      console.log(`Voice recognition language set to: ${voiceLanguage}`);
    }
  }

  // Initialize WebSocket connection
  async function initializeWebSocketConnection() {
    try {
      connectionStatus = 'connecting';
      
      // Setup connection event listeners
      terminalWebSocketClient.onConnectionStateChanged((state) => {
        connectionStatus = state;
      });

      terminalWebSocketClient.onErrorOccurred((error) => {
        console.error('WebSocket error:', error);
        voiceError = `Connection error: ${error.message}`;
      });

      // Connect to WebSocket server
      await terminalWebSocketClient.connect();
      
      console.log('WebSocket connection established');

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      connectionStatus = 'error';
      voiceError = `Connection failed: ${error}`;
    }
  }

  // Setup performance monitoring
  function setupPerformanceMonitoring() {
    // Monitor terminal store for performance metrics
    terminalStore.subscribe(state => {
      performanceMetrics = {
        commandLatency: state.globalPerformanceMetrics.averageLatency,
        voiceProcessingTime: performanceMetrics.voiceProcessingTime,
        totalCommands: state.globalPerformanceMetrics.totalCommands,
        successfulCommands: state.globalPerformanceMetrics.totalCommands - state.globalPerformanceMetrics.failedCommands
      };
    });

    // Log performance warnings
    setInterval(() => {
      if (performanceMetrics.commandLatency > 15) {
        console.warn(`High command latency detected: ${performanceMetrics.commandLatency.toFixed(1)}ms`);
      }
    }, 10000);
  }

  // Setup global event listeners
  function setupEventListeners() {
    // Listen for voice terminal commands
    window.addEventListener('voice-terminal-command', handleVoiceTerminalEvent);

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyboard);

    // Listen for visibility changes to pause/resume voice recognition
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Handle voice terminal commands from voice navigation
  function handleVoiceTerminalCommand(action: string, parameter?: string) {
    const startTime = performance.now();
    
    try {
      switch (action) {
        case 'new-session':
          createNewSession();
          break;
        case 'close-session':
          closeCurrentSession();
          break;
        case 'next-session':
          switchToNextSession();
          break;
        case 'previous-session':
          switchToPreviousSession();
          break;
        case 'split-view':
          toggleSplitView();
          break;
        case 'scroll-up':
          scrollTerminal('up');
          break;
        case 'scroll-down':
          scrollTerminal('down');
          break;
        case 'scroll-top':
          scrollTerminal('top');
          break;
        case 'scroll-bottom':
          scrollTerminal('bottom');
          break;
        case 'clear-terminal':
          clearCurrentTerminal();
          break;
        case 'focus-input':
          focusCommandInput();
          break;
        case 'voice-input':
          startVoiceCommandInput();
          break;
        case 'clear-input':
          clearCommandInput();
          break;
        case 'execute-command':
          executeCurrentCommand();
          break;
        case 'copy-all':
          copyAllTerminalOutput();
          break;
        case 'copy-selection':
          copySelectedText();
          break;
        case 'search':
          searchTerminalOutput(parameter);
          break;
        case 'search-next':
          searchNext();
          break;
        case 'search-previous':
          searchPrevious();
          break;
        default:
          console.warn(`Unknown voice terminal command: ${action}`);
          return;
      }

      // Record successful command
      performanceMetrics.totalCommands++;
      performanceMetrics.successfulCommands++;
      lastCommandResult = `Executed: ${action}`;
      
      // Add to command history
      commandHistory.unshift(`${action}${parameter ? ` ${parameter}` : ''}`);
      if (commandHistory.length > 50) {
        commandHistory = commandHistory.slice(0, 50);
      }

    } catch (error) {
      console.error(`Failed to execute voice command ${action}:`, error);
      voiceError = `Command failed: ${error}`;
      performanceMetrics.totalCommands++;
    } finally {
      // Record command processing time
      const processingTime = performance.now() - startTime;
      performanceMetrics.voiceProcessingTime = processingTime;
    }
  }

  // Handle voice terminal events
  function handleVoiceTerminalEvent(event: CustomEvent) {
    const { action, parameter } = event.detail;
    handleVoiceTerminalCommand(action, parameter);
  }

  // Voice recognition functions
  function startVoiceRecognition() {
    if (!voiceRecognition?.supported || isVoiceListening) return;

    voiceError = '';
    
    voiceRecognition.start(
      (result: VoiceRecognitionResult) => {
        lastVoiceCommand = result.transcript;
        voiceConfidence = result.confidence;
        
        if (result.isFinal) {
          processVoiceCommand(result.transcript);
        }
      },
      (error: string) => {
        voiceError = error;
        isVoiceListening = false;
      },
      () => {
        isVoiceListening = false;
      }
    );
    
    isVoiceListening = true;
  }

  function stopVoiceRecognition() {
    if (voiceRecognition && isVoiceListening) {
      voiceRecognition.stop();
    }
  }

  function processVoiceCommand(transcript: string) {
    const startTime = performance.now();
    
    try {
      // Process through voice navigation system
      const handled = voiceNavigation.processVoiceCommand(transcript);
      
      if (handled) {
        lastCommandResult = `Processed: "${transcript}"`;
      } else {
        lastCommandResult = `Unrecognized: "${transcript}"`;
        console.warn(`Unrecognized voice command: ${transcript}`);
      }
      
    } catch (error) {
      console.error('Error processing voice command:', error);
      voiceError = `Processing error: ${error}`;
    } finally {
      performanceMetrics.voiceProcessingTime = performance.now() - startTime;
    }
  }

  // Terminal action implementations
  function createNewSession() {
    // Trigger new session creation in SessionManager
    const event = new CustomEvent('session-action', {
      detail: { action: 'create', sessionName: `Terminal ${Date.now()}` }
    });
    window.dispatchEvent(event);
  }

  function closeCurrentSession() {
    if (currentSession) {
      const event = new CustomEvent('session-action', {
        detail: { action: 'close', sessionId: currentSession.id }
      });
      window.dispatchEvent(event);
    }
  }

  function switchToNextSession() {
    const event = new CustomEvent('session-action', {
      detail: { action: 'next' }
    });
    window.dispatchEvent(event);
  }

  function switchToPreviousSession() {
    const event = new CustomEvent('session-action', {
      detail: { action: 'previous' }
    });
    window.dispatchEvent(event);
  }

  function toggleSplitView() {
    const event = new CustomEvent('session-action', {
      detail: { action: 'split-toggle' }
    });
    window.dispatchEvent(event);
  }

  function scrollTerminal(direction: 'up' | 'down' | 'top' | 'bottom') {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'scroll', direction, sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function clearCurrentTerminal() {
    if (currentSession) {
      terminalStore.clearSessionOutput(currentSession.id);
    }
  }

  function focusCommandInput() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'focus-input', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function startVoiceCommandInput() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'voice-input', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function clearCommandInput() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'clear-input', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function executeCurrentCommand() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'execute-command', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function copyAllTerminalOutput() {
    if (currentSession) {
      const allText = currentSession.output.map(line => line.content).join('\n');
      navigator.clipboard.writeText(allText).catch(err => {
        console.error('Failed to copy output:', err);
        voiceError = 'Failed to copy output';
      });
    }
  }

  function copySelectedText() {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      navigator.clipboard.writeText(selection.toString()).catch(err => {
        console.error('Failed to copy selection:', err);
        voiceError = 'Failed to copy selection';
      });
    }
  }

  function searchTerminalOutput(query?: string) {
    if (query) {
      const event = new CustomEvent('terminal-action', {
        detail: { action: 'search', query, sessionId: currentSession?.id }
      });
      window.dispatchEvent(event);
    }
  }

  function searchNext() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'search-next', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  function searchPrevious() {
    const event = new CustomEvent('terminal-action', {
      detail: { action: 'search-previous', sessionId: currentSession?.id }
    });
    window.dispatchEvent(event);
  }

  // Event handlers
  function handleGlobalKeyboard(event: KeyboardEvent) {
    // Global voice activation shortcut
    if (event.ctrlKey && event.key === ' ') {
      event.preventDefault();
      if (isVoiceListening) {
        stopVoiceRecognition();
      } else {
        startVoiceRecognition();
      }
    }
  }

  function handleVisibilityChange() {
    // Pause voice recognition when tab is not visible
    if (document.hidden && isVoiceListening) {
      stopVoiceRecognition();
    }
  }

  // Update voice navigation context
  function updateVoiceNavigationContext() {
    if (currentSession) {
      const contextId = `terminal-${currentSession.id}`;
      voiceNavigation.createContext(contextId);
      voiceNavigation.setActiveContext(contextId);
    }
  }

  // Cleanup function
  function cleanupVoiceTerminalIntegration() {
    // Stop voice recognition
    if (isVoiceListening) {
      stopVoiceRecognition();
    }

    // Clear voice navigation callback
    voiceNavigation.clearTerminalCommandCallback();

    // Remove event listeners
    window.removeEventListener('voice-terminal-command', handleVoiceTerminalEvent);
    document.removeEventListener('keydown', handleGlobalKeyboard);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Disconnect WebSocket
    terminalWebSocketClient.disconnect();

    console.log('Voice Terminal Integration cleaned up');
  }

  // Utility functions
  function formatPerformanceMetrics() {
    return {
      commandLatency: `${performanceMetrics.commandLatency.toFixed(1)}ms`,
      voiceProcessingTime: `${performanceMetrics.voiceProcessingTime.toFixed(1)}ms`,
      successRate: performanceMetrics.totalCommands > 0 
        ? `${((performanceMetrics.successfulCommands / performanceMetrics.totalCommands) * 100).toFixed(1)}%`
        : '100%'
    };
  }

  function getConnectionStatusColor() {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'connecting': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#888';
    }
  }

  function getVoiceStatusColor() {
    if (!voiceRecognition?.supported) return '#888';
    if (voiceError) return '#f44336';
    if (isVoiceListening) return '#4caf50';
    return '#888';
  }
</script>

<div class="voice-terminal-integration">
  <!-- Status bar -->
  <div class="status-bar">
    <div class="status-section">
      <span class="status-label">Connection:</span>
      <span class="status-indicator" style="color: {getConnectionStatusColor()}">
        {connectionStatus}
      </span>
    </div>

    {#if enableVoiceCommands}
      <div class="status-section">
        <span class="status-label">Voice:</span>
        <span class="status-indicator" style="color: {getVoiceStatusColor()}">
          {#if !voiceRecognition?.supported}
            Not Supported
          {:else if voiceError}
            Error
          {:else if isVoiceListening}
            Listening
          {:else}
            Ready
          {/if}
        </span>
        
        {#if voiceRecognition?.supported}
          <button 
            class="voice-toggle"
            class:active={isVoiceListening}
            on:click={isVoiceListening ? stopVoiceRecognition : startVoiceRecognition}
            aria-label={isVoiceListening ? 'Stop voice recognition' : 'Start voice recognition'}
          >
            {isVoiceListening ? '⏹️' : '🎤'}
          </button>
        {/if}
      </div>
    {/if}

    {#if enablePerformanceMonitoring}
      <div class="status-section">
        <span class="status-label">Performance:</span>
        <span class="performance-metrics">
          {formatPerformanceMetrics().commandLatency} | 
          {formatPerformanceMetrics().successRate}
        </span>
      </div>
    {/if}

    <div class="status-section">
      <span class="help-text">Press Ctrl+Space for voice commands</span>
    </div>
  </div>

  <!-- Voice feedback -->
  {#if enableVoiceCommands && (lastVoiceCommand || voiceError || lastCommandResult)}
    <div class="voice-feedback">
      {#if voiceError}
        <div class="feedback-item error">
          <span class="feedback-label">Error:</span>
          <span class="feedback-text">{voiceError}</span>
        </div>
      {/if}

      {#if lastVoiceCommand}
        <div class="feedback-item voice">
          <span class="feedback-label">Voice:</span>
          <span class="feedback-text">"{lastVoiceCommand}"</span>
          {#if voiceConfidence > 0}
            <span class="confidence">({(voiceConfidence * 100).toFixed(0)}%)</span>
          {/if}
        </div>
      {/if}

      {#if lastCommandResult}
        <div class="feedback-item result">
          <span class="feedback-label">Result:</span>
          <span class="feedback-text">{lastCommandResult}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Main terminal interface -->
  <div class="terminal-interface">
    <SessionManager 
      maxSessions={maxTerminalSessions}
      enableVoiceNavigation={enableVoiceCommands}
      showPerformanceMetrics={enablePerformanceMonitoring}
    />
  </div>

  <!-- Voice commands help (hidden by default, shown on voice activation) -->
  {#if isVoiceListening}
    <div class="voice-help">
      <h4>Voice Commands Available:</h4>
      <div class="command-categories">
        <div class="category">
          <h5>Sessions:</h5>
          <ul>
            <li>"new session" - Create new terminal</li>
            <li>"close session" - Close current terminal</li>
            <li>"next session" - Switch to next</li>
            <li>"split view" - Enable split view</li>
          </ul>
        </div>
        
        <div class="category">
          <h5>Navigation:</h5>
          <ul>
            <li>"scroll up/down" - Navigate output</li>
            <li>"go to top/bottom" - Quick navigation</li>
            <li>"clear terminal" - Clear output</li>
          </ul>
        </div>
        
        <div class="category">
          <h5>Input:</h5>
          <ul>
            <li>"focus input" - Focus command input</li>
            <li>"voice input" - Voice command entry</li>
            <li>"clear input" - Clear current command</li>
          </ul>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-terminal-integration {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--terminal-bg, #1a1a1a);
    color: var(--terminal-text, #ffffff);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--status-bar-bg, #2d2d2d);
    border-bottom: 1px solid var(--terminal-border, #333);
    font-size: 12px;
    min-height: 36px;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-label {
    font-weight: 500;
    color: var(--status-label, #888);
  }

  .status-indicator {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 11px;
  }

  .voice-toggle {
    background: transparent;
    border: 1px solid var(--terminal-border, #333);
    color: var(--terminal-text, #ffffff);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-left: 4px;
  }

  .voice-toggle.active {
    background: var(--voice-active, #4caf50);
    border-color: var(--voice-active-border, #66bb6a);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .performance-metrics {
    font-family: monospace;
    color: var(--performance-text, #4fc3f7);
  }

  .help-text {
    color: var(--help-text, #666);
    font-style: italic;
    font-size: 11px;
  }

  .voice-feedback {
    background: var(--feedback-bg, rgba(0, 0, 0, 0.3));
    border-bottom: 1px solid var(--terminal-border, #333);
    padding: 8px 16px;
    font-size: 12px;
    max-height: 100px;
    overflow-y: auto;
  }

  .feedback-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .feedback-item.error {
    color: var(--error-text, #f44336);
  }

  .feedback-item.voice {
    color: var(--voice-text, #4fc3f7);
  }

  .feedback-item.result {
    color: var(--result-text, #4caf50);
  }

  .feedback-label {
    font-weight: bold;
    min-width: 50px;
  }

  .feedback-text {
    flex: 1;
  }

  .confidence {
    color: var(--confidence-text, #888);
    font-size: 11px;
  }

  .terminal-interface {
    flex: 1;
    overflow: hidden;
  }

  .voice-help {
    position: absolute;
    top: 100px;
    right: 20px;
    background: var(--help-bg, rgba(45, 45, 45, 0.95));
    border: 1px solid var(--terminal-border, #333);
    border-radius: 8px;
    padding: 16px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    font-size: 12px;
  }

  .voice-help h4 {
    margin: 0 0 12px 0;
    color: var(--help-title, #4fc3f7);
    font-size: 14px;
  }

  .command-categories {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .category h5 {
    margin: 0 0 8px 0;
    color: var(--category-title, #4caf50);
    font-size: 12px;
  }

  .category ul {
    margin: 0;
    padding-left: 16px;
    list-style: none;
  }

  .category li {
    margin-bottom: 4px;
    color: var(--help-item, #ccc);
    font-size: 11px;
  }

  .category li:before {
    content: "▸ ";
    color: var(--help-bullet, #888);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .status-bar {
      flex-wrap: wrap;
      padding: 6px 12px;
    }

    .status-section {
      font-size: 11px;
    }

    .help-text {
      display: none;
    }

    .voice-help {
      right: 10px;
      left: 10px;
      max-width: none;
    }

    .command-categories {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .voice-toggle {
      border-width: 2px;
    }

    .feedback-item {
      border-left: 3px solid currentColor;
      padding-left: 8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .voice-toggle.active {
      animation: none;
    }
  }
</style>
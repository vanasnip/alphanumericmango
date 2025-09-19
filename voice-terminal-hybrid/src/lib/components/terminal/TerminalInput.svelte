<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable, get } from 'svelte/store';
  import { terminalStore, activeSession } from '../../stores/terminalStore.js';
  import { terminalWebSocketClient } from '../../websocket/TerminalWebSocketClient.js';
  import { voiceNavigation } from '../../voiceNavigation.js';
  import type { QueuedCommand, SecurityConfig } from '../../stores/terminalStore.js';

  // Props
  export let sessionId: string;
  export let placeholder = 'Enter command...';
  export let enableHistory = true;
  export let enableAutoComplete = true;
  export let enableVoiceInput = true;
  export let maxHistoryLength = 100;
  export let showSecurityWarnings = true;
  export let requireConfirmation = true;

  // Internal state
  let inputElement: HTMLInputElement;
  let currentCommand = '';
  let commandHistory: string[] = [];
  let historyIndex = -1;
  let isComposing = false;
  let showSuggestions = false;
  let suggestions: string[] = [];
  let selectedSuggestionIndex = -1;
  let isVoiceMode = false;
  let voiceRecognition: SpeechRecognition | null = null;
  let securityWarning = '';
  let confirmationRequired = false;
  let pendingCommand = '';
  let isExecuting = false;

  // Common commands for autocompletion
  const commonCommands = [
    'ls', 'cd', 'pwd', 'cat', 'grep', 'find', 'ps', 'top', 'htop', 'kill',
    'mkdir', 'rmdir', 'touch', 'rm', 'cp', 'mv', 'chmod', 'chown',
    'git status', 'git add', 'git commit', 'git push', 'git pull', 'git log',
    'npm install', 'npm start', 'npm build', 'npm test', 'npm run',
    'docker ps', 'docker run', 'docker stop', 'docker build', 'docker logs',
    'tmux new-session', 'tmux attach-session', 'tmux list-sessions'
  ];

  // Reactive statements
  $: session = $terminalStore.sessions.get(sessionId);
  $: securityConfig = $terminalStore.securityConfig;
  $: isActiveSession = session?.uiState.isActive || false;
  $: connectionState = session?.connectionState || 'disconnected';
  $: canExecuteCommands = connectionState === 'connected' && !isExecuting;

  // Auto-completion
  $: if (currentCommand && enableAutoComplete) {
    updateSuggestions();
  } else {
    showSuggestions = false;
  }

  // Security validation
  $: if (currentCommand && showSecurityWarnings) {
    validateCommandSecurity();
  }

  onMount(() => {
    setupInputElement();
    loadCommandHistory();
    registerVoiceCommands();
    setupVoiceRecognition();
    
    if (isActiveSession) {
      focusInput();
    }
  });

  onDestroy(() => {
    saveCommandHistory();
    unregisterVoiceCommands();
    cleanupVoiceRecognition();
  });

  // Input setup and focus management
  function setupInputElement() {
    if (!inputElement) return;

    // Set up input attributes for accessibility
    inputElement.setAttribute('aria-label', `Command input for session ${sessionId}`);
    inputElement.setAttribute('aria-describedby', `command-help-${sessionId}`);
    
    // Auto-focus when session becomes active
    if (isActiveSession) {
      inputElement.focus();
    }
  }

  function focusInput() {
    if (inputElement && isActiveSession) {
      inputElement.focus();
    }
  }

  // Command history management
  function loadCommandHistory() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(`terminal-history-${sessionId}`);
      if (stored) {
        commandHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
    }
  }

  function saveCommandHistory() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(`terminal-history-${sessionId}`, JSON.stringify(commandHistory));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }

  function addToHistory(command: string) {
    if (!command.trim() || !enableHistory) return;
    
    // Remove duplicate if exists
    const existingIndex = commandHistory.indexOf(command);
    if (existingIndex !== -1) {
      commandHistory.splice(existingIndex, 1);
    }
    
    // Add to beginning of history
    commandHistory.unshift(command);
    
    // Limit history length
    if (commandHistory.length > maxHistoryLength) {
      commandHistory = commandHistory.slice(0, maxHistoryLength);
    }
    
    saveCommandHistory();
  }

  // Auto-completion functionality
  function updateSuggestions() {
    const trimmedCommand = currentCommand.trim().toLowerCase();
    if (trimmedCommand.length < 2) {
      showSuggestions = false;
      return;
    }

    // Filter common commands and history
    const allCommands = [...new Set([...commandHistory, ...commonCommands])];
    suggestions = allCommands
      .filter(cmd => cmd.toLowerCase().includes(trimmedCommand))
      .slice(0, 10);
    
    showSuggestions = suggestions.length > 0;
    selectedSuggestionIndex = -1;
  }

  function applySuggestion(suggestion: string) {
    currentCommand = suggestion;
    showSuggestions = false;
    focusInput();
  }

  // Security validation
  function validateCommandSecurity() {
    securityWarning = '';
    confirmationRequired = false;
    
    if (!securityConfig.enableCommandValidation) return;
    
    const command = currentCommand.trim();
    if (!command) return;

    // Check for blocked commands
    for (const blocked of securityConfig.blockedCommands) {
      if (command.toLowerCase().includes(blocked.toLowerCase())) {
        securityWarning = `Blocked command detected: "${blocked}"`;
        return;
      }
    }

    // Check for commands requiring confirmation
    for (const confirmCmd of securityConfig.requireConfirmation) {
      if (command.toLowerCase().startsWith(confirmCmd.toLowerCase())) {
        confirmationRequired = true;
        securityWarning = `Command "${confirmCmd}" requires confirmation`;
        return;
      }
    }

    // Check command length
    if (command.length > securityConfig.maxCommandLength) {
      securityWarning = `Command exceeds maximum length (${securityConfig.maxCommandLength} characters)`;
      return;
    }

    // Check allowed commands if specified
    if (securityConfig.allowedCommands.length > 0) {
      const commandBase = command.split(' ')[0];
      if (!securityConfig.allowedCommands.includes(commandBase)) {
        securityWarning = `Command "${commandBase}" is not in allowed commands list`;
        return;
      }
    }
  }

  // Voice recognition setup
  function setupVoiceRecognition() {
    if (!enableVoiceInput || typeof window === 'undefined') return;
    
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = true;
        voiceRecognition.lang = 'en-US';

        voiceRecognition.onstart = () => {
          isVoiceMode = true;
        };

        voiceRecognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            currentCommand = finalTranscript.trim();
            isVoiceMode = false;
          }
        };

        voiceRecognition.onend = () => {
          isVoiceMode = false;
        };

        voiceRecognition.onerror = (event) => {
          console.error('Voice recognition error:', event.error);
          isVoiceMode = false;
        };
      }
    } catch (error) {
      console.error('Failed to setup voice recognition:', error);
    }
  }

  function startVoiceInput() {
    if (voiceRecognition && !isVoiceMode) {
      voiceRecognition.start();
    }
  }

  function stopVoiceInput() {
    if (voiceRecognition && isVoiceMode) {
      voiceRecognition.stop();
    }
  }

  function cleanupVoiceRecognition() {
    if (voiceRecognition) {
      voiceRecognition.abort();
      voiceRecognition = null;
    }
  }

  // Voice navigation integration
  function registerVoiceCommands() {
    if (!enableVoiceInput) return;

    voiceNavigation.registerItem(
      `input-focus-${sessionId}`,
      'command',
      ['focus input', 'command input'],
      () => focusInput(),
      inputElement
    );

    voiceNavigation.registerItem(
      `voice-input-${sessionId}`,
      'command',
      ['voice input', 'speak command'],
      () => startVoiceInput(),
      inputElement
    );

    voiceNavigation.registerItem(
      `clear-input-${sessionId}`,
      'command',
      ['clear input', 'clear command'],
      () => clearInput(),
      inputElement
    );
  }

  function unregisterVoiceCommands() {
    if (!enableVoiceInput) return;

    voiceNavigation.unregisterItem(`input-focus-${sessionId}`);
    voiceNavigation.unregisterItem(`voice-input-${sessionId}`);
    voiceNavigation.unregisterItem(`clear-input-${sessionId}`);
  }

  // Command execution
  async function executeCommand() {
    const command = currentCommand.trim();
    if (!command || !canExecuteCommands) return;

    // Security validation
    if (securityWarning && !confirmationRequired) {
      terminalStore.addOutput(sessionId, `Security Error: ${securityWarning}`, 'error');
      return;
    }

    // Handle confirmation requirement
    if (confirmationRequired && pendingCommand !== command) {
      pendingCommand = command;
      terminalStore.addOutput(sessionId, `Confirm execution of: ${command} (type again to confirm)`, 'system');
      return;
    }

    isExecuting = true;
    
    try {
      // Add command to terminal output
      terminalStore.addOutput(sessionId, `$ ${command}`, 'command');
      
      // Add to history
      addToHistory(command);
      
      // Create command queue item
      const queuedCommand: QueuedCommand = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        command,
        priority: 'normal',
        timestamp: new Date(),
        securityValidated: !securityWarning,
        voiceInitiated: isVoiceMode
      };

      // Queue command for execution
      terminalStore.queueCommand(queuedCommand);
      
      // Clear input
      clearInput();
      
      // Reset confirmation state
      confirmationRequired = false;
      pendingCommand = '';
      
    } catch (error) {
      console.error('Failed to execute command:', error);
      terminalStore.addOutput(sessionId, `Execution Error: ${error}`, 'error');
    } finally {
      isExecuting = false;
    }
  }

  function clearInput() {
    currentCommand = '';
    historyIndex = -1;
    showSuggestions = false;
    securityWarning = '';
    confirmationRequired = false;
    pendingCommand = '';
  }

  // Event handlers
  function handleKeyDown(event: KeyboardEvent) {
    // Handle composition events (for international keyboards)
    if (isComposing) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (showSuggestions && selectedSuggestionIndex >= 0) {
          applySuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          executeCommand();
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (showSuggestions) {
          selectedSuggestionIndex = Math.max(0, selectedSuggestionIndex - 1);
        } else {
          navigateHistory(1);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (showSuggestions) {
          selectedSuggestionIndex = Math.min(suggestions.length - 1, selectedSuggestionIndex + 1);
        } else {
          navigateHistory(-1);
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          applySuggestion(suggestions[0]);
        }
        break;

      case 'Escape':
        if (showSuggestions) {
          showSuggestions = false;
          selectedSuggestionIndex = -1;
        } else if (isVoiceMode) {
          stopVoiceInput();
        } else {
          clearInput();
        }
        break;

      case 'l':
        if (event.ctrlKey) {
          event.preventDefault();
          terminalStore.clearSessionOutput(sessionId);
        }
        break;

      case 'c':
        if (event.ctrlKey) {
          event.preventDefault();
          clearInput();
        }
        break;
    }
  }

  function navigateHistory(direction: number) {
    if (!enableHistory || commandHistory.length === 0) return;

    if (historyIndex === -1) {
      historyIndex = direction > 0 ? 0 : commandHistory.length - 1;
    } else {
      historyIndex += direction;
      historyIndex = Math.max(0, Math.min(commandHistory.length - 1, historyIndex));
    }

    currentCommand = commandHistory[historyIndex] || '';
  }

  function handleCompositionStart() {
    isComposing = true;
  }

  function handleCompositionEnd() {
    isComposing = false;
  }

  function handleInput() {
    // Reset history navigation when user types
    if (historyIndex !== -1 && currentCommand !== commandHistory[historyIndex]) {
      historyIndex = -1;
    }
  }

  function handleFocus() {
    if (isActiveSession) {
      terminalStore.setActiveSession(sessionId);
    }
  }
</script>

<div class="terminal-input-container">
  <!-- Security warning display -->
  {#if securityWarning && showSecurityWarnings}
    <div class="security-warning" class:confirmation={confirmationRequired}>
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">{securityWarning}</span>
      {#if confirmationRequired}
        <span class="confirmation-hint">Type command again to confirm</span>
      {/if}
    </div>
  {/if}

  <!-- Command input area -->
  <div class="input-wrapper" class:disabled={!canExecuteCommands} class:voice-mode={isVoiceMode}>
    <div class="prompt">$</div>
    
    <input
      bind:this={inputElement}
      bind:value={currentCommand}
      type="text"
      class="command-input"
      {placeholder}
      disabled={!canExecuteCommands}
      autocomplete="off"
      spellcheck="false"
      on:keydown={handleKeyDown}
      on:compositionstart={handleCompositionStart}
      on:compositionend={handleCompositionEnd}
      on:input={handleInput}
      on:focus={handleFocus}
      aria-label="Command input"
      aria-describedby="command-help-{sessionId}"
    />

    <!-- Voice input button -->
    {#if enableVoiceInput && voiceRecognition}
      <button
        class="voice-button"
        class:active={isVoiceMode}
        on:click={isVoiceMode ? stopVoiceInput : startVoiceInput}
        disabled={!canExecuteCommands}
        aria-label={isVoiceMode ? 'Stop voice input' : 'Start voice input'}
      >
        {#if isVoiceMode}
          🛑
        {:else}
          🎤
        {/if}
      </button>
    {/if}

    <!-- Execute button -->
    <button
      class="execute-button"
      on:click={executeCommand}
      disabled={!canExecuteCommands || !currentCommand.trim()}
      aria-label="Execute command"
    >
      {#if isExecuting}
        ⏳
      {:else}
        ▶️
      {/if}
    </button>
  </div>

  <!-- Auto-completion suggestions -->
  {#if showSuggestions && suggestions.length > 0}
    <div class="suggestions-container" role="listbox" aria-label="Command suggestions">
      {#each suggestions as suggestion, index}
        <div
          class="suggestion-item"
          class:selected={index === selectedSuggestionIndex}
          role="option"
          aria-selected={index === selectedSuggestionIndex}
          on:click={() => applySuggestion(suggestion)}
          on:keydown={(e) => e.key === 'Enter' && applySuggestion(suggestion)}
          tabindex="0"
        >
          <span class="suggestion-text">{suggestion}</span>
          {#if commandHistory.includes(suggestion)}
            <span class="suggestion-badge">history</span>
          {:else}
            <span class="suggestion-badge">command</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Help text -->
  <div id="command-help-{sessionId}" class="help-text" aria-live="polite">
    {#if !canExecuteCommands}
      {connectionState === 'disconnected' ? 'Disconnected - commands unavailable' : 'Connecting...'}
    {:else if isVoiceMode}
      Listening for voice input... Press Escape to cancel
    {:else if confirmationRequired}
      Command requires confirmation - type again to execute
    {:else if enableHistory}
      Use ↑↓ for history, Tab for completion, Ctrl+L to clear, Ctrl+C to cancel
    {:else}
      Tab for completion, Ctrl+L to clear, Ctrl+C to cancel
    {/if}
  </div>
</div>

<style>
  .terminal-input-container {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--terminal-border, #333);
    background: var(--terminal-input-bg, #1a1a1a);
  }

  .security-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--warning-bg, rgba(255, 152, 0, 0.1));
    color: var(--warning-text, #ff9800);
    border-bottom: 1px solid var(--warning-border, rgba(255, 152, 0, 0.3));
    font-size: 12px;
  }

  .security-warning.confirmation {
    background: var(--confirmation-bg, rgba(76, 175, 80, 0.1));
    color: var(--confirmation-text, #4caf50);
    border-bottom-color: var(--confirmation-border, rgba(76, 175, 80, 0.3));
  }

  .warning-icon {
    font-size: 14px;
  }

  .warning-text {
    flex: 1;
    font-weight: 500;
  }

  .confirmation-hint {
    font-style: italic;
    opacity: 0.8;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    min-height: 40px;
  }

  .input-wrapper.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .input-wrapper.voice-mode {
    background: var(--voice-mode-bg, rgba(76, 175, 80, 0.1));
    animation: voice-pulse 1.5s infinite;
  }

  @keyframes voice-pulse {
    0%, 100% { background-opacity: 0.1; }
    50% { background-opacity: 0.2; }
  }

  .prompt {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-weight: bold;
    color: var(--terminal-prompt, #4fc3f7);
    user-select: none;
    min-width: 16px;
  }

  .command-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--terminal-text, #ffffff);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    padding: 4px 0;
    line-height: 1.4;
  }

  .command-input::placeholder {
    color: var(--terminal-placeholder, #666);
    opacity: 0.7;
  }

  .command-input:focus {
    outline: none;
  }

  .voice-button,
  .execute-button {
    padding: 6px 10px;
    border: 1px solid var(--terminal-button-border, #333);
    background: var(--terminal-button-bg, #2d2d2d);
    color: var(--terminal-button-text, #ffffff);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    min-width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .voice-button:hover,
  .execute-button:hover {
    background: var(--terminal-button-hover, #3d3d3d);
    border-color: var(--terminal-button-border-hover, #555);
  }

  .voice-button:disabled,
  .execute-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .voice-button.active {
    background: var(--voice-active-bg, #4caf50);
    border-color: var(--voice-active-border, #66bb6a);
    animation: voice-recording 1s infinite;
  }

  @keyframes voice-recording {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .suggestions-container {
    max-height: 200px;
    overflow-y: auto;
    border-top: 1px solid var(--terminal-border, #333);
    background: var(--terminal-suggestions-bg, #2d2d2d);
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--terminal-border-light, rgba(255, 255, 255, 0.1));
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
  }

  .suggestion-item:hover,
  .suggestion-item.selected {
    background: var(--terminal-suggestion-selected, rgba(0, 120, 212, 0.2));
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .suggestion-text {
    flex: 1;
    color: var(--terminal-text, #ffffff);
  }

  .suggestion-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 2px;
    background: var(--terminal-badge-bg, #555);
    color: var(--terminal-badge-text, #fff);
    text-transform: uppercase;
    font-weight: bold;
  }

  .help-text {
    padding: 6px 12px;
    font-size: 11px;
    color: var(--terminal-help-text, #888);
    background: var(--terminal-help-bg, rgba(0, 0, 0, 0.2));
    border-top: 1px solid var(--terminal-border-light, rgba(255, 255, 255, 0.1));
    line-height: 1.3;
  }

  /* Theme variations */
  .terminal-input-container {
    --terminal-input-bg: var(--terminal-bg, #1a1a1a);
    --terminal-text: var(--terminal-text-color, #ffffff);
    --terminal-border: var(--terminal-border-color, #333);
    --terminal-prompt: var(--terminal-prompt-color, #4fc3f7);
    --terminal-placeholder: var(--terminal-placeholder-color, #666);
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .security-warning {
      border-width: 2px;
    }
    
    .voice-button.active {
      outline: 2px solid var(--voice-active-border, #66bb6a);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .voice-button.active {
      animation: none;
    }
    
    .input-wrapper.voice-mode {
      animation: none;
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .input-wrapper {
      padding: 6px 8px;
      gap: 6px;
    }
    
    .command-input {
      font-size: 13px;
    }
    
    .voice-button,
    .execute-button {
      padding: 4px 8px;
      min-width: 32px;
      font-size: 11px;
    }
    
    .help-text {
      font-size: 10px;
      padding: 4px 8px;
    }
  }

  /* Focus management for accessibility */
  .suggestion-item:focus {
    outline: 2px solid var(--terminal-focus, #0078d4);
    outline-offset: -2px;
  }

  .voice-button:focus,
  .execute-button:focus {
    outline: 2px solid var(--terminal-focus, #0078d4);
    outline-offset: -2px;
  }
</style>
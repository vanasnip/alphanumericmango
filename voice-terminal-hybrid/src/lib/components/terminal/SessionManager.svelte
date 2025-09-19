<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { derived } from 'svelte/store';
  import { terminalStore, activeSessions, activeSession, globalPerformanceStatus } from '../../stores/terminalStore.js';
  import { terminalWebSocketClient } from '../../websocket/TerminalWebSocketClient.js';
  import { voiceNavigation } from '../../voiceNavigation.js';
  import TerminalDisplay from './TerminalDisplay.svelte';
  import TerminalInput from './TerminalInput.svelte';
  import type { TerminalSession } from '../../stores/terminalStore.js';

  // Props
  export let maxSessions = 10;
  export let enableTabs = true;
  export let enableSplitView = true;
  export let showPerformanceMetrics = true;
  export let enableVoiceNavigation = true;
  export let defaultSessionName = 'Terminal';

  // Internal state
  let isCreatingSession = false;
  let newSessionName = '';
  let showNewSessionDialog = false;
  let selectedSessions: Set<string> = new Set();
  let splitViewMode: 'horizontal' | 'vertical' | 'grid' = 'horizontal';
  let isDragging = false;
  let draggedSessionId: string | null = null;
  let sessionOrder: string[] = [];

  // Voice navigation numbers for sessions
  let sessionVoiceNumbers = new Map<string, number>();

  // Reactive statements
  $: sessions = $activeSessions;
  $: currentActiveSession = $activeSession;
  $: performanceStatus = $globalPerformanceStatus;
  $: canCreateSession = sessions.length < maxSessions && !isCreatingSession;

  // Update session order when sessions change
  $: if (sessions.length > 0) {
    updateSessionOrder();
  }

  // Performance monitoring
  $: averageLatency = performanceStatus.metrics.averageLatency;
  $: isPerformanceGood = performanceStatus.isWithinTarget;

  onMount(() => {
    setupSessionManager();
    registerVoiceCommands();
    initializeWebSocketConnection();
  });

  onDestroy(() => {
    unregisterVoiceCommands();
    cleanupSessionManager();
  });

  // Session manager setup
  function setupSessionManager() {
    // Load existing sessions or create default session
    if (sessions.length === 0) {
      createDefaultSession();
    }
    
    // Setup keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    // Setup performance monitoring
    if (showPerformanceMetrics) {
      startPerformanceMonitoring();
    }
  }

  function cleanupSessionManager() {
    document.removeEventListener('keydown', handleGlobalKeyDown);
    stopPerformanceMonitoring();
  }

  // WebSocket connection
  async function initializeWebSocketConnection() {
    try {
      await terminalWebSocketClient.connect();
      
      // Load existing sessions from server
      const serverSessions = await terminalWebSocketClient.listSessions();
      
      // If no server sessions and no local sessions, create default
      if (serverSessions.length === 0 && sessions.length === 0) {
        await createSession(defaultSessionName);
      }
      
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      // Work in offline mode with local sessions only
      if (sessions.length === 0) {
        createDefaultSession();
      }
    }
  }

  // Session management
  async function createSession(name?: string) {
    if (isCreatingSession || !canCreateSession) return;
    
    isCreatingSession = true;
    const sessionName = name || newSessionName || `${defaultSessionName} ${sessions.length + 1}`;
    
    try {
      // Try to create session on server
      const session = await terminalWebSocketClient.createSession(sessionName);
      await terminalWebSocketClient.attachSession(session.id);
      
      // Session is automatically added to store by WebSocket client
      updateVoiceNavigation();
      
    } catch (error) {
      console.error('Failed to create session:', error);
      // Create local session as fallback
      createLocalSession(sessionName);
    } finally {
      isCreatingSession = false;
      newSessionName = '';
      showNewSessionDialog = false;
    }
  }

  function createLocalSession(name: string) {
    // Create a local session when server is unavailable
    const sessionId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localSession = {
      id: sessionId,
      name,
      pid: 0,
      created: new Date(),
      windows: [],
      attached: true
    };
    
    terminalStore.createSession(localSession);
    terminalStore.setActiveSession(sessionId);
    updateVoiceNavigation();
  }

  function createDefaultSession() {
    createLocalSession(defaultSessionName);
  }

  async function removeSession(sessionId: string) {
    if (sessions.length <= 1) {
      // Don't remove the last session
      return;
    }
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Confirm removal if session has activity
    if (session.output.length > 0) {
      const confirmed = confirm(`Remove session "${session.name}"? This will permanently delete all output.`);
      if (!confirmed) return;
    }
    
    try {
      // Detach from server if connected
      if (session.connectionState === 'connected') {
        await terminalWebSocketClient.sendMessage({
          type: 'session-detach',
          data: { sessionId },
          sessionId
        });
      }
    } catch (error) {
      console.error('Failed to detach session from server:', error);
    }
    
    // Remove from local store
    terminalStore.removeSession(sessionId);
    selectedSessions.delete(sessionId);
    updateVoiceNavigation();
  }

  function setActiveSession(sessionId: string) {
    terminalStore.setActiveSession(sessionId);
    updateVoiceNavigation();
  }

  function duplicateSession(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      createSession(`${session.name} (Copy)`);
    }
  }

  function renameSession(sessionId: string, newName: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (session && newName.trim()) {
      // Update session name in store
      terminalStore.updateSessionUIState(sessionId, { 
        // Note: This would need to be extended to support name changes
      });
      updateVoiceNavigation();
    }
  }

  // Session ordering and layout
  function updateSessionOrder() {
    const currentIds = sessions.map(s => s.id);
    
    // Preserve existing order and add new sessions
    const newOrder = sessionOrder.filter(id => currentIds.includes(id));
    const newSessions = currentIds.filter(id => !sessionOrder.includes(id));
    
    sessionOrder = [...newOrder, ...newSessions];
  }

  function reorderSessions(fromIndex: number, toIndex: number) {
    const newOrder = [...sessionOrder];
    const [movedSession] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedSession);
    sessionOrder = newOrder;
  }

  // Split view management
  function toggleSplitView() {
    if (selectedSessions.size < 2) {
      // Auto-select first two sessions
      const firstTwo = sessions.slice(0, 2);
      selectedSessions = new Set(firstTwo.map(s => s.id));
    }
    
    splitViewMode = splitViewMode === 'horizontal' ? 'vertical' : 'horizontal';
  }

  function addToSplitView(sessionId: string) {
    selectedSessions.add(sessionId);
    selectedSessions = selectedSessions; // Trigger reactivity
  }

  function removeFromSplitView(sessionId: string) {
    selectedSessions.delete(sessionId);
    selectedSessions = selectedSessions; // Trigger reactivity
  }

  // Voice navigation integration
  function registerVoiceCommands() {
    if (!enableVoiceNavigation) return;

    voiceNavigation.registerItem(
      'session-new',
      'command',
      ['new session', 'create session'],
      () => showNewSessionDialog = true
    );

    voiceNavigation.registerItem(
      'session-close',
      'command',
      ['close session', 'remove session'],
      () => currentActiveSession && removeSession(currentActiveSession.id)
    );

    voiceNavigation.registerItem(
      'session-next',
      'command',
      ['next session', 'switch session'],
      () => switchToNextSession()
    );

    voiceNavigation.registerItem(
      'session-previous',
      'command',
      ['previous session', 'back session'],
      () => switchToPreviousSession()
    );

    voiceNavigation.registerItem(
      'session-split',
      'command',
      ['split view', 'split sessions'],
      () => toggleSplitView()
    );
  }

  function updateVoiceNavigation() {
    if (!enableVoiceNavigation) return;

    // Clear existing session voice numbers
    sessionVoiceNumbers.forEach((number, sessionId) => {
      voiceNavigation.unregisterItem(number);
    });
    sessionVoiceNumbers.clear();

    // Register each session with a voice number
    sessions.forEach((session, index) => {
      const voiceNumber = voiceNavigation.registerItem(
        `session-${session.id}`,
        'project',
        [`session ${index + 1}`, session.name],
        () => setActiveSession(session.id),
        undefined,
        index + 1
      );
      
      sessionVoiceNumbers.set(session.id, voiceNumber);
    });
  }

  function unregisterVoiceCommands() {
    if (!enableVoiceNavigation) return;

    voiceNavigation.unregisterItem('session-new');
    voiceNavigation.unregisterItem('session-close');
    voiceNavigation.unregisterItem('session-next');
    voiceNavigation.unregisterItem('session-previous');
    voiceNavigation.unregisterItem('session-split');

    sessionVoiceNumbers.forEach((number, sessionId) => {
      voiceNavigation.unregisterItem(number);
    });
    sessionVoiceNumbers.clear();
  }

  // Navigation helpers
  function switchToNextSession() {
    if (sessions.length <= 1) return;
    
    const currentIndex = sessions.findIndex(s => s.id === currentActiveSession?.id);
    const nextIndex = (currentIndex + 1) % sessions.length;
    setActiveSession(sessions[nextIndex].id);
  }

  function switchToPreviousSession() {
    if (sessions.length <= 1) return;
    
    const currentIndex = sessions.findIndex(s => s.id === currentActiveSession?.id);
    const prevIndex = currentIndex === 0 ? sessions.length - 1 : currentIndex - 1;
    setActiveSession(sessions[prevIndex].id);
  }

  // Event handlers
  function handleGlobalKeyDown(event: KeyboardEvent) {
    // Only handle shortcuts when not typing in inputs
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 't':
          event.preventDefault();
          showNewSessionDialog = true;
          break;
        case 'w':
          event.preventDefault();
          if (currentActiveSession) {
            removeSession(currentActiveSession.id);
          }
          break;
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            switchToPreviousSession();
          } else {
            switchToNextSession();
          }
          break;
      }
    }

    // Number keys for session switching
    if (event.key >= '1' && event.key <= '9') {
      const sessionIndex = parseInt(event.key) - 1;
      if (sessionIndex < sessions.length) {
        event.preventDefault();
        setActiveSession(sessions[sessionIndex].id);
      }
    }
  }

  function handleTabDragStart(event: DragEvent, sessionId: string) {
    if (!event.dataTransfer) return;
    
    isDragging = true;
    draggedSessionId = sessionId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sessionId);
  }

  function handleTabDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleTabDrop(event: DragEvent, targetSessionId: string) {
    event.preventDefault();
    
    if (!draggedSessionId || draggedSessionId === targetSessionId) {
      isDragging = false;
      draggedSessionId = null;
      return;
    }
    
    const fromIndex = sessionOrder.indexOf(draggedSessionId);
    const toIndex = sessionOrder.indexOf(targetSessionId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderSessions(fromIndex, toIndex);
    }
    
    isDragging = false;
    draggedSessionId = null;
  }

  function handleNewSessionSubmit() {
    if (newSessionName.trim()) {
      createSession(newSessionName.trim());
    }
  }

  // Performance monitoring
  let performanceMonitorInterval: number;

  function startPerformanceMonitoring() {
    performanceMonitorInterval = setInterval(() => {
      // Performance monitoring is handled by the store
      // This could trigger UI updates or warnings
      if (averageLatency > 50) {
        console.warn(`High terminal latency detected: ${averageLatency.toFixed(1)}ms`);
      }
    }, 5000);
  }

  function stopPerformanceMonitoring() {
    if (performanceMonitorInterval) {
      clearInterval(performanceMonitorInterval);
    }
  }

  // Utility functions
  function formatLastActivity(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes === 0) return 'now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  }

  function getSessionStatusClass(session: TerminalSession): string {
    const classes = ['session-tab'];
    
    if (session.uiState.isActive) classes.push('active');
    if (session.connectionState === 'connected') classes.push('connected');
    if (session.connectionState === 'disconnected') classes.push('disconnected');
    if (session.connectionState === 'error') classes.push('error');
    if (selectedSessions.has(session.id)) classes.push('selected');
    
    return classes.join(' ');
  }
</script>

<div class="session-manager" class:performance-warning={!isPerformanceGood}>
  <!-- Session tabs -->
  {#if enableTabs}
    <div class="session-tabs">
      <div class="tabs-container">
        {#each sessionOrder as sessionId (sessionId)}
          {@const session = sessions.find(s => s.id === sessionId)}
          {#if session}
            <div
              class={getSessionStatusClass(session)}
              draggable="true"
              on:dragstart={(e) => handleTabDragStart(e, session.id)}
              on:dragover={handleTabDragOver}
              on:drop={(e) => handleTabDrop(e, session.id)}
              on:click={() => setActiveSession(session.id)}
              on:keydown={(e) => e.key === 'Enter' && setActiveSession(session.id)}
              tabindex="0"
              role="tab"
              aria-selected={session.uiState.isActive}
              aria-label="Session {session.name}"
            >
              <!-- Voice navigation number -->
              {#if enableVoiceNavigation}
                <span class="voice-number" aria-hidden="true">
                  {sessionVoiceNumbers.get(session.id) || ''}
                </span>
              {/if}
              
              <!-- Connection status -->
              <span class="connection-indicator" class:connected={session.connectionState === 'connected'}></span>
              
              <!-- Session name -->
              <span class="session-name">{session.name}</span>
              
              <!-- Activity indicator -->
              {#if session.output.length > 0}
                <span class="activity-indicator" title="Last activity: {formatLastActivity(session.lastActivity)}">
                  {session.output.length}
                </span>
              {/if}
              
              <!-- Split view toggle -->
              {#if enableSplitView}
                <button
                  class="split-toggle"
                  class:active={selectedSessions.has(session.id)}
                  on:click|stopPropagation={() => selectedSessions.has(session.id) ? removeFromSplitView(session.id) : addToSplitView(session.id)}
                  aria-label="Toggle split view for {session.name}"
                >
                  ⊞
                </button>
              {/if}
              
              <!-- Close button -->
              <button
                class="close-button"
                on:click|stopPropagation={() => removeSession(session.id)}
                disabled={sessions.length <= 1}
                aria-label="Close session {session.name}"
              >
                ×
              </button>
            </div>
          {/if}
        {/each}
        
        <!-- New session button -->
        <button
          class="new-session-button"
          on:click={() => showNewSessionDialog = true}
          disabled={!canCreateSession}
          aria-label="Create new session"
        >
          +
        </button>
      </div>
      
      <!-- Performance indicator -->
      {#if showPerformanceMetrics}
        <div class="performance-display" class:warning={!isPerformanceGood}>
          <span class="performance-label">Latency:</span>
          <span class="performance-value">{averageLatency.toFixed(1)}ms</span>
          <span class="performance-status" class:good={isPerformanceGood}>
            {isPerformanceGood ? '✓' : '⚠'}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Session content area -->
  <div class="session-content" class:split-view={selectedSessions.size > 1} class:split-{splitViewMode}>
    {#if selectedSessions.size > 1 && enableSplitView}
      <!-- Split view mode -->
      {#each Array.from(selectedSessions) as sessionId (sessionId)}
        {@const session = sessions.find(s => s.id === sessionId)}
        {#if session}
          <div class="split-panel" class:active={session.uiState.isActive}>
            <div class="split-panel-header">
              <span class="panel-title">{session.name}</span>
              <button 
                class="panel-focus-button"
                on:click={() => setActiveSession(session.id)}
                aria-label="Focus {session.name}"
              >
                📍
              </button>
            </div>
            <div class="split-panel-content">
              <TerminalDisplay 
                sessionId={session.id}
                enableVoiceNavigation={false}
                performanceMode={true}
              />
              {#if session.uiState.isActive}
                <TerminalInput sessionId={session.id} />
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {:else if currentActiveSession}
      <!-- Single session mode -->
      <div class="single-session">
        <TerminalDisplay 
          sessionId={currentActiveSession.id}
          enableVoiceNavigation={enableVoiceNavigation}
        />
        <TerminalInput sessionId={currentActiveSession.id} />
      </div>
    {:else}
      <!-- No active session -->
      <div class="no-session">
        <h3>No Active Session</h3>
        <p>Create a new terminal session to get started.</p>
        <button on:click={() => showNewSessionDialog = true}>Create Session</button>
      </div>
    {/if}
  </div>

  <!-- New session dialog -->
  {#if showNewSessionDialog}
    <div class="dialog-overlay" on:click={() => showNewSessionDialog = false}>
      <div class="dialog" on:click|stopPropagation role="dialog" aria-labelledby="new-session-title">
        <h3 id="new-session-title">Create New Session</h3>
        <form on:submit|preventDefault={handleNewSessionSubmit}>
          <label for="session-name-input">Session Name:</label>
          <input
            id="session-name-input"
            type="text"
            bind:value={newSessionName}
            placeholder={`${defaultSessionName} ${sessions.length + 1}`}
            autofocus
          />
          <div class="dialog-buttons">
            <button type="button" on:click={() => showNewSessionDialog = false}>Cancel</button>
            <button type="submit" disabled={isCreatingSession}>
              {isCreatingSession ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .session-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--terminal-manager-bg, #1a1a1a);
    border: 1px solid var(--terminal-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }

  .session-manager.performance-warning {
    border-color: var(--warning-color, #ff9800);
  }

  .session-tabs {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--terminal-tabs-bg, #2d2d2d);
    border-bottom: 1px solid var(--terminal-border, #333);
    padding: 0 8px;
    min-height: 48px;
  }

  .tabs-container {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tabs-container::-webkit-scrollbar {
    display: none;
  }

  .session-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--terminal-tab-bg, #1a1a1a);
    border: 1px solid var(--terminal-border, #333);
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    min-width: 120px;
    max-width: 200px;
    font-size: 13px;
    transition: all 0.2s ease;
    user-select: none;
  }

  .session-tab:hover {
    background: var(--terminal-tab-hover, #3d3d3d);
  }

  .session-tab.active {
    background: var(--terminal-tab-active, #0078d4);
    color: var(--terminal-tab-active-text, #ffffff);
    border-bottom-color: transparent;
  }

  .session-tab.selected {
    box-shadow: 0 0 0 2px var(--terminal-accent, #4caf50);
  }

  .session-tab.connected .connection-indicator {
    background: var(--status-connected, #4caf50);
  }

  .session-tab.disconnected .connection-indicator {
    background: var(--status-disconnected, #888);
  }

  .session-tab.error .connection-indicator {
    background: var(--status-error, #f44336);
  }

  .session-tab:focus {
    outline: 2px solid var(--terminal-focus, #0078d4);
    outline-offset: -2px;
  }

  .voice-number {
    min-width: 16px;
    text-align: center;
    background: var(--voice-number-bg, rgba(76, 175, 80, 0.2));
    color: var(--voice-number-text, #4caf50);
    border-radius: 2px;
    font-size: 10px;
    font-weight: bold;
    padding: 1px 3px;
  }

  .connection-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-disconnected, #888);
    flex-shrink: 0;
  }

  .session-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .activity-indicator {
    background: var(--activity-indicator-bg, rgba(76, 175, 80, 0.2));
    color: var(--activity-indicator-text, #4caf50);
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: bold;
    min-width: 16px;
    text-align: center;
  }

  .split-toggle {
    background: transparent;
    border: 1px solid var(--terminal-border, #333);
    color: var(--terminal-text, #ffffff);
    padding: 2px 4px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 10px;
  }

  .split-toggle.active {
    background: var(--split-active-bg, #4caf50);
    border-color: var(--split-active-border, #66bb6a);
  }

  .close-button {
    background: transparent;
    border: none;
    color: var(--terminal-text, #ffffff);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 16px;
    line-height: 1;
  }

  .close-button:hover {
    background: var(--close-button-hover, #f44336);
    color: var(--close-button-hover-text, #ffffff);
  }

  .close-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .new-session-button {
    background: var(--new-session-bg, #4caf50);
    border: 1px solid var(--new-session-border, #66bb6a);
    color: var(--new-session-text, #ffffff);
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    min-width: 36px;
  }

  .new-session-button:hover {
    background: var(--new-session-hover, #66bb6a);
  }

  .new-session-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .performance-display {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--terminal-text, #ffffff);
    background: var(--performance-bg, rgba(0, 0, 0, 0.2));
    padding: 4px 8px;
    border-radius: 4px;
  }

  .performance-display.warning {
    background: var(--performance-warning-bg, rgba(255, 152, 0, 0.2));
    color: var(--performance-warning-text, #ff9800);
  }

  .performance-label {
    font-weight: 500;
  }

  .performance-value {
    font-family: monospace;
    font-weight: bold;
  }

  .performance-status.good {
    color: var(--status-good, #4caf50);
  }

  .session-content {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .session-content.split-view {
    gap: 1px;
    background: var(--terminal-border, #333);
  }

  .session-content.split-horizontal {
    flex-direction: row;
  }

  .session-content.split-vertical {
    flex-direction: column;
  }

  .split-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--terminal-bg, #1a1a1a);
    min-width: 300px;
    min-height: 200px;
  }

  .split-panel.active {
    box-shadow: 0 0 0 2px var(--terminal-focus, #0078d4);
  }

  .split-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: var(--split-header-bg, #2d2d2d);
    border-bottom: 1px solid var(--terminal-border, #333);
    font-size: 12px;
  }

  .panel-title {
    font-weight: 500;
    color: var(--terminal-text, #ffffff);
  }

  .panel-focus-button {
    background: transparent;
    border: 1px solid var(--terminal-border, #333);
    color: var(--terminal-text, #ffffff);
    padding: 2px 6px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 10px;
  }

  .panel-focus-button:hover {
    background: var(--panel-focus-hover, #3d3d3d);
  }

  .split-panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .single-session {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .no-session {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--terminal-text, #ffffff);
    gap: 16px;
    padding: 32px;
    text-align: center;
  }

  .no-session h3 {
    margin: 0;
    font-size: 24px;
    color: var(--terminal-text-muted, #888);
  }

  .no-session p {
    margin: 0;
    color: var(--terminal-text-muted, #888);
  }

  .no-session button {
    background: var(--new-session-bg, #4caf50);
    border: 1px solid var(--new-session-border, #66bb6a);
    color: var(--new-session-text, #ffffff);
    padding: 12px 24px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--terminal-dialog-bg, #2d2d2d);
    border: 1px solid var(--terminal-border, #333);
    border-radius: 8px;
    padding: 24px;
    min-width: 300px;
    max-width: 500px;
    color: var(--terminal-text, #ffffff);
  }

  .dialog h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
  }

  .dialog form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dialog label {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .dialog input {
    padding: 8px 12px;
    border: 1px solid var(--terminal-border, #333);
    border-radius: 4px;
    background: var(--terminal-input-bg, #1a1a1a);
    color: var(--terminal-text, #ffffff);
    font-size: 14px;
  }

  .dialog input:focus {
    outline: 2px solid var(--terminal-focus, #0078d4);
    outline-offset: -2px;
  }

  .dialog-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .dialog-buttons button {
    padding: 8px 16px;
    border: 1px solid var(--terminal-border, #333);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .dialog-buttons button[type="button"] {
    background: var(--dialog-cancel-bg, #555);
    color: var(--dialog-cancel-text, #ffffff);
  }

  .dialog-buttons button[type="submit"] {
    background: var(--dialog-submit-bg, #4caf50);
    color: var(--dialog-submit-text, #ffffff);
  }

  .dialog-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .session-tabs {
      padding: 0 4px;
      min-height: 40px;
    }
    
    .session-tab {
      min-width: 80px;
      max-width: 120px;
      padding: 6px 8px;
      font-size: 12px;
    }
    
    .voice-number {
      display: none;
    }
    
    .activity-indicator {
      font-size: 9px;
      padding: 1px 4px;
    }
    
    .performance-display {
      font-size: 11px;
      padding: 2px 6px;
    }
    
    .split-panel {
      min-width: 200px;
      min-height: 150px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .session-tab {
      border-width: 2px;
    }
    
    .session-tab.active {
      outline: 2px solid var(--terminal-text, #ffffff);
    }
  }
</style>
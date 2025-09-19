<script lang="ts">
  import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { terminalStore, activeSession } from '../../stores/terminalStore.js';
  import { voiceNavigation } from '../../voiceNavigation.js';
  import type { TerminalSession, TerminalOutputLine } from '../../stores/terminalStore.js';

  // Props
  export let sessionId: string;
  export let showLineNumbers = true;
  export let enableVoiceNavigation = true;
  export let maxLines = 1000;
  export let fontSize = 14;
  export let theme = 'dark';
  export let autoScroll = true;
  export let enableSearch = true;
  export let enableCopy = true;
  export let performanceMode = false; // Use virtual scrolling for large outputs

  // Internal state
  let terminalContainer: HTMLElement;
  let outputContainer: HTMLElement;
  let isUserScrolling = false;
  let searchQuery = '';
  let searchResults: number[] = [];
  let currentSearchIndex = 0;
  let voiceNavigationNumbers = new Map<number, TerminalOutputLine>();
  let virtualizedItems: TerminalOutputLine[] = [];
  let visibleStartIndex = 0;
  let visibleEndIndex = 50;
  let itemHeight = 20;
  let containerHeight = 0;
  let totalHeight = 0;

  // Reactive statements
  $: session = $terminalStore.sessions.get(sessionId);
  $: outputLines = session?.output || [];
  $: filteredLines = searchQuery ? 
    outputLines.filter(line => line.content.toLowerCase().includes(searchQuery.toLowerCase())) : 
    outputLines;
  $: isActiveSession = session?.uiState.isActive || false;
  $: connectionState = session?.connectionState || 'disconnected';

  // Performance monitoring
  $: if (session?.performanceMetrics.averageLatency) {
    updatePerformanceIndicator(session.performanceMetrics.averageLatency);
  }

  // Virtual scrolling setup
  $: if (performanceMode && outputLines.length > 100) {
    updateVirtualizedDisplay();
  } else {
    virtualizedItems = filteredLines;
  }

  // Theme classes
  $: terminalClasses = `terminal-display terminal-theme-${theme} ${connectionState === 'connected' ? 'connected' : 'disconnected'} ${isActiveSession ? 'active' : 'inactive'}`;

  onMount(() => {
    setupTerminalDisplay();
    registerVoiceNavigation();
    setupScrollHandling();
    setupResizeObserver();
    
    // Focus management for accessibility
    if (isActiveSession && terminalContainer) {
      terminalContainer.focus();
    }
  });

  onDestroy(() => {
    unregisterVoiceNavigation();
    cleanupEventListeners();
  });

  afterUpdate(() => {
    if (autoScroll && !isUserScrolling && outputContainer) {
      scrollToBottom();
    }
    updateVoiceNavigationNumbers();
  });

  // Terminal display setup
  function setupTerminalDisplay() {
    if (!terminalContainer) return;

    // Set initial styles
    terminalContainer.style.fontSize = `${fontSize}px`;
    
    // Calculate item height for virtual scrolling
    if (outputContainer && outputContainer.children.length > 0) {
      itemHeight = outputContainer.children[0].getBoundingClientRect().height;
    }

    // Setup keyboard navigation
    terminalContainer.addEventListener('keydown', handleKeyDown);
  }

  function setupScrollHandling() {
    if (!outputContainer) return;

    outputContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    // Intersection observer for auto-scroll detection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            isUserScrolling = false;
          }
        });
      },
      { threshold: 1.0 }
    );

    // Observe the last line for auto-scroll detection
    const lastLine = outputContainer.lastElementChild;
    if (lastLine) {
      observer.observe(lastLine);
    }
  }

  function setupResizeObserver() {
    if (!terminalContainer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
        updateVirtualizedDisplay();
      }
    });

    resizeObserver.observe(terminalContainer);
  }

  // Voice navigation integration
  function registerVoiceNavigation() {
    if (!enableVoiceNavigation) return;

    // Register terminal as navigable context
    voiceNavigation.createContext(`terminal-${sessionId}`);
    voiceNavigation.setActiveContext(`terminal-${sessionId}`);

    // Register terminal commands
    voiceNavigation.registerItem(
      `terminal-scroll-up-${sessionId}`,
      'command',
      ['scroll up', 'up'],
      () => scrollUp(),
      terminalContainer
    );

    voiceNavigation.registerItem(
      `terminal-scroll-down-${sessionId}`,
      'command',
      ['scroll down', 'down'],
      () => scrollDown(),
      terminalContainer
    );

    voiceNavigation.registerItem(
      `terminal-clear-${sessionId}`,
      'command',
      ['clear terminal', 'clear'],
      () => clearTerminal(),
      terminalContainer
    );

    voiceNavigation.registerItem(
      `terminal-copy-${sessionId}`,
      'command',
      ['copy output', 'copy all'],
      () => copyAllOutput(),
      terminalContainer
    );
  }

  function updateVoiceNavigationNumbers() {
    if (!enableVoiceNavigation) return;

    // Clear existing voice navigation numbers
    voiceNavigationNumbers.forEach((_, number) => {
      voiceNavigation.unregisterItem(number);
    });
    voiceNavigationNumbers.clear();

    // Register visible lines with voice navigation numbers
    const visibleLines = performanceMode ? virtualizedItems : filteredLines.slice(-50); // Last 50 lines
    
    visibleLines.forEach((line, index) => {
      const voiceNumber = voiceNavigation.registerItem(
        `terminal-line-${line.id}`,
        'message',
        [line.content.substring(0, 20)], // First 20 chars as voice command
        () => selectLine(line),
        undefined,
        index + 1
      );
      
      voiceNavigationNumbers.set(voiceNumber, line);
    });
  }

  function unregisterVoiceNavigation() {
    if (!enableVoiceNavigation) return;

    voiceNavigationNumbers.forEach((_, number) => {
      voiceNavigation.unregisterItem(number);
    });
    voiceNavigationNumbers.clear();
  }

  // Virtual scrolling implementation
  function updateVirtualizedDisplay() {
    if (!performanceMode || !containerHeight || !itemHeight) {
      return;
    }

    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const buffer = Math.floor(visibleCount * 0.5); // 50% buffer
    
    visibleStartIndex = Math.max(0, Math.floor(outputContainer?.scrollTop / itemHeight) - buffer);
    visibleEndIndex = Math.min(outputLines.length, visibleStartIndex + visibleCount + buffer * 2);
    
    virtualizedItems = outputLines.slice(visibleStartIndex, visibleEndIndex);
    totalHeight = outputLines.length * itemHeight;
  }

  // Event handlers
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Detect if user is manually scrolling
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    isUserScrolling = !isAtBottom;

    // Update virtualized display
    if (performanceMode) {
      updateVirtualizedDisplay();
    }

    // Update session scroll position
    terminalStore.updateSessionUIState(sessionId, { scrollPosition: scrollTop });
  }

  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        scrollUp();
        break;
      case 'ArrowDown':
        event.preventDefault();
        scrollDown();
        break;
      case 'PageUp':
        event.preventDefault();
        scrollPageUp();
        break;
      case 'PageDown':
        event.preventDefault();
        scrollPageDown();
        break;
      case 'Home':
        if (event.ctrlKey) {
          event.preventDefault();
          scrollToTop();
        }
        break;
      case 'End':
        if (event.ctrlKey) {
          event.preventDefault();
          scrollToBottom();
        }
        break;
      case 'f':
        if (event.ctrlKey) {
          event.preventDefault();
          toggleSearch();
        }
        break;
      case 'c':
        if (event.ctrlKey && enableCopy) {
          event.preventDefault();
          copySelectedText();
        }
        break;
    }
  }

  // Scroll functions
  function scrollUp() {
    if (outputContainer) {
      outputContainer.scrollTop -= itemHeight * 3;
      isUserScrolling = true;
    }
  }

  function scrollDown() {
    if (outputContainer) {
      outputContainer.scrollTop += itemHeight * 3;
    }
  }

  function scrollPageUp() {
    if (outputContainer) {
      outputContainer.scrollTop -= containerHeight * 0.9;
      isUserScrolling = true;
    }
  }

  function scrollPageDown() {
    if (outputContainer) {
      outputContainer.scrollTop += containerHeight * 0.9;
    }
  }

  function scrollToTop() {
    if (outputContainer) {
      outputContainer.scrollTop = 0;
      isUserScrolling = true;
    }
  }

  function scrollToBottom() {
    if (outputContainer) {
      outputContainer.scrollTop = outputContainer.scrollHeight;
      isUserScrolling = false;
    }
  }

  // Terminal actions
  function clearTerminal() {
    terminalStore.clearSessionOutput(sessionId);
  }

  function selectLine(line: TerminalOutputLine) {
    // Highlight selected line and optionally copy to clipboard
    const lineElement = document.querySelector(`[data-line-id="${line.id}"]`);
    if (lineElement) {
      lineElement.classList.add('selected');
      setTimeout(() => lineElement.classList.remove('selected'), 1000);
      
      if (enableCopy) {
        copyLineToClipboard(line.content);
      }
    }
  }

  function copyLineToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy text:', err);
    });
  }

  function copyAllOutput() {
    const allText = outputLines.map(line => line.content).join('\n');
    navigator.clipboard.writeText(allText).catch(err => {
      console.error('Failed to copy all output:', err);
    });
  }

  function copySelectedText() {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      navigator.clipboard.writeText(selection.toString()).catch(err => {
        console.error('Failed to copy selection:', err);
      });
    }
  }

  // Search functionality
  function toggleSearch() {
    searchQuery = searchQuery ? '' : 'search...';
  }

  function searchNext() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    scrollToSearchResult();
  }

  function searchPrevious() {
    if (searchResults.length === 0) return;
    currentSearchIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    scrollToSearchResult();
  }

  function scrollToSearchResult() {
    const resultIndex = searchResults[currentSearchIndex];
    if (outputContainer && resultIndex !== undefined) {
      const targetScrollTop = resultIndex * itemHeight;
      outputContainer.scrollTop = targetScrollTop;
      isUserScrolling = true;
    }
  }

  // Performance monitoring
  function updatePerformanceIndicator(latency: number) {
    if (terminalContainer) {
      const indicator = terminalContainer.querySelector('.performance-indicator');
      if (indicator) {
        indicator.textContent = `${latency.toFixed(1)}ms`;
        indicator.className = `performance-indicator ${latency > 15 ? 'warning' : 'good'}`;
      }
    }
  }

  // Utility functions
  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString();
  }

  function getLineTypeClass(type: TerminalOutputLine['type']): string {
    switch (type) {
      case 'command': return 'line-command';
      case 'error': return 'line-error';
      case 'system': return 'line-system';
      default: return 'line-output';
    }
  }

  function cleanupEventListeners() {
    if (terminalContainer) {
      terminalContainer.removeEventListener('keydown', handleKeyDown);
    }
    if (outputContainer) {
      outputContainer.removeEventListener('scroll', handleScroll);
    }
  }

  // Accessibility helpers
  function announceNewOutput(line: TerminalOutputLine) {
    // Announce new output to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = `New ${line.type}: ${line.content}`;
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  // React to new output lines
  $: if (outputLines.length > 0) {
    const lastLine = outputLines[outputLines.length - 1];
    if (lastLine && isActiveSession) {
      announceNewOutput(lastLine);
    }
  }
</script>

<div 
  class={terminalClasses}
  bind:this={terminalContainer}
  tabindex="0"
  role="log"
  aria-label="Terminal output for session {sessionId}"
  aria-live="polite"
  aria-atomic="false"
>
  <!-- Header with connection status and performance -->
  <div class="terminal-header">
    <div class="connection-status">
      <span class="status-indicator status-{connectionState}"></span>
      <span class="status-text">{connectionState}</span>
    </div>
    
    {#if session?.performanceMetrics.enableMetrics}
      <div class="performance-indicator">
        {session.performanceMetrics.averageLatency.toFixed(1)}ms
      </div>
    {/if}
    
    {#if enableSearch}
      <div class="search-container">
        <input 
          type="text" 
          bind:value={searchQuery}
          placeholder="Search output..."
          class="search-input"
          aria-label="Search terminal output"
        />
        {#if searchResults.length > 0}
          <div class="search-results">
            {currentSearchIndex + 1} of {searchResults.length}
            <button on:click={searchPrevious} aria-label="Previous search result">↑</button>
            <button on:click={searchNext} aria-label="Next search result">↓</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Terminal output area -->
  <div 
    class="terminal-output"
    bind:this={outputContainer}
    style="height: {containerHeight}px;"
    aria-label="Terminal output lines"
  >
    {#if performanceMode && outputLines.length > 100}
      <!-- Virtual scrolling for performance -->
      <div style="height: {totalHeight}px; position: relative;">
        <div style="transform: translateY({visibleStartIndex * itemHeight}px);">
          {#each virtualizedItems as line, index (line.id)}
            <div 
              class="terminal-line {getLineTypeClass(line.type)}"
              data-line-id={line.id}
              style="height: {itemHeight}px;"
            >
              {#if showLineNumbers}
                <span class="line-number" aria-hidden="true">
                  {visibleStartIndex + index + 1}
                </span>
              {/if}
              
              {#if enableVoiceNavigation}
                <span class="voice-number" aria-hidden="true">
                  {voiceNavigationNumbers.get(index + 1) === line ? index + 1 : ''}
                </span>
              {/if}
              
              <span class="line-timestamp" aria-label="Timestamp: {formatTimestamp(line.timestamp)}">
                {formatTimestamp(line.timestamp)}
              </span>
              
              <span class="line-content" role="text">
                {line.content}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Standard rendering for smaller outputs -->
      {#each filteredLines as line, index (line.id)}
        <div 
          class="terminal-line {getLineTypeClass(line.type)}"
          data-line-id={line.id}
        >
          {#if showLineNumbers}
            <span class="line-number" aria-hidden="true">
              {index + 1}
            </span>
          {/if}
          
          {#if enableVoiceNavigation}
            <span class="voice-number" aria-hidden="true">
              {voiceNavigationNumbers.get(index + 1) === line ? index + 1 : ''}
            </span>
          {/if}
          
          <span class="line-timestamp" aria-label="Timestamp: {formatTimestamp(line.timestamp)}">
            {formatTimestamp(line.timestamp)}
          </span>
          
          <span class="line-content" role="text">
            {line.content}
          </span>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Auto-scroll indicator -->
  {#if isUserScrolling && autoScroll}
    <div class="auto-scroll-indicator">
      <button on:click={scrollToBottom} aria-label="Scroll to bottom">
        ↓ Auto-scroll paused
      </button>
    </div>
  {/if}
</div>

<style>
  .terminal-display {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    background: var(--terminal-bg, #1a1a1a);
    color: var(--terminal-text, #ffffff);
    border: 1px solid var(--terminal-border, #333);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .terminal-display:focus {
    outline: 2px solid var(--terminal-focus, #0078d4);
    outline-offset: -2px;
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--terminal-header-bg, #2d2d2d);
    border-bottom: 1px solid var(--terminal-border, #333);
    font-size: 12px;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-disconnected, #888);
  }

  .status-indicator.status-connected {
    background: var(--status-connected, #4caf50);
  }

  .status-indicator.status-connecting {
    background: var(--status-connecting, #ff9800);
    animation: pulse 1.5s infinite;
  }

  .status-indicator.status-error {
    background: var(--status-error, #f44336);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .performance-indicator {
    font-family: monospace;
    padding: 2px 6px;
    background: var(--perf-bg, #333);
    border-radius: 3px;
  }

  .performance-indicator.warning {
    background: var(--perf-warning, #ff9800);
    color: var(--perf-warning-text, #000);
  }

  .performance-indicator.good {
    background: var(--perf-good, #4caf50);
    color: var(--perf-good-text, #fff);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-input {
    padding: 4px 8px;
    border: 1px solid var(--terminal-border, #333);
    background: var(--terminal-input-bg, #1a1a1a);
    color: var(--terminal-text, #ffffff);
    border-radius: 3px;
    font-size: 12px;
    width: 150px;
  }

  .search-results {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }

  .search-results button {
    padding: 2px 6px;
    border: 1px solid var(--terminal-border, #333);
    background: var(--terminal-button-bg, #2d2d2d);
    color: var(--terminal-text, #ffffff);
    border-radius: 2px;
    cursor: pointer;
  }

  .search-results button:hover {
    background: var(--terminal-button-hover, #3d3d3d);
  }

  .terminal-output {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    font-size: inherit;
    line-height: 1.4;
  }

  .terminal-line {
    display: flex;
    align-items: flex-start;
    padding: 2px 8px;
    min-height: 20px;
    border-left: 3px solid transparent;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .terminal-line:hover {
    background: var(--terminal-line-hover, rgba(255, 255, 255, 0.05));
  }

  .terminal-line.selected {
    background: var(--terminal-line-selected, rgba(0, 120, 212, 0.3));
    border-left-color: var(--terminal-accent, #0078d4);
  }

  .terminal-line.line-command {
    color: var(--terminal-command, #4fc3f7);
    font-weight: 500;
  }

  .terminal-line.line-error {
    color: var(--terminal-error, #f44336);
    border-left-color: var(--terminal-error, #f44336);
  }

  .terminal-line.line-system {
    color: var(--terminal-system, #ff9800);
    font-style: italic;
  }

  .line-number {
    min-width: 40px;
    text-align: right;
    margin-right: 8px;
    color: var(--terminal-line-number, #666);
    font-size: 11px;
    user-select: none;
  }

  .voice-number {
    min-width: 20px;
    text-align: center;
    margin-right: 6px;
    color: var(--terminal-voice-number, #4caf50);
    font-size: 10px;
    font-weight: bold;
    background: var(--terminal-voice-bg, rgba(76, 175, 80, 0.1));
    border-radius: 2px;
    padding: 1px 3px;
    user-select: none;
  }

  .line-timestamp {
    min-width: 80px;
    margin-right: 8px;
    color: var(--terminal-timestamp, #888);
    font-size: 11px;
    user-select: none;
  }

  .line-content {
    flex: 1;
    word-wrap: break-word;
  }

  .auto-scroll-indicator {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
  }

  .auto-scroll-indicator button {
    padding: 8px 12px;
    background: var(--terminal-scroll-indicator-bg, rgba(0, 120, 212, 0.9));
    color: var(--terminal-scroll-indicator-text, #ffffff);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .auto-scroll-indicator button:hover {
    background: var(--terminal-scroll-indicator-hover, rgba(0, 120, 212, 1));
  }

  /* Theme variations */
  .terminal-theme-light {
    --terminal-bg: #ffffff;
    --terminal-text: #000000;
    --terminal-border: #ccc;
    --terminal-header-bg: #f0f0f0;
    --terminal-line-hover: rgba(0, 0, 0, 0.05);
    --terminal-command: #0066cc;
    --terminal-error: #cc0000;
    --terminal-system: #cc6600;
  }

  .terminal-theme-dark {
    --terminal-bg: #1a1a1a;
    --terminal-text: #ffffff;
    --terminal-border: #333;
    --terminal-header-bg: #2d2d2d;
    --terminal-line-hover: rgba(255, 255, 255, 0.05);
    --terminal-command: #4fc3f7;
    --terminal-error: #f44336;
    --terminal-system: #ff9800;
  }

  /* Connection state styles */
  .connected {
    border-color: var(--status-connected, #4caf50);
  }

  .disconnected {
    border-color: var(--status-disconnected, #888);
    opacity: 0.7;
  }

  /* Active/inactive session styles */
  .active {
    box-shadow: 0 0 0 2px var(--terminal-focus, #0078d4);
  }

  .inactive {
    opacity: 0.8;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .terminal-header {
      padding: 6px 8px;
      font-size: 11px;
    }
    
    .search-input {
      width: 100px;
    }
    
    .line-number {
      min-width: 30px;
      font-size: 10px;
    }
    
    .line-timestamp {
      min-width: 60px;
      font-size: 10px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .terminal-display {
      border-width: 2px;
    }
    
    .terminal-line.selected {
      background: var(--terminal-line-selected-hc, rgba(255, 255, 0, 0.5));
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .status-indicator.status-connecting {
      animation: none;
    }
  }
</style>
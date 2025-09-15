<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { 
    Button, 
    Input, 
    Dropdown, 
    DropdownItem, 
    Tooltip, 
    Badge,
    Breadcrumb,
    BreadcrumbItem,
    Popover
  } from 'flowbite-svelte';
  import { 
    SearchOutline, 
    ChevronDownOutline,
    ExclamationTriangleOutline,
    CheckCircleOutline,
    InformationCircleOutline,
    ColorPaletteOutline,
    CloseOutline
  } from 'flowbite-svelte-icons';

  const dispatch = createEventDispatcher();

  // Props
  export let value = '';
  export let errors = [];
  export let suggestions = [];
  export let readonly = false;
  export let lineNumbers = true;
  export let autoComplete = true;
  export let colorPicker = true;

  // Editor state
  let editorElement;
  let textareaElement;
  let lineNumbersElement;
  let currentLine = 1;
  let currentColumn = 1;
  let searchQuery = '';
  let searchResults = [];
  let currentSearchIndex = -1;
  let showSearch = false;
  let showSuggestions = false;
  let suggestionIndex = -1;
  let cursorPosition = 0;
  
  // Breadcrumb navigation
  let breadcrumbs = [];
  
  // Color picker state
  let showColorPicker = false;
  let colorPickerPosition = { top: 0, left: 0 };
  let selectedColor = '#000000';
  let colorInputValue = '';

  // JSON parsing and validation
  $: parsedJson = tryParseJson(value);
  $: isValidJson = parsedJson !== null;
  $: lineCount = value.split('\n').length;

  // Syntax highlighting patterns
  const syntaxPatterns = {
    string: /"([^"\\]|\\.)*"/g,
    number: /\b\d+\.?\d*\b/g,
    boolean: /\b(true|false)\b/g,
    null: /\bnull\b/g,
    key: /"([^"\\]|\\.)*"(?=\s*:)/g,
    bracket: /[{}[\]]/g,
    colon: /:/g,
    comma: /,/g
  };

  // Color value patterns for detection
  const colorPatterns = {
    hex: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/g,
    rgb: /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g,
    rgba: /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g,
    hsl: /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)/g
  };

  onMount(() => {
    updateLineNumbers();
    updateBreadcrumbs();
    highlightSyntax();
  });

  function tryParseJson(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  function updateLineNumbers() {
    if (!lineNumbersElement || !lineNumbers) return;
    
    const lines = Array.from({ length: lineCount }, (_, i) => i + 1);
    lineNumbersElement.innerHTML = lines
      .map(num => `<span class="line-number" data-line="${num}">${num}</span>`)
      .join('\n');
  }

  function updateCursorPosition() {
    if (!textareaElement) return;
    
    const textarea = textareaElement;
    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split('\n');
    
    currentLine = lines.length;
    currentColumn = lines[lines.length - 1].length + 1;
    cursorPosition = textarea.selectionStart;
    
    updateBreadcrumbs();
    checkForColorValue();
  }

  function updateBreadcrumbs() {
    if (!isValidJson) {
      breadcrumbs = [];
      return;
    }

    try {
      const textBeforeCursor = value.substring(0, cursorPosition);
      const path = getJsonPath(textBeforeCursor, parsedJson);
      breadcrumbs = path;
    } catch {
      breadcrumbs = [];
    }
  }

  function getJsonPath(textBeforeCursor, json) {
    // Simplified path detection - in a real implementation, 
    // you'd want a more robust JSON AST parser
    const path = [];
    const lines = textBeforeCursor.split('\n');
    let depth = 0;
    let currentPath = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('{') || trimmed.includes('[')) {
        const keyMatch = trimmed.match(/"([^"]+)"\s*:/);
        if (keyMatch) {
          currentPath[depth] = keyMatch[1];
          depth++;
        }
      }
      if (trimmed.includes('}') || trimmed.includes(']')) {
        if (depth > 0) {
          depth--;
          currentPath[depth] = undefined;
        }
      }
    }
    
    return currentPath.filter(Boolean).map(key => ({ label: key, path: key }));
  }

  function checkForColorValue() {
    if (!colorPicker || !textareaElement) return;
    
    const textarea = textareaElement;
    const text = textarea.value;
    const position = textarea.selectionStart;
    
    // Check if cursor is near a color value
    for (const [type, pattern] of Object.entries(colorPatterns)) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (position >= match.index && position <= match.index + match[0].length) {
          selectedColor = match[0];
          colorInputValue = selectedColor;
          
          // Position color picker near the cursor
          const rect = textarea.getBoundingClientRect();
          const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
          const charWidth = 8; // Approximate character width
          
          colorPickerPosition = {
            top: rect.top + (currentLine - 1) * lineHeight + lineHeight,
            left: rect.left + (currentColumn - 1) * charWidth
          };
          
          showColorPicker = true;
          return;
        }
      }
    }
    
    showColorPicker = false;
  }

  function highlightSyntax() {
    // This is a simplified syntax highlighter
    // In a production app, you'd want to use a library like Prism.js or Monaco Editor
    if (!editorElement) return;
    
    const highlighted = value
      .replace(syntaxPatterns.string, '<span class="syntax-string">$&</span>')
      .replace(syntaxPatterns.number, '<span class="syntax-number">$&</span>')
      .replace(syntaxPatterns.boolean, '<span class="syntax-boolean">$&</span>')
      .replace(syntaxPatterns.null, '<span class="syntax-null">$&</span>')
      .replace(syntaxPatterns.key, '<span class="syntax-key">$&</span>')
      .replace(syntaxPatterns.bracket, '<span class="syntax-bracket">$&</span>')
      .replace(syntaxPatterns.colon, '<span class="syntax-colon">$&</span>')
      .replace(syntaxPatterns.comma, '<span class="syntax-comma">$&</span>');
    
    // Update syntax highlighting overlay
    const overlay = editorElement.querySelector('.syntax-overlay');
    if (overlay) {
      overlay.innerHTML = highlighted;
    }
  }

  function handleInput(event) {
    value = event.target.value;
    dispatch('input', { value });
    
    updateLineNumbers();
    highlightSyntax();
    
    if (autoComplete) {
      checkAutoComplete();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      insertText('  '); // 2 spaces for indentation
    } else if (event.ctrlKey || event.metaKey) {
      if (event.key === 'f') {
        event.preventDefault();
        toggleSearch();
      } else if (event.key === 's') {
        event.preventDefault();
        dispatch('save');
      }
    } else if (showSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        suggestionIndex = Math.min(suggestionIndex + 1, suggestions.length - 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        suggestionIndex = Math.max(suggestionIndex - 1, 0);
      } else if (event.key === 'Enter' && suggestionIndex >= 0) {
        event.preventDefault();
        applySuggestion(suggestions[suggestionIndex]);
      } else if (event.key === 'Escape') {
        showSuggestions = false;
      }
    }
  }

  function insertText(text) {
    if (!textareaElement) return;
    
    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(end);
    
    value = beforeCursor + text + afterCursor;
    
    tick().then(() => {
      textareaElement.selectionStart = textareaElement.selectionEnd = start + text.length;
      textareaElement.focus();
    });
  }

  function checkAutoComplete() {
    // Simplified auto-complete logic
    if (!autoComplete || suggestions.length === 0) return;
    
    const textarea = textareaElement;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastWord = textBeforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    
    if (lastWord) {
      const word = lastWord[0];
      const matchingSuggestions = suggestions.filter(s => 
        s.toLowerCase().startsWith(word.toLowerCase())
      );
      
      if (matchingSuggestions.length > 0) {
        showSuggestions = true;
        suggestionIndex = 0;
      } else {
        showSuggestions = false;
      }
    } else {
      showSuggestions = false;
    }
  }

  function applySuggestion(suggestion) {
    const textarea = textareaElement;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    const lastWordMatch = textBeforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    
    if (lastWordMatch) {
      const beforeWord = textBeforeCursor.substring(0, lastWordMatch.index);
      value = beforeWord + suggestion + textAfterCursor;
      
      tick().then(() => {
        const newCursorPos = beforeWord.length + suggestion.length;
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
      });
    }
    
    showSuggestions = false;
  }

  function toggleSearch() {
    showSearch = !showSearch;
    if (showSearch) {
      tick().then(() => {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.focus();
      });
    }
  }

  function performSearch() {
    if (!searchQuery) {
      searchResults = [];
      return;
    }
    
    const results = [];
    const lines = value.split('\n');
    
    lines.forEach((line, lineIndex) => {
      let startIndex = 0;
      let match;
      
      while ((match = line.indexOf(searchQuery, startIndex)) !== -1) {
        results.push({
          line: lineIndex + 1,
          column: match + 1,
          text: line.trim()
        });
        startIndex = match + 1;
      }
    });
    
    searchResults = results;
    currentSearchIndex = results.length > 0 ? 0 : -1;
  }

  function navigateSearch(direction) {
    if (searchResults.length === 0) return;
    
    if (direction === 'next') {
      currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      currentSearchIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    }
    
    const result = searchResults[currentSearchIndex];
    jumpToLine(result.line);
  }

  function jumpToLine(lineNumber) {
    if (!textareaElement) return;
    
    const lines = value.split('\n');
    let position = 0;
    
    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1; // +1 for newline
    }
    
    textareaElement.focus();
    textareaElement.selectionStart = textareaElement.selectionEnd = position;
    updateCursorPosition();
  }

  function applyColorValue() {
    if (!textareaElement || !colorInputValue) return;
    
    const textarea = textareaElement;
    const text = textarea.value;
    const position = textarea.selectionStart;
    
    // Find and replace the color value at cursor position
    for (const [type, pattern] of Object.entries(colorPatterns)) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (position >= match.index && position <= match.index + match[0].length) {
          const beforeColor = text.substring(0, match.index);
          const afterColor = text.substring(match.index + match[0].length);
          value = beforeColor + colorInputValue + afterColor;
          
          tick().then(() => {
            const newPosition = match.index + colorInputValue.length;
            textarea.selectionStart = textarea.selectionEnd = newPosition;
            textarea.focus();
          });
          
          showColorPicker = false;
          return;
        }
      }
    }
  }

  // Reactive updates
  $: if (value) {
    updateLineNumbers();
    highlightSyntax();
  }

  $: if (searchQuery) {
    performSearch();
  }
</script>

<div class="json-editor" class:readonly>
  <!-- Editor Header -->
  <div class="editor-header">
    <!-- Breadcrumb Navigation -->
    {#if breadcrumbs.length > 0}
      <Breadcrumb class="breadcrumb">
        <BreadcrumbItem href="#" on:click={() => jumpToLine(1)}>root</BreadcrumbItem>
        {#each breadcrumbs as crumb}
          <BreadcrumbItem>{crumb.label}</BreadcrumbItem>
        {/each}
      </Breadcrumb>
    {/if}

    <!-- Editor Actions -->
    <div class="editor-actions">
      <!-- Search Toggle -->
      <Tooltip content="Search (Ctrl+F)">
        <Button
          size="xs"
          color="ghost"
          on:click={toggleSearch}
          class:active={showSearch}
        >
          <SearchOutline class="w-4 h-4" />
        </Button>
      </Tooltip>

      <!-- Status Indicators -->
      {#if errors.length > 0}
        <Badge color="red" class="status-badge">
          <ExclamationTriangleOutline class="w-3 h-3 mr-1" />
          {errors.length} errors
        </Badge>
      {:else if isValidJson}
        <Badge color="green" class="status-badge">
          <CheckCircleOutline class="w-3 h-3 mr-1" />
          Valid JSON
        </Badge>
      {/if}

      <!-- Cursor Position -->
      <span class="cursor-position">
        Ln {currentLine}, Col {currentColumn}
      </span>
    </div>
  </div>

  <!-- Search Bar -->
  {#if showSearch}
    <div class="search-bar">
      <Input
        class="search-input flex-1"
        placeholder="Search..."
        bind:value={searchQuery}
        size="sm"
      />
      
      {#if searchResults.length > 0}
        <span class="search-results">
          {currentSearchIndex + 1} of {searchResults.length}
        </span>
        
        <Button size="xs" color="ghost" on:click={() => navigateSearch('prev')}>
          ↑
        </Button>
        <Button size="xs" color="ghost" on:click={() => navigateSearch('next')}>
          ↓
        </Button>
      {/if}
      
      <Button size="xs" color="ghost" on:click={() => showSearch = false}>
        <CloseOutline class="w-4 h-4" />
      </Button>
    </div>
  {/if}

  <!-- Editor Container -->
  <div class="editor-container" bind:this={editorElement}>
    <!-- Line Numbers -->
    {#if lineNumbers}
      <div class="line-numbers" bind:this={lineNumbersElement}></div>
    {/if}

    <!-- Text Editor -->
    <div class="editor-content">
      <!-- Syntax Highlighting Overlay -->
      <div class="syntax-overlay" aria-hidden="true"></div>
      
      <!-- Error Indicators -->
      {#if errors.length > 0}
        <div class="error-indicators">
          {#each errors as error}
            <div 
              class="error-indicator" 
              style="top: {(error.line - 1) * 1.5}rem"
              title={error.message}
            >
              <ExclamationTriangleOutline class="w-4 h-4 text-red-500" />
            </div>
          {/each}
        </div>
      {/if}

      <!-- Main Textarea -->
      <textarea
        bind:this={textareaElement}
        bind:value
        on:input={handleInput}
        on:keydown={handleKeydown}
        on:select={updateCursorPosition}
        on:click={updateCursorPosition}
        class="editor-textarea"
        {readonly}
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        data-gramm="false"
      ></textarea>
    </div>

    <!-- Auto-complete Suggestions -->
    {#if showSuggestions && suggestions.length > 0}
      <div class="suggestions-dropdown">
        {#each suggestions as suggestion, index}
          <div 
            class="suggestion-item" 
            class:active={index === suggestionIndex}
            on:click={() => applySuggestion(suggestion)}
            on:keydown={(e) => e.key === 'Enter' && applySuggestion(suggestion)}
            role="button"
            tabindex="0"
          >
            {suggestion}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Color Picker Popover -->
  {#if showColorPicker}
    <div 
      class="color-picker-popover"
      style="top: {colorPickerPosition.top}px; left: {colorPickerPosition.left}px"
    >
      <div class="color-picker-content">
        <div class="color-preview" style="background-color: {selectedColor}"></div>
        <Input
          type="color"
          bind:value={colorInputValue}
          size="sm"
          class="color-input"
        />
        <div class="color-actions">
          <Button size="xs" color="primary" on:click={applyColorValue}>
            Apply
          </Button>
          <Button size="xs" color="ghost" on:click={() => showColorPicker = false}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .json-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--theme-background);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--theme-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
    gap: 1rem;
  }

  .breadcrumb {
    flex: 1;
    min-width: 0;
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge {
    font-size: 0.75rem;
  }

  .cursor-position {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
    font-family: 'JetBrains Mono', monospace;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--theme-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
  }

  .search-results {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
    white-space: nowrap;
  }

  .editor-container {
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .line-numbers {
    display: flex;
    flex-direction: column;
    background-color: color-mix(in srgb, var(--theme-surface) 50%, var(--theme-background));
    border-right: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
    padding: 1rem 0.5rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: color-mix(in srgb, var(--theme-text) 50%, transparent);
    text-align: right;
    user-select: none;
    min-width: 3rem;
  }

  .line-number {
    display: block;
    height: 1.5rem;
    padding: 0 0.25rem;
  }

  .line-number:hover {
    background-color: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  }

  .editor-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .syntax-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow: hidden;
    pointer-events: none;
    color: transparent;
  }

  .editor-textarea {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    padding: 1rem;
    border: none;
    outline: none;
    background: transparent;
    color: var(--theme-text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow: auto;
    resize: none;
    caret-color: var(--theme-primary);
  }

  .editor-textarea::selection {
    background-color: color-mix(in srgb, var(--theme-primary) 25%, transparent);
  }

  .readonly .editor-textarea {
    cursor: default;
  }

  .error-indicators {
    position: absolute;
    right: 0.5rem;
    top: 1rem;
    pointer-events: none;
  }

  .error-indicator {
    position: absolute;
    right: 0;
  }

  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 1rem;
    right: 1rem;
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 5%, transparent);
  }

  .suggestion-item:hover,
  .suggestion-item.active {
    background-color: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .color-picker-popover {
    position: fixed;
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 20;
    padding: 0.75rem;
  }

  .color-picker-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 150px;
  }

  .color-preview {
    width: 100%;
    height: 2rem;
    border-radius: 0.25rem;
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }

  .color-input {
    width: 100%;
    height: 2rem;
  }

  .color-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Syntax Highlighting */
  :global(.syntax-string) { color: #10B981; }
  :global(.syntax-number) { color: #F59E0B; }
  :global(.syntax-boolean) { color: #8B5CF6; }
  :global(.syntax-null) { color: #6B7280; }
  :global(.syntax-key) { color: #3B82F6; }
  :global(.syntax-bracket) { color: var(--theme-text); font-weight: bold; }
  :global(.syntax-colon) { color: var(--theme-text); }
  :global(.syntax-comma) { color: var(--theme-text); }

  /* Responsive Design */
  @media (max-width: 768px) {
    .editor-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .breadcrumb {
      order: 2;
    }

    .editor-actions {
      order: 1;
      justify-content: space-between;
    }

    .line-numbers {
      min-width: 2.5rem;
      font-size: 0.75rem;
    }

    .editor-textarea,
    .syntax-overlay {
      font-size: 0.75rem;
    }
  }

  /* Focus States */
  .editor-textarea:focus {
    box-shadow: inset 0 0 0 2px var(--theme-primary);
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .line-numbers {
      border-right-color: var(--theme-text);
    }
    
    .suggestions-dropdown,
    .color-picker-popover {
      border-color: var(--theme-text);
    }
  }
</style>
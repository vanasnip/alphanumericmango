<script>
  import { onMount } from 'svelte';
  import { Drawer, Button, Tooltip, Badge } from 'flowbite-svelte';
  import { 
    ChevronLeftOutline, 
    ChevronRightOutline, 
    MenuOutline,
    GridOutline,
    CodeOutline,
    EyeOutline
  } from 'flowbite-svelte-icons';

  // Layout state
  let leftPanelOpen = true;
  let rightPanelOpen = true;
  let leftPanelWidth = 300;
  let rightPanelWidth = 350;
  let centerPanelWidth = 600;
  
  // Mobile responsive state
  let isMobile = false;
  let activePanel = 'editor'; // 'sidebar', 'editor', 'preview'
  
  // Resizing state
  let isResizing = false;
  let resizePanel = null;
  
  // Props
  export let showSidebar = true;
  export let showPreview = true;
  export let sidebarContent = null;
  export let editorContent = null;
  export let previewContent = null;

  // Mobile detection
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      if (isMobile) {
        leftPanelOpen = false;
        rightPanelOpen = false;
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  });

  // Panel toggle functions
  function toggleLeftPanel() {
    if (isMobile) {
      activePanel = activePanel === 'sidebar' ? 'editor' : 'sidebar';
    } else {
      leftPanelOpen = !leftPanelOpen;
    }
  }

  function toggleRightPanel() {
    if (isMobile) {
      activePanel = activePanel === 'preview' ? 'editor' : 'preview';
    } else {
      rightPanelOpen = !rightPanelOpen;
    }
  }

  // Resizing handlers
  function startResize(panel, event) {
    if (isMobile) return;
    
    isResizing = true;
    resizePanel = panel;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    event.preventDefault();
  }

  function handleResize(event) {
    if (!isResizing || !resizePanel) return;
    
    const containerRect = document.querySelector('.settings-layout').getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left;
    
    if (resizePanel === 'left') {
      leftPanelWidth = Math.max(200, Math.min(500, mouseX));
    } else if (resizePanel === 'right') {
      rightPanelWidth = Math.max(250, Math.min(600, containerRect.width - mouseX));
    }
  }

  function stopResize() {
    isResizing = false;
    resizePanel = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }

  // Mobile panel navigation
  const panels = [
    { id: 'sidebar', label: 'Settings', icon: MenuOutline },
    { id: 'editor', label: 'Editor', icon: CodeOutline },
    { id: 'preview', label: 'Preview', icon: EyeOutline }
  ];
</script>

<div class="settings-layout" class:mobile={isMobile}>
  <!-- Mobile Navigation Bar -->
  {#if isMobile}
    <div class="mobile-nav">
      {#each panels as panel}
        <button
          class="nav-button"
          class:active={activePanel === panel.id}
          on:click={() => activePanel = panel.id}
          aria-label={panel.label}
        >
          <svelte:component this={panel.icon} class="w-5 h-5" />
          <span class="nav-label">{panel.label}</span>
          {#if panel.id === 'sidebar' && leftPanelOpen}
            <Badge class="notification-badge">3</Badge>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Desktop Layout -->
  {#if !isMobile}
    <div class="desktop-layout">
      <!-- Left Sidebar -->
      {#if showSidebar}
        <div 
          class="left-panel" 
          class:collapsed={!leftPanelOpen}
          style="width: {leftPanelOpen ? leftPanelWidth : 60}px"
        >
          <div class="panel-header">
            <h3 class="panel-title">
              {#if leftPanelOpen}
                Theme Settings
              {:else}
                <GridOutline class="w-5 h-5" />
              {/if}
            </h3>
            <Button
              size="xs"
              color="ghost"
              on:click={toggleLeftPanel}
              aria-label={leftPanelOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {#if leftPanelOpen}
                <ChevronLeftOutline class="w-4 h-4" />
              {:else}
                <ChevronRightOutline class="w-4 h-4" />
              {/if}
            </Button>
          </div>
          
          <div class="panel-content" class:collapsed-content={!leftPanelOpen}>
            {#if sidebarContent}
              <svelte:component this={sidebarContent} collapsed={!leftPanelOpen} />
            {:else}
              <slot name="sidebar" collapsed={!leftPanelOpen} />
            {/if}
          </div>
        </div>

        <!-- Left Resize Handle -->
        {#if leftPanelOpen}
          <div
            class="resize-handle left-resize"
            on:mousedown={(e) => startResize('left', e)}
            role="separator"
            aria-label="Resize sidebar"
          ></div>
        {/if}
      {/if}

      <!-- Center Editor Panel -->
      <div class="center-panel" class:full-width={!showSidebar || !showPreview}>
        <div class="panel-header">
          <h3 class="panel-title">JSON Editor</h3>
          <div class="panel-actions">
            {#if !leftPanelOpen && showSidebar}
              <Tooltip content="Show sidebar">
                <Button
                  size="xs"
                  color="ghost"
                  on:click={toggleLeftPanel}
                >
                  <MenuOutline class="w-4 h-4" />
                </Button>
              </Tooltip>
            {/if}
            
            {#if !rightPanelOpen && showPreview}
              <Tooltip content="Show preview">
                <Button
                  size="xs"
                  color="ghost"
                  on:click={toggleRightPanel}
                >
                  <EyeOutline class="w-4 h-4" />
                </Button>
              </Tooltip>
            {/if}
          </div>
        </div>
        
        <div class="panel-content">
          {#if editorContent}
            <svelte:component this={editorContent} />
          {:else}
            <slot name="editor" />
          {/if}
        </div>
      </div>

      <!-- Right Preview Panel -->
      {#if showPreview}
        <!-- Right Resize Handle -->
        {#if rightPanelOpen}
          <div
            class="resize-handle right-resize"
            on:mousedown={(e) => startResize('right', e)}
            role="separator"
            aria-label="Resize preview"
          ></div>
        {/if}

        <div 
          class="right-panel" 
          class:collapsed={!rightPanelOpen}
          style="width: {rightPanelOpen ? rightPanelWidth : 60}px"
        >
          <div class="panel-header">
            <Button
              size="xs"
              color="ghost"
              on:click={toggleRightPanel}
              aria-label={rightPanelOpen ? 'Collapse preview' : 'Expand preview'}
            >
              {#if rightPanelOpen}
                <ChevronRightOutline class="w-4 h-4" />
              {:else}
                <ChevronLeftOutline class="w-4 h-4" />
              {/if}
            </Button>
            <h3 class="panel-title">
              {#if rightPanelOpen}
                Live Preview
              {:else}
                <EyeOutline class="w-5 h-5" />
              {/if}
            </h3>
          </div>
          
          <div class="panel-content" class:collapsed-content={!rightPanelOpen}>
            {#if previewContent}
              <svelte:component this={previewContent} collapsed={!rightPanelOpen} />
            {:else}
              <slot name="preview" collapsed={!rightPanelOpen} />
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Mobile Layout -->
    <div class="mobile-layout">
      <div class="mobile-panel" class:active={activePanel === 'sidebar'}>
        {#if sidebarContent}
          <svelte:component this={sidebarContent} mobile={true} />
        {:else}
          <slot name="sidebar" mobile={true} />
        {/if}
      </div>
      
      <div class="mobile-panel" class:active={activePanel === 'editor'}>
        {#if editorContent}
          <svelte:component this={editorContent} mobile={true} />
        {:else}
          <slot name="editor" mobile={true} />
        {/if}
      </div>
      
      <div class="mobile-panel" class:active={activePanel === 'preview'}>
        {#if previewContent}
          <svelte:component this={previewContent} mobile={true} />
        {:else}
          <slot name="preview" mobile={true} />
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--theme-background);
    color: var(--theme-text);
    overflow: hidden;
  }

  /* Mobile Navigation */
  .mobile-nav {
    display: flex;
    background-color: var(--theme-surface);
    border-bottom: 1px solid var(--theme-text, #374151);
    padding: 0.5rem;
    z-index: 10;
  }

  .nav-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--theme-text);
    border-radius: 0.375rem;
    transition: all 0.2s;
    flex: 1;
    position: relative;
  }

  .nav-button:hover {
    background-color: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  }

  .nav-button.active {
    background-color: var(--theme-primary);
    color: white;
  }

  .nav-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .notification-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    min-width: 1.25rem;
    height: 1.25rem;
    font-size: 0.625rem;
  }

  /* Desktop Layout */
  .desktop-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-panel,
  .right-panel,
  .center-panel {
    display: flex;
    flex-direction: column;
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    transition: width 0.3s ease;
  }

  .left-panel {
    border-right: none;
    min-width: 60px;
  }

  .right-panel {
    border-left: none;
    min-width: 60px;
  }

  .center-panel {
    flex: 1;
    min-width: 400px;
    border-left: none;
    border-right: none;
  }

  .center-panel.full-width {
    border-left: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-right: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }

  .collapsed {
    overflow: hidden;
  }

  /* Panel Headers */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
    background-color: var(--theme-background);
    min-height: 60px;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .panel-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Panel Content */
  .panel-content {
    flex: 1;
    overflow: auto;
    padding: 1rem;
  }

  .collapsed-content {
    padding: 0.5rem;
  }

  /* Resize Handles */
  .resize-handle {
    width: 4px;
    background-color: transparent;
    cursor: col-resize;
    transition: background-color 0.2s;
    z-index: 5;
  }

  .resize-handle:hover {
    background-color: var(--theme-primary);
  }

  .left-resize {
    border-right: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }

  .right-resize {
    border-left: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }

  /* Mobile Layout */
  .mobile-layout {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .mobile-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--theme-surface);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    overflow: auto;
  }

  .mobile-panel.active {
    transform: translateX(0);
  }

  .mobile-panel:first-child.active {
    transform: translateX(0);
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .left-panel {
      max-width: 250px;
    }
    
    .right-panel {
      max-width: 300px;
    }
  }

  @media (max-width: 768px) {
    .desktop-layout {
      display: none;
    }
  }

  @media (min-width: 769px) {
    .mobile-nav,
    .mobile-layout {
      display: none;
    }
  }

  /* Focus States for Accessibility */
  .nav-button:focus,
  .resize-handle:focus {
    outline: 2px solid var(--theme-primary);
    outline-offset: 2px;
  }

  /* High Contrast Mode Support */
  @media (prefers-contrast: high) {
    .panel-header,
    .left-panel,
    .right-panel,
    .center-panel {
      border-color: var(--theme-text);
    }
  }

  /* Reduced Motion Support */
  @media (prefers-reduced-motion: reduce) {
    .left-panel,
    .right-panel,
    .mobile-panel,
    .nav-button,
    .resize-handle {
      transition: none;
    }
  }
</style>
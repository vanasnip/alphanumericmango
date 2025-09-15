import { browser } from '$app/environment';

/**
 * File watcher utility for settings.json with debouncing and error handling
 */
class FileWatcher {
  constructor() {
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.abortControllers = new Map();
  }

  /**
   * Watch a file for changes with debouncing
   * @param {string} filePath - Path to the file to watch
   * @param {Function} callback - Callback function to execute on change
   * @param {number} debounceMs - Debounce delay in milliseconds (default: 100)
   */
  watch(filePath, callback, debounceMs = 100) {
    if (!browser) return () => {};

    // Clean up existing watcher if any
    this.unwatch(filePath);

    // Create abort controller for this watcher
    const abortController = new AbortController();
    this.abortControllers.set(filePath, abortController);

    // Start polling for file changes
    const startPolling = () => {
      let lastModified = null;
      let isInitialLoad = true;

      const poll = async () => {
        try {
          const response = await fetch(filePath, {
            method: 'HEAD',
            signal: abortController.signal
          });

          if (response.ok) {
            const modified = response.headers.get('last-modified');
            
            if (!isInitialLoad && modified !== lastModified) {
              this.debouncedCallback(filePath, callback, debounceMs);
            }
            
            lastModified = modified;
            isInitialLoad = false;
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.warn(`File watcher error for ${filePath}:`, error);
          }
        }

        // Continue polling if not aborted
        if (!abortController.signal.aborted) {
          setTimeout(poll, 1000); // Poll every second
        }
      };

      poll();
    };

    // For modern browsers, try to use the File System Access API if available
    if ('showOpenFilePicker' in window && navigator.serviceWorker) {
      this.setupServiceWorkerWatcher(filePath, callback, debounceMs);
    } else {
      // Fallback to polling
      startPolling();
    }

    // Return cleanup function
    return () => this.unwatch(filePath);
  }

  /**
   * Setup service worker based file watching (more efficient)
   */
  async setupServiceWorkerWatcher(filePath, callback, debounceMs) {
    try {
      // Register a simple service worker for file watching
      if ('serviceWorker' in navigator) {
        // For now, fallback to polling - service worker setup would be more complex
        // and requires additional infrastructure
        this.setupPollingWatcher(filePath, callback, debounceMs);
      }
    } catch (error) {
      console.warn('Service worker file watching not available, falling back to polling');
      this.setupPollingWatcher(filePath, callback, debounceMs);
    }
  }

  /**
   * Setup polling-based file watcher
   */
  setupPollingWatcher(filePath, callback, debounceMs) {
    let lastContent = null;
    let isInitialLoad = true;

    const poll = async () => {
      const abortController = this.abortControllers.get(filePath);
      if (!abortController || abortController.signal.aborted) return;

      try {
        const response = await fetch(filePath, {
          signal: abortController.signal,
          cache: 'no-cache'
        });

        if (response.ok) {
          const content = await response.text();
          
          if (!isInitialLoad && content !== lastContent) {
            this.debouncedCallback(filePath, callback, debounceMs);
          }
          
          lastContent = content;
          isInitialLoad = false;
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn(`Polling error for ${filePath}:`, error);
        }
      }

      // Schedule next poll
      if (!abortController.signal.aborted) {
        setTimeout(poll, 1000);
      }
    };

    poll();
  }

  /**
   * Debounced callback execution
   */
  debouncedCallback(filePath, callback, debounceMs) {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error(`File watcher callback error for ${filePath}:`, error);
      }
      this.debounceTimers.delete(filePath);
    }, debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Stop watching a file
   */
  unwatch(filePath) {
    // Clear debounce timer
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }

    // Abort any ongoing requests
    const abortController = this.abortControllers.get(filePath);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(filePath);
    }

    // Remove from watchers map
    this.watchers.delete(filePath);
  }

  /**
   * Stop watching all files
   */
  unwatchAll() {
    for (const filePath of this.watchers.keys()) {
      this.unwatch(filePath);
    }
  }

  /**
   * Get list of currently watched files
   */
  getWatchedFiles() {
    return Array.from(this.watchers.keys());
  }
}

// Create singleton instance
export const fileWatcher = new FileWatcher();

// Cleanup on page unload
if (browser) {
  window.addEventListener('beforeunload', () => {
    fileWatcher.unwatchAll();
  });
}

export default fileWatcher;
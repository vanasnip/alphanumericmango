/**
 * Performance Optimizations for Theme System
 * Implements recommended optimizations from the performance analysis
 */

// 1. CSS Change Detection and Caching
class ThemeCSSCache {
  constructor() {
    this.cache = new Map();
    this.lastGeneratedCSS = '';
    this.maxCacheSize = 50; // Limit memory usage
  }

  generateThemeCSS(theme, generateCSS) {
    const themeKey = this.getThemeKey(theme);
    
    if (this.cache.has(themeKey)) {
      return this.cache.get(themeKey);
    }
    
    const css = generateCSS(theme);
    
    // Implement cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(themeKey, css);
    return css;
  }

  getThemeKey(theme) {
    // Create a more efficient key than full JSON.stringify
    const { mode, preset, global, components } = theme;
    const colorKeys = Object.keys(global.colors).sort();
    const colorValues = colorKeys.map(k => global.colors[k]).join('|');
    const componentKeys = Object.keys(components).sort().join('|');
    
    return `${mode}-${preset}-${colorValues}-${componentKeys}`;
  }

  hasChanged(css) {
    if (css !== this.lastGeneratedCSS) {
      this.lastGeneratedCSS = css;
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.lastGeneratedCSS = '';
  }
}

// 2. Debounced Theme Updates
class ThemeUpdateDebouncer {
  constructor() {
    this.updateTimeout = null;
    this.pendingUpdates = new Map();
    this.isUpdating = false;
  }

  scheduleUpdate(key, updateFn, delay = 16) {
    clearTimeout(this.updateTimeout);
    this.pendingUpdates.set(key, updateFn);
    
    this.updateTimeout = setTimeout(() => {
      this.processPendingUpdates();
    }, delay);
  }

  scheduleImmediate(key, updateFn) {
    this.pendingUpdates.set(key, updateFn);
    
    if (!this.isUpdating) {
      requestAnimationFrame(() => {
        this.processPendingUpdates();
      });
    }
  }

  processPendingUpdates() {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    
    for (const [key, updateFn] of this.pendingUpdates) {
      try {
        updateFn();
      } catch (error) {
        console.warn(`Theme update failed for ${key}:`, error);
      }
    }
    
    this.pendingUpdates.clear();
    this.isUpdating = false;
  }

  cancel() {
    clearTimeout(this.updateTimeout);
    this.pendingUpdates.clear();
  }
}

// 3. Optimized CSS Variable Application
function createOptimizedCSSApplicator() {
  let currentStyleElement = null;
  const applyQueue = [];
  let isProcessing = false;

  return {
    applyCSSVariables(css, id = 'theme-variables') {
      applyQueue.push({ css, id });
      
      if (!isProcessing) {
        isProcessing = true;
        requestAnimationFrame(() => {
          this.processCSSQueue();
        });
      }
    },

    processCSSQueue() {
      // Process all queued CSS updates in a single frame
      const updates = [...applyQueue];
      applyQueue.length = 0;
      
      // Apply the most recent update for each ID
      const latestUpdates = new Map();
      updates.forEach(update => {
        latestUpdates.set(update.id, update.css);
      });

      for (const [id, css] of latestUpdates) {
        this.updateStyleElement(id, css);
      }
      
      isProcessing = false;
    },

    updateStyleElement(id, css) {
      const existing = document.getElementById(id);
      if (existing) {
        // Update existing element content
        existing.textContent = css;
      } else {
        // Create new style element
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
      }
    }
  };
}

// 4. Theme Equality Checker
class ThemeComparator {
  constructor() {
    this.lastThemeHash = null;
  }

  hasThemeChanged(theme) {
    const currentHash = this.getThemeHash(theme);
    
    if (currentHash !== this.lastThemeHash) {
      this.lastThemeHash = currentHash;
      return true;
    }
    
    return false;
  }

  getThemeHash(theme) {
    // Create a lightweight hash instead of full JSON.stringify
    const { mode, preset } = theme;
    const colorHash = this.hashObject(theme.global.colors);
    const componentHash = this.hashObject(theme.components);
    
    return `${mode}-${preset}-${colorHash}-${componentHash}`;
  }

  hashObject(obj) {
    // Simple hash function for objects
    let hash = 0;
    const str = JSON.stringify(obj);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }
}

// 5. Enhanced Theme Store with Performance Optimizations
function createOptimizedThemeStore(originalStore) {
  const cssCache = new ThemeCSSCache();
  const debouncer = new ThemeUpdateDebouncer();
  const cssApplicator = createOptimizedCSSApplicator();
  const comparator = new ThemeComparator();
  
  let currentTheme = null;

  return {
    ...originalStore,

    // Optimized set method
    set(theme) {
      // Quick equality check
      if (!comparator.hasThemeChanged(theme)) {
        return;
      }

      currentTheme = theme;
      
      // Update store immediately
      originalStore._set(theme);
      
      // Debounce CSS and storage updates
      debouncer.scheduleUpdate('css', () => {
        this.updateThemeCSS(theme);
      });
      
      debouncer.scheduleUpdate('storage', () => {
        this.saveToLocalStorage(theme);
      }, 100); // Longer delay for storage
    },

    // Optimized update method
    update(updater) {
      let newTheme;
      originalStore._update(current => {
        newTheme = updater(current);
        return newTheme;
      });
      
      if (newTheme && comparator.hasThemeChanged(newTheme)) {
        currentTheme = newTheme;
        
        debouncer.scheduleUpdate('css', () => {
          this.updateThemeCSS(newTheme);
        });
        
        debouncer.scheduleUpdate('storage', () => {
          this.saveToLocalStorage(newTheme);
        }, 100);
      }
      
      return newTheme;
    },

    // Optimized CSS update with caching
    updateThemeCSS(theme) {
      const css = cssCache.generateThemeCSS(theme, (t) => {
        return originalStore.generateThemeCSS(t);
      });
      
      if (cssCache.hasChanged(css)) {
        cssApplicator.applyCSSVariables(css, 'theme-variables');
        
        // Generate Flowbite CSS separately to avoid regeneration
        const flowbiteCSS = cssCache.generateThemeCSS(
          { ...theme, _type: 'flowbite' },
          (t) => originalStore.generateFlowbiteVariables(t)
        );
        
        cssApplicator.applyCSSVariables(flowbiteCSS, 'flowbite-variables');
      }
    },

    // Fixed cross-tab sync (removes double CSS update)
    startWatching() {
      if (!browser || this.storageWatcherCleanup) return;
      
      const handleStorageChange = (e) => {
        if (e.key === 'voice-terminal-theme' && e.newValue) {
          try {
            const newTheme = JSON.parse(e.newValue);
            const validation = validateTheme(newTheme);
            
            if (validation.isValid && comparator.hasThemeChanged(newTheme)) {
              // Direct store update without triggering CSS update
              originalStore._set(newTheme);
              currentTheme = newTheme;
              
              // Single CSS update
              debouncer.scheduleImmediate('sync-css', () => {
                this.updateThemeCSS(newTheme);
              });
              
              themeError.set(null);
            }
          } catch (error) {
            console.warn('Failed to sync theme from storage event:', error);
          }
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      this.storageWatcherCleanup = () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    },

    // Performance monitoring utilities
    getPerformanceStats() {
      return {
        cacheSize: cssCache.cache.size,
        cacheHits: cssCache.cacheHits || 0,
        pendingUpdates: debouncer.pendingUpdates.size,
        lastUpdateTime: performance.now()
      };
    },

    // Clear performance caches
    clearCache() {
      cssCache.clear();
      debouncer.cancel();
      comparator.lastThemeHash = null;
    }
  };
}

// 6. Performance Monitoring Utilities
class ThemePerformanceMonitor {
  constructor() {
    this.metrics = {
      themeSwitches: 0,
      totalSwitchTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: []
    };
    
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  measureThemeSwitch(operation) {
    if (!this.isEnabled) return operation();
    
    const start = performance.now();
    performance.mark('theme-switch-start');
    
    const result = operation();
    
    performance.mark('theme-switch-end');
    performance.measure('theme-switch', 'theme-switch-start', 'theme-switch-end');
    
    const duration = performance.now() - start;
    this.recordSwitchTime(duration);
    
    return result;
  }

  recordSwitchTime(duration) {
    this.metrics.themeSwitches++;
    this.metrics.totalSwitchTime += duration;
    
    if (duration > 100) {
      console.warn(`Slow theme switch detected: ${duration.toFixed(2)}ms`);
    }
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  recordMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize
      });
      
      // Keep only last 100 measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }
    }
  }

  getAverageSwitchTime() {
    return this.metrics.themeSwitches > 0 
      ? this.metrics.totalSwitchTime / this.metrics.themeSwitches 
      : 0;
  }

  getCacheHitRate() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? this.metrics.cacheHits / total : 0;
  }

  generateReport() {
    return {
      averageSwitchTime: this.getAverageSwitchTime(),
      totalSwitches: this.metrics.themeSwitches,
      cacheHitRate: this.getCacheHitRate(),
      memoryTrend: this.getMemoryTrend(),
      recommendations: this.generateRecommendations()
    };
  }

  getMemoryTrend() {
    if (this.metrics.memoryUsage.length < 2) return 'insufficient-data';
    
    const recent = this.metrics.memoryUsage.slice(-10);
    const early = recent[0].used;
    const late = recent[recent.length - 1].used;
    
    const change = ((late - early) / early) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.getAverageSwitchTime() > 50) {
      recommendations.push('Consider enabling CSS caching');
    }
    
    if (this.getCacheHitRate() < 0.5) {
      recommendations.push('Cache hit rate is low - review theme usage patterns');
    }
    
    if (this.getMemoryTrend() === 'increasing') {
      recommendations.push('Memory usage is increasing - check for memory leaks');
    }
    
    return recommendations;
  }
}

// Export the optimizations
export {
  ThemeCSSCache,
  ThemeUpdateDebouncer,
  createOptimizedCSSApplicator,
  ThemeComparator,
  createOptimizedThemeStore,
  ThemePerformanceMonitor
};
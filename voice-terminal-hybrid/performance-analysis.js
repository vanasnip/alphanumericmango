/**
 * Theme Performance Analysis Script
 * Measures critical performance metrics for the theme persistence fix
 */

// Mock browser environment for Node.js testing
const mockBrowser = {
  localStorage: {
    items: {},
    getItem: function(key) {
      return this.items[key] || null;
    },
    setItem: function(key, value) {
      this.items[key] = value;
    },
    removeItem: function(key) {
      delete this.items[key];
    }
  },
  document: {
    createElement: () => ({ textContent: '', id: '', appendChild: () => {} }),
    getElementById: () => null,
    head: { appendChild: () => {} },
    documentElement: { 
      classList: { add: () => {}, remove: () => {} },
      className: '',
      style: { setProperty: () => {} }
    }
  },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  }
};

// Set up globals for testing
global.localStorage = mockBrowser.localStorage;
global.document = mockBrowser.document;
global.window = mockBrowser.window;

// Import theme modules (simulate browser context)
import { performance } from 'perf_hooks';

// Simulated theme configurations for testing
const DEFAULT_THEME = {
  mode: 'dark',
  preset: 'default',
  global: {
    colors: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      background: '#1F2937',
      surface: '#374151',
      text: '#F9FAFB'
    },
    typography: {
      fontFamily: 'Inter, system-ui',
      fontSize: {
        base: '16px',
        scale: 1.25
      }
    },
    spacing: {
      unit: '0.25rem',
      scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
    },
    borders: {
      radius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px'
      },
      width: '1px',
      style: 'solid'
    }
  },
  components: {
    terminal: {
      inherit: false,
      background: '#000000',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      lineHeight: 1.5,
      padding: '1rem'
    },
    voiceIndicator: {
      inherit: true,
      overrides: {
        activeColor: '#10B981',
        pulseAnimation: '2s ease-in-out infinite'
      }
    }
  }
};

const LARGE_THEME = {
  ...DEFAULT_THEME,
  global: {
    ...DEFAULT_THEME.global,
    colors: {
      ...DEFAULT_THEME.global.colors,
      // Add many colors to test performance with large themes
      ...Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [`color${i}`, `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`])
      )
    }
  },
  components: {
    ...DEFAULT_THEME.components,
    // Add many components to test performance
    ...Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`component${i}`, {
        inherit: true,
        overrides: {
          color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
          background: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
        }
      }])
    )
  }
};

// Performance measurement utilities
class PerformanceAnalyzer {
  constructor() {
    this.results = {};
  }

  measure(testName, iterations, testFn) {
    const measurements = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      testFn();
      const end = performance.now();
      measurements.push(end - start);
    }

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const median = measurements.sort((a, b) => a - b)[Math.floor(measurements.length / 2)];

    this.results[testName] = {
      average: avg,
      min: min,
      max: max,
      median: median,
      measurements: measurements
    };

    return this.results[testName];
  }

  async measureAsync(testName, iterations, testFn) {
    const measurements = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testFn();
      const end = performance.now();
      measurements.push(end - start);
    }

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const median = measurements.sort((a, b) => a - b)[Math.floor(measurements.length / 2)];

    this.results[testName] = {
      average: avg,
      min: min,
      max: max,
      median: median,
      measurements: measurements
    };

    return this.results[testName];
  }

  generateReport() {
    console.log('\n=== THEME PERFORMANCE ANALYSIS REPORT ===\n');
    
    for (const [testName, result] of Object.entries(this.results)) {
      console.log(`${testName}:`);
      console.log(`  Average: ${result.average.toFixed(2)}ms`);
      console.log(`  Median: ${result.median.toFixed(2)}ms`);
      console.log(`  Min: ${result.min.toFixed(2)}ms`);
      console.log(`  Max: ${result.max.toFixed(2)}ms`);
      
      // Performance assessment
      let assessment = '';
      if (result.average < 10) {
        assessment = '✅ EXCELLENT';
      } else if (result.average < 50) {
        assessment = '✅ GOOD';
      } else if (result.average < 100) {
        assessment = '⚠️ ACCEPTABLE';
      } else {
        assessment = '❌ NEEDS OPTIMIZATION';
      }
      
      console.log(`  Assessment: ${assessment}`);
      console.log('');
    }
  }
}

// Test implementations
const analyzer = new PerformanceAnalyzer();

// 1. localStorage Performance Tests
function testLocalStorageWrite() {
  const themeJson = JSON.stringify(DEFAULT_THEME);
  localStorage.setItem('voice-terminal-theme', themeJson);
}

function testLocalStorageRead() {
  const stored = localStorage.getItem('voice-terminal-theme');
  if (stored) {
    JSON.parse(stored);
  }
}

function testLargeThemeStorage() {
  const themeJson = JSON.stringify(LARGE_THEME);
  localStorage.setItem('voice-terminal-theme', themeJson);
}

// 2. Theme Validation Performance
function validateThemeStructure(theme) {
  // Simplified validation logic
  const requiredKeys = ['mode', 'preset', 'global', 'components'];
  const isValid = requiredKeys.every(key => key in theme);
  
  if (!isValid) return { isValid: false };
  
  // Check colors
  const colors = theme.global?.colors;
  if (!colors || typeof colors !== 'object') return { isValid: false };
  
  // Check components
  const components = theme.components;
  if (!components || typeof components !== 'object') return { isValid: false };
  
  return { isValid: true };
}

function testThemeValidation() {
  validateThemeStructure(DEFAULT_THEME);
}

function testLargeThemeValidation() {
  validateThemeStructure(LARGE_THEME);
}

// 3. CSS Variable Generation Performance
function formatCSSValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function objectToCSSVariables(obj, prefix = '--theme') {
  const variables = [];
  
  function traverse(current, path) {
    for (const [key, value] of Object.entries(current)) {
      const variableName = `${prefix}-${path}${key}`.replace(/([A-Z])/g, '-$1').toLowerCase();
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value, `${path}${key}-`);
      } else {
        variables.push(`  ${variableName}: ${formatCSSValue(value)};`);
      }
    }
  }
  
  traverse(obj, '');
  return variables.join('\n');
}

function generateThemeCSS(theme) {
  const globalVars = objectToCSSVariables(theme.global, '--theme');
  const modeVar = `  --theme-mode: ${theme.mode};`;
  const presetVar = `  --theme-preset: ${theme.preset};`;
  
  const globalCSS = `:root {\n${modeVar}\n${presetVar}\n${globalVars}\n}`;
  
  // Generate component CSS
  const componentRules = [];
  for (const [componentName, config] of Object.entries(theme.components)) {
    if (config.inherit && config.overrides) {
      const overrideVars = objectToCSSVariables(config.overrides, `--${componentName}`);
      componentRules.push(`.${componentName} {\n${overrideVars}\n}`);
    } else {
      const componentVars = objectToCSSVariables(config, `--${componentName}`);
      componentRules.push(`.${componentName} {\n${componentVars}\n}`);
    }
  }
  
  return `${globalCSS}\n\n${componentRules.join('\n\n')}`;
}

function testCSSGeneration() {
  generateThemeCSS(DEFAULT_THEME);
}

function testLargeCSSGeneration() {
  generateThemeCSS(LARGE_THEME);
}

// 4. Theme Switching Simulation
function simulateThemeSwitch(fromTheme, toTheme) {
  // Simulate the full theme switch process
  validateThemeStructure(toTheme);
  generateThemeCSS(toTheme);
  localStorage.setItem('voice-terminal-theme', JSON.stringify(toTheme));
}

function testThemeSwitch() {
  const oceanTheme = {
    ...DEFAULT_THEME,
    preset: 'ocean',
    global: {
      ...DEFAULT_THEME.global,
      colors: {
        ...DEFAULT_THEME.global.colors,
        primary: '#0EA5E9',
        background: '#0F172A'
      }
    }
  };
  
  simulateThemeSwitch(DEFAULT_THEME, oceanTheme);
}

// 5. Memory Usage Simulation
function testMemoryUsage() {
  const themes = [];
  
  // Create multiple theme variations
  for (let i = 0; i < 100; i++) {
    const theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
    theme.global.colors.primary = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    themes.push(theme);
  }
  
  // Simulate switching between them
  themes.forEach(theme => {
    generateThemeCSS(theme);
  });
  
  // Clean up (simulate garbage collection)
  themes.length = 0;
}

// 6. Cross-tab sync simulation
function testCrossTabSync() {
  const newTheme = {
    ...DEFAULT_THEME,
    global: {
      ...DEFAULT_THEME.global,
      colors: {
        ...DEFAULT_THEME.global.colors,
        primary: '#FF6B35'
      }
    }
  };
  
  // Simulate storage event processing
  localStorage.setItem('voice-terminal-theme', JSON.stringify(newTheme));
  const stored = localStorage.getItem('voice-terminal-theme');
  if (stored) {
    const parsedTheme = JSON.parse(stored);
    validateThemeStructure(parsedTheme);
    generateThemeCSS(parsedTheme);
  }
}

// Run all performance tests
async function runPerformanceAnalysis() {
  console.log('Starting theme performance analysis...\n');

  // 1. localStorage Performance
  console.log('Testing localStorage performance...');
  analyzer.measure('localStorage Write (Default Theme)', 1000, testLocalStorageWrite);
  analyzer.measure('localStorage Read (Default Theme)', 1000, testLocalStorageRead);
  analyzer.measure('localStorage Write (Large Theme)', 100, testLargeThemeStorage);

  // 2. Theme Validation Performance
  console.log('Testing theme validation performance...');
  analyzer.measure('Theme Validation (Default)', 1000, testThemeValidation);
  analyzer.measure('Theme Validation (Large)', 100, testLargeThemeValidation);

  // 3. CSS Generation Performance
  console.log('Testing CSS generation performance...');
  analyzer.measure('CSS Generation (Default Theme)', 1000, testCSSGeneration);
  analyzer.measure('CSS Generation (Large Theme)', 100, testLargeCSSGeneration);

  // 4. Theme Switching Performance
  console.log('Testing theme switching performance...');
  analyzer.measure('Complete Theme Switch', 1000, testThemeSwitch);

  // 5. Memory Usage Simulation
  console.log('Testing memory usage patterns...');
  analyzer.measure('Memory Usage Simulation', 10, testMemoryUsage);

  // 6. Cross-tab Sync Performance
  console.log('Testing cross-tab sync performance...');
  analyzer.measure('Cross-tab Sync Simulation', 1000, testCrossTabSync);

  // Generate comprehensive report
  analyzer.generateReport();
  
  // Performance recommendations
  generateRecommendations();
}

function generateRecommendations() {
  console.log('=== PERFORMANCE RECOMMENDATIONS ===\n');

  const results = analyzer.results;

  // Analyze localStorage performance
  const storageWrite = results['localStorage Write (Default Theme)'];
  const storageRead = results['localStorage Read (Default Theme)'];
  
  if (storageWrite?.average > 5) {
    console.log('❌ localStorage Write Performance Issue:');
    console.log(`   Average write time: ${storageWrite.average.toFixed(2)}ms`);
    console.log('   Recommendation: Consider debouncing theme saves or using incremental updates\n');
  } else {
    console.log('✅ localStorage write performance is optimal\n');
  }

  // Analyze CSS generation performance
  const cssGenDefault = results['CSS Generation (Default Theme)'];
  const cssGenLarge = results['CSS Generation (Large Theme)'];
  
  if (cssGenDefault?.average > 10) {
    console.log('❌ CSS Generation Performance Issue:');
    console.log(`   Average generation time: ${cssGenDefault.average.toFixed(2)}ms`);
    console.log('   Recommendation: Optimize CSS variable generation algorithm\n');
  }

  if (cssGenLarge?.average > 100) {
    console.log('⚠️ Large Theme CSS Generation:');
    console.log(`   Large theme generation time: ${cssGenLarge.average.toFixed(2)}ms`);
    console.log('   Recommendation: Consider lazy CSS generation or caching\n');
  }

  // Analyze theme switching performance
  const themeSwitch = results['Complete Theme Switch'];
  
  if (themeSwitch?.average > 100) {
    console.log('❌ Theme Switch Too Slow:');
    console.log(`   Average switch time: ${themeSwitch.average.toFixed(2)}ms (Target: <100ms)`);
    console.log('   Recommendations:');
    console.log('   - Implement CSS variable caching');
    console.log('   - Use requestAnimationFrame for DOM updates');
    console.log('   - Consider theme preloading\n');
  } else if (themeSwitch?.average > 50) {
    console.log('⚠️ Theme Switch Performance Warning:');
    console.log(`   Average switch time: ${themeSwitch.average.toFixed(2)}ms`);
    console.log('   Recommendation: Consider optimizations for sub-50ms performance\n');
  } else {
    console.log('✅ Theme switching performance meets target (<100ms)\n');
  }

  // General optimization opportunities
  console.log('=== OPTIMIZATION OPPORTUNITIES ===\n');
  
  console.log('1. **CSS Variable Caching**:');
  console.log('   - Cache generated CSS strings to avoid regeneration');
  console.log('   - Use theme fingerprinting for cache invalidation\n');
  
  console.log('2. **Batch DOM Updates**:');
  console.log('   - Group CSS variable updates into single DOM operation');
  console.log('   - Use DocumentFragment for multiple element updates\n');
  
  console.log('3. **Lazy Loading**:');
  console.log('   - Generate component-specific CSS only when needed');
  console.log('   - Defer non-critical theme properties\n');
  
  console.log('4. **Storage Optimization**:');
  console.log('   - Store only theme differences from default');
  console.log('   - Implement theme compression for large configurations\n');
  
  console.log('5. **Event Debouncing**:');
  console.log('   - Debounce rapid theme changes to prevent thrashing');
  console.log('   - Use requestIdleCallback for non-urgent updates\n');
}

// Run the analysis
runPerformanceAnalysis().catch(console.error);
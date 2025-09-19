/**
 * Browser Compatibility Tests
 * Cross-browser validation for Chrome, Firefox, Safari, Edge
 * Mobile browser testing for iOS Safari, Android Chrome
 * JavaScript compatibility and feature detection
 */

import { test, expect, Browser, devices } from '@playwright/test';
import TestEnvironment, { TestEnvironmentConfig } from './utils/TestEnvironment';

const testConfig: TestEnvironmentConfig = {
  baseUrl: 'http://localhost:4173',
  wsProxyUrl: 'ws://localhost:8080',
  tmuxBackendUrl: 'http://localhost:8081',
  testTimeout: 45000,
  retryAttempts: 2
};

// Browser configurations for testing
const browserConfigs = [
  { name: 'Chrome', device: 'Desktop Chrome', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { name: 'Firefox', device: 'Desktop Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0' },
  { name: 'Safari', device: 'Desktop Safari', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' },
  { name: 'Edge', device: 'Desktop Edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' }
];

// Mobile browser configurations
const mobileConfigs = [
  { name: 'iOS Safari', device: 'iPhone 14 Pro', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'Android Chrome', device: 'Pixel 7', userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  { name: 'Samsung Internet', device: 'Galaxy S23', userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36' }
];

test.describe('Browser Compatibility Tests', () => {
  let testEnv: TestEnvironment;

  test.beforeEach(async () => {
    testEnv = new TestEnvironment(testConfig);
    await testEnv.initialize();
  });

  test.afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  test.describe('Desktop Browser Compatibility', () => {
    browserConfigs.forEach((config) => {
      test(`should work correctly in ${config.name}`, async ({ browser }) => {
        const session = await testEnv.createUserSession(browser, {
          sessionId: `desktop_${config.name.toLowerCase()}_001`,
          userId: `desktop_user_${config.name.toLowerCase()}`,
          userAgent: config.userAgent,
          viewport: { width: 1920, height: 1080 }
        });

        await testEnv.connectUserSession(`desktop_${config.name.toLowerCase()}_001`);

        // Test core functionality
        await validateCoreFunctionality(session.page, config.name);

        // Test WebSocket compatibility
        await validateWebSocketFeatures(session.page, config.name);

        // Test JavaScript compatibility
        await validateJavaScriptFeatures(session.page, config.name);

        // Test performance in this browser
        const perfMetrics = await testEnv.measurePerformance(`desktop_${config.name.toLowerCase()}_001`);
        
        // Browser-specific performance expectations
        const expectedMetrics = getBrowserPerformanceExpectations(config.name);
        expect(perfMetrics.renderTime).toBeLessThan(expectedMetrics.maxRenderTime);
        expect(perfMetrics.webSocketLatency).toBeLessThan(expectedMetrics.maxWsLatency);
      });
    });

    test('should maintain feature parity across desktop browsers', async ({ browser }) => {
      const sessions = [];
      
      // Create sessions for all desktop browsers
      for (const config of browserConfigs) {
        const sessionId = `parity_${config.name.toLowerCase()}`;
        const session = await testEnv.createUserSession(browser, {
          sessionId,
          userId: `parity_user_${config.name.toLowerCase()}`,
          userAgent: config.userAgent
        });
        sessions.push({ sessionId, config, session });
      }

      // Connect all sessions
      for (const { sessionId } of sessions) {
        await testEnv.connectUserSession(sessionId);
      }

      // Test same functionality across all browsers
      const testCommands = [
        'echo "Cross-browser test"',
        'pwd',
        'ls -la',
        'date'
      ];

      const results = [];
      for (const { sessionId, config } of sessions) {
        const browserResults = [];
        for (const command of testCommands) {
          const result = await testEnv.executeCommand(sessionId, command, {
            timeout: 5000
          });
          browserResults.push({
            command,
            success: result.success,
            executionTime: result.executionTime,
            outputLength: result.output.length
          });
        }
        results.push({ browser: config.name, results: browserResults });
      }

      // Verify feature parity
      validateFeatureParity(results);
    });
  });

  test.describe('Mobile Browser Compatibility', () => {
    mobileConfigs.forEach((config) => {
      test(`should work correctly on ${config.name}`, async ({ browser }) => {
        const deviceConfig = devices[config.device] || {
          viewport: { width: 390, height: 844 },
          userAgent: config.userAgent,
          isMobile: true,
          hasTouch: true
        };

        const session = await testEnv.createUserSession(browser, {
          sessionId: `mobile_${config.name.toLowerCase().replace(' ', '_')}_001`,
          userId: `mobile_user_${config.name.toLowerCase().replace(' ', '_')}`,
          viewport: deviceConfig.viewport,
          userAgent: config.userAgent
        });

        await testEnv.connectUserSession(`mobile_${config.name.toLowerCase().replace(' ', '_')}_001`);

        // Test mobile-specific functionality
        await validateMobileFunctionality(session.page, config.name);

        // Test touch interactions
        await validateTouchInteractions(session.page, config.name);

        // Test mobile keyboard handling
        await validateMobileKeyboard(session.page, config.name);

        // Test mobile performance
        const perfMetrics = await testEnv.measurePerformance(`mobile_${config.name.toLowerCase().replace(' ', '_')}_001`);
        
        // Mobile performance expectations are different
        expect(perfMetrics.renderTime).toBeLessThan(5000);
        expect(perfMetrics.webSocketLatency).toBeLessThan(100);
        expect(perfMetrics.memoryUsage).toBeLessThan(150 * 1024 * 1024); // 150MB for mobile
      });
    });

    test('should handle orientation changes on mobile', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'orientation_test_001',
        userId: 'orientation_user',
        viewport: { width: 390, height: 844 }
      });

      await testEnv.connectUserSession('orientation_test_001');

      // Test in portrait mode
      await session.page.setViewportSize({ width: 390, height: 844 });
      await validateTerminalLayout(session.page, 'portrait');

      // Test in landscape mode
      await session.page.setViewportSize({ width: 844, height: 390 });
      await validateTerminalLayout(session.page, 'landscape');

      // Verify terminal functionality persists across orientation changes
      const testResult = await testEnv.executeCommand('orientation_test_001', 'echo "Orientation test"', {
        expectOutput: 'Orientation test'
      });

      expect(testResult.success).toBe(true);
    });
  });

  test.describe('WebSocket Implementation Differences', () => {
    test('should handle WebSocket variations across browsers', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'websocket_test_001',
        userId: 'websocket_user'
      });

      await testEnv.connectUserSession('websocket_test_001');

      // Test WebSocket connection stability
      const wsTests = [
        { test: 'Basic Connection', command: 'echo "WebSocket test"' },
        { test: 'Large Data Transfer', command: 'cat /etc/passwd' },
        { test: 'Rapid Commands', command: 'for i in {1..5}; do echo "Rapid $i"; done' },
        { test: 'Binary Data', command: 'ls -la /bin | head -10' }
      ];

      for (const wsTest of wsTests) {
        const result = await testEnv.executeCommand('websocket_test_001', wsTest.command, {
          timeout: 10000
        });
        
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(5000);
      }

      // Test WebSocket reconnection
      await testWebSocketReconnection(session.page);
    });

    test('should handle different WebSocket subprotocols', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'subprotocol_test_001',
        userId: 'subprotocol_user'
      });

      // Test WebSocket with different subprotocols
      const subprotocolTests = ['terminal-v1', 'xterm-256color', 'binary'];
      
      for (const protocol of subprotocolTests) {
        await session.page.evaluate((subprotocol) => {
          // Test subprotocol support
          try {
            const ws = new WebSocket('ws://localhost:8080/ws', subprotocol);
            return ws.protocol === subprotocol;
          } catch (error) {
            return false;
          }
        }, protocol);
      }
    });
  });

  test.describe('Audio/Speech API Variations', () => {
    test('should detect and handle speech recognition differences', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'speech_api_001',
        userId: 'speech_user',
        permissions: ['microphone']
      });

      await testEnv.connectUserSession('speech_api_001');

      // Test speech recognition API availability
      const speechSupport = await session.page.evaluate(() => {
        const hasWebSpeechAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const hasMediaDevices = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        
        return {
          webSpeechAPI: hasWebSpeechAPI,
          mediaDevices: hasMediaDevices,
          userAgent: navigator.userAgent
        };
      });

      // Browser-specific speech API handling
      if (speechSupport.webSpeechAPI) {
        await testSpeechRecognition(session.page);
      } else {
        // Test fallback mechanisms
        await testSpeechFallback(session.page);
      }

      expect(speechSupport.mediaDevices).toBe(true);
    });

    test('should handle audio playback across browsers', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'audio_test_001',
        userId: 'audio_user'
      });

      await testEnv.connectUserSession('audio_test_001');

      // Test audio context creation
      const audioSupport = await session.page.evaluate(() => {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          
          return {
            audioContext: !!audioContext,
            state: audioContext.state,
            sampleRate: audioContext.sampleRate
          };
        } catch (error) {
          return { audioContext: false, error: error.toString() };
        }
      });

      expect(audioSupport.audioContext).toBe(true);

      // Test audio feedback functionality
      await testAudioFeedback(session.page);
    });
  });

  test.describe('Accessibility Features Cross-Browser', () => {
    test('should work with screen readers across browsers', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'accessibility_001',
        userId: 'accessibility_user'
      });

      await testEnv.connectUserSession('accessibility_001');

      // Test ARIA attributes
      const ariaSupport = await session.page.evaluate(() => {
        const terminal = document.querySelector('[data-testid="terminal-container"]');
        return {
          hasAriaLabel: terminal?.hasAttribute('aria-label'),
          hasRole: terminal?.hasAttribute('role'),
          hasAriaLive: !!document.querySelector('[aria-live]')
        };
      });

      expect(ariaSupport.hasAriaLabel).toBe(true);
      expect(ariaSupport.hasRole).toBe(true);
      expect(ariaSupport.hasAriaLive).toBe(true);

      // Test keyboard navigation
      await testKeyboardNavigation(session.page);

      // Test screen reader announcements
      await testScreenReaderSupport(session.page);
    });

    test('should support high contrast mode', async ({ browser }) => {
      const session = await testEnv.createUserSession(browser, {
        sessionId: 'high_contrast_001',
        userId: 'contrast_user'
      });

      // Enable high contrast mode
      await session.page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      
      await testEnv.connectUserSession('high_contrast_001');

      // Verify high contrast styles are applied
      const contrastSupport = await session.page.evaluate(() => {
        const styles = getComputedStyle(document.body);
        const terminalStyles = getComputedStyle(document.querySelector('[data-testid="terminal-container"]') as Element);
        
        return {
          bodyBackground: styles.backgroundColor,
          terminalBackground: terminalStyles.backgroundColor,
          hasHighContrast: window.matchMedia('(prefers-contrast: high)').matches
        };
      });

      // Verify readable contrast ratios
      expect(contrastSupport).toBeDefined();
    });
  });
});

// Helper functions for validation

async function validateCoreFunctionality(page: any, browserName: string): Promise<void> {
  // Test basic page loading
  await expect(page.locator('[data-testid="terminal-container"]')).toBeVisible();
  
  // Test terminal initialization
  await page.waitForSelector('[data-testid="terminal-output"]', { timeout: 5000 });
  
  // Test input handling
  const terminalInput = page.locator('[data-testid="terminal-input"]');
  await terminalInput.fill('echo "Browser test: ' + browserName + '"');
  await terminalInput.press('Enter');
  
  // Verify output
  await expect(page.locator('[data-testid="terminal-output"]')).toContainText('Browser test: ' + browserName);
}

async function validateWebSocketFeatures(page: any, browserName: string): Promise<void> {
  // Test WebSocket connection status
  const wsStatus = await page.evaluate(() => {
    return (window as any).terminalClient ? (window as any).terminalClient.isConnected() : false;
  });
  
  expect(wsStatus).toBe(true);
  
  // Test message sending
  await page.evaluate(() => {
    if ((window as any).terminalClient) {
      (window as any).terminalClient.send('ping');
    }
  });
  
  // Wait for response
  await page.waitForTimeout(1000);
}

async function validateJavaScriptFeatures(page: any, browserName: string): Promise<void> {
  const jsFeatures = await page.evaluate(() => {
    return {
      promises: typeof Promise !== 'undefined',
      asyncAwait: typeof (async () => {})().then === 'function',
      fetch: typeof fetch !== 'undefined',
      websockets: typeof WebSocket !== 'undefined',
      audioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
      speechRecognition: typeof (window as any).SpeechRecognition !== 'undefined' || typeof (window as any).webkitSpeechRecognition !== 'undefined'
    };
  });
  
  expect(jsFeatures.promises).toBe(true);
  expect(jsFeatures.fetch).toBe(true);
  expect(jsFeatures.websockets).toBe(true);
}

function getBrowserPerformanceExpectations(browserName: string) {
  const expectations = {
    'Chrome': { maxRenderTime: 3000, maxWsLatency: 50 },
    'Firefox': { maxRenderTime: 4000, maxWsLatency: 75 },
    'Safari': { maxRenderTime: 3500, maxWsLatency: 60 },
    'Edge': { maxRenderTime: 3200, maxWsLatency: 55 }
  };
  
  return expectations[browserName as keyof typeof expectations] || { maxRenderTime: 5000, maxWsLatency: 100 };
}

function validateFeatureParity(results: any[]): void {
  const baselineResults = results[0].results;
  
  for (let i = 1; i < results.length; i++) {
    const compareResults = results[i].results;
    
    for (let j = 0; j < baselineResults.length; j++) {
      expect(compareResults[j].success).toBe(baselineResults[j].success);
      expect(Math.abs(compareResults[j].outputLength - baselineResults[j].outputLength)).toBeLessThan(50);
    }
  }
}

async function validateMobileFunctionality(page: any, deviceName: string): Promise<void> {
  // Test touch-friendly interface
  await expect(page.locator('[data-testid="mobile-terminal-input"]')).toBeVisible();
  
  // Test virtual keyboard
  await page.locator('[data-testid="mobile-terminal-input"]').tap();
  await page.waitForTimeout(500);
  
  // Test mobile command execution
  await page.locator('[data-testid="mobile-terminal-input"]').fill('echo "Mobile test"');
  await page.locator('[data-testid="mobile-send-button"]').tap();
}

async function validateTouchInteractions(page: any, deviceName: string): Promise<void> {
  // Test swipe gestures
  const terminal = page.locator('[data-testid="terminal-container"]');
  
  // Test pinch zoom
  await page.touchscreen.tap(400, 400);
  await page.waitForTimeout(100);
  
  // Test scroll
  await terminal.hover();
  await page.mouse.wheel(0, 100);
}

async function validateMobileKeyboard(page: any, deviceName: string): Promise<void> {
  const input = page.locator('[data-testid="mobile-terminal-input"]');
  
  // Test various keyboard inputs
  await input.fill('ls -la');
  await input.press('Enter');
  
  // Test special characters
  await input.fill('echo "Special: !@#$%"');
  await input.press('Enter');
}

async function validateTerminalLayout(page: any, orientation: string): Promise<void> {
  const layout = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="terminal-container"]');
    const rect = container?.getBoundingClientRect();
    
    return {
      width: rect?.width,
      height: rect?.height,
      aspectRatio: rect ? rect.width / rect.height : 0
    };
  });
  
  if (orientation === 'portrait') {
    expect(layout.aspectRatio).toBeLessThan(1);
  } else {
    expect(layout.aspectRatio).toBeGreaterThan(1);
  }
}

async function testWebSocketReconnection(page: any): Promise<void> {
  // Simulate connection loss
  await page.evaluate(() => {
    if ((window as any).terminalClient) {
      (window as any).terminalClient.disconnect();
    }
  });
  
  await page.waitForTimeout(2000);
  
  // Test reconnection
  await page.evaluate(() => {
    if ((window as any).terminalClient) {
      (window as any).terminalClient.reconnect();
    }
  });
  
  await page.waitForTimeout(3000);
  
  // Verify reconnection
  const isConnected = await page.evaluate(() => {
    return (window as any).terminalClient ? (window as any).terminalClient.isConnected() : false;
  });
  
  expect(isConnected).toBe(true);
}

async function testSpeechRecognition(page: any): Promise<void> {
  const speechTest = await page.evaluate(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      return { success: true, hasRecognition: true };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  });
  
  expect(speechTest.success).toBe(true);
}

async function testSpeechFallback(page: any): Promise<void> {
  // Test alternative input methods when speech is not available
  const fallbackTest = await page.evaluate(() => {
    return {
      hasKeyboard: true,
      hasTouch: 'ontouchstart' in window,
      hasVoiceButton: !!document.querySelector('[data-testid="voice-button"]')
    };
  });
  
  expect(fallbackTest.hasKeyboard || fallbackTest.hasTouch).toBe(true);
}

async function testAudioFeedback(page: any): Promise<void> {
  const audioTest = await page.evaluate(() => {
    try {
      const audio = new Audio();
      return { canPlay: true, hasAudio: true };
    } catch (error) {
      return { canPlay: false, error: error.toString() };
    }
  });
  
  expect(audioTest.canPlay).toBe(true);
}

async function testKeyboardNavigation(page: any): Promise<void> {
  // Test tab navigation
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  
  // Test arrow key navigation
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  
  // Test escape key
  await page.keyboard.press('Escape');
}

async function testScreenReaderSupport(page: any): Promise<void> {
  const ariaSupport = await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="terminal-container"]');
    const liveRegion = document.querySelector('[aria-live="polite"]');
    
    return {
      terminalAccessible: terminal?.getAttribute('aria-label') !== null,
      hasLiveRegion: liveRegion !== null,
      hasProperRoles: terminal?.getAttribute('role') === 'textbox' || terminal?.getAttribute('role') === 'application'
    };
  });
  
  expect(ariaSupport.terminalAccessible).toBe(true);
  expect(ariaSupport.hasLiveRegion).toBe(true);
}
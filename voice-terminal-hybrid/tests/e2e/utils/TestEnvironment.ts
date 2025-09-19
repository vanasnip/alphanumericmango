/**
 * Test Environment Management for E2E System Validation
 * Handles test setup, teardown, and environment state management
 */

import { Page, Browser, BrowserContext } from '@playwright/test';
import { TmuxSessionManager } from '../../../src/lib/tmux/TmuxSessionManager';
import { TerminalWebSocketClient } from '../../../src/lib/websocket/TerminalWebSocketClient';

export interface TestEnvironmentConfig {
  baseUrl: string;
  wsProxyUrl: string;
  tmuxBackendUrl: string;
  testTimeout: number;
  retryAttempts: number;
  networkConditions?: {
    offline: boolean;
    downloadThroughput: number;
    uploadThroughput: number;
    latency: number;
  };
}

export interface UserSession {
  sessionId: string;
  userId: string;
  tmuxSession: string;
  websocketClient: TerminalWebSocketClient | null;
  page: Page;
  context: BrowserContext;
}

export class TestEnvironment {
  private config: TestEnvironmentConfig;
  private activeSessions: Map<string, UserSession> = new Map();
  private tmuxManager: TmuxSessionManager | null = null;
  private testId: string;

  constructor(config: TestEnvironmentConfig) {
    this.config = config;
    this.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize test environment with backend services
   */
  async initialize(): Promise<void> {
    try {
      // Initialize TmuxSessionManager for backend operations
      this.tmuxManager = new TmuxSessionManager({
        maxSessions: 10,
        sessionTimeout: 300000, // 5 minutes
        cleanupInterval: 60000,  // 1 minute
        enableSecurity: true,
        enableLogging: true,
        logLevel: 'debug'
      });

      await this.tmuxManager.initialize();
      
      console.log(`Test environment ${this.testId} initialized successfully`);
    } catch (error) {
      throw new Error(`Failed to initialize test environment: ${error}`);
    }
  }

  /**
   * Create a new user session for testing
   */
  async createUserSession(
    browser: Browser, 
    sessionConfig: {
      sessionId: string;
      userId: string;
      viewport?: { width: number; height: number };
      userAgent?: string;
      permissions?: string[];
    }
  ): Promise<UserSession> {
    const context = await browser.newContext({
      viewport: sessionConfig.viewport || { width: 1280, height: 720 },
      userAgent: sessionConfig.userAgent,
      permissions: sessionConfig.permissions || ['microphone']
    });

    const page = await context.newPage();
    
    // Create tmux session for this user
    const tmuxSessionId = await this.createTmuxSession(sessionConfig.userId);
    
    const userSession: UserSession = {
      sessionId: sessionConfig.sessionId,
      userId: sessionConfig.userId,
      tmuxSession: tmuxSessionId,
      websocketClient: null,
      page,
      context
    };

    this.activeSessions.set(sessionConfig.sessionId, userSession);
    
    return userSession;
  }

  /**
   * Navigate user session to application and establish WebSocket connection
   */
  async connectUserSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Navigate to application
    await session.page.goto(this.config.baseUrl);
    
    // Wait for application to load
    await session.page.waitForSelector('[data-testid="terminal-container"]', {
      timeout: 10000
    });

    // Establish WebSocket connection
    session.websocketClient = await this.establishWebSocketConnection(
      session.page,
      session.tmuxSession
    );
  }

  /**
   * Execute terminal command in user session
   */
  async executeCommand(
    sessionId: string, 
    command: string, 
    options: {
      timeout?: number;
      expectOutput?: string;
      expectError?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    output: string;
    error?: string;
    executionTime: number;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.websocketClient) {
      throw new Error(`Session ${sessionId} not connected`);
    }

    const startTime = Date.now();
    
    try {
      // Send command through WebSocket
      await session.websocketClient.sendCommand(command);
      
      // Wait for command completion
      const result = await this.waitForCommandCompletion(
        session,
        options.timeout || 5000,
        options.expectOutput
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: !options.expectError,
        output: result.output,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (options.expectError) {
        return {
          success: true,
          output: '',
          error: error.toString(),
          executionTime
        };
      }
      
      return {
        success: false,
        output: '',
        error: error.toString(),
        executionTime
      };
    }
  }

  /**
   * Simulate network conditions for testing resilience
   */
  async simulateNetworkConditions(
    sessionId: string,
    conditions: {
      offline?: boolean;
      downloadThroughput?: number;
      uploadThroughput?: number;
      latency?: number;
    }
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const cdpSession = await session.context.newCDPSession(session.page);
    
    if (conditions.offline) {
      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
      });
    } else {
      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: conditions.downloadThroughput || -1,
        uploadThroughput: conditions.uploadThroughput || -1,
        latency: conditions.latency || 0
      });
    }
  }

  /**
   * Measure performance metrics for a user session
   */
  async measurePerformance(sessionId: string): Promise<{
    renderTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    webSocketLatency: number;
    memoryUsage: number;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const performanceMetrics = await session.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        renderTime: navigation.loadEventEnd - navigation.fetchStart,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: paint.find(p => p.name === 'largest-contentful-paint')?.startTime || 0
      };
    });

    // Measure WebSocket latency
    const wsLatency = await this.measureWebSocketLatency(session);
    
    // Get memory usage
    const memoryInfo = await session.page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : { usedJSHeapSize: 0, totalJSHeapSize: 0 };
    });

    return {
      ...performanceMetrics,
      webSocketLatency: wsLatency,
      memoryUsage: memoryInfo.usedJSHeapSize
    };
  }

  /**
   * Clean up user session
   */
  async cleanupUserSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Close WebSocket connection
      if (session.websocketClient) {
        await session.websocketClient.close();
      }

      // Clean up tmux session
      if (this.tmuxManager) {
        await this.tmuxManager.destroySession(session.tmuxSession);
      }

      // Close browser context
      await session.context.close();

      this.activeSessions.delete(sessionId);
    } catch (error) {
      console.error(`Error cleaning up session ${sessionId}:`, error);
    }
  }

  /**
   * Clean up entire test environment
   */
  async cleanup(): Promise<void> {
    // Clean up all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      await this.cleanupUserSession(sessionId);
    }

    // Clean up tmux manager
    if (this.tmuxManager) {
      await this.tmuxManager.cleanup();
    }

    console.log(`Test environment ${this.testId} cleaned up successfully`);
  }

  /**
   * Get current system metrics for monitoring
   */
  async getSystemMetrics(): Promise<{
    activeSessions: number;
    tmuxSessions: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    const activeSessions = this.activeSessions.size;
    const tmuxSessions = this.tmuxManager ? await this.tmuxManager.getSessionCount() : 0;
    
    // Get system metrics (simplified for this example)
    const memoryUsage = process.memoryUsage().heapUsed;
    const cpuUsage = process.cpuUsage().user;

    return {
      activeSessions,
      tmuxSessions,
      memoryUsage,
      cpuUsage
    };
  }

  // Private helper methods

  private async createTmuxSession(userId: string): Promise<string> {
    if (!this.tmuxManager) {
      throw new Error('TmuxSessionManager not initialized');
    }

    const sessionId = await this.tmuxManager.createSession({
      sessionId: `${this.testId}_${userId}`,
      userId,
      command: '/bin/bash',
      cwd: '/tmp',
      env: { TEST_MODE: 'true' }
    });

    return sessionId;
  }

  private async establishWebSocketConnection(
    page: Page,
    tmuxSessionId: string
  ): Promise<TerminalWebSocketClient> {
    // Inject WebSocket client setup into page
    const wsClient = await page.evaluateHandle((sessionId) => {
      return new (window as any).TerminalWebSocketClient({
        url: 'ws://localhost:8080/ws',
        sessionId: sessionId,
        autoReconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 5
      });
    }, tmuxSessionId);

    // Wait for connection to be established
    await page.waitForFunction(() => {
      return (window as any).terminalClient && (window as any).terminalClient.isConnected();
    }, { timeout: 10000 });

    return wsClient.asElement() as any;
  }

  private async waitForCommandCompletion(
    session: UserSession,
    timeout: number,
    expectedOutput?: string
  ): Promise<{ output: string }> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Command execution timeout'));
          return;
        }

        try {
          const output = await session.page.evaluate(() => {
            const terminal = document.querySelector('[data-testid="terminal-output"]');
            return terminal ? terminal.textContent || '' : '';
          });

          if (expectedOutput && output.includes(expectedOutput)) {
            clearInterval(checkInterval);
            resolve({ output });
          } else if (!expectedOutput && output.trim().length > 0) {
            clearInterval(checkInterval);
            resolve({ output });
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 100);
    });
  }

  private async measureWebSocketLatency(session: UserSession): Promise<number> {
    const startTime = Date.now();
    
    // Send ping command and measure response time
    await session.page.evaluate(() => {
      if ((window as any).terminalClient) {
        (window as any).terminalClient.ping();
      }
    });

    // Wait for pong response
    await session.page.waitForFunction(() => {
      return (window as any).terminalClient && (window as any).terminalClient.lastPongTime > 0;
    }, { timeout: 5000 });

    return Date.now() - startTime;
  }
}

export default TestEnvironment;
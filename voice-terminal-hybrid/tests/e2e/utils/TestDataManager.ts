/**
 * Test Data Manager
 * Manages test data generation, cleanup, and state management
 */

import { randomBytes } from 'crypto';

export interface TestUser {
  id: string;
  username: string;
  role: 'admin' | 'developer' | 'readonly' | 'guest';
  permissions: string[];
  sessionData?: Record<string, any>;
}

export interface TestSession {
  sessionId: string;
  userId: string;
  tmuxSessionId: string;
  createdAt: Date;
  lastActivity: Date;
  state: 'active' | 'idle' | 'disconnected' | 'terminated';
  workingDirectory: string;
  environment: Record<string, string>;
  commandHistory: string[];
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  users: TestUser[];
  sessions: TestSession[];
  expectedOutcomes: TestOutcome[];
  cleanup: CleanupAction[];
}

export interface TestOutcome {
  type: 'command_output' | 'file_exists' | 'state_change' | 'performance_metric';
  expected: any;
  actual?: any;
  tolerance?: number; // For numeric comparisons
}

export interface CleanupAction {
  type: 'delete_file' | 'kill_process' | 'reset_environment' | 'clear_session';
  target: string;
  options?: Record<string, any>;
}

export class TestDataManager {
  private users: Map<string, TestUser> = new Map();
  private sessions: Map<string, TestSession> = new Map();
  private scenarios: Map<string, TestScenario> = new Map();
  private tempFiles: Set<string> = new Set();
  private tempDirectories: Set<string> = new Set();

  constructor() {
    this.initializeDefaultUsers();
  }

  /**
   * Create a test user with specified role and permissions
   */
  createTestUser(
    role: TestUser['role'] = 'developer',
    customPermissions?: string[]
  ): TestUser {
    const userId = this.generateId('user');
    const permissions = customPermissions || this.getDefaultPermissions(role);
    
    const user: TestUser = {
      id: userId,
      username: `test_${role}_${userId.slice(-8)}`,
      role,
      permissions,
      sessionData: {}
    };

    this.users.set(userId, user);
    return user;
  }

  /**
   * Create a test session for a user
   */
  createTestSession(userId: string, options: {
    workingDirectory?: string;
    environment?: Record<string, string>;
    tmuxSessionName?: string;
  } = {}): TestSession {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const sessionId = this.generateId('session');
    const tmuxSessionId = options.tmuxSessionName || `tmux_${sessionId.slice(-8)}`;

    const session: TestSession = {
      sessionId,
      userId,
      tmuxSessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      state: 'active',
      workingDirectory: options.workingDirectory || '/tmp',
      environment: {
        USER: user.username,
        HOME: `/home/${user.username}`,
        SHELL: '/bin/bash',
        TERM: 'xterm-256color',
        ...options.environment
      },
      commandHistory: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Generate test data for various scenarios
   */
  generateTestFiles(count: number = 5): Array<{ path: string; content: string; size: number }> {
    const files = [];
    
    for (let i = 0; i < count; i++) {
      const filename = `test_file_${i}_${Date.now()}.txt`;
      const path = `/tmp/${filename}`;
      const content = this.generateTestContent(Math.random() * 1000 + 100);
      
      files.push({
        path,
        content,
        size: content.length
      });
      
      this.tempFiles.add(path);
    }
    
    return files;
  }

  /**
   * Generate test content of specified size
   */
  generateTestContent(sizeBytes: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n ';
    let content = '';
    
    for (let i = 0; i < sizeBytes; i++) {
      content += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return content;
  }

  /**
   * Create test scenarios for complex multi-user testing
   */
  createTestScenario(name: string, description: string): TestScenario {
    const scenarioId = this.generateId('scenario');
    
    const scenario: TestScenario = {
      id: scenarioId,
      name,
      description,
      users: [],
      sessions: [],
      expectedOutcomes: [],
      cleanup: []
    };
    
    this.scenarios.set(scenarioId, scenario);
    return scenario;
  }

  /**
   * Add user to test scenario
   */
  addUserToScenario(scenarioId: string, user: TestUser): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    
    scenario.users.push(user);
  }

  /**
   * Add session to test scenario
   */
  addSessionToScenario(scenarioId: string, session: TestSession): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    
    scenario.sessions.push(session);
  }

  /**
   * Generate concurrent user scenario
   */
  generateConcurrentUserScenario(userCount: number): TestScenario {
    const scenario = this.createTestScenario(
      `Concurrent ${userCount} Users`,
      `Test scenario with ${userCount} concurrent users performing various operations`
    );

    // Create users with different roles
    const roles: TestUser['role'][] = ['admin', 'developer', 'readonly'];
    
    for (let i = 0; i < userCount; i++) {
      const role = roles[i % roles.length];
      const user = this.createTestUser(role);
      this.addUserToScenario(scenario.id, user);

      // Create session for each user
      const session = this.createTestSession(user.id, {
        workingDirectory: `/tmp/user_${i}`,
        environment: {
          USER_INDEX: i.toString(),
          CONCURRENT_TEST: 'true'
        }
      });
      this.addSessionToScenario(scenario.id, session);
    }

    // Add expected outcomes
    scenario.expectedOutcomes = [
      {
        type: 'performance_metric',
        expected: { maxLatency: 3000, avgLatency: 1000 }
      },
      {
        type: 'state_change',
        expected: { allSessionsActive: true }
      }
    ];

    // Add cleanup actions
    scenario.cleanup = [
      {
        type: 'clear_session',
        target: 'all'
      },
      {
        type: 'delete_file',
        target: '/tmp/user_*'
      }
    ];

    return scenario;
  }

  /**
   * Generate load testing data
   */
  generateLoadTestData(operationsPerUser: number = 10): Array<{
    userId: string;
    operations: Array<{
      type: 'command' | 'file_operation' | 'environment_change';
      command: string;
      expectedResult?: string;
      timing?: number;
    }>;
  }> {
    const loadTestData = [];

    for (const [userId, user] of this.users) {
      const operations = [];
      
      for (let i = 0; i < operationsPerUser; i++) {
        const operationType = ['command', 'file_operation', 'environment_change'][
          Math.floor(Math.random() * 3)
        ] as 'command' | 'file_operation' | 'environment_change';

        let operation;
        
        switch (operationType) {
          case 'command':
            operation = {
              type: operationType,
              command: this.generateRandomCommand(),
              timing: Math.random() * 1000 + 500 // 500-1500ms
            };
            break;
          case 'file_operation':
            const filename = `load_test_${i}_${Date.now()}.txt`;
            operation = {
              type: operationType,
              command: `echo "Load test data ${i}" > /tmp/${filename}`,
              expectedResult: 'file_created'
            };
            this.tempFiles.add(`/tmp/${filename}`);
            break;
          case 'environment_change':
            operation = {
              type: operationType,
              command: `export LOAD_TEST_VAR_${i}="value_${i}"`,
              expectedResult: 'variable_set'
            };
            break;
        }
        
        operations.push(operation);
      }
      
      loadTestData.push({ userId, operations });
    }

    return loadTestData;
  }

  /**
   * Update session state
   */
  updateSessionState(sessionId: string, updates: Partial<TestSession>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session, updates);
    session.lastActivity = new Date();
  }

  /**
   * Record command in session history
   */
  recordCommand(sessionId: string, command: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.commandHistory.push(command);
    session.lastActivity = new Date();
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): {
    commandCount: number;
    sessionDuration: number;
    lastActivity: Date;
    state: string;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      commandCount: session.commandHistory.length,
      sessionDuration: Date.now() - session.createdAt.getTime(),
      lastActivity: session.lastActivity,
      state: session.state
    };
  }

  /**
   * Generate stress test commands
   */
  generateStressTestCommands(): string[] {
    return [
      // CPU intensive
      'for i in {1..1000}; do echo $i > /dev/null; done',
      'yes | head -10000 | wc -l',
      'find /usr -name "*.so" 2>/dev/null | head -100',
      
      // Memory intensive
      'dd if=/dev/zero of=/tmp/bigfile bs=1M count=10 2>/dev/null',
      'cat /dev/urandom | head -1000 | base64',
      
      // I/O intensive
      'ls -la /usr/bin | sort | uniq',
      'grep -r "test" /tmp 2>/dev/null || true',
      
      // Network simulation
      'ping -c 3 localhost',
      'netstat -an | head -20',
      
      // Complex operations
      'ps aux | grep -v grep | wc -l',
      'df -h | tail -n +2',
      'free -m',
      'uptime'
    ];
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    // Clear temporary files
    for (const filePath of this.tempFiles) {
      // Note: In real implementation, would use fs operations
      console.log(`Cleaning up file: ${filePath}`);
    }
    this.tempFiles.clear();

    // Clear temporary directories
    for (const dirPath of this.tempDirectories) {
      console.log(`Cleaning up directory: ${dirPath}`);
    }
    this.tempDirectories.clear();

    // Clear sessions
    this.sessions.clear();

    // Keep users for potential reuse, but clear session data
    for (const [userId, user] of this.users) {
      user.sessionData = {};
    }

    console.log('Test data cleanup completed');
  }

  /**
   * Export test data for analysis
   */
  exportTestData(): {
    users: TestUser[];
    sessions: TestSession[];
    scenarios: TestScenario[];
    tempFiles: string[];
  } {
    return {
      users: Array.from(this.users.values()),
      sessions: Array.from(this.sessions.values()),
      scenarios: Array.from(this.scenarios.values()),
      tempFiles: Array.from(this.tempFiles)
    };
  }

  // Private helper methods

  private initializeDefaultUsers(): void {
    // Create some default test users
    this.createTestUser('admin');
    this.createTestUser('developer');
    this.createTestUser('readonly');
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  private getDefaultPermissions(role: TestUser['role']): string[] {
    const permissionMap = {
      admin: ['read', 'write', 'execute', 'admin', 'microphone', 'clipboard-read', 'clipboard-write'],
      developer: ['read', 'write', 'execute', 'microphone'],
      readonly: ['read'],
      guest: ['read']
    };

    return permissionMap[role] || permissionMap.guest;
  }

  private generateRandomCommand(): string {
    const commands = [
      'echo "Random test"',
      'date',
      'pwd',
      'ls -la',
      'whoami',
      'uname -a',
      'ps aux | head -5',
      'df -h',
      'free -m',
      'uptime'
    ];

    return commands[Math.floor(Math.random() * commands.length)];
  }

  /**
   * Validate test data integrity
   */
  validateTestData(): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for orphaned sessions
    for (const [sessionId, session] of this.sessions) {
      if (!this.users.has(session.userId)) {
        issues.push(`Session ${sessionId} references non-existent user ${session.userId}`);
      }
    }

    // Check for inactive sessions
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActivity.getTime();
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        issues.push(`Session ${sessionId} has been inactive for ${Math.round(inactiveTime / 60000)} minutes`);
      }
    }

    // Check for scenarios with no users
    for (const [scenarioId, scenario] of this.scenarios) {
      if (scenario.users.length === 0) {
        issues.push(`Scenario ${scenarioId} has no users`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate test report data
   */
  generateTestReport(): {
    summary: {
      totalUsers: number;
      activeSessions: number;
      totalScenarios: number;
      tempFilesCreated: number;
    };
    usersByRole: Record<string, number>;
    sessionsByState: Record<string, number>;
    averageSessionDuration: number;
    commandsExecuted: number;
  } {
    const usersByRole: Record<string, number> = {};
    const sessionsByState: Record<string, number> = {};
    let totalSessionDuration = 0;
    let totalCommands = 0;

    // Count users by role
    for (const user of this.users.values()) {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
    }

    // Count sessions by state and calculate metrics
    for (const session of this.sessions.values()) {
      sessionsByState[session.state] = (sessionsByState[session.state] || 0) + 1;
      totalSessionDuration += Date.now() - session.createdAt.getTime();
      totalCommands += session.commandHistory.length;
    }

    return {
      summary: {
        totalUsers: this.users.size,
        activeSessions: this.sessions.size,
        totalScenarios: this.scenarios.size,
        tempFilesCreated: this.tempFiles.size
      },
      usersByRole,
      sessionsByState,
      averageSessionDuration: this.sessions.size > 0 ? totalSessionDuration / this.sessions.size : 0,
      commandsExecuted: totalCommands
    };
  }
}

export default TestDataManager;
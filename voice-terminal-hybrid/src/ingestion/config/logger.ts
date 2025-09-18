/**
 * Logger configuration for notification ingestion
 */

export interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

/**
 * Create a console logger with structured output
 */
export function createConsoleLogger(options: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeTimestamp?: boolean;
  includeMeta?: boolean;
  colorize?: boolean;
} = {}): Logger {
  const {
    level = 'info',
    includeTimestamp = true,
    includeMeta = true,
    colorize = true
  } = options;

  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m'   // Reset
  };

  const currentLevel = levels[level];

  function shouldLog(logLevel: keyof typeof levels): boolean {
    return levels[logLevel] >= currentLevel;
  }

  function formatMessage(
    logLevel: keyof typeof levels,
    message: string,
    meta?: any
  ): string {
    const parts: string[] = [];

    // Timestamp
    if (includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    // Level
    const levelStr = logLevel.toUpperCase().padEnd(5);
    if (colorize) {
      parts.push(`${colors[logLevel]}${levelStr}${colors.reset}`);
    } else {
      parts.push(levelStr);
    }

    // Message
    parts.push(message);

    // Metadata
    if (includeMeta && meta) {
      try {
        const metaStr = typeof meta === 'object' ? JSON.stringify(meta, null, 2) : String(meta);
        parts.push(`\n${metaStr}`);
      } catch {
        parts.push(`\n[Unable to serialize metadata]`);
      }
    }

    return parts.join(' ');
  }

  return {
    debug: (message: string, meta?: any) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', message, meta));
      }
    },

    info: (message: string, meta?: any) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', message, meta));
      }
    },

    warn: (message: string, meta?: any) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message, meta));
      }
    },

    error: (message: string, meta?: any) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message, meta));
      }
    }
  };
}

/**
 * Create a silent logger (useful for testing)
 */
export function createSilentLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop
  };
}

/**
 * Create a logger that writes to a file
 */
export function createFileLogger(filePath: string, options: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeTimestamp?: boolean;
  includeMeta?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
} = {}): Logger {
  const {
    level = 'info',
    includeTimestamp = true,
    includeMeta = true,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 5
  } = options;

  // This is a simplified file logger implementation
  // In production, you might want to use a more robust logging library
  
  const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  const currentLevel = levels[level];

  function shouldLog(logLevel: keyof typeof levels): boolean {
    return levels[logLevel] >= currentLevel;
  }

  function formatMessage(
    logLevel: keyof typeof levels,
    message: string,
    meta?: any
  ): string {
    const parts: string[] = [];

    if (includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(logLevel.toUpperCase().padEnd(5));
    parts.push(message);

    if (includeMeta && meta) {
      try {
        const metaStr = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
        parts.push(metaStr);
      } catch {
        parts.push('[Unable to serialize metadata]');
      }
    }

    return parts.join(' ') + '\n';
  }

  async function writeToFile(content: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.appendFile(filePath, content);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
      console.log(content.trim());
    }
  }

  return {
    debug: (message: string, meta?: any) => {
      if (shouldLog('debug')) {
        writeToFile(formatMessage('debug', message, meta));
      }
    },

    info: (message: string, meta?: any) => {
      if (shouldLog('info')) {
        writeToFile(formatMessage('info', message, meta));
      }
    },

    warn: (message: string, meta?: any) => {
      if (shouldLog('warn')) {
        writeToFile(formatMessage('warn', message, meta));
      }
    },

    error: (message: string, meta?: any) => {
      if (shouldLog('error')) {
        writeToFile(formatMessage('error', message, meta));
      }
    }
  };
}

/**
 * Create a logger that combines multiple loggers
 */
export function createMultiLogger(...loggers: Logger[]): Logger {
  return {
    debug: (message: string, meta?: any) => {
      loggers.forEach(logger => logger.debug(message, meta));
    },

    info: (message: string, meta?: any) => {
      loggers.forEach(logger => logger.info(message, meta));
    },

    warn: (message: string, meta?: any) => {
      loggers.forEach(logger => logger.warn(message, meta));
    },

    error: (message: string, meta?: any) => {
      loggers.forEach(logger => logger.error(message, meta));
    }
  };
}
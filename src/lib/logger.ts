type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  clinicId?: string;
  userId?: string;
  patientId?: string;
  noteId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private correlationId?: string;
  private baseContext: LogContext = {};

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  setContext(context: LogContext): void {
    this.baseContext = { ...this.baseContext, ...context };
  }

  clearContext(): void {
    this.baseContext = {};
    this.correlationId = undefined;
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (this.correlationId) {
      entry.correlationId = this.correlationId;
    }

    const mergedContext = { ...this.baseContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = this.sanitizeContext(mergedContext);
    }

    return entry;
  }

  private sanitizeContext(context: LogContext): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'content', 'title'];

    for (const [key, value] of Object.entries(context)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = this.formatEntry(level, message, context);
    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.formatEntry('error', message, context);

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    console.error(JSON.stringify(entry));
  }

  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.correlationId = this.correlationId;
    childLogger.baseContext = { ...this.baseContext, ...context };
    return childLogger;
  }
}

export const logger = new Logger();
export { Logger, LogContext };

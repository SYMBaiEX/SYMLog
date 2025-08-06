import { logError as logErrorToConsole } from '@/lib/logger';

export interface LogContext {
  [key: string]: any;
}

export interface LoggerOptions {
  service?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Unified logging service for consistent logging across the application
 * Based on the pattern established in gateway.ts
 */
export class UnifiedLogger {
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    this.options = options;
  }

  private formatMessage(level: string, message: string): string {
    const prefix = `[${level}]`;
    const servicePrefix = this.options.service ? `[${this.options.service}]` : '';
    const componentPrefix = this.options.component ? `[${this.options.component}]` : '';
    
    return `${prefix}${servicePrefix}${componentPrefix} ${message}`;
  }

  private formatContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    return {
      ...context,
      ...(this.options.userId && { userId: this.options.userId }),
      ...(this.options.sessionId && { sessionId: this.options.sessionId }),
      timestamp: new Date().toISOString(),
    };
  }

  info(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('INFO', message);
    const formattedContext = this.formatContext(context);
    
    if (formattedContext) {
      console.log(formattedMessage, formattedContext);
    } else {
      console.log(formattedMessage);
    }
  }

  warn(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('WARN', message);
    const formattedContext = this.formatContext(context);
    
    if (formattedContext) {
      console.warn(formattedMessage, formattedContext);
    } else {
      console.warn(formattedMessage);
    }
  }

  error(message: string, context?: LogContext): void {
    const formattedContext = this.formatContext(context);
    logErrorToConsole(message, formattedContext);
  }

  debug(message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage('DEBUG', message);
    const formattedContext = this.formatContext(context);
    
    if (formattedContext) {
      console.debug(formattedMessage, formattedContext);
    } else {
      console.debug(formattedMessage);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalOptions: LoggerOptions): UnifiedLogger {
    return new UnifiedLogger({
      ...this.options,
      ...additionalOptions,
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new UnifiedLogger();

/**
 * Create a logger for a specific service/component
 */
export function createLogger(options: LoggerOptions): UnifiedLogger {
  return new UnifiedLogger(options);
}

/**
 * Legacy compatibility - matches the gateway.ts pattern
 */
export const loggingService = {
  info: (message: string, data?: any) => logger.info(message, data),
  warn: (message: string, data?: any) => logger.warn(message, data),
  error: (message: string, data?: any) => logger.error(message, data),
  debug: (message: string, data?: any) => logger.debug(message, data),
};
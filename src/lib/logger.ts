/**
 * Structured Logger Abstraction
 * Production-safe logging with automatic redaction and structured output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: any;
}

/**
 * Structured logger with environment-aware output
 * - Development: Pretty console output
 * - Production: Structured JSON (ready for log aggregation)
 */
class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey'];

    /**
     * Redact sensitive information from log context
     */
    private redact(context: LogContext): LogContext {
        const redacted: LogContext = {};

        for (const [key, value] of Object.entries(context)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = this.sensitiveKeys.some(k => lowerKey.includes(k));

            if (isSensitive) {
                redacted[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                redacted[key] = this.redact(value);
            } else {
                redacted[key] = value;
            }
        }

        return redacted;
    }

    /**
     * Format log message with context
     */
    private format(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();

        if (this.isDevelopment) {
            // Pretty format for development
            const emoji = {
                debug: '🐛',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌'
            }[level];

            return context
                ? `${emoji} [${level.toUpperCase()}] ${message} ${JSON.stringify(this.redact(context), null, 2)}`
                : `${emoji} [${level.toUpperCase()}] ${message}`;
        } else {
            // Structured JSON for production (ready for log aggregation like Datadog, Splunk, etc.)
            return JSON.stringify({
                timestamp,
                level,
                message,
                ...(context ? { context: this.redact(context) } : {})
            });
        }
    }

    /**
     * Debug log (development only)
     */
    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.log(this.format('debug', message, context));
        }
    }

    /**
     * Info log (development only)
     */
    info(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.log(this.format('info', message, context));
        }
    }

    /**
     * Warning log (always logged)
     */
    warn(message: string, context?: LogContext): void {
        console.warn(this.format('warn', message, context));
    }

    /**
     * Error log (always logged)
     */
    error(message: string, context?: LogContext): void {
        console.error(this.format('error', message, context));
    }
}

// Export singleton instance
export const logger = new Logger();

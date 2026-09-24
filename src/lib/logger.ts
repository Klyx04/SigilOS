/**
 * Structured Logger Abstraction
 * Production-safe logging with automatic redaction and structured output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Autorise n'importe quelle valeur en contexte de log (objet, Error, string, ...).
// Normalisée dans normalizeContext avant l'affichage.
type LogContext = unknown;

/**
 * Structured logger with environment-aware output
 * - Development: Pretty console output
 * - Production: Structured JSON (ready for log aggregation)
 */
class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    // ⚠️ Ce sont des **motifs en minuscules** : la comparaison se fait sur `key.toLowerCase()`
    // (constat du 23/09/2026 : `'apiKey'` n'était JAMAIS masqué — la clé normalisée `apikey`
    // ne contient pas la chaîne `'apiKey'`).
    private sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'apikey'];

    /**
     * Normalise une valeur arbitraire en objet de contexte sûr :
     * - undefined/null → pas de contexte
     * - Error → { error: { message, name, stack } }
     * - objet → utilisé tel quel
     * - primitive → { value }
     */
    private normalizeContext(context: LogContext): Record<string, unknown> | undefined {
        if (context === undefined || context === null) return undefined;
        if (context instanceof Error) {
            return {
                error: {
                    name: context.name,
                    message: context.message,
                    ...(context.stack ? { stack: context.stack } : {}),
                },
            };
        }
        if (typeof context === 'object') {
            return context as Record<string, unknown>;
        }
        return { value: context };
    }

    /**
     * Redact sensitive information from log context
     */
    private redact(context: Record<string, unknown>): Record<string, unknown> {
        const redacted: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(context)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = this.sensitiveKeys.some(k => lowerKey.includes(k));

            if (isSensitive) {
                redacted[key] = '[REDACTED]';
            } else if (value instanceof Error) {
                // ⚠️ Un `Error` n'a **aucune propriété énumérable** : la récursion ci-dessous
                // rendait `{}` ⇒ logs `Error: {}` et message PERDU (constat user du
                // 23/09/2026 : « pas mal d'erreur encore… on voit rien »). Ici on garde
                // `name` + `message` (stack en développement seulement).
                redacted[key] = {
                    name: value.name,
                    message: value.message,
                    ...(this.isDevelopment && value.stack ? { stack: value.stack } : {}),
                };
            } else if (Array.isArray(value)) {
                redacted[key] = value.map((v) =>
                    v instanceof Error ? { name: v.name, message: v.message } : v
                );
            } else if (typeof value === 'object' && value !== null) {
                redacted[key] = this.redact(value as Record<string, unknown>);
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
        const normalized = this.normalizeContext(context);

        // Sérialisation robuste : certaines valeurs (BigInt, cycles) font échouer
        // JSON.stringify → on retombe sur une représentation sûre plutôt que de crasher.
        const safeSerialize = (value: unknown): string => {
            try {
                return JSON.stringify(value);
            } catch {
                try {
                    return JSON.stringify(String(value));
                } catch {
                    return '"[Unserializable]"';
                }
            }
        };

        if (this.isDevelopment) {
            // Pretty format for development
            const emoji = {
                debug: '🐛',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌'
            }[level];

            return normalized
                ? `${emoji} [${level.toUpperCase()}] ${message} ${safeSerialize(this.redact(normalized))}`
                : `${emoji} [${level.toUpperCase()}] ${message}`;
        } else {
            // Structured JSON for production (ready for log aggregation like Datadog, Splunk, etc.)
            const out = {
                timestamp,
                level,
                message,
                ...(normalized ? { context: this.redact(normalized) } : {})
            };
            try {
                return JSON.stringify(out);
            } catch {
                // BigInt / cycles dans le contexte → format de secours sans crash
                const safeOut: Record<string, unknown> = { timestamp, level, message };
                if (normalized) safeOut.context = String(this.redact(normalized));
                return JSON.stringify(safeOut);
            }
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
     * Info log (always logged)
     */
    info(message: string, context?: LogContext): void {
        console.log(this.format('info', message, context));
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

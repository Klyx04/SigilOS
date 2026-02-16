/**
 * Rate Limiting Configuration
 * Centralized rate limit rules for all sensitive actions
 */

export const RATE_LIMITS = {
    // Mission Actions
    MISSION_SUBMIT: { requests: 10, window: 60_000 }, // 10 req/min
    MISSION_TOGGLE_INTEREST: { requests: 20, window: 60_000 }, // 20 req/min
    MISSION_RESET: { requests: 5, window: 300_000 }, // 5 req/5min

    // Admin Actions
    ADMIN_ACTION: { requests: 20, window: 60_000 }, // 20 req/min
    ADMIN_BULK_OPERATION: { requests: 5, window: 300_000 }, // 5 req/5min

    // Profile Updates
    PROFILE_UPDATE: { requests: 5, window: 300_000 }, // 5 req/5min
    PROFILE_VACATION: { requests: 3, window: 600_000 }, // 3 req/10min

    // Absence Management
    ABSENCE_CREATE: { requests: 10, window: 300_000 }, // 10 req/5min
    ABSENCE_UPDATE: { requests: 10, window: 300_000 }, // 10 req/5min

    // Document Actions
    DOC_CREATE: { requests: 5, window: 300_000 }, // 5 req/5min
    DOC_UPDATE: { requests: 10, window: 300_000 }, // 10 req/5min

    // API Routes
    API_SYNC: { requests: 5, window: 300_000 }, // 5 req/5min
    API_UPLOAD: { requests: 10, window: 60_000 }, // 10 req/min

    // Authentication
    AUTH_LOGIN: { requests: 5, window: 300_000 }, // 5 req/5min
    AUTH_REGISTER: { requests: 3, window: 600_000 }, // 3 req/10min
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/**
 * Get rate limit config by key
 */
export function getRateLimit(key: RateLimitKey) {
    return RATE_LIMITS[key];
}

/**
 * Format rate limit for user-facing error messages
 */
export function formatRateLimit(key: RateLimitKey): string {
    const { requests, window } = RATE_LIMITS[key];
    const minutes = Math.floor(window / 60_000);

    if (minutes === 1) {
        return `${requests} requêtes par minute`;
    } else if (minutes < 60) {
        return `${requests} requêtes par ${minutes} minutes`;
    } else {
        const hours = Math.floor(minutes / 60);
        return `${requests} requêtes par ${hours} heure${hours > 1 ? 's' : ''}`;
    }
}

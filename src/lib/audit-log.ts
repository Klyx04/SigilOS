/**
 * Audit Logging System
 * Logs all super-admin actions for security monitoring
 */

type AuditAction =
    | 'ADMIN_ACCESS'
    | 'GAME_DATA_VIEW'
    | 'GAME_DATA_CREATE'
    | 'GAME_DATA_UPDATE'
    | 'GAME_DATA_DELETE'
    | 'CONFIG_CHANGE'
    | 'USER_IMPERSONATE';

interface AuditLog {
    timestamp: string;
    userId: string;
    userName: string;
    action: AuditAction;
    resource?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Log an admin action
 * In production, this should also save to DB or external service (Sentry, Datadog, etc.)
 */
export function auditLog(log: Omit<AuditLog, 'timestamp'>): void {
    const fullLog: AuditLog = {
        timestamp: new Date().toISOString(),
        ...log,
    };

    // Console log (captured by Docker logs in prod)

    // TODO: Optional - Save to DB for long-term audit trail
    // await prisma.auditLog.create({ data: fullLog });

    // TODO: Optional - Send to Sentry for monitoring
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureMessage(`[AUDIT] ${log.action}`, { level: 'info', extra: fullLog });
    // }
}

/**
 * Helper to log page access
 */
export function logPageAccess(params: {
    userId: string;
    userName: string;
    page: string;
    details?: Record<string, any>;
}): void {
    auditLog({
        userId: params.userId,
        userName: params.userName,
        action: 'ADMIN_ACCESS',
        resource: params.page,
        details: params.details,
    });
}

/**
 * Helper to log game data changes
 */
export function logGameDataChange(params: {
    userId: string;
    userName: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: string;
    entityId?: string;
    entityName?: string;
    changes?: Record<string, any>;
}): void {
    auditLog({
        userId: params.userId,
        userName: params.userName,
        action: `GAME_DATA_${params.operation}` as AuditAction,
        resource: `${params.entityType}:${params.entityId || params.entityName || 'unknown'}`,
        details: params.changes,
    });
}

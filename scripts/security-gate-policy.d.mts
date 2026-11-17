/**
 * Types de la politique d'exceptions de la porte de sécurité.
 * Le module exécuté reste `security-gate-policy.mjs` (importé tel quel par le script Node).
 */

export interface ProdAuditException {
    /** Identifiant GHSA, seule faille couverte par l'exception. */
    advisory: string;
    /** Dernier jour de validité (inclus), `YYYY-MM-DD` (UTC). */
    expiresAt: string;
    /** Pourquoi l'exception existe — affiché dans la sortie de la porte. */
    reason: string;
}

export interface AuditAdvisoryRef {
    url?: string;
    title?: string;
    severity?: string;
}

export interface AuditVulnerability {
    severity?: string;
    via?: Array<string | AuditAdvisoryRef>;
}

export interface AuditReport {
    vulnerabilities?: Record<string, AuditVulnerability>;
    metadata?: {
        vulnerabilities?: {
            info?: number;
            low?: number;
            moderate?: number;
            high?: number;
            critical?: number;
            total?: number;
        };
    };
}

export interface ApplicableException extends ProdAuditException {
    /** Paquets `high`/`critical` effectivement couverts. */
    packages: string[];
}

export const PROD_AUDIT_EXCEPTIONS: ProdAuditException[];
export function advisoryIdFromUrl(url: unknown): string | null;
export function isExceptionExpired(exception: ProdAuditException | null | undefined, now?: Date): boolean;
export function findApplicableException(options: {
    report: AuditReport | null | undefined;
    exceptions?: ProdAuditException[];
    now?: Date;
    severities?: string[];
}): ApplicableException | null;

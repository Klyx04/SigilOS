/**
 * Porte de sécurité — **politique d'exceptions temporaires** (règle pure).
 *
 * 🛡️ Ce que ce test protège (mesure du 17/11/2026, avis picomatch GHSA-fc5q-39xc-vjpf) :
 * ① une exception est **nominative** : elle ne couvre qu'une seule GHSA ;
 * ② elle est **couvrante** : TOUS les paquets `high`/`critical` bloqués doivent descendre
 *    de cette GHSA — une autre faille dans le lot fait échouer la porte ;
 * ③ elle **expire** : après `expiresAt`, plus aucune exception (comportement historique) ;
 * ④ elle est **fail-closed** : avis sans URL, dépendance absente ou date invalide ⇒ refus.
 */

import { describe, it, expect } from "vitest";
import {
    PROD_AUDIT_EXCEPTIONS,
    advisoryIdFromUrl,
    findApplicableException,
    isExceptionExpired,
    type AuditReport,
} from "../../scripts/security-gate-policy.mjs";

const GHSA = "GHSA-fc5q-39xc-vjpf";

/** Rapport `npm audit --omit=dev` synthétique : la chaîne Sentry → picomatch. */
const picomatchReport = (): AuditReport => ({
    vulnerabilities: {
        "@sentry/nextjs": { severity: "high", via: ["@rollup/plugin-commonjs"] },
        "@rollup/plugin-commonjs": { severity: "high", via: ["@rollup/pluginutils", "picomatch"] },
        "@rollup/pluginutils": { severity: "high", via: ["picomatch"] },
        picomatch: {
            severity: "high",
            via: [{ title: "ReDoS", url: `https://github.com/advisories/${GHSA}` }],
        },
    },
    metadata: { vulnerabilities: { high: 4, total: 4 } },
});

const BEFORE_EXPIRY = new Date("2026-11-18T12:00:00Z");
const AFTER_EXPIRY = new Date("2026-11-25T00:00:00Z");

describe("security-gate-policy — exception nominative et datée", () => {
    it("couvre la chaîne complète avant l'expiration", () => {
        const exception = findApplicableException({ report: picomatchReport(), now: BEFORE_EXPIRY });
        expect(exception).not.toBeNull();
        expect(exception?.advisory).toBe(GHSA);
        expect(exception?.packages).toHaveLength(4);
    });

    it("n'existe plus après l'expiration (la porte ré-échoue)", () => {
        expect(findApplicableException({ report: picomatchReport(), now: AFTER_EXPIRY })).toBeNull();
    });

    it("refuse dès qu'une AUTRE faille est présente dans le lot", () => {
        const report = picomatchReport();
        report.vulnerabilities!.other = {
            severity: "high",
            via: [{ title: "Autre", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
        };
        expect(findApplicableException({ report, now: BEFORE_EXPIRY })).toBeNull();
    });

    it("refuse un avis sans URL (fail-closed)", () => {
        const report = picomatchReport();
        (report.vulnerabilities!.picomatch.via as any[]) = [{ title: "sans lien" }];
        expect(findApplicableException({ report, now: BEFORE_EXPIRY })).toBeNull();
    });

    it("refuse une dépendance absente du rapport (fail-closed)", () => {
        const report = picomatchReport();
        delete report.vulnerabilities!["@rollup/pluginutils"];
        expect(findApplicableException({ report, now: BEFORE_EXPIRY })).toBeNull();
    });

    it("refuse un rapport vide ou sans vulnérabilité bloquante", () => {
        expect(findApplicableException({ report: null, now: BEFORE_EXPIRY })).toBeNull();
        expect(findApplicableException({ report: { vulnerabilities: {} }, now: BEFORE_EXPIRY })).toBeNull();
    });
});

describe("security-gate-policy — utilitaires", () => {
    it("extrait et normalise l'identifiant GHSA d'une URL", () => {
        expect(advisoryIdFromUrl(`https://github.com/advisories/${GHSA}`)).toBe(GHSA);
        expect(advisoryIdFromUrl("https://example.invalid/x")).toBeNull();
        expect(advisoryIdFromUrl(null)).toBeNull();
    });

    it("une date invalide est considérée comme expirée", () => {
        expect(isExceptionExpired({ advisory: GHSA, expiresAt: "pas-une-date", reason: "x" })).toBe(true);
        expect(isExceptionExpired({ advisory: GHSA, expiresAt: "2026-11-24", reason: "x" }, BEFORE_EXPIRY)).toBe(false);
        expect(isExceptionExpired({ advisory: GHSA, expiresAt: "2026-11-24", reason: "x" }, AFTER_EXPIRY)).toBe(true);
    });

    it("chaque exception déclarée est bien formée et documentée", () => {
        for (const exception of PROD_AUDIT_EXCEPTIONS) {
            expect(exception.advisory).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i);
            expect(Number.isNaN(new Date(`${exception.expiresAt}T23:59:59Z`).getTime())).toBe(false);
            expect(exception.reason.length).toBeGreaterThan(40);
        }
    });
});

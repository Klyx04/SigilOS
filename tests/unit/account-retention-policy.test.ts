/**
 * Espace visiteur — verrou de la rétention des comptes orphelins (**D-V5**, 06/11/2026).
 *
 * Décision user : « 365 jrs pour tous ». Le code purgeait encore à **90 j** dans la route
 * cron : une décision écrite mais non appliquée. Ce test verrouille la constante, les
 * bornes de sûreté et le fait que le cron ne repasse pas une valeur en dur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    ORPHAN_ACCOUNT_RETENTION_DAYS,
    ORPHAN_RETENTION_MAX_DAYS,
    ORPHAN_RETENTION_MIN_DAYS,
    resolveOrphanRetentionDays,
} from "@/lib/account-retention-policy";

describe("Rétention des comptes orphelins — 365 jours pour tous", () => {
    it("la décision D-V5 vaut 365 jours, une seule durée", () => {
        expect(ORPHAN_ACCOUNT_RETENTION_DAYS).toBe(365);
        expect(resolveOrphanRetentionDays()).toBe(365);
        expect(resolveOrphanRetentionDays(null)).toBe(365);
    });

    it("une valeur aberrante est bornée (ni 1 jour, ni 100 ans)", () => {
        expect(resolveOrphanRetentionDays(1)).toBe(ORPHAN_RETENTION_MIN_DAYS);
        expect(resolveOrphanRetentionDays(999_999)).toBe(ORPHAN_RETENTION_MAX_DAYS);
    });

    it("le cron passe la politique, plus un 90 en dur", () => {
        const source = readFileSync("src/app/api/cron/account-retention/route.ts", "utf8");
        expect(source).toMatch(/ORPHAN_ACCOUNT_RETENTION_DAYS/);
        expect(source).not.toMatch(/retentionDays:\s*90/);
    });

    it("le noyau utilise le résolveur, pas une borne recopiée", () => {
        const source = readFileSync("src/server/account-retention-core.ts", "utf8");
        expect(source).toMatch(/resolveOrphanRetentionDays\(opts\?\.retentionDays\)/);
        expect(source).not.toMatch(/opts\?\.retentionDays \|\| 90/);
    });
});

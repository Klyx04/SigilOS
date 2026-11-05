import { describe, expect, it } from "vitest";
import {
    isRunOpen,
    resolveSongesReminderStep,
    runInteractionRefusal,
    runJoinRefusal,
    SONGES_CLOSE_AFTER_DAYS,
} from "@/lib/songes/run-status";

/**
 * Règle pure — **état d'une run Songes et calendrier d'inactivité**.
 *
 * Défauts mesurés le 05/11/2026 (disparition d'une run du 29/10) :
 * ① un worker BullMQ abandonnait les runs après **3 jours** sans activité, sans rappel
 *    ni suppression du post Discord ;
 * ② le cron officiel (J+7/15/20/21) calculait ses paliers sur `DreamRun.updatedAt`,
 *    or chaque rappel écrivait `lastReminderAt` — donc avançait `updatedAt` et repoussait
 *    la clôture de plusieurs jours ;
 * ③ le refus de candidature était le même pour une run **archivée** et pour une run close,
 *    ce qui affichait « n'accepte plus de candidatures » sur un post fantôme.
 *
 * Ce test verrouille la règle : elle seule décide, aucun écran ne la réimplémente.
 */
describe("état d'une run Songes", () => {
    it("une run ouverte est RECRUITING ou IN_PROGRESS, rien d'autre", () => {
        expect(isRunOpen("RECRUITING")).toBe(true);
        expect(isRunOpen("IN_PROGRESS")).toBe(true);
        for (const closed of ["ABANDONED", "COMPLETED", "FAILED", null, undefined, ""]) {
            expect(isRunOpen(closed)).toBe(false);
        }
    });

    it("le refus de candidature nomme la vraie cause", () => {
        expect(runJoinRefusal("ABANDONED")).toContain("archivée");
        expect(runJoinRefusal("COMPLETED")).toContain("terminée");
        expect(runJoinRefusal("FAILED")).toContain("échoué");
        // Un statut inconnu garde un refus, jamais un « ok » implicite.
        expect(runJoinRefusal("ARCHIVED_BY_HAND")).toBe("Cette run n'accepte plus de candidatures.");
    });

    it("une run ouverte n'oppose aucun refus d'interaction", () => {
        expect(runInteractionRefusal("RECRUITING")).toBeNull();
        expect(runInteractionRefusal("IN_PROGRESS")).toBeNull();
        expect(runInteractionRefusal("ABANDONED")).toContain("archivée");
        expect(runInteractionRefusal("COMPLETED")).toBe("Cette run est terminée.");
    });
});

describe("calendrier d'inactivité d'une run Songes", () => {
    const step = (daysSinceActivity: number, reminderCount: number, extra: object = {}) =>
        resolveSongesReminderStep({ daysSinceActivity, reminderCount, ...extra });

    it("rappelle à J+7, J+15 puis J+20 — jamais avant le seuil", () => {
        expect(step(6, 0)).toBeNull();
        expect(step(7, 0)).toBe(1);
        expect(step(14, 1)).toBeNull();
        expect(step(15, 1)).toBe(2);
        expect(step(19, 2)).toBeNull();
        expect(step(20, 2)).toBe(3);
    });

    it("ne clôt qu'après les trois rappels ET J+21", () => {
        expect(step(21, 0)).toBe(1);
        expect(step(21, 1)).toBe(2);
        expect(step(21, 2)).toBe(3);
        expect(step(20, 3)).toBeNull();
        expect(step(SONGES_CLOSE_AFTER_DAYS, 3)).toBe("close");
    });

    it("une run très en retard est rattrapée, jamais close en silence", () => {
        // 40 jours sans activité, aucun rappel : on commence par le rappel 1.
        expect(step(40, 0)).toBe(1);
        expect(step(40, 3)).toBe("close");
    });

    it("le cooldown de 24 h empêche deux écritures le même jour", () => {
        expect(step(15, 1, { hoursSinceLastReminder: 23 })).toBeNull();
        expect(step(15, 1, { hoursSinceLastReminder: 24 })).toBe(2);
    });

    it("une run en stand-by ne reçoit ni rappel ni clôture", () => {
        expect(step(40, 0, { standBy: true })).toBeNull();
        expect(step(40, 3, { standBy: true })).toBeNull();
    });
});

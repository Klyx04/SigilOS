/**
 * D7 — l'annulation n'est plus muette (31/10/2026).
 *
 * Décision du mainteneur : **notification dans le tableau de bord uniquement**, pour les
 * **inscrits** (`EventParticipant.status = REGISTERED`). Aucun DM, aucun message Discord :
 * l'embed du salon est supprimé par l'annulation (B3), et on n'ajoute rien à sa place.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ACTIONS = readFileSync(join(process.cwd(), "src/server/actions/calendar-actions.ts"), "utf8");

function cancelFunction(): string {
    const start = ACTIONS.indexOf("export async function cancelCalendarEvent");
    const end = ACTIONS.indexOf("export async function", start + 10);
    return ACTIONS.slice(start, end > start ? end : undefined);
}

describe("annulation d'événement — notification des inscrits (D7)", () => {
    const fn = cancelFunction();

    it("notifie chaque inscrit (REGISTERED) via le centre de notifications", () => {
        expect(fn).toContain("createNotification");
        expect(fn).toMatch(/where: \{ eventId, status: "REGISTERED" \}/);
        expect(fn).toContain('"SYSTEM_INFO"');
        expect(fn).toContain('"EVENT"');
    });

    it("ne notifie que les inscrits, en lien vers le calendrier", () => {
        expect(fn).toContain("/dashboard/${guildId}/calendar");
        expect(fn).not.toMatch(/"PENDING"|"WAITLIST"/);
    });

    it("aucun DM ni message Discord ajouté par l'annulation", () => {
        expect(fn).not.toMatch(/sendDirectMessage|createDM|sendChannelMessage/);
        // L'embed existant reste supprimé (comportement B3 d'origine).
        expect(fn).toContain("deleteChannelMessage");
    });

    it("le journal d'audit dit combien d'inscrits ont été notifiés", () => {
        expect(fn).toContain('action: "EVENT_CANCELLED"');
        expect(fn).toContain("notified");
    });

    it("une notification ratée ne défait pas l'annulation (fail-soft journalisé)", () => {
        expect(fn).toMatch(/catch \(error\)[\s\S]*notifications non écrites/);
    });
});

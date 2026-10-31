/**
 * Garde — **cycle de vie d'un raid**, lot **R1-P0** (audit du 30/10/2026).
 *
 * Quatre défauts mesurés sur `dev` (`calendar-actions.ts`) :
 * ① l'undo **patchait** un embed supprimé à la clôture (`updateDiscordEventEmbed` 1554-1555) ⇒ raid
 *    « fantôme », et les rappels n'étaient **jamais** recréés (marqueurs d'idempotence intacts) ;
 * ② `completeEvent` acceptait un `RAID_OFFICIAL` et créditait **tous** les inscrits (+50 XP) ;
 * ③ le score était **facultatif** (`data.score?.trim() || null`) ;
 * ④ annulation, suppression, clôture et undo n'écrivaient **aucun** audit.
 *
 * Ce fichier verrouille la **règle pure** (comportement) et le **câblage** (le serveur l'appelle).
 * Lecture seule : aucune base, aucun Discord.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    assertRaidClosureRoute,
    buildRaidUndoMetadata,
    isValidRaidClosureInput,
    REMINDER_MARKERS_CLEARED_ON_UNDO,
    shouldRepublishAfterUndo,
    validateRaidClosureInput,
} from "@/lib/raid-closure-rules";

const ACTIONS = "src/server/actions/calendar-actions.ts";
const read = (path: string) => readFileSync(path, "utf8");

/** Corps d'une server action (jusqu'à la suivante) — pour ne pas confondre les fonctions. */
function functionBody(code: string, name: string): string {
    const start = code.indexOf(`export async function ${name}(`);
    expect(start, `${name} introuvable`).toBeGreaterThanOrEqual(0);
    const next = code.indexOf("export async function", start + 1);
    return code.slice(start, next === -1 ? undefined : next);
}

describe("clôture raid — la règle (pure)", () => {
    it("un raid ne passe JAMAIS par la clôture générique", () => {
        const refused = assertRaidClosureRoute("RAID_OFFICIAL");
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.error).toContain("clôture raid");
        // Les autres types gardent le chemin générique.
        for (const type of ["EVENT_GUILD", "SESSION_MISSIONS", "SONGES_RUN", "DUNGEON_FARM"]) {
            expect(assertRaidClosureRoute(type).ok, type).toBe(true);
        }
        // Une valeur absente n'est pas un raid : pas de refus inventé.
        expect(assertRaidClosureRoute(null).ok).toBe(true);
    });

    it("le score est obligatoire : vide, blanc ou absent ⇒ refus", () => {
        for (const score of ["", "   ", undefined, null, 42]) {
            const result = validateRaidClosureInput({ score, presentUserIds: ["u1"] });
            expect(result.ok, String(score)).toBe(false);
            if (!result.ok) expect(result.error).toContain("obligatoire");
            expect(isValidRaidClosureInput({ score, presentUserIds: ["u1"] })).toBe(false);
        }
    });

    it("un score réel est nettoyé et accepté, les présents sont dédoublonnés", () => {
        const result = validateRaidClosureInput({
            score: "  84 500  ",
            presentUserIds: ["u1", "u2", "u1"],
        });
        expect(result).toMatchObject({ ok: true, score: "84 500", presentUserIds: ["u1", "u2"] });
        expect(isValidRaidClosureInput({ score: "84 500", presentUserIds: [] })).toBe(true);
    });

    it("les bornes tiennent : score > 40 caractères, plus de 32 présents", () => {
        expect(validateRaidClosureInput({ score: "9".repeat(41), presentUserIds: [] }).ok).toBe(false);
        const tooMany = Array.from({ length: 33 }, (_, i) => `u${i}`);
        expect(validateRaidClosureInput({ score: "12 000", presentUserIds: tooMany }).ok).toBe(false);
        // 32 présents restent valides.
        expect(validateRaidClosureInput({ score: "12 000", presentUserIds: tooMany.slice(0, 32) }).ok).toBe(true);
    });

    it("après un undo : republier dès que le raid avait un embed (jamais patcher)", () => {
        expect(shouldRepublishAfterUndo({ discordChannelId: "c1", discordMessageId: "m1" })).toBe(true);
        // Pas de message connu ⇒ rien à republier (le raid n'avait jamais été publié).
        expect(shouldRepublishAfterUndo({ discordChannelId: "c1", discordMessageId: null })).toBe(false);
        expect(shouldRepublishAfterUndo({})).toBe(false);
    });

    it("les métadonnées d'un raid rouvert effacent la clôture ET rendent les rappels rejouables", () => {
        const before = {
            raidScore: "84 500",
            raidPresentUserIds: ["u1", "u2"],
            raidPurpleKamasCost: 30,
            completedAt: "2026-10-30T20:00:00.000Z",
            completedBy: "u1",
            systemClosedAt: null,
            standBy: { paused: true },
            raidReminder24hSentAt: "2026-10-29T20:00:00.000Z",
            raidReminderSentAt: "2026-10-30T19:00:00.000Z",
            closureReminderSentAt: "2026-10-31T20:00:00.000Z",
            eventReminderSentAt: "2026-10-29T12:00:00.000Z",
            reminderMessages: [{ channelId: "c", messageId: "m" }],
        };
        const after = buildRaidUndoMetadata(before, "actor-1", new Date("2026-10-31T09:00:00.000Z"));

        expect(after).toMatchObject({
            raidScore: null,
            raidPresentUserIds: [],
            completedAt: null,
            completedBy: null,
            closedBySystem: null,
            systemClosedAt: null,
            raidUndoneAt: "2026-10-31T09:00:00.000Z",
            raidUndoneBy: "actor-1",
            reminderMessages: [],
            // On ne jette pas ce qui n'appartient pas à la clôture.
            standBy: { paused: true },
            raidPurpleKamasCost: 30,
        });
        // Les 4 marqueurs de rappel disparaissent : le cron peut les rejouer.
        for (const marker of REMINDER_MARKERS_CLEARED_ON_UNDO) {
            expect(after, marker).not.toHaveProperty(marker);
        }
        // La source n'est pas modifiée (règle pure).
        expect(before.raidScore).toBe("84 500");
        expect(before.reminderMessages).toHaveLength(1);
    });
});

describe("clôture raid — le câblage dans les server actions", () => {
    const code = read(ACTIONS);

    it("l'undo REPUBLIE et ne patche plus le message supprimé", () => {
        const undo = functionBody(code, "undoCompleteRaidEvent");
        expect(undo).toMatch(/publishDiscordEvent\(guildId, eventId\)/);
        expect(undo).not.toMatch(/updateDiscordEventEmbed/);
        expect(undo).toMatch(/shouldRepublishAfterUndo\(event\)/);
        // Métadonnées reconstruites par la règle pure (marqueurs de rappel effacés).
        expect(undo).toMatch(/buildRaidUndoMetadata\(meta, ctx\.id \?\? ""\)/);
    });

    it("la clôture générique refuse un raid, la clôture raid valide son entrée", () => {
        expect(functionBody(code, "completeEvent")).toMatch(/assertRaidClosureRoute\(event\.type\)/);
        expect(functionBody(code, "completeRaidEvent")).toMatch(
            /validateRaidClosureInput\(\{ score: data\?\.score, presentUserIds: data\?\.presentUserIds \}\)/,
        );
    });

    it("les issues du cycle de vie écrivent un audit", () => {
        const expected: [string, string][] = [
            ["completeEvent", "EVENT_CLOSED"],
            ["completeRaidEvent", "RAID_CLOSED"],
            ["undoCompleteRaidEvent", "RAID_CLOSURE_UNDONE"],
            ["cancelCalendarEvent", "EVENT_CANCELLED"],
            ["deleteCalendarEvent", "EVENT_DELETED"],
        ];
        for (const [fn, action] of expected) {
            const body = functionBody(code, fn);
            expect(body, fn).toMatch(/createAuditLog\(\{/);
            expect(body, fn).toContain(`action: "${action}"`);
        }
    });

    it("le doublon de `revalidatePath` de la création a disparu", () => {
        const create = functionBody(code, "createCalendarEvent");
        expect(create).not.toMatch(
            /revalidatePath\(`\/dashboard\/\$\{guildId\}\/calendar`\);\s*revalidatePath\(`\/dashboard\/\$\{guildId\}\/calendar`\);/,
        );
        expect(create.match(/revalidatePath\(`\/dashboard\/\$\{guildId\}\/calendar`\)/g) ?? []).toHaveLength(1);
    });
});

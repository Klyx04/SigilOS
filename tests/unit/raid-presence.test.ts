/**
 * Registre de présence des raids — R1 « no-show » (PLAN-RAID L2, 31/10/2026).
 *
 * Règle **pure** (aucune I/O) : le serveur (`completeRaidEvent`) et l'écran (attestation,
 * validation bloquante) consomment exactement ces fonctions. La dernière section est une
 * **garde de source** : elle vérifie que le registre est bien écrit/supprimé par les actions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
    buildRaidClosureAttestation,
    buildRaidPresenceRows,
    raidPresenceRetentionCutoff,
    summarizeRaidPresence,
    validateRaidAbsences,
    RAID_ABSENCE_DEFAULT,
    RAID_PRESENCE_RETENTION_DAYS,
} from "@/lib/raid-presence";

const REG = ["u1", "u2", "u3"];

describe("validateRaidAbsences — entrée bornée", () => {
    it("accepte les trois motifs et dédoublonne (la première décision gagne)", () => {
        const res = validateRaidAbsences([
            { userId: "u1", reason: "PREVENU" },
            { userId: "u1", reason: "NO_SHOW" },
            { userId: "u2", reason: "EXCUSE" },
        ]);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.absences).toEqual([
                { userId: "u1", reason: "PREVENU" },
                { userId: "u2", reason: "EXCUSE" },
            ]);
        }
    });

    it("refuse un motif inconnu (aucune valeur libre n'entre en base)", () => {
        expect(validateRaidAbsences([{ userId: "u1", reason: "ABSENT" }]).ok).toBe(false);
    });

    it("refuse plus de 32 absences", () => {
        const tooMany = Array.from({ length: 33 }, (_, i) => ({ userId: `u${i}`, reason: "NO_SHOW" }));
        expect(validateRaidAbsences(tooMany).ok).toBe(false);
    });

    it("une entrée absente ou illisible vaut « aucune absence »", () => {
        expect(validateRaidAbsences(undefined)).toEqual({ ok: true, absences: [] });
        expect(validateRaidAbsences("n'importe quoi")).toEqual({ ok: true, absences: [] });
    });

    it("le défaut de la décoche est « Prévenu » (décision du 31/10/2026)", () => {
        expect(RAID_ABSENCE_DEFAULT).toBe("PREVENU");
    });
});

describe("buildRaidPresenceRows — un statut par inscrit", () => {
    it("écrit une ligne par inscrit (présent / prévenu / excusé / no-show)", () => {
        const res = buildRaidPresenceRows({
            registeredUserIds: ["u1", "u2", "u3", "u4"],
            presentUserIds: ["u1"],
            absences: [
                { userId: "u2", reason: "PREVENU" },
                { userId: "u3", reason: "EXCUSE" },
                { userId: "u4", reason: "NO_SHOW" },
            ],
        });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.rows).toEqual([
            { userId: "u1", status: "PRESENT" },
            { userId: "u2", status: "PREVENU" },
            { userId: "u3", status: "EXCUSE" },
            { userId: "u4", status: "NO_SHOW" },
        ]);
        expect(res).toMatchObject({ present: 1, absent: 3, warned: 1, excused: 1, noShows: 1 });
    });

    it("un inscrit décoché SANS motif refuse la clôture (le no-show n'est pas un oubli)", () => {
        const res = buildRaidPresenceRows({ registeredUserIds: REG, presentUserIds: ["u1"], absences: [] });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error).toContain("2 inscrits");
    });

    it("un présent hors inscrits est refusé (on ne crédite pas un inconnu)", () => {
        const res = buildRaidPresenceRows({ registeredUserIds: REG, presentUserIds: ["u1", "intrus"], absences: [] });
        expect(res.ok).toBe(false);
    });

    it("une absence hors inscrits est refusée", () => {
        const res = buildRaidPresenceRows({
            registeredUserIds: REG,
            presentUserIds: ["u1", "u2", "u3"],
            absences: [{ userId: "intrus", reason: "NO_SHOW" }],
        });
        expect(res.ok).toBe(false);
    });

    it("un membre ne peut pas être présent ET absent", () => {
        const res = buildRaidPresenceRows({
            registeredUserIds: REG,
            presentUserIds: ["u1", "u2", "u3"],
            absences: [{ userId: "u2", reason: "NO_SHOW" }],
        });
        expect(res.ok).toBe(false);
    });

    it("sans inscrit, rien n'est enregistré (fail-closed)", () => {
        expect(buildRaidPresenceRows({ registeredUserIds: [], presentUserIds: [], absences: [] }).ok).toBe(false);
    });

    it("dédoublonne un inscrit listé deux fois", () => {
        const res = buildRaidPresenceRows({ registeredUserIds: ["u1", "u1"], presentUserIds: ["u1"], absences: [] });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.rows).toHaveLength(1);
    });
});


describe("attestation et compteur 90 jours", () => {
    it("dit le débit par présent et le nombre de no-shows", () => {
        expect(buildRaidClosureAttestation({ present: 3, noShows: 1, purpleKamasCost: 30 })).toBe(
            "3 présents débités de 30 🟣 chacun, 1 no-show.",
        );
    });

    it("don désactivé : aucun Kamas Violet annoncé (pas de 0 inventé)", () => {
        expect(buildRaidClosureAttestation({ present: 1, noShows: 0, purpleKamasCost: null })).toContain(
            "aucun Kamas Violet",
        );
    });

    it("le compteur agrège les statuts déjà lus", () => {
        expect(summarizeRaidPresence(["PRESENT", "NO_SHOW", "NO_SHOW", "PREVENU", "EXCUSE"])).toEqual({
            present: 1,
            absent: 4,
            warned: 1,
            excused: 1,
            noShows: 2,
        });
    });

    it("la purge garde 90 jours pleins", () => {
        const now = new Date("2026-10-31T12:00:00Z");
        const cutoff = raidPresenceRetentionCutoff(now);
        expect(now.getTime() - cutoff.getTime()).toBe(RAID_PRESENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    });
});

describe("câblage serveur (garde de source)", () => {
    const actions = readFileSync(join(process.cwd(), "src/server/actions/calendar-actions.ts"), "utf8");

    it("la clôture écrit le registre dans la MÊME transaction que le statut", () => {
        expect(actions).toContain("db.raidPresence.createMany");
        expect(actions).toMatch(/\$transaction\(\[[\s\S]*raidPresence\.createMany[\s\S]*guildEvent\.update/);
    });

    it("l'annulation de clôture efface le registre", () => {
        const undo = actions.slice(actions.indexOf("export async function undoCompleteRaidEvent"));
        expect(undo).toContain("db.raidPresence.deleteMany");
    });

    it("le registre exige une permission de staff (jamais un membre)", () => {
        const register = actions.slice(actions.indexOf("export async function getRaidPresenceRegister"));
        expect(register).toMatch(/canManageRaid[\s\S]*Permission insuffisante/);
    });

    it("la correction d'un statut est réservée à l'officier et auditée", () => {
        const correct = actions.slice(actions.indexOf("export async function correctRaidPresence"));
        expect(correct).toContain("RAID_PRESENCE_CORRECTED");
        expect(correct).toMatch(/canManageRaid/);
        expect(correct).toMatch(/updateMany/);
    });
});

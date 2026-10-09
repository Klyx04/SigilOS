/**
 * Miroir agenda DJ/Songes (`@/lib/agenda-mirror`) — règle pure du lot R1.
 *
 * Verrouille : titres par mode, plages (+2 h, chapeau multi min-max),
 * sans-date → null, statuts de fin (filigrane « Terminé »), bornes
 * anti-blob et détection `isAgendaMirror` (modale lecture seule).
 */

import { describe, it, expect } from "vitest";
import {
    AGENDA_MIRROR_DURATION_MS,
    aggregateMirrorClasses,
    agendaMirrorSource,
    djMirrorModeLabel,
    djMirrorRange,
    djMirrorStatus,
    djMirrorTitle,
    isAgendaMirror,
    mirrorMessage,
    mirrorMultiEntries,
    mirrorMultiLines,
    pickMirrorAchievements,
    songesDifficultyLabel,
    songesMirrorRange,
    songesMirrorStatus,
    songesMirrorTitle,
} from "@/lib/agenda-mirror";

describe("agenda-mirror — titres", () => {
    it("décline le titre DJ par mode (donjon / quête / défi / titan)", () => {
        expect(djMirrorTitle({ mode: "DONJON", dungeonName: "Servitude" })).toBe("[DJ] Servitude");
        expect(djMirrorTitle({ mode: "QUETE", questName: "Le nouveau monde" })).toBe("[Quête] Le nouveau monde");
        expect(djMirrorTitle({ mode: "DEFI", defiName: "Xélor fou" })).toBe("[Défi] Xélor fou");
        expect(djMirrorTitle({ mode: "TITAN", titanName: "Gargandyas" })).toBe("[Titan] Gargandyas");
    });

    it("ne dépasse jamais 100 caractères (limite du schéma GuildEvent)", () => {
        const title = djMirrorTitle({ mode: "QUETE", questName: "x".repeat(300) });
        expect(title.length).toBeLessThanOrEqual(100);
    });

    it("titre Songes = palier en français", () => {
        expect(songesMirrorTitle("REVE_I")).toBe("[Songes] Rêve I");
        expect(songesMirrorTitle("CAUCHEMAR_III")).toBe("[Songes] Cauchemar III");
        expect(songesDifficultyLabel("PARADOXE_II")).toBe("Paradoxe II");
    });
});

describe("agenda-mirror — plages", () => {
    it("date simple → +2 h (durée miroir)", () => {
        const range = djMirrorRange({ mode: "DONJON", targetDate: new Date("2026-10-20T20:00:00Z") });
        expect(range?.start.toISOString()).toBe("2026-10-20T20:00:00.000Z");
        expect(range!.end.getTime() - range!.start.getTime()).toBe(AGENDA_MIRROR_DURATION_MS);
    });

    it("sans date → null (pas de miroir, pas de bruit)", () => {
        expect(djMirrorRange({ mode: "DONJON", targetDate: null })).toBeNull();
        expect(djMirrorRange({ mode: "QUETE", targetDate: undefined })).toBeNull();
        expect(songesMirrorRange(null)).toBeNull();
        expect(songesMirrorRange(undefined)).toBeNull();
    });

    it("date invalide → null (jamais de miroir cassé)", () => {
        expect(djMirrorRange({ mode: "DONJON", targetDate: "pas-une-date" })).toBeNull();
    });

    it("multi-donjons → UN chapeau min-max (fin = dernière + 2 h)", () => {
        const range = djMirrorRange({
            mode: "DONJON",
            dungeonsJson: [
                { name: "A", targetDate: "2026-10-20T20:00:00Z" },
                { name: "B", targetDate: "2026-10-22T21:00:00Z" },
            ],
        });
        expect(range?.start.toISOString()).toBe("2026-10-20T20:00:00.000Z");
        expect(range?.end.toISOString()).toBe("2026-10-22T23:00:00.000Z");
    });

    it("multi sans aucune date → null", () => {
        expect(djMirrorRange({ mode: "DONJON", dungeonsJson: [{ name: "A" }] })).toBeNull();
    });

    it("enveloppe { _items } lue comme un tableau (rappels H-1)", () => {
        expect(
            mirrorMultiEntries({ _items: [{ name: "A", targetDate: "2026-10-20T20:00:00Z" }] })
        ).toHaveLength(1);
        expect(mirrorMultiEntries(null)).toEqual([]);
        expect(mirrorMultiEntries("pas-du-json")).toEqual([]);
    });

    it("run Songes datée → +2 h", () => {
        const range = songesMirrorRange(new Date("2026-10-21T19:00:00Z"));
        expect(range?.start.toISOString()).toBe("2026-10-21T19:00:00.000Z");
        expect(range!.end.getTime() - range!.start.getTime()).toBe(AGENDA_MIRROR_DURATION_MS);
    });

    it("djMirrorModeLabel replie l'inconnu sur DJ (jamais undefined)", () => {
        expect(djMirrorModeLabel("QUELQUE_CHOSE")).toBe("DJ");
        expect(djMirrorModeLabel(null)).toBe("DJ");
    });
});

describe("agenda-mirror — statuts de fin (filigrane Terminé)", () => {
    it("post fermé/expiré → COMPLETED (gardé avec filigrane, pas supprimé)", () => {
        expect(djMirrorStatus("CLOSED")).toBe("COMPLETED");
        expect(djMirrorStatus("EXPIRED")).toBe("COMPLETED");
        expect(djMirrorStatus("OPEN")).toBe("PUBLISHED");
        expect(djMirrorStatus("FULL")).toBe("PUBLISHED");
    });

    it("run clôturée/échouée → COMPLETED, abandonnée → CANCELLED", () => {
        expect(songesMirrorStatus("COMPLETED")).toBe("COMPLETED");
        expect(songesMirrorStatus("FAILED")).toBe("COMPLETED");
        expect(songesMirrorStatus("ABANDONED")).toBe("CANCELLED");
        expect(songesMirrorStatus("IN_PROGRESS")).toBe("PUBLISHED");
        expect(songesMirrorStatus("RECRUITING")).toBe("PUBLISHED");
    });
});

describe("agenda-mirror — enrichissement borné (ni vide ni blob)", () => {
    it("classes agrégées par effectif, bornées à 8", () => {
        const classes = aggregateMirrorClasses(["Cra", "cra", "Eni", null, "", "Cra"]);
        expect(classes[0]).toEqual({ classe: "Cra", count: 2 });
        expect(classes).toHaveLength(3);
        expect(aggregateMirrorClasses(Array(20).fill("X"))).toHaveLength(1);
    });

    it("succès dédupliqués, bornés à 5", () => {
        expect(pickMirrorAchievements(["A", "A", "B", null])).toEqual(["A", "B"]);
        expect(pickMirrorAchievements(Array(9).fill("S"))).toHaveLength(1);
    });

    it("message borné à 500, null si vide", () => {
        expect(mirrorMessage(null)).toBeNull();
        expect(mirrorMessage("   ")).toBeNull();
        expect(mirrorMessage("hello")).toBe("hello");
        expect(mirrorMessage("x".repeat(900))!.length).toBeLessThanOrEqual(501);
    });

    it("détail multi borné à 5 lignes", () => {
        const lines = mirrorMultiLines([
            { name: "A", targetDate: "2026-10-20T20:00:00Z" },
            { name: "", targetDate: "nawak" },
        ]);
        expect(lines[0]).toEqual({ name: "A", date: "2026-10-20T20:00:00.000Z" });
        expect(lines[1]).toEqual({ name: "Donjon", date: null });
    });
});

describe("agenda-mirror — détection (modale lecture seule)", () => {
    it("reconnaît un miroir DJ / Songes et retrouve sa source", () => {
        const dj = { source: { kind: "DJ", djPostId: "abc" } };
        const songes = { source: { kind: "SONGES", dreamRunId: "run1" } };
        expect(isAgendaMirror(dj)).toBe(true);
        expect(isAgendaMirror(songes)).toBe(true);
        expect(agendaMirrorSource(dj)).toEqual({ kind: "DJ", id: "abc" });
        expect(agendaMirrorSource(songes)).toEqual({ kind: "SONGES", id: "run1" });
    });

    it("un event normal n'est jamais un miroir", () => {
        expect(isAgendaMirror(null)).toBe(false);
        expect(isAgendaMirror({})).toBe(false);
        expect(isAgendaMirror({ source: { kind: "DJ" } })).toBe(false);
        expect(agendaMirrorSource({ source: { kind: "DJ" } })).toBeNull();
    });
});

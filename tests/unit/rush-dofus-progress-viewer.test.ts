import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { scopeGuildProgressForViewer } from "@/lib/rush-dofus-progress";

/**
 * Panneau « Progression Guilde par Dofus » — le lecteur ne doit pas voir ses mules
 * fusionnées avec son personnage actif.
 *
 * Mesure du 25/11/2026 : profil à 2 emplacements (principal 2 blocs validés, mule 6),
 * cartes à 100 % et quêtes validées après le reset du principal. La règle « moi = mon
 * personnage actif, les autres = la guilde » reprend la convention de
 * `getRushDungeonStates` (mine = characterSlot, others = les membres).
 */

const row = (
    profileId: string,
    characterSlot: string | null | undefined,
    milestoneId: string,
    isCompleted = false
) => ({ profileId, characterSlot, milestoneId, isCompleted });

describe("périmètre du panneau de guilde — un lecteur = son personnage actif", () => {
    it("garde le personnage actif du lecteur et écarte ses mules", () => {
        const rows = [
            row("moi", "PRINCIPAL", "bloc-principal", true),
            row("moi", "Mule-1", "bloc-mule", true),
        ];

        const out = scopeGuildProgressForViewer(rows, {
            profileId: "moi",
            characterSlot: "PRINCIPAL",
        });

        expect(out.map((r) => r.milestoneId)).toEqual(["bloc-principal"]);
    });

    it("suit la mule quand elle est le personnage actif", () => {
        const rows = [
            row("moi", "PRINCIPAL", "bloc-principal", true),
            row("moi", "Mule-1", "bloc-mule", true),
        ];

        const out = scopeGuildProgressForViewer(rows, {
            profileId: "moi",
            characterSlot: "Mule-1",
        });

        expect(out.map((r) => r.milestoneId)).toEqual(["bloc-mule"]);
    });

    it("garde tous les emplacements des autres membres (vue guilde intacte)", () => {
        const rows = [
            row("moi", "PRINCIPAL", "a", true),
            row("autre", "PRINCIPAL", "b", true),
            row("autre", "Mule-2", "c", true),
        ];

        const out = scopeGuildProgressForViewer(rows, {
            profileId: "moi",
            characterSlot: "PRINCIPAL",
        });

        expect(out.map((r) => r.milestoneId)).toEqual(["a", "b", "c"]);
    });

    it("normalise un emplacement absent en PRINCIPAL", () => {
        const rows = [row("moi", null, "a", true), row("moi", undefined, "b", true)];

        const out = scopeGuildProgressForViewer(rows, {
            profileId: "moi",
            characterSlot: "PRINCIPAL",
        });

        expect(out).toHaveLength(2);
    });

    it("ne filtre pas sans profil lecteur — aucune ligne cachée", () => {
        const rows = [row("moi", "Mule-1", "a"), row("autre", "PRINCIPAL", "b")];

        const out = scopeGuildProgressForViewer(rows, {
            profileId: null,
            characterSlot: "PRINCIPAL",
        });

        expect(out).toEqual(rows);
        expect(out).not.toBe(rows);
    });

    it("cas mesuré : la mule à 6 blocs ne maintient plus le panneau après le reset du principal", () => {
        const rows = Array.from({ length: 6 }, (_, index) =>
            row("moi", "Mule-1", `bloc-mule-${index}`, true)
        );

        // Le reset efface les lignes du principal : la vue de son personnage actif est vide.
        const out = scopeGuildProgressForViewer(rows, {
            profileId: "moi",
            characterSlot: "PRINCIPAL",
        });

        expect(out).toHaveLength(0);
    });
});

const PANEL =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const CLIENT =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PAGE =
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("branchement du périmètre dans le guide interne", () => {
    it("le panneau applique la règle et les deux props du personnage actif", () => {
        const panel = read(PANEL);
        expect(panel).toContain("scopeGuildProgressForViewer");
        expect(panel).toContain("visibleProgress");
        expect(panel).toContain("activeCharacterSlot");
        expect(panel).toContain("viewerProfileId");
    });

    it("le client transmet le profil du lecteur et l'emplacement sélectionné", () => {
        const client = read(CLIENT);
        expect(client).toContain("viewerProfileId={currentProfileId}");
        expect(client).toContain('activeCharacterSlot={effectiveAltPseudo ?? "PRINCIPAL"}');
        expect(read(PAGE)).toContain("currentProfileId={user.profileId ?? undefined}");
    });
});

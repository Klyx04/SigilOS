/**
 * Lien « quêtes Dofus » d'une fiche boss — **plus de 404 fabriqué**.
 *
 * Défaut mesuré le 30/10/2026 : la fiche boss interne construisait
 * `/dashboard/<guild>/quetes-dofus/guide/<slug>` (constat user : `du-cauchemar` → 404). La page
 * `/quetes-dofus/<slug>` existe ; le segment `/guide/` est une invention — `du-cauchemar` est un
 * `DofusItem`, pas un `OptimizedGuide`.
 *
 * Et l'en-tête de groupe affichait un **trophée** de succès là où il s'agit de quêtes : la vraie
 * icône du client (`btnIcon_quest.png`, repli `quests.png`) est désormais utilisée sur les deux
 * surfaces (interne et publique).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dofusQuestHref } from "@/lib/dofus-quest-link";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const INTERNAL = "src/components/succes/SuccesBossQuests.tsx";
const PUBLIC = "src/app/boss/[dungeonId]/_components/PublicBossQuestsTab.tsx";

describe("dofusQuestHref — la page Dofus, jamais un segment inventé", () => {
    it("vise `/quetes-dofus/<slug>`", () => {
        expect(dofusQuestHref("g1", "du-cauchemar")).toBe("/dashboard/g1/quetes-dofus/du-cauchemar");
    });

    it("retombe sur la racine quand le slug manque", () => {
        expect(dofusQuestHref("g1", null)).toBe("/dashboard/g1/quetes-dofus");
        expect(dofusQuestHref("g1", undefined)).toBe("/dashboard/g1/quetes-dofus");
        expect(dofusQuestHref("g1", "   ")).toBe("/dashboard/g1/quetes-dofus");
    });

    it("encode le slug (aucune URL cassée par un caractère réservé)", () => {
        expect(dofusQuestHref("g1", "dofus/émeraude")).toBe("/dashboard/g1/quetes-dofus/dofus%2F%C3%A9meraude");
    });
});

describe("Fiche boss — le lien et l'icône disent la vérité", () => {
    it("la surface interne n'invente plus `/guide/`", () => {
        const src = codeOf(INTERNAL);
        expect(src).not.toContain("/guide/${");
        expect(src).toContain("dofusQuestHref(guildId, group.dofusSlug)");
    });

    it("les deux surfaces utilisent la vraie icône de quête", () => {
        expect(read(INTERNAL)).toContain("/assets/dofus/icons/btnIcon_quest.png");
        expect(read(PUBLIC)).toContain("/assets/dofus/icons/btnIcon_quest.png");
        // Repli final identique des deux côtés.
        expect(read(INTERNAL)).toContain("/assets/dofus/icons/quests.png");
        expect(read(PUBLIC)).toContain("/assets/dofus/icons/quests.png");
    });

    it("le trophée « succès » a quitté l'en-tête du groupe public", () => {
        expect(codeOf(PUBLIC)).not.toContain("/assets/dofus/icons/success.png");
    });

    it("la fiche publique ne fabrique aucun lien interne (identité seule)", () => {
        expect(codeOf(PUBLIC)).not.toContain("dofusQuestHref");
        expect(codeOf(PUBLIC)).not.toContain("next/link");
    });
});

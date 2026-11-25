import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { pickBlockBookmarkSequence } from "@/lib/rush-block-bookmark";

/**
 * Quick wins du 25/11/2026 :
 *  · « Je suis ici » sur un bloc dont toutes les quêtes sont verrouillées ;
 *  · affordance de clic dans la fiche Dofus ;
 *  · première page de la modale « Ressources à prévoir » (442 lignes).
 */

const seq = (id: string) => ({ id });

describe("« Je suis ici » — un repère est une position, pas une validation", () => {
    it("choisit la première quête non terminée même si toutes sont verrouillées", () => {
        const target = pickBlockBookmarkSequence(
            [seq("a"), seq("b")],
            () => false,
            () => true
        );
        expect(target?.id).toBe("a");
    });

    it("préfère une quête jouable quand il y en a une", () => {
        const target = pickBlockBookmarkSequence(
            [seq("a"), seq("b")],
            () => false,
            (s) => s.id === "a"
        );
        expect(target?.id).toBe("b");
    });

    it("ignore les quêtes déjà terminées", () => {
        const target = pickBlockBookmarkSequence(
            [seq("a"), seq("b"), seq("c")],
            (s) => s.id !== "b",
            () => true
        );
        expect(target?.id).toBe("b");
    });

    it("retombe sur la première quête quand tout est terminé, et null sans quête", () => {
        expect(
            pickBlockBookmarkSequence([seq("a"), seq("b")], () => true, () => true)?.id
        ).toBe("a");
        expect(pickBlockBookmarkSequence([], () => false, () => false)).toBeNull();
    });
});

const CLIENT = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const DOFUS_MODAL = "src/components/dofus-quests/rush/RushDofusDetailModal.tsx";
const RESOURCES_MODAL =
    "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal.tsx";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("quick wins — branchement", () => {
    it("le bouton de bloc utilise la règle de repère", () => {
        expect(read(CLIENT)).toContain("pickBlockBookmarkSequence(nonInfoSeqs");
    });

    it("la fiche Dofus montre le clic au survol et au focus", () => {
        const modal = read(DOFUS_MODAL);
        expect(modal).toContain("hover:bg-elevated");
        expect(modal).toContain("focus-visible:outline-2");
        expect(modal).toContain("group-hover:text-success");
    });

    it("la modale Ressources rend une première page, puis « Afficher plus »", () => {
        const modal = read(RESOURCES_MODAL);
        expect(modal).toContain("RESOURCE_PAGE_SIZE = 60");
        expect(modal).toContain("const shown = visible.slice(0, visibleCount)");
        expect(modal).toContain("Afficher plus (");
        expect(modal).toContain("{shown.map((r) =>");
    });
});

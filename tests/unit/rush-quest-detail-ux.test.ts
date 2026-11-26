import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Retours user du 26/11/2026 sur la fiche de quête et la fiche Dofus :
 *  · les monstres « à combattre » doivent ouvrir leur fiche, pas rester des chips mortes ;
 *  · les favicons DofusNoobs / DofusDB doivent être à côté de la position, pas seulement
 *    dans une section « Liens » en bas ;
 *  · les personnages d'un même compte ne s'empilent plus dans la fiche Dofus.
 *
 * Le câblage est verrouillé par lecture de source (même convention que les autres
 * gardes d'UI du module Rush) ; les règles pures sont testées à part.
 */

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("fiche de quête — monstres et sources", () => {
    it("les espèces à combattre ouvrent la fiche interne", () => {
        const source = read("src/components/dofus-quests/rush/RushQuestConstraints.tsx");
        expect(source).toContain("RushMonsterFicheModal");
        expect(source).toContain("monsterIdFromImageUrl(mob.imageUrl)");
        expect(source).toContain("setFiche({ slug: String(monsterId), name: mob.name })");
        expect(source).toContain('viewer === "member"');
        expect(source).toContain('viewer === "visitor"');
    });

    it("les favicons DofusNoobs / DofusDB vivent à côté de la position", () => {
        const source = read(
            "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx"
        );
        expect(source).toContain("const sourceLinks");
        expect(source).toContain("noobsIcon");
        expect(source).toContain("dbIcon");
        expect(source).toContain("{sourceLinks ?");
        // Le bas de fiche ne doit plus répéter les mêmes liens.
        expect(source).not.toContain("<p className={sectionLabel}>Liens</p>");
    });
});

describe("fiche Dofus — un compte, une ligne", () => {
    it("groupe les mules et affiche la classe à côté du pseudo", () => {
        const source = read("src/components/dofus-quests/rush/RushDofusDetailModal.tsx");
        expect(source).toContain("groupDofusMembersByOwner");
        expect(source).toContain("primaryDofusMember");
        expect(source).toContain("getClass(primary.dofusClass)");
        expect(source).toContain("+{extra}");
    });
});

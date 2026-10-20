/**
 * Garde — PARITÉ des onglets de fiche boss entre la fiche PUBLIQUE (`/boss/<slug>`)
 * et les fiches INTERNES du module Succès (donjon, avis de recherche).
 *
 * Défaut mesuré (11/10/2026) : l'interne ne proposait que 5 onglets (sorts, sim,
 * butin, salle, quêtes) là où le public en proposait 8 (manquaient : Stratégie,
 * Rangs & Paliers, Succès du donjon), et chaque surface portait **sa propre**
 * définition (deux listes à maintenir à la main ⇒ divergence silencieuse).
 *
 * 🛡️ Une seule définition désormais : `@/lib/boss-fiche-tabs`. Ce test verrouille
 * à la fois la règle (unitaire) et le câblage (les trois surfaces consomment la
 * source partagée, aucune ne redéclare sa liste).
 *
 * Lecture seule : aucune base, aucun rendu navigateur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
    BOSS_FICHE_TAB_ICONS,
    BOSS_FICHE_TAB_ORDER,
    buildBossFicheTabs,
    type BossFicheTabCounts,
} from "@/lib/boss-fiche-tabs";

const PUBLIC_FICHE = "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx";
const INTERNAL_DUNGEON = "src/components/succes/SuccesBossGuide.tsx";
// Fiche d'avis : le RENDU vit dans `BountyFicheView` (partagé avec la carte du monde),
// `SuccesAvisTab` n'en est que l'hôte (liste à gauche + rendu à droite).
const INTERNAL_BOUNTY = "src/components/succes/BountyFicheView.tsx";
const AVIS_HOST = "src/components/succes/SuccesAvisTab.tsx";

const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ALL: BossFicheTabCounts = { grades: 5, roomMonsters: 4, quests: 3, achievements: 2 };
const idsOf = (tabs: { id: string }[]) => tabs.map((t) => t.id);


describe("buildBossFicheTabs — jeu d'onglets canonique", () => {
    it("avec toutes les données : les onglets utiles, dans l'ordre canonique", () => {
        const tabs = buildBossFicheTabs({ entity: "dungeon", counts: ALL, hasMechanics: true });
        // L'onglet « Monstres » est réservé à la fiche d'un monstre : sur un donjon, il
        // doublonnait « Monstres de la salle » (les 8 sont inclus dans les 10).
        expect(idsOf(tabs)).toEqual([
            "sorts",
            "sim",
            "strategy",
            "grades",
            "loot",
            "family",
            "quests",
            "achievements",
        ]);
        expect(idsOf(tabs)).not.toContain("monsters");
    });

    it("l'onglet « Monstres » n'existe plus (doublon supprimé le 20/10/2026)", () => {
        // Il était toujours masqué (les monstres normaux sont un sous-ensemble des monstres de
        // salle) : le lien bestiaire vit désormais sur la carte, pas dans un onglet.
        const monster = buildBossFicheTabs({ entity: "monster", counts: ALL, hasMechanics: true });
        expect(idsOf(monster)).not.toContain("monsters");
    });

    it("chaque onglet porte un libellé et un picto local (aucun hotlink)", () => {
        const tabs = buildBossFicheTabs({ entity: "dungeon", counts: ALL, hasMechanics: true });
        for (const tab of tabs) {
            expect(tab.label.length).toBeGreaterThan(0);
            expect(tab.icon).toBe(BOSS_FICHE_TAB_ICONS[tab.id]);
            expect(tab.icon.startsWith("/assets/")).toBe(true);
        }
        // Le registre d'icônes couvre exactement les 8 onglets (une surface ne peut pas en oublier un).
        expect(Object.keys(BOSS_FICHE_TAB_ICONS).sort()).toEqual([...BOSS_FICHE_TAB_ORDER].sort());
    });

    it("les onglets sans donnée sortent (jamais d'onglet vide)", () => {
        const tabs = buildBossFicheTabs({
            entity: "dungeon",
            counts: { grades: 1, roomMonsters: 1, quests: 0, achievements: 0 },
            hasMechanics: false,
        });
        // `sorts`, `sim` et `loot` sont toujours là : leurs vues gèrent l'état vide.
        expect(idsOf(tabs)).toEqual(["sorts", "sim", "loot"]);
    });

    it("règles de masquage, une par donnée manquante", () => {
        const base = { entity: "dungeon" as const, counts: ALL, hasMechanics: true };
        expect(idsOf(buildBossFicheTabs({ ...base, hasMechanics: false }))).not.toContain("strategy");
        expect(idsOf(buildBossFicheTabs({ ...base, counts: { ...ALL, grades: 1 } }))).not.toContain("grades");
        expect(idsOf(buildBossFicheTabs({ ...base, counts: { ...ALL, roomMonsters: 1 } }))).not.toContain("family");
        expect(idsOf(buildBossFicheTabs({ ...base, counts: { ...ALL, quests: 0 } }))).not.toContain("quests");
        expect(idsOf(buildBossFicheTabs({ ...base, counts: { ...ALL, achievements: 0 } }))).not.toContain("achievements");
    });

    it("les libellés à badge portent leur compteur ; la locale change les mots, pas les onglets", () => {
        const fr = buildBossFicheTabs({ entity: "bounty", counts: ALL, hasMechanics: true });
        const en = buildBossFicheTabs({ entity: "bounty", counts: ALL, hasMechanics: true, locale: "en" });
        expect(fr.find((t) => t.id === "grades")?.label).toBe("Rangs & Paliers (5)");
        expect(en.find((t) => t.id === "grades")?.label).toBe("Ranks & Levels (5)");
        expect(fr.find((t) => t.id === "sorts")?.label).toBe("Sorts du monstre recherché");
        expect(en.find((t) => t.id === "quests")?.label).toBe("Linked Quests (3)");
        // Le JEU d'onglets est indépendant de la nature de l'entité et de la locale.
        for (const entity of ["dungeon", "bounty", "titan", "anomaly", "raid", "monster"] as const) {
            expect(idsOf(buildBossFicheTabs({ entity, counts: ALL, hasMechanics: true }))).toEqual(idsOf(fr));
        }
        // Une fiche de **monstre normal** nomme ses sorts comme tels (parité des surfaces).
        expect(buildBossFicheTabs({ entity: "monster", counts: ALL, hasMechanics: true }).find((t) => t.id === "sorts")?.label)
            .toBe("Sorts du monstre");
    });
});



describe("Parité — la MÊME définition dans les trois surfaces", () => {
    for (const [surface, path] of [
        ["fiche publique", PUBLIC_FICHE],
        ["fiche donjon interne", INTERNAL_DUNGEON],
        ["fiche avis interne", INTERNAL_BOUNTY],
    ] as const) {
        it(`${surface} consomme la source partagée`, () => {
            const code = codeOf(path);
            expect(code, `${surface} n'importe pas la source partagée`).toMatch(
                /import \{[^}]*buildBossFicheTabs[^}]*\} from "@\/lib\/boss-fiche-tabs"/
            );
            expect(code, `${surface} n'appelle pas le constructeur partagé`).toMatch(/buildBossFicheTabs\(\{/);
        });

        it(`${surface} ne redéclare plus sa liste d'onglets`, () => {
            const code = codeOf(path);
            // Aucun picto d'onglet en dur (ils viennent de `BOSS_FICHE_TAB_ICONS`).
            expect(code, `${surface} code encore un picto d'onglet en dur`).not.toMatch(
                /asset: "\/assets\/dofus\/(modules|icons)\//
            );
            // Aucune seconde table d'onglets locale.
            expect(code, `${surface} porte encore une liste d'onglets locale`).not.toMatch(/const tabs = \(\s*\[/);
        });
    }

    it("la fiche donjon interne expose bien les 3 onglets qui manquaient + l'onglet Monstres", () => {
        const code = codeOf(INTERNAL_DUNGEON);
        // On les rend par les composants publics/partagés (aucun recodage).
        expect(code).toMatch(/detailTab === "strategy"/);
        expect(code).toMatch(/detailTab === "grades"/);
        expect(code).toMatch(/detailTab === "achievements"/);
        expect(code).toMatch(/<SuccesBossEncyclo/);
        expect(code).toMatch(/<PublicBossAchievementsTab/);
    });

    it("la fiche avis est un rendu PARTAGÉ (aucun doublon dans son hôte)", () => {
        expect(codeOf(INTERNAL_BOUNTY)).toMatch(/detailTab === "grades"/);
        expect(codeOf(INTERNAL_BOUNTY)).toMatch(/<SuccesBossEncyclo/);
        expect(codeOf(INTERNAL_BOUNTY)).not.toMatch(/detailTab === "info"/);
        // L'hôte (module Succès) REND ce composant au lieu de le redéfinir.
        expect(codeOf(AVIS_HOST)).toMatch(/<BountyFicheView/);
        expect(codeOf(AVIS_HOST)).not.toMatch(/<SuccesBossEncyclo/);
    });

    it("la carte du monde rend LA MÊME fiche d'avis (une seule définition)", () => {
        const code = codeOf("src/components/worldmap/ZoneDetailModal.tsx");
        expect(code).toMatch(/<BountyFicheView/);
        expect(code).toMatch(/getBountyFiche\(/);
    });

    it("le lien bestiaire est porté par les cartes de salle (l'onglet « Monstres » a disparu)", () => {
        for (const path of [PUBLIC_FICHE, INTERNAL_DUNGEON]) {
            const code = codeOf(path);
            expect(code, path).toMatch(/monsterFicheHref\(/);
            // Le doublon d'onglets a été supprimé le 20/10/2026 : les monstres normaux sont
            // un sous-ensemble des monstres de la salle, le lien remplace l'onglet.
            expect(code, path).not.toMatch(/detailTab === "monsters"/);
        }
    });
});


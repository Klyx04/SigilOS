/**
 * Gardes — filtre d'affichage de la liste des quêtes (overlay).
 *
 * 🎯 Demande user (02/11/2026) : un contrôle segmenté « Toutes / En cours /
 * Verrouillées », dans la DA « Carnet de campagne » (l'actif prend le filet d'or).
 *
 * 🛡️ Ce que ce test verrouille :
 *  · « En cours » = ni terminée, ni verrouillée ; « Verrouillées » = bloquée **non
 *    terminée** (une quête faite n'est jamais verrouillée, même si l'entrée est
 *    incohérente) ;
 *  · **l'ordre de la source est conservé** (on filtre, on ne trie pas) ;
 *  · l'overlay monte le contrôle et applique la règle à la liste du chapitre ;
 *  · le contrôle est un `role="group"` de boutons `aria-pressed`, pas une navigation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { filterRushQuests, matchesRushQuestFilter, nextQuestId } from "@/lib/rush-quest-filter";

const q = (id: string, isDone = false, isLocked = false) => ({ id, isDone, isLocked });

describe("matchesRushQuestFilter", () => {
    it("« Toutes » ne filtre rien", () => {
        expect(matchesRushQuestFilter(q("a"), "all")).toBe(true);
        expect(matchesRushQuestFilter(q("b", true), "all")).toBe(true);
        expect(matchesRushQuestFilter(q("c", false, true), "all")).toBe(true);
    });

    it("« En cours » garde les quêtes disponibles", () => {
        expect(matchesRushQuestFilter(q("a"), "active")).toBe(true);
        expect(matchesRushQuestFilter(q("b", true), "active")).toBe(false);
        expect(matchesRushQuestFilter(q("c", false, true), "active")).toBe(false);
    });

    it("« Verrouillées » garde les quêtes bloquées non terminées", () => {
        expect(matchesRushQuestFilter(q("a"), "locked")).toBe(false);
        expect(matchesRushQuestFilter(q("b", true), "locked")).toBe(false);
        expect(matchesRushQuestFilter(q("c", false, true), "locked")).toBe(true);
        // Incohérence d'entrée : une quête terminée n'est jamais « verrouillée ».
        expect(matchesRushQuestFilter(q("d", true, true), "locked")).toBe(false);
    });
});

describe("filterRushQuests — l'ordre de la source est conservé", () => {
    const list = [q("a"), q("b", false, true), q("c", true), q("d")];

    it("ne trie jamais : chaque filtre garde l'ordre d'origine", () => {
        expect(filterRushQuests(list, "all").map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
        expect(filterRushQuests(list, "active").map((x) => x.id)).toEqual(["a", "d"]);
        expect(filterRushQuests(list, "locked").map((x) => x.id)).toEqual(["b"]);
    });
});

describe("câblage de l'overlay", () => {
    const GUIDE = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
    const FILTER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestFilter.tsx";

    it("l'overlay monte le filtre et l'applique à la liste du chapitre", () => {
        const src = readFileSync(GUIDE, "utf8");
        expect(src).toMatch(/<RushOverlayQuestFilter/);
        expect(src).toMatch(/matchesRushQuestFilter/);
        expect(src).toMatch(/questFilter !== "all"/);
    });

    it("le contrôle est un groupe accessible, avec trois blocs séparés et l'or actif", () => {
        const src = readFileSync(FILTER, "utf8");
        expect(src).toContain('role="group"');
        expect(src).toContain('aria-label="Filtrer les quêtes"');
        expect(src).toContain("aria-pressed={active}");
        for (const label of ["Toutes", "En cours", "Verrouillées"]) expect(src).toContain(label);
        // DA « Gouache Wakfu » : le segment actif se signale par le trait de
        // pinceau sous le texte (peint par `.da-filters`), plus par une plaque
        // dorée — le composant ne code donc plus aucune couleur d'état.
        expect(src).toContain("da-filters");
        expect(src).not.toContain("border-gold/60");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DA « Gouache Wakfu » (E1e ④) : « à faire maintenant » est une règle PURE.
// Elle sert le nœud accentué, le bouton « Reprendre » et l'arrêt du fil de sève :
// une seule vérité, sinon les trois désignent trois quêtes différentes.
// ─────────────────────────────────────────────────────────────────────────────
describe("nextQuestId — la prochaine quête à faire", () => {
    const q = (id: string, isDone = false, isLocked = false) => ({ id, isDone, isLocked });

    it("rend la PREMIÈRE quête ni validée ni verrouillée, dans l'ordre du guide", () => {
        expect(nextQuestId([q("a", true), q("b", true), q("c"), q("d")])).toBe("c");
    });

    it("saute les verrouillées et les validées", () => {
        expect(nextQuestId([q("a", false, true), q("b", true), q("c")])).toBe("c");
    });

    it("ne rend rien quand tout est fait (ou tout verrouillé)", () => {
        expect(nextQuestId([q("a", true), q("b", true)])).toBeNull();
        expect(nextQuestId([q("a", false, true)])).toBeNull();
        expect(nextQuestId([])).toBeNull();
    });
});

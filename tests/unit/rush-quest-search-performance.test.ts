/**
 * Verrou de performance — recherche de quête (26/11/2026).
 *
 * Demande user (verbatim) : « la recherche de quete lag assez fort ».
 *
 * Mesure : chaque touche relisait et normalisait tous les champs de toutes les
 * quêtes (nom, tips, note, donjons, tags) avant de re-rendre le guide. Correctif
 * commun aux trois surfaces : `useDeferredValue` pour garder le champ réactif et
 * un index construit UNE fois par guide côté dashboard / overlay.
 *
 * Lecture seule : aucun rendu, aucune base.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUB = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

describe("recherche de quête — la frappe reste réactive", () => {
  it("overlay : valeur différée + index de recherche unique", () => {
    const src = read(OVERLAY);
    expect(src).toContain("useDeferredValue(search)");
    expect(src).toContain("const searchIndex = useMemo(");
    expect(src).toContain("entry.haystack.includes(q)");
  });

  it("dashboard : valeur différée + index normalisé construit une fois", () => {
    const src = read(DASH);
    expect(src).toContain("useDeferredValue(searchQuery)");
    expect(src).toContain("const searchIndex = useMemo(");
    expect(src).toContain("entry.haystack.includes(q)");
    // L'ancienne boucle normalisait chaque champ à chaque touche.
    expect(src).not.toContain("fields.some(f => f && normalizeSearch(f).includes(q))");
  });

  it("guide public : valeur différée dans le filtre des blocs", () => {
    const src = read(PUB);
    expect(src).toContain("useDeferredValue(searchQuery)");
    expect(src).toContain("deferredSearchQuery.trim().length > 0");
    expect(src).not.toMatch(/if \(searchQuery\.trim\(\)\.length > 0\) \{\s*const q = searchQuery\.toLowerCase\(\)/);
  });
});

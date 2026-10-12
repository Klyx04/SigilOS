/**
 * Garde — une quête VERROUILLÉE (prérequis non terminés) et une quête REPÉRÉE
 * (« Je suis ici ») ne doivent JAMAIS se peindre de la même couleur.
 *
 * 🎯 Défaut mesuré (user, 21/09/2026) : « la couleur de fond d'une quête prérequis
 * bloqué et une quête jalonée sont identiques faut revoir ca, idem dans les overlay,
 * change valable public et interne ». Les deux états étaient ambre : la carte bloquée
 * en `bg-warning/[0.04] border-warning/25`, la carte repérée en `bg-warning/10
 * border-warning/40` — deux teintes voisines sur fond sombre (et côté overlay, la carte
 * bloquée restait carrément neutre, seul l'encart « À terminer avant » disait le verrou).
 *
 * ✅ Règle retenue (sémantique, pas décoration) : le VERROU est `danger` (rouge, avec
 * cadenas + libellé rouges), le REPÈRE reste `warning` (ambre, + filet gauche dans l'overlay).
 *
 * 🛡️ Câblage vérifié sur les sources, commentaires retirés (la prose ne fait pas passer
 * le test). Les deux surfaces partagées sont concernées : dashboard interne et overlay
 * (`RushOverlayQuestListItem` sert l'overlay interne ET public). Le guide public n'a pas
 * d'état « bloqué » (aucun verrou côté visiteur). Lecture seule : aucun rendu, aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const OVERLAY_ITEM = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const DASH = codeOf(DASHBOARD);
const ITEM = codeOf(OVERLAY_ITEM);

describe("Dashboard — quête bloquée (rouge) ≠ quête repérée (ambre)", () => {
  it("la carte bloquée par un prérequis passe en danger", () => {
    expect(DASH).toMatch(/bg-danger\/\[0\.05\] border-danger\/30/);
    // L'ancienne teinte ambre du blocage ne doit pas revenir.
    expect(DASH).not.toMatch(/bg-warning\/\[0\.04\] border-warning\/25/);
  });

  it("cadenas, nom du prérequis et chips sont rouges (même état, même couleur)", () => {
    expect(DASH).toMatch(/Lock className="w-3\.5 h-3\.5 text-danger/);
    expect(DASH).toMatch(/text-danger truncate">\{singleName\}/);
    expect(DASH).toMatch(/font-semibold text-danger border border-danger\/30 hover:bg-danger\/10/);
    expect(DASH).toMatch(/outline-danger\/50/);
  });

  it("la carte repérée reste ambre (le repère n'est pas un blocage)", () => {
    expect(DASH).toMatch(/isThisBookmarked\s*\?\s*"border-warning\/40 bg-warning\/10"/);
  });
});

describe("Overlay — verrou (danger) ≠ repère (ambre), pour l'interne comme le public", () => {
  it("la carte verrouillée porte une teinte danger", () => {
    expect(ITEM).toMatch(/isLocked\s*\?\s*"border-danger\/30 bg-danger\/\[0\.05\]"/);
  });

  it("la carte repérée garde son ambre et son filet gauche", () => {
    expect(ITEM).toMatch(
      /isBookmarked\s*\?\s*"border-warning\/40 border-l-\[3px\] border-l-warning bg-warning\/10"/
    );
  });

  it("les chips de prérequis ne sont plus ambre", () => {
    expect(ITEM).not.toMatch(/border-warning\/40 bg-warning\/10 px-1\.5 py-0\.5/);
    expect(ITEM).toMatch(/border-danger\/40 bg-danger\/10 px-1\.5 py-0\.5/);
  });
});

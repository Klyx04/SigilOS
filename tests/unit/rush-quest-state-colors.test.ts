/**
 * Garde — une quête VERROUILLÉE (prérequis non terminés) et une quête REPÉRÉE
 * (« Je suis ici ») ne doivent JAMAIS se peindre de la même façon.
 *
 * 🎯 Défaut mesuré (user, 21/09/2026) : « la couleur de fond d'une quête prérequis
 * bloqué et une quête jalonée sont identiques faut revoir ca, idem dans les overlay ».
 *
 * ✅ Règle retenue, réécrite avec la DA (E3, 05/11/2026) : chaque état a son
 * **attribut**, et la feuille le peint. `data-state="locked"` ⇒ nœud pointillé +
 * carte à 78 % ; `data-here="true"` ⇒ accent du bloc, teinte légère. Le jaune du
 * repère n'est plus une classe Tailwind posée à la main : même information, une
 * seule source de vérité visuelle, identique au guide public et à l'overlay.
 *
 * 🛡️ Câblage vérifié sur les sources, commentaires retirés (la prose ne fait pas passer
 * le test). Lecture seule : aucun rendu, aucune base.
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
const DA_CSS = codeOf("src/app/da-wakfu.css");

describe("Dashboard — quête bloquée ≠ quête repérée (deux attributs, deux peintures)", () => {
  it("la carte bloquée est un `da-row[data-state=locked]`, pas un cadre rouge", () => {
    expect(DASH).toMatch(/data-state="locked"/);
    // La peinture est dans la feuille de la DA : nœud pointillé + carte atténuée.
    expect(DA_CSS).toMatch(
      /\.da-row\[data-state="locked"\] \.da-node::before\s*\{[^}]*border-style:\s*dashed/
    );
    expect(DA_CSS).toMatch(/\.da-row\[data-state="locked"\] \.da-card\s*\{\s*opacity:\s*\.78/);
    // Les anciennes teintes de blocage ne doivent pas revenir.
    expect(DASH).not.toMatch(/bg-danger\/\[0\.05\] border-danger\/30/);
    expect(DASH).not.toMatch(/bg-warning\/\[0\.04\] border-warning\/25/);
  });

  it("cadenas, nom du prérequis et chips restent rouges (même état, même couleur)", () => {
    expect(DASH).toMatch(/Lock className="w-3\.5 h-3\.5 text-danger/);
    expect(DASH).toMatch(/text-danger truncate">\{singleName\}/);
    expect(DASH).toMatch(/font-semibold text-danger border border-danger\/30 hover:bg-danger\/10/);
    expect(DASH).toMatch(/outline-danger\/50/);
  });

  it("la carte repérée a SON attribut (`data-here`), distinct du verrou", () => {
    expect(DASH).toMatch(/data-here=\{isThisBookmarked \? "true" : undefined\}/);
    // Peinte par la DA à l'accent du bloc — jamais par la règle du verrou.
    expect(DA_CSS).toMatch(/\.da-row\[data-here="true"\] \.da-card::before/);
    expect(DA_CSS).not.toMatch(/\.da-row\[data-here="true"\] \.da-node/);
  });
});

describe("Overlay — verrou (danger) ≠ repère (ambre), pour l'interne comme le public", () => {
  it("la carte verrouillée porte un filet danger à gauche, pas un cadre rouge complet", () => {
    // DA « Gouache Wakfu » : l'état est un ATTRIBUT, peint par `da-wakfu.css`.
    // Même intention — le verrou se signale sans remplir la carte de rouge.
    // Depuis E1e, la première quête ni validée ni verrouillée porte `next`.
    expect(ITEM).toMatch(/data-state=\{isDone \? "done" : isLocked \? "locked" : isNext \? "next" : "todo"\}/);
    // L'ancien cadre rouge intégral ne doit pas revenir (retour user 02/11/2026).
    expect(ITEM).not.toMatch(/border-danger\/30 bg-danger\/\[0\.05\]/);
  });

  it("la carte repérée garde son ambre et son filet gauche", () => {
    // Le repère reste DISTINCT du verrou : il a son propre attribut (`data-here`)
    // et sa propre teinte, l'accent du bloc — jamais `danger`.
    expect(ITEM).toMatch(
      /data-here=\{isBookmarked && !isDone && !isLocked \? "true" : "false"\}/
    );
  });

  it("le blocage nomme le prérequis, en danger, sans second cadenas", () => {
    expect(ITEM).not.toMatch(/border-warning\/40 bg-warning\/10 px-1\.5 py-0\.5/);
    expect(ITEM).toContain("Terminer :");
    expect(ITEM).toMatch(/text-left text-\[11px\] font-semibold text-danger/);
    expect(ITEM).not.toContain("Quête à terminer avant");
  });
});

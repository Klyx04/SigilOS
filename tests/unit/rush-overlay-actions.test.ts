/**
 * Garde — rangée d'actions de l'overlay (DA « Gouache Wakfu », lot E1e ②).
 *
 * La maquette pose deux boutons pleine largeur juste sous le dock :
 *   · « Reprendre » → retour à la prochaine quête à faire ;
 *   · « Ressources » → la modale « Ressources à prévoir », avec le compte des
 *     ressources déjà cochées.
 *
 * L'ancienne **icône** « Ressources » de l'en-tête disparaît : deux chemins pour la
 * même modale, c'était un doublon (arbitrage du 05/11/2026).
 *
 * 🛡️ Lecture seule : rendu réel du composant + câblage des deux surfaces.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayActions } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayActions";

const BASE = "src/app/overlay/guide/[guildId]/[slug]";
const SHELL = `${BASE}/GuideOverlayClient.tsx`;
const HEADER = `${BASE}/components/RushOverlayHeader.tsx`;

const html = (checked = 2, total = 8) =>
  renderToStaticMarkup(
    React.createElement(RushOverlayActions, {
      onResume: () => {},
      onOpenResources: () => {},
      checked,
      total,
    })
  );

describe("Rangée d'actions de l'overlay", () => {
  it("porte les deux actions de la maquette, dans cet ordre", () => {
    const out = html();
    expect(out).toContain("da-actions");
    expect(out).toContain("Reprendre");
    expect(out).toContain("Ressources");
    expect(out.indexOf("Reprendre")).toBeLessThan(out.indexOf("Ressources"));
    // L'action principale est la planche pleine de la DA, pas une bordure d'accent.
    expect(out).toContain('data-variant="main"');
  });

  it("affiche le compte des ressources déjà cochées", () => {
    expect(html(3, 8)).toContain(">3/8<");
    // Un guide sans ressource ne montre pas une pastille vide.
    expect(html(0, 0)).not.toContain("da-badge");
  });

  it("l'overlay monte la rangée et reprend la LISTE, jamais la fenêtre", () => {
    const shell = readFileSync(SHELL, "utf8");
    expect(shell).toMatch(/<RushOverlayActions/);
    // Le nœud du dock porte lui aussi un `data-state` : la cible est la liste.
    expect(shell).toMatch(/listRef\.current/);
    expect(shell).toMatch(/<main ref=\{listRef\}/);
    expect(shell).toMatch(/setShowResources\(true\)/);
  });

  it("l'en-tête n'a plus l'icône Ressources (un seul point d'entrée)", () => {
    const header = readFileSync(HEADER, "utf8");
    expect(header).not.toMatch(/modules\/resources\.png/);
    expect(header).not.toMatch(/onOpenResources/);
  });
});

/**
 * Gardes — **V-G** : la liaison Metamob depuis l'overlay.
 *
 * 🎯 Le cul-de-sac mesuré : `ocreEnabled = !isGuest && !!ocre && …` et `ocre = null`
 * quand le compte n'est pas lié ⇒ **le bouton archimonstre n'existait pas**, donc
 * aucune entrée pour lier son compte sans quitter la fenêtre de jeu.
 *
 * 🛡️ Ce que ce test verrouille :
 *  • l'entrée Ocre ne dépend plus des DONNÉES (membre, hors invité/public) ;
 *  • l'état « non lié » affiche un formulaire de liaison (pas une erreur) ;
 *  • ce formulaire reste **PiP-safe** : aucun `Dialog`/portail vers `document.body`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayOcreModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayOcreModal";
import { unavailableOcrePanelData } from "@/lib/ocre-soul-stones";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

const CLIENT = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const PAGE = "src/app/overlay/guide/[guildId]/[slug]/page.tsx";
const MODAL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayOcreModal.tsx";
const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";

describe("panneau Ocre — état « compte non lié »", () => {
  it("propose la liaison au lieu d'une erreur", () => {
    const html = render(
      React.createElement(RushOverlayOcreModal, {
        guildId: "g1",
        isLightMode: false,
        initial: null,
        state: "not-linked",
        onClose: () => {},
      })
    );
    expect(html).toContain("Lier mon compte Metamob");
    expect(html).toContain("Pseudo Metamob");
    expect(html).toContain("Clé API");
    expect(html).not.toContain("Metamob indisponible");
  });

  it("ne rend pas le formulaire quand les données sont disponibles", () => {
    const html = render(
      React.createElement(RushOverlayOcreModal, {
        guildId: "g1",
        isLightMode: false,
        initial: unavailableOcrePanelData(),
        state: "ready",
        onClose: () => {},
      })
    );
    expect(html).not.toContain("Lier mon compte Metamob");
  });

  it("le formulaire est PiP-safe : aucun portail ni Dialog", () => {
    const code = read(MODAL);
    const start = code.indexOf("function LinkMetamobInline");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start);
    expect(block).not.toMatch(/<Dialog/);
    expect(block).not.toMatch(/document\.body/);
    expect(block).not.toMatch(/createPortal/);
    // La liaison passe bien par l'action protégée (auth + rate limit + Zod).
    expect(block).toMatch(/linkOcreAccount\(/);
  });
});

describe("câblage V-G", () => {
  it("l'entrée Ocre ne dépend plus de la présence de données", () => {
    const code = read(CLIENT);
    expect(code).toMatch(/const ocreEnabled = !isGuest && !!guildId && guildId !== "public";/);
    expect(code).not.toMatch(/const ocreEnabled = [^;]*!!ocre[^;]*;/);
    // Le panneau est rendu même sans données (il gérera l'état « non lié »).
    expect(code).toMatch(/\{showOcre && ocreEnabled && \(/);
  });

  it("la page serveur distingue « non lié » d'une erreur Metamob", () => {
    const code = read(PAGE);
    expect(code).toMatch(/let ocreState: "ready" \| "not-linked" \| "error" = "not-linked";/);
    expect(code).toMatch(/ocreState = "ready";/);
    expect(code).toMatch(/ocreState = "error";/);
    expect(code).toMatch(/ocreState=\{ocreState\}/);
  });

  it("le bouton du header existe aussi sans résumé (compte non lié)", () => {
    const code = read(HEADER);
    expect(code).toMatch(/\{onOpenOcre && \(/);
    expect(code).not.toMatch(/\{onOpenOcre && ocre && \(/);
  });
});

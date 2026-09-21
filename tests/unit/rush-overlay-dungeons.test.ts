/**
 * Gardes — donjons d'une quête dans l'overlay, et retrait de l'encart « À FAIRE MAINTENANT ».
 *
 * 🎯 Demandes user (21/09/2026, verbatim) : « supprime dans les overlay la partie à faire
 * maintenant c'est inutile · les dj dans les quêtes : le survol doit afficher le / les dj,
 * comme le concurrent tougli, cliquable vers sa page (si overlay du guide public, page
 * publique du dj ; si overlay du guide interne, page dj du module fiche boss) · pas de
 * preview des dj ça marche pas · si ya un seul dj dans une quête tu affiches x1 ou x2 etc ·
 * icone à importer : donjon.png ».
 *
 * 🔍 Mesure : le badge « Donjon » n'avait qu'un `title` natif (aucun contenu), et l'encart doré
 * « À FAIRE MAINTENANT » répétait la première quête de la liste juste en dessous.
 *
 * 🛡️ Ce que ce test verrouille : la destination du lien (publique ↔ module), le compteur du
 * badge, le picto du jeu, la popover branchée sur ce badge, et l'absence de l'encart doré.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayDungeonCard } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard";
import { isPublicOverlay } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";

const dj = (name: string, over: Record<string, unknown> = {}) => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name: `Donjon ${name}`,
  bossName: name,
  imageUrl: `/game-data/dungeons/${name}.webp`,
  isOcre: false,
  ...over,
});

const html = (dungeons: ReturnType<typeof dj>[], guildId?: string) =>
  renderToStaticMarkup(
    React.createElement(RushOverlayDungeonCard, { dungeons, guildId } as never)
  );

describe("isPublicOverlay — d'où vient l'overlay", () => {
  it("public quand il n'y a pas de guilde (ou la sentinelle « public »)", () => {
    expect(isPublicOverlay(undefined)).toBe(true);
    expect(isPublicOverlay(null)).toBe(true);
    expect(isPublicOverlay("")).toBe(true);
    expect(isPublicOverlay("public")).toBe(true);
  });

  it("interne dès qu'une guilde est connue", () => {
    expect(isPublicOverlay("1234567890")).toBe(false);
  });
});

describe("RushOverlayDungeonCard — la bonne page selon la surface", () => {
  it("overlay du guide PUBLIC ⇒ fiche publique du donjon", () => {
    const out = html([dj("Kankreblath")], "public");
    expect(out).toContain('href="/boss/kankreblath"');
    expect(out).not.toContain("/dashboard/");
    expect(out).toContain("Voir la fiche publique de Kankreblath");
  });

  it("overlay du guide INTERNE ⇒ fiche boss du module (deep-link succès)", () => {
    const out = html([dj("Kankreblath")], "guild-1");
    expect(out).toContain('href="/dashboard/guild-1/succes?dungeon=kankreblath&amp;view=boss"');
    expect(out).not.toContain('href="/boss/');
    expect(out).toContain("Ouvrir la fiche boss de Kankreblath");
  });

  it("plusieurs donjons : pluriel et une ligne par donjon", () => {
    const out = html([dj("Kankreblath"), dj("Glourdorak")], "public");
    expect(out).toContain("Donjons requis");
    expect(out.split('href="/boss/').length - 1).toBe(2);
  });

  it("un donjon sans image garde sa ligne (picto du donjon, jamais de trou)", () => {
    const out = html([dj("Sans", { imageUrl: undefined })], "public");
    expect(out).toContain("Sans");
    expect(out).not.toContain("<img");
  });
});

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ITEM = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const POPOVER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonPopover.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const COMPACT = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayCompact.tsx";

describe("Badge donjon — compteur, picto du jeu, popover branchée", () => {
  const code = codeOf(ITEM);

  it("affiche le NOMBRE de donjons requis (×1, ×2…)", () => {
    expect(code).toMatch(/Donjon ×\{dungeons\.length\}/);
    expect(code).toMatch(/const dungeons = React\.useMemo\(\(\) => \(hasDungeon \? getDungeons\(seq\) : \[\]\)/);
  });

  it("porte le picto du donjon du jeu, pas un glyphe d'interface", () => {
    expect(code).toMatch(/src="\/assets\/dofus-ui\/pictos\/donjon\.png"/);
    expect(code).not.toMatch(/<DoorOpen/);
  });

  it("la popover est branchée sur ce badge (survol ET clic)", () => {
    expect(code).toMatch(/<RushOverlayDungeonPopover dungeons=\{dungeons\} guildId=\{guildId\}>/);
    const pop = codeOf(POPOVER);
    expect(pop).toMatch(/onMouseEnter=\{handleMouseEnter\}/);
    expect(pop).toMatch(/onClick=\{toggle\}/);
    // Une animation d'entrée peut rester bloquée en fenêtre PiP : on n'en met pas.
    expect(pop).not.toMatch(/framer-motion/);
    expect(pop).toMatch(/createPortal/);
  });

  it("la popover se monte dans le document DU NŒUD (fenêtre PiP), jamais dans la page principale", () => {
    const pop = codeOf(POPOVER);
    // Dans un bundle JS, `document` reste celui de la page principale même quand le nœud vit
    // dans la PiP : c'est ce qui faisait apparaître l'aperçu « n'importe où sur l'écran ».
    expect(pop).toMatch(/ownerDocument/);
    expect(pop).toMatch(/portalDoc\.body/);
    expect(pop).not.toMatch(/document\.body/);
    // Les mesures aussi doivent venir de la fenêtre du nœud.
    expect(pop).toMatch(/ownerDocument\.defaultView/);
    expect(pop).not.toMatch(/window\.innerWidth/);
    expect(pop).not.toMatch(/window\.innerHeight/);
  });

  it("l'overlay transmet sa guilde aux lignes de quête (destinations correctes)", () => {
    expect(codeOf(OVERLAY).split("guildId={guildId}").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("le picto du donjon existe dans les assets", () => {
    expect(existsSync("public/assets/dofus-ui/pictos/donjon.png")).toBe(true);
  });
});

describe("Encart « À FAIRE MAINTENANT » — retiré de l'overlay", () => {
  it("le composant n'existe plus (aucun code mort)", () => {
    expect(existsSync("src/components/dofus-quests/rush/RushCurrentObjective.tsx")).toBe(false);
    expect(codeOf(OVERLAY)).not.toMatch(/RushCurrentObjective/);
    expect(codeOf(COMPACT)).not.toMatch(/RushCurrentObjective/);
    expect(codeOf(OVERLAY)).not.toContain("À FAIRE MAINTENANT");
  });

  it("le mode compact garde son titre de quête courante", () => {
    // `objective` reste la source du titre et de l'étape n/m du mode jeu.
    expect(codeOf(COMPACT)).toMatch(/const name = objective\?\.subGuideName/);
  });
});
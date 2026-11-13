/**
 * Garde — **T-4a : dépli sobre et célébration tokenisée** (12/11/2026).
 *
 * 🎯 Ce qui est livré sans captures :
 *  · **G8** — le dépli d'un bloc ne mesure plus la hauteur en JS (`framer-motion`
 *    `height: 0 → auto`) : il passe par `grid-template-rows` (`0fr → 1fr`) ;
 *  · **O15** — `motion-reduce` coupe l'animation du dépli, et la célébration ne
 *    rend plus ses éclats quand l'utilisateur demande moins de mouvement ;
 *  · **G9** — la célébration utilise les tokens (`bg-background`,
 *    `text-muted-foreground`, `--da-amber`) au lieu de `zinc`/`backdrop-blur`.
 *
 * 🚧 **G7 (hero complet) et la composition G9 restent ouverts** : ils se jugent
 * à l'écran, captures à l'appui (ROADMAP, rang 5).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const COLLAPSE = codeOf("src/components/dofus-quests/rush/RushCollapse.tsx");
const CELEBRATION = codeOf("src/components/dofus-quests/rush/MilestoneCelebration.tsx");
const TIMELINE = codeOf("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");

describe("G8 — le dépli passe par grid-template-rows", () => {
  it("le composant partagé porte les deux états et la transition", () => {
    expect(COLLAPSE).toContain("grid-rows-[1fr]");
    expect(COLLAPSE).toContain("grid-rows-[0fr]");
    expect(COLLAPSE).toContain("transition-[grid-template-rows,opacity]");
    expect(COLLAPSE).toContain("motion-reduce:transition-none");
  });

  it("le contenu fermé est retiré du clavier et des lecteurs d'écran", () => {
    expect(COLLAPSE).toContain("inert={!open}");
    expect(COLLAPSE).toContain("aria-hidden={!open}");
  });

  it("le bloc du guide utilise le dépli partagé, plus la mesure de hauteur", () => {
    expect(TIMELINE).toContain("<RushCollapse open={expanded}>");
    // Le bloc ne doit plus être enveloppé dans un `AnimatePresence` conditionné par `expanded`.
    expect(TIMELINE).not.toMatch(/<AnimatePresence>\s*\{expanded && \(/);
  });
});

describe("O15 — motion sobre", () => {
  it("la célébration coupe les éclats si l'utilisateur réduit les animations", () => {
    expect(CELEBRATION).toContain("useReducedMotion");
    expect(CELEBRATION).toContain("!reduceMotion && SPARKS.map");
    expect(CELEBRATION).toContain("duration: reduceMotion ? 0 : 0.4");
  });

  it("le guide coupe la rotation infinie du bandeau « En construction »", () => {
    expect(TIMELINE).toContain("useReducedMotion");
    expect(TIMELINE).toContain("reduceMotion ? undefined : {rotate:[0,-5,5,-5,0]}");
  });
});

describe("G9 — la célébration suit la DA", () => {
  it("plus de zinc ni de blur dans la pastille", () => {
    expect(CELEBRATION).not.toContain("zinc-");
    expect(CELEBRATION).not.toContain("backdrop-blur");
  });

  it("le doré par défaut vient du token de la DA", () => {
    expect(CELEBRATION).toContain("var(--da-amber, #d4a853)");
    expect(CELEBRATION).toContain("bg-background/85");
    expect(CELEBRATION).toContain("text-muted-foreground");
  });
});

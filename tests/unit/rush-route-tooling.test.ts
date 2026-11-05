/**
 * Garde — **outillage God de la route** (lot G0 : G1→G4, 02/11/2026).
 *
 * 🎯 Ce que le lot devait rendre possible, mesuré avant :
 *  · G1 — la route s'éditait **quête par quête** (236 fois) : aucune action de masse ;
 *  · G2 — `classReq` était un `<input>` libre : `osa` ou `Féca` masquaient la quête ;
 *  · G3 — aucun moyen de voir ce que le joueur verrait, sans publier ;
 *  · G4 — la vue Branches s'arrêtait à l'Ordre (2 étages), pas de contrôle des 19 classes.
 *
 * 🛡️ Ces verrous tiennent le **câblage** (lecture des sources, commentaires retirés) :
 * le comportement de la règle pure vit dans `rush-class-branches.test.ts`, celui de la
 * route dans `rush-route.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ADMIN_PATH = "src/components/god/rush-editor/RushEditorStudio.tsx";
const PAGE_PATH = "src/app/god/rush-sylvestre/page.tsx";
const ACTIONS_PATH = "src/server/actions/optimized-guide-actions.ts";
const BRANCHES_PATH = "src/lib/rush-branches.ts";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ADMIN = codeOf(ADMIN_PATH);
const PAGE = codeOf(PAGE_PATH);
const ACTIONS = codeOf(ACTIONS_PATH);
const BRANCHES = codeOf(BRANCHES_PATH);

describe("G1 — la route s'applique au bloc entier", () => {
  it("le studio envoie la route du bloc par l'action dédiée", () => {
    expect(ADMIN).toContain("updateRushBlockRoute");
    expect(ADMIN).toContain("handleApplyBlockRoute");
    expect(ADMIN).toContain("onApplyBlockRoute");
  });

  it("la barre porte les quatre axes et les deux gestes", () => {
    expect(ADMIN).toContain("Route du bloc");
    expect(ADMIN).toContain("Appliquer au bloc");
    expect(ADMIN).toContain("Effacer la route");
  });

  it("la confirmation dit la portée et l'effet d'un champ vide", () => {
    expect(ADMIN).toContain("Une valeur vide efface celle du bloc");
    expect(ADMIN).toContain("de ce bloc");
  });

  it("l'action serveur garde l'accès Rush ET le rate limit Redis", () => {
    expect(ACTIONS).toMatch(/export async function updateRushBlockRoute/);
    expect(ACTIONS).toContain("requireRushWriteAccess(");
    expect(ACTIONS).toMatch(/rateLimit\(/);
  });

  it("l'action borne chaque axe (cité, palier, classe)", () => {
    expect(ACTIONS).toContain('z.enum(["bontarien", "brakmarien"])');
    expect(ACTIONS).toContain("z.literal(20)");
    expect(ACTIONS).toContain("DOFUS_CLASSES.some");
  });

  it("l'action refuse un Ordre inconnu ou d'une autre cité", () => {
    expect(ACTIONS).toContain('"Ordre inconnu"');
    expect(ACTIONS).toContain('"Un Ordre exige une cité"');
    expect(ACTIONS).toContain("Cet Ordre n'appartient pas à la cité choisie");
    expect(ACTIONS).toContain("orderCodesForCamp(input.alignReq)");
  });

  it("l'action vérifie que le bloc appartient au guide Rush AVANT d'écrire", () => {
    const start = ACTIONS.indexOf("export async function updateRushBlockRoute");
    expect(start).toBeGreaterThan(-1);
    const body = ACTIONS.slice(start, start + 2600);
    expect(body).toContain('guide: { slug: "rush-sylvestre" }');
    expect(body).toContain("updateMany(");
    // La vérification précède l'écriture dans le corps de l'action.
    expect(body.indexOf('guide: { slug: "rush-sylvestre" }')).toBeLessThan(body.indexOf("updateMany("));
  });

  it("l'action trace l'écriture de masse", () => {
    expect(ACTIONS).toContain('op: "route-rush-block"');
    expect(ACTIONS).toContain("logGodWrite(");
  });
});

describe("G2 — la classe est une liste fermée", () => {
  it("plus aucun champ de classe libre dans les deux formulaires", () => {
    expect(ADMIN).not.toContain('placeholder="feca, osa…"');
    expect(ADMIN).not.toContain("<input value={classReq}");
  });

  it("la liste vient de DOFUS_CLASSES et sert les trois surfaces (bloc, édition, création)", () => {
    expect((ADMIN.match(/<RushClassSelect/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(ADMIN).toContain("DOFUS_CLASSES.map");
  });

  it("une valeur historique inconnue reste visible, jamais effacée en silence", () => {
    expect(ADMIN).toContain("Valeur inconnue :");
  });
});

describe("G3 — aperçu de la route, sans publier", () => {
  it("l'aperçu passe par la règle unique `resolveRushRoute`", () => {
    expect(ADMIN).toContain('import { resolveRushRoute } from "@/lib/rush-route"');
    expect(ADMIN).toContain("resolveRushRoute(milestones");
  });

  it("l'écran dit qu'il ne publie rien et affiche le compte visible", () => {
    expect(ADMIN).toContain("Aperçu de la route");
    expect(ADMIN).toContain("rien n&apos;est publié");
    expect(ADMIN).toContain("{shown} / {total} quêtes");
  });
});

describe("G4 — Branches à trois étages (cité → Ordre → classe)", () => {
  it("la page calcule la vue des classes par la règle pure", () => {
    expect(PAGE).toContain("buildRushClassBranches");
    expect(PAGE).toContain("classBranches={classBranches}");
  });

  it("la page transmet `classReq` (sans lui, la vue serait vide)", () => {
    expect(PAGE).toContain("classReq: seq.classReq ?? null");
  });

  it("le panneau rend les 19 classes et nomme les manques", () => {
    expect(ADMIN).toContain("classView.classes.map");
    expect(ADMIN).toContain("— manque —");
    expect(ADMIN).toContain("Classes — 19 variantes");
  });

  it("les classes inconnues et les quêtes mal placées sont nommées", () => {
    expect(ADMIN).toContain("classView.unknown");
    expect(ADMIN).toContain("classView.misplaced");
  });

  it("la règle est additive : `buildRushBranches` reste intacte", () => {
    expect(BRANCHES).toContain("export function buildRushBranches");
    expect(BRANCHES).toContain("export function buildRushClassBranches");
  });
});

describe("non-régression des gardes existantes du studio", () => {
  it("les libellés historiques et les cinq paliers restent présents", () => {
    expect(ADMIN).toContain("Cité (route)");
    expect(ADMIN).toContain("Ordre (quêtes d'Ordre)");
    expect(ADMIN).toContain("[20, 40, 60, 80, 100].map");
    expect(ADMIN).toContain("7. 🧭 Route (cité / Ordre / palier / classe)");
  });
});


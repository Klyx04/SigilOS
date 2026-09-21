/**
 * Garde — les ressources « à prévoir » se cochent À LA MAIN, et la même coche vaut
 * partout : module de guilde (persistée par membre ET par personnage) et page
 * publique (persistée dans le navigateur).
 *
 * 🎯 Demande user (21/09/2026) : « ajoute un bouton “ressources à prévoir” avec le
 * calcul en temps réel en fonction des quêtes validées ou non · permet de cocher
 * manuellement telle ressource pour la valider · si la quête est invalidée : cela
 * reset la coche manuelle · ce truc doit être enregistré par user/mule côté interne ·
 * et localement dans son browser côté public ».
 *
 * Ce qu'on verrouille :
 *   · la clé de ressource (`rushResourceKey`) est STABLE et normalisée — c'est elle
 *     qui est stockée en base comme dans le navigateur ;
 *   · la modale partagée affiche la case, barre le nom coché et ne compte plus la
 *     ressource comme « restante » ;
 *   · le module écrit côté serveur (par personnage) et la page publique en localStorage ;
 *   · une quête INVALIDÉE supprime les coches de ses ressources (côté serveur).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { rushResourceKey } from "@/lib/rush-guide-utils";
import { RushOverlayResourcesModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal";

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const ACTIONS = "src/server/actions/optimized-guide-actions.ts";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const res = (name: string, count = 1, id = "1") => ({ key: `id:${id}|${name.toLowerCase()}`, name, count, id });

const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(
      RushOverlayResourcesModal,
      {
        resources: [res("Eau Potable", 10), res("Bois de Frêne", 2, "2")],
        allResources: [res("Eau Potable", 10), res("Bois de Frêne", 2, "2")],
        isLightMode: false,
        onClose: () => {},
        totalCount: 2,
        theme: "site",
        ...props,
      } as never
    )
  );

describe("Clé de ressource — une seule définition, valable pour toutes les surfaces", () => {
  it("normalise l'identifiant et le nom (casse, espaces) de façon stable", () => {
    expect(rushResourceKey({ id: "7018", name: "  Eau   Potable " })).toBe("id:7018|eau potable");
    expect(rushResourceKey({ id: "7018", name: "EAU POTABLE" })).toBe(
      rushResourceKey({ id: "7018", name: "eau potable" })
    );
  });

  it("reste distincte sans identifiant (deux ressources du même nom ne fusionnent pas par hasard)", () => {
    expect(rushResourceKey({ name: "Riz" })).toBe("id:|riz");
  });
});

describe("Modale Ressources — coche manuelle « déjà préparé »", () => {
  it("affiche une case par ressource dès que la surface sait cocher", () => {
    const out = html({ onToggleCheck: () => {} });
    expect(out).toContain("J&#x27;ai déjà préparé cet objet");
    expect(out.match(/aria-pressed=/g)?.length).toBe(2);
  });

  it("sans handler, aucune case : la liste reste lisible seule", () => {
    expect(html({})).not.toContain("aria-pressed=");
  });

  it("barre la ressource cochée et la sort du compte des restantes", () => {
    const out = html({ checkedKeys: new Set(["id:1|eau potable"]), onToggleCheck: () => {} });
    expect(out).toContain("line-through");
    // 1 restante sur 2 : la cochée ne compte plus.
    expect(out).toContain("1 / 2");
  });

  it("garde la ressource cochée DANS la liste (on doit pouvoir décocher)", () => {
    const out = html({ checkedKeys: new Set(["id:1|eau potable"]), onToggleCheck: () => {} });
    expect(out).toContain("Eau Potable");
    expect(out).toContain("Déjà préparé — cliquer pour décocher");
  });
});

describe("Persistance — module (serveur, par personnage) ↔ page publique (navigateur)", () => {
  it("le module charge les coches côté serveur et les réécrit à chaque geste", () => {
    const dash = codeOf(DASHBOARD);
    expect(dash).toMatch(/setRushResourceChecks\(/);
    expect(dash).toMatch(/setRushResourceChecks\(guildId, guide\.slug, \[\.\.\.next\], effectiveAltPseudo\)/);
    expect(dash).toMatch(/initialResourceChecks/);
    // Le compteur du bouton suit les quêtes validées ET les coches.
    expect(dash).toMatch(/rushResourcesRemaining\.filter\(\(r\) => !resourceChecks\.has\(r\.key\)\)/);
  });

  it("la page publique écrit dans le navigateur, par personnage", () => {
    const pub = codeOf(PUBLIC);
    expect(pub).toMatch(/localStorage\.setItem\(`\$\{storagePrefix\}resources`/);
    expect(pub).toMatch(/checkedKeys=\{resourceChecks\}/);
  });

  it("le serveur expose lecture + écriture bornées, gardées par la guilde", () => {
    const actions = codeOf(ACTIONS);
    expect(actions).toMatch(/export async function getRushResourceChecks/);
    expect(actions).toMatch(/export async function setRushResourceChecks/);
    expect(actions).toMatch(/playerGuideResourceCheck/);
    expect(actions).toMatch(/rushResourceKeysSchema/);
  });

  it("une quête invalidée remet à zéro les coches de ses ressources", () => {
    const actions = codeOf(ACTIONS);
    expect(actions).toMatch(/unvalidatedSeqIds/);
    expect(actions).toMatch(/playerGuideResourceCheck\.deleteMany/);
  });
});

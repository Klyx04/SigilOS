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
import { aggregateRushResources } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { RushChapterSidebar } from "@/components/dofus-quests/rush/RushChapterSidebar";

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

// ─────────────────────────────────────────────────────────────────────────────
// Rail « Objets requis » (`RushChapterSidebar`) — lot V-A : UNE seule agrégation.
// 🎯 Demande user (10/10/2026) : la liste et les compteurs de ressources doivent être
// IDENTIQUES partout (overlay, dashboard, guide public, rail, modale, grilles).
//
// Mesure du 10/10/2026 sur les données réelles : le rail recalculait sa propre liste
// (clé = nom seul, `quantity || count`, phrases « instruction » comptées comme des
// objets) ⇒ 391 lignes contre 392 pour `aggregateRushResources` (clé `rushResourceKey`
// = id + nom normalisé, `count ?? quantity`, exclusions partagées).
//
// Les 2 écarts mesurés sont des défauts de DONNÉES (corrigés au lot V-B), pas
// d'agrégation : « Reflet onirique » (id 22058 invalide — DofusDB renvoie le repli
// `id 666` — contre 32079, la vraie « Ressource des Songes ») et l'id 9687
// (« Moyenne pierre d'âme ») porté par un tag nommé « Moyenne pierre d'âme parfaite ».
// Le rail doit donc AFFICHER ces écarts au lieu de les masquer en fusionnant.
// ─────────────────────────────────────────────────────────────────────────────
describe("Rail « Objets requis » — la MÊME agrégation que les autres surfaces (V-A)", () => {
  const milestones = [
    {
      id: "ms1",
      chapter: 1,
      chapterLabel: "Chapitre 1",
      title: "Préparation",
      type: "ZONE",
      isOptional: false,
      order: 0,
      sequences: [
        {
          id: "s1",
          subGuideRef: "q1",
          subGuideName: "Quête 1",
          isOptional: false,
          order: 0,
          activityTags: [
            // Même nom, ids DIFFÉRENTS : deux objets — jamais une fusion.
            { type: "item", id: "22058", name: "Reflet onirique", count: 570 },
            { type: "item", id: "32079", name: "Reflet onirique", count: 600 },
            // `count` ET `quantity` : la règle partagée est `count ?? quantity` (5+3).
            { type: "item", id: "7018", name: "Eau Potable", count: 5, quantity: 3 },
            // Phrase d'action déguisée en objet : hors ressources, comme partout.
            { type: "item", kind: "instruction", name: "Parler à X" },
          ],
        },
        {
          id: "s2",
          subGuideRef: "q2",
          subGuideName: "Quête 2",
          isOptional: false,
          order: 1,
          activityTags: [
            // `quantity` seul : compte quand même.
            { type: "item", id: "7018", name: "Eau Potable", quantity: 3 },
            { type: "item", id: "9687", name: "Moyenne pierre d'âme", count: 1 },
            { type: "item", id: "9688", name: "Moyenne pierre d'âme parfaite", count: 4 },
          ],
        },
      ],
    },
  ] as never;

  const canonical = aggregateRushResources(milestones as never);

  // `renderToStaticMarkup` échappe l'apostrophe (`&#x27;`) : on dé-échappe la sortie
  // pour pouvoir comparer les noms tels qu'ils s'affichent à l'écran.
  const rail = (completed: string[], props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      React.createElement(RushChapterSidebar, {
        milestones,
        completedSeqIds: new Set(completed),
        selectedChapter: "ALL",
        ...props,
      } as never)
    ).replace(/&#x27;/g, "'");

  it("affiche exactement les lignes de `aggregateRushResources` (compteur + quantités)", () => {
    const out = rail([]);
    // Le compteur du rail est le NOMBRE DE LIGNES de la source unique.
    expect(out).toContain(`(${canonical.length})`);
    for (const r of canonical) {
      expect(out).toContain(r.name);
      expect(out).toContain(`×${r.count}`);
    }
  });

  it("deux ids distincts portant le même nom restent DEUX lignes, chacune avec son icône", () => {
    const out = rail([]);
    // L'ancienne clé « nom seul » fusionnait ces deux objets (×1170).
    expect(out).not.toContain("×1170");
    expect(out).toContain("×570");
    expect(out).toContain("×600");
    // L'icône suit l'id de SA ligne (jamais celle d'un autre objet).
    expect(out).toContain("/uploads/assets-dofus/items/22058.webp");
    expect(out).toContain("/uploads/assets-dofus/items/32079.webp");
  });

  it("applique la règle de quantité partagée et écarte les phrases « instruction »", () => {
    const out = rail([]);
    // `count ?? quantity` : 5 (s1) + 3 (s2) = 8. L'ancien rail (`quantity || count`)
    // donnait 6 ; aucun autre objet du fixture ne vaut 8 ou 6, donc la balise `>×N<`
    // désigne à coup sûr l'Eau Potable (et `>×6<` ne matche pas `×600`).
    expect(out).toMatch(/>×8<\/span>/);
    expect(out).not.toMatch(/>×6<\/span>/);
    expect(out).not.toContain("Parler à X");
  });

  it("le décrément suit les quêtes validées (mêmes entrées que les autres surfaces)", () => {
    // s1 validée : les DEUX « Reflet onirique » sortent (5 lignes → 3 restantes,
    // celles de s2) ; les « restantes » du rail suivent donc les quêtes validées.
    const out = rail(["s1"], { hideProvidedResources: true });
    expect(out).toContain("Encore requis");
    expect(out).toContain('<span class="font-mono tabular-nums text-foreground">3</span>');
    expect(out).toContain("Eau Potable");
    expect(out).toContain("Moyenne pierre d'âme");
    expect(out).not.toContain("Reflet onirique");
  });

  it("toutes les quêtes validées ⇒ plus rien à prévoir", () => {
    const out = rail(["s1", "s2"], { hideProvidedResources: true });
    expect(out).toContain('<span class="font-mono tabular-nums text-foreground">0</span>');
    expect(out).toContain("Aucune ressource répertoriée");
  });
});

/**
 * Gardes — **L2 : changer d'Ordre décoche les 5 quêtes de l'ancien Ordre** (02/11/2026).
 *
 * 🎯 Règle de jeu (`ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md` § 8.2) : changer de cité
 * efface la branche de l'ancienne cité (`L1`) ; changer d'**Ordre** efface les **5**
 * quêtes de l'ancien Ordre, le nouvel Ordre repartant de son rang 1. La progression de
 * cité n'est jamais touchée.
 *
 * 🛡️ Ce que ces verrous interdisent :
 *  · un reset qui déborde sur un autre Ordre ou sur l'autre cité ;
 *  · un reset « au hasard » quand la cité ou l'Ordre sont inconnus (fail-closed) ;
 *  · une cascade : elle emprunterait la chaîne des rangs et effacerait le nouvel Ordre ;
 *  · une écriture du nouvel Ordre AVANT le reset (l'ancien serait alors introuvable) ;
 *  · une action sans authentification, sans rate limit, ou lisant l'Ordre côté client.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { orderResetSeeds } from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const seq = (id: string, over: Partial<RushSequence> = {}): RushSequence =>
  ({
    id,
    subGuideName: `Quête ${id}`,
    subGuideRef: id,
    order: 0,
    isOptional: false,
    ...over,
  }) as unknown as RushSequence;

const ms = (id: string, sequences: RushSequence[]): RushMilestone =>
  ({
    id,
    type: "QUETE_SERIE",
    chapter: 1,
    chapterLabel: id,
    title: id,
    order: 0,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

const ranks = (prefix: string, camp: "bontarien" | "brakmarien", order: string): RushSequence[] =>
  [20, 40, 60, 80, 100].map((level, i) =>
    seq(`${prefix}-${i + 1}`, { alignReq: camp, alignOrderCode: order, alignLevelReq: level })
  );

const GUIDE: RushMilestone[] = [
  ms("cite", [
    seq("b-cite", { alignReq: "bontarien" }),
    seq("k-cite", { alignReq: "brakmarien" }),
    seq("commune"),
  ]),
  ms("vaillant", ranks("vaillant", "bontarien", "coeur_vaillant")),
  ms("attentif", ranks("attentif", "bontarien", "oeil_attentif")),
  ms("saignant", ranks("saignant", "brakmarien", "coeur_saignant")),
];

describe("orderResetSeeds — les 5 quêtes de l'Ordre quitté, rien de plus", () => {
  it("rend les 5 rangs de l'Ordre quitté", () => {
    expect(orderResetSeeds(GUIDE, "bontarien", "coeur_vaillant")).toEqual([
      "vaillant-1",
      "vaillant-2",
      "vaillant-3",
      "vaillant-4",
      "vaillant-5",
    ]);
  });

  it("accepte l'id court historique du studio (`vaillant`) comme le code canonique", () => {
    expect(orderResetSeeds(GUIDE, "bontarien", "vaillant")).toEqual(
      orderResetSeeds(GUIDE, "bontarien", "coeur_vaillant")
    );
  });

  it("ne déborde ni sur un autre Ordre, ni sur l'autre cité, ni sur les quêtes de cité", () => {
    const seeds = orderResetSeeds(GUIDE, "bontarien", "coeur_vaillant");
    expect(seeds).not.toContain("attentif-1");
    expect(seeds).not.toContain("saignant-1");
    expect(seeds).not.toContain("b-cite");
    expect(seeds).not.toContain("commune");
  });

  it("fail-closed : cité inconnue, Ordre inconnu ou absence de choix ⇒ aucune graine", () => {
    expect(orderResetSeeds(GUIDE, null, "coeur_vaillant")).toEqual([]);
    expect(orderResetSeeds(GUIDE, "bontarien", null)).toEqual([]);
    expect(orderResetSeeds(GUIDE, "bontarien", "pirate")).toEqual([]);
    expect(orderResetSeeds(GUIDE, "neutre", "coeur_vaillant")).toEqual([]);
  });

  it("une cité qui ne possède pas cet Ordre ne décoche rien (donnée incohérente)", () => {
    expect(orderResetSeeds(GUIDE, "brakmarien", "coeur_vaillant")).toEqual([]);
  });
});

describe("câblage — reset d'Ordre côté serveur", () => {
  const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
  const SERVER = "src/server/rush-alignment.ts";
  const FORM = "src/components/dofus-quests/rush/AlignmentChoiceForm.tsx";

  it("la règle serveur part de `orderResetSeeds` et n'emploie AUCUNE cascade", () => {
    const code = read(SERVER);
    const start = code.indexOf("export async function orderResetIds");
    const body = code.slice(start, start + 400);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("orderResetSeeds(milestones, camp, order)");
    expect(body).not.toContain("cascadeResetIds");
  });

  it("le reset d'Ordre est décidé par la règle pure et exécuté AVANT l'écriture", () => {
    const server = read(SERVER);
    const start = server.indexOf("export async function resetProgressOnAlignmentChange");
    const helper = server.slice(start, start + 900);
    expect(start).toBeGreaterThan(-1);
    expect(helper).toContain("alignmentChangeReset(input)");
    expect(helper).toContain("resetOrderQuests(");
    expect(helper).toContain("input.current.alignmentOrder");

    // La mule : reset avant l'écriture de `altPseudos`.
    const actions = read("src/server/actions/profile-actions.ts");
    const fnAt = actions.indexOf("export async function updateMuleAlignment");
    const resetAt = actions.indexOf("await resetProgressOnAlignmentChange({", fnAt);
    const writeAt = actions.indexOf("await db.userProfile.update({", fnAt);
    expect(resetAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(resetAt);
    // La cité et l'Ordre quittés sont relus dans la mule, jamais reçus du client.
    expect(actions).toContain("alignmentOrder: alts[idx].alignmentOrder ?? null");
  });

  it("le formulaire ne reset plus lui-même : il annonce ce que l'action a décoché", () => {
    const code = read(FORM);
    expect(code).not.toContain("resetRushOrderProgress");
    expect(code).not.toContain("resetAlignmentProgress");
    expect(code).toContain("res.data?.cleared");
  });
});

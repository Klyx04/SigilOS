/**
 * Verrou de statut — siphon des grimoires (26/11/2026).
 *
 * Mesure : 231 icônes « en échec » sur la passe locale, toutes par **budget local**
 * (`LOCAL_THROTTLE_DEFERRED`), pas par asset manquant. Le worker marquait la passe
 * `PARTIAL` et l'écran God affichait un échec. Une limite locale est un **différé** :
 * la passe s'arrête et sera rejouée, elle n'invente pas un échec.
 *
 * Lecture seule : aucune base, aucun réseau.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const CORE = "src/lib/class-spells-siphon.ts";
const WORKER = "src/workers/game-data-worker.ts";
const ACTIONS = "src/server/actions/asset-siphon-actions.ts";
const INLINE = "src/components/admin/game-data-inline-runners.ts";

describe("grimoires — une limite locale n'est pas un échec d'icône", () => {
  it("le cœur distingue différé et échec réel, et arrête la passe", () => {
    const src = read(CORE);
    expect(src).toContain("isLocalThrottleDeferredMessage");
    expect(src).toContain("deferred: boolean");
    expect(src).toContain("result.deferred = true");
    // Le différé est testé AVANT d'incrémenter `failedIcons`.
    const deferredCheck = src.indexOf("isLocalThrottleDeferredMessage(icon.error)");
    const deferredFlag = src.indexOf("result.deferred = true", deferredCheck);
    const failed = src.indexOf("result.failedIcons++", deferredCheck);
    expect(deferredCheck).toBeGreaterThan(-1);
    expect(deferredFlag).toBeGreaterThan(deferredCheck);
    expect(failed).toBeGreaterThan(deferredFlag);
  });

  it("le worker ne marque pas PARTIAL pour un différé, et le dit dans le message", () => {
    const src = read(WORKER);
    expect(src).toContain("partial: result.failedIcons > 0");
    expect(src).not.toContain("partial: result.failedIcons > 0 || result.deferred");
    expect(src).toContain("limite locale atteinte, reprise au prochain passage");
    expect(src).toContain("result.deferred");
  });

  it("la pré-chauffe God (une classe) applique la même règle", () => {
    const src = read(ACTIONS);
    expect(src).toContain("isLocalThrottleDeferredMessage(res.error)");
    expect(src).toContain("iconsDeferred");
    // Le runner inline compte les classes différées sans les traiter en échec.
    const inline = read(INLINE);
    expect(inline).toContain("iconsDeferred");
    expect(inline).toContain("limite locale — reprise au prochain passage");
  });
});

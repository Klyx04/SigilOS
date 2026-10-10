/**
 * Garde — les **ids d'objets** du guide Sylvestre doivent être des ids que DofusDB connaît.
 *
 * 🎯 Mesure du 10/10/2026 (lot V-B) : le tag « Reflet onirique » portait l'id **22058**. DofusDB
 * sert alors son **item de repli 666** (« Purée pique-fêle ») : la garde d'identité du siphon
 * refuse l'icône ⇒ **placeholder** à l'écran, et un chemin deviné aurait gravé l'icône d'un
 * AUTRE objet pendant un an. Le vrai objet est **32079** (`?name.fr=Reflet onirique` → id 32079,
 * `iconId` 164149), mesuré en lecture seule sur l'API.
 *
 * Ce test verrouille la correction de DONNÉES (source de seed `src/data/rush-sylvestre-guide.json`)
 * sans réseau : aucun id fautif connu ne doit revenir.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const GUIDE_JSON = "src/data/rush-sylvestre-guide.json";

/** id fautif mesuré → id correct (DofusDB). */
const IDS_CORRIGES = new Map<number, number>([[22058, 32079]]);

/** Parcourt tout le JSON et ramasse les tags d'objets (`type: "item"` + `id` numérique). */
function collectItemTagIds(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) {
    for (const child of node) collectItemTagIds(child, out);
    return out;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.type === "item") {
      const id = Number(record.id);
      if (Number.isInteger(id) && id > 0) out.push(id);
    }
    for (const value of Object.values(record)) collectItemTagIds(value, out);
  }
  return out;
}

describe("Guide Sylvestre — ids d'objets (données de seed)", () => {
  const ids = collectItemTagIds(JSON.parse(readFileSync(GUIDE_JSON, "utf8")));

  it("ne contient plus l'id invalide 22058 (« Reflet onirique »)", () => {
    expect(ids, "22058 renvoie l'item de repli 666 chez DofusDB").not.toContain(22058);
  });

  it("porte le bon id 32079 (le vrai « Reflet onirique »)", () => {
    expect(ids).toContain(32079);
  });

  it("chaque correction connue est appliquée dans le même sens", () => {
    for (const [fautif, correct] of IDS_CORRIGES) {
      expect(ids, `id ${fautif} encore présent`).not.toContain(fautif);
      expect(ids, `id ${correct} attendu`).toContain(correct);
    }
  });
});

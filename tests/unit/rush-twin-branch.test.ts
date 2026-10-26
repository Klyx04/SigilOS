/**
 * Gardes — **Lot 4** : dissocier les routes Bonta / Brâkmar dans le studio God.
 *
 * 🎯 L'astuce retenue : **pas deux guides**, un **slot miroir**. Chaque séquence porte
 * `alignReq` ; la jumelle se crée au même `order`, avec le camp opposé.
 *
 * 🛡️ Ce que ce test verrouille :
 *  • l'action est protégée (`requireRushAccess`) et **fail-closed** sans camp ;
 *  • le camp est **inversé**, l'ordre et le seuil de niveau sont **recopiés** ;
 *  • le studio God expose le bouton sur les seules séquences marquées.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
const GOD = "src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx";

describe("duplicateRushSequenceAsTwin — slot miroir", () => {
  const code = read(ACTIONS);
  const start = code.indexOf("export async function duplicateRushSequenceAsTwin");
  const body = code.slice(start, start + 2600);

  it("est une action protégée", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("await requireRushAccess();");
  });

  it("fail-closed : refuse une séquence sans camp exploitable", () => {
    expect(body).toMatch(/if \(camp !== "bontarien" && camp !== "brakmarien"\)/);
    expect(body).toMatch(/success: false as const/);
  });

  it("inverse le camp et recopie l'ordre + le seuil de niveau", () => {
    expect(body).toMatch(/camp === "bontarien" \? "brakmarien" : "bontarien"/);
    expect(body).toMatch(/order: source\.order/);
    expect(body).toMatch(/alignOrderReq: source\.alignOrderReq/);
    expect(body).toMatch(/alignReq: twinCamp/);
  });
});

describe("jumelle d'ORDRE (1 → 3)", () => {
  const code = read(ACTIONS);
  const start = code.indexOf("export async function duplicateRushSequenceAsOrderTwins");
  const body = code.slice(start, start + 3200);

  it("est protégée et fail-closed sans cité ou sans Ordre", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("await requireRushAccess();");
    expect(body).toMatch(/n'a pas de cité/);
    expect(body).toMatch(/n'a pas d'Ordre/);
  });

  it("crée les 2 AUTRES Ordres de la même cité, sans doublon (codes canoniques)", () => {
    // Les codes écrits sont les **codes canoniques** (`coeur_vaillant`…), pas les ids
    // courts du référentiel de guilde (`vaillant`) : la règle de route compare ces codes.
    expect(body).toMatch(/orderCodesForCamp\(camp\)/);
    expect(body).toMatch(/if \(other\.code === sourceCode\) continue;/);
    expect(body).toMatch(/alignOrderCode: other\.code/);
    // L'idempotence lit la base **avant** de créer, et normalise les codes déjà écrits
    // (une jumelle créée avec l'ancien vocabulaire ne doit pas être recréée).
    expect(body).toMatch(/findMany\(\{/);
    expect(body).toMatch(/normalizeOrderCode\(s\.alignOrderCode\)/);
    expect(body).toMatch(/if \(existingCodes\.has\(other\.code\)\) continue;/);
  });

  it("le studio God expose le bouton sur les seules quêtes d'Ordre", () => {
    const god = read(GOD);
    expect(god).toContain('{seq.alignOrderCode && <OrderTwinButton sequenceId={seq.id} />}');
    expect(god).toContain("duplicateRushSequenceAsOrderTwins");
  });
});

describe("studio God — identité de quête et route éditables", () => {
  const god = read(GOD);

  it("les deux formulaires (édition ET création) envoient les ids de quête et portent le picker", () => {
    expect(god.match(/questDbIds,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(god.match(/<RushQuestPicker/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("l'Ordre est écrit en code canonique, jamais avec l'id court de `ORDERS`", () => {
    expect(god).toContain("orderCodesForCamp(alignReq)");
    expect(god).not.toMatch(/ORDERS\[alignReq\]/);
  });

  it("une séquence existante peut changer de route (cité / Ordre / palier / classe)", () => {
    expect(god).toContain("7. 🧭 Route (cité / Ordre / palier / classe)");
  });
});

describe("studio God — champs de la route à deux étages", () => {
  const god = read(GOD);

  it("propose cité, Ordre, palier et classe", () => {
    expect(god).toContain("Cité (route)");
    expect(god).toContain("Ordre (quêtes d'Ordre)");
    expect(god).toContain("Palier requis (verrou)");
    expect(god).toContain("Classe (quêtes de classe)");
  });

  it("le palier n'est proposé que sur les 5 valeurs réelles", () => {
    expect(god).toContain("[20, 40, 60, 80, 100].map");
  });
});

describe("studio God — bouton Jumelle (cité)", () => {
  const code = read(GOD);

  it("n'apparaît que sur une séquence marquée par un camp", () => {
    expect(code).toMatch(/\{seq\.alignReq && \(/);
    expect(code).toContain("<TwinButton sequenceId={seq.id} />");
  });

  it("appelle l'action et rafraîchit les données", () => {
    const start = code.indexOf("function TwinButton");
    expect(start).toBeGreaterThan(-1);
    const body = code.slice(start, start + 1400);
    expect(body).toContain("duplicateRushSequenceAsTwin(sequenceId)");
    expect(body).toContain("router.refresh()");
  });
});

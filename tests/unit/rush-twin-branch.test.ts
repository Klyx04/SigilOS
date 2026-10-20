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
  const body = code.slice(start, start + 2200);

  it("est protégée et fail-closed sans cité ou sans Ordre", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("await requireRushAccess();");
    expect(body).toMatch(/n'a pas de cité/);
    expect(body).toMatch(/n'a pas d'Ordre/);
  });

  it("crée les 2 AUTRES Ordres de la même cité, sans doublon", () => {
    expect(body).toMatch(/if \(other\.id === sourceOrder\) continue;/);
    expect(body).toMatch(/alignOrderCode: other\.id/);
    expect(body).toMatch(/findFirst\(\{/);
    expect(body).toMatch(/if \(exists\) continue;/);
  });

  it("le studio God expose le bouton sur les seules quêtes d'Ordre", () => {
    const god = read(GOD);
    expect(god).toContain('{seq.alignOrderCode && <OrderTwinButton sequenceId={seq.id} />}');
    expect(god).toContain("duplicateRushSequenceAsOrderTwins");
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

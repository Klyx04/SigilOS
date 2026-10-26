import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { importKey, isRushImportNoop, planRushImport } from "@/lib/rush-import";

/**
 * Garde du **dry-run d'import** (S4-4) : le plan dit ce qui serait créé, ce qui
 * existe déjà et ce qui est douteux — sans jamais rien écrire. L'import ne
 * réécrit pas l'existant : un texte saisi dans God ne peut pas être écrasé.
 */
const EMPTY = { milestones: [] };

const CURRENT = {
  milestones: [
    {
      id: "ms-incarnam",
      title: "Quêtes Incarnam, Astrub et Pandala",
      sequences: [
        { id: "seq-1", subGuideName: "#2502 Bien débuter" },
        { id: "seq-2", subGuideName: "#1635 Dans la gueule du Milimoulou" },
      ],
    },
  ],
};

describe("rush-import — rapprochement des libellés", () => {
  it("ignore casse, accents et ponctuation", () => {
    expect(importKey("  Quêtes Incarnam, Astrub & Pandala ")).toBe("quetes incarnam astrub pandala");
    expect(importKey("Bontarien / Brâkmar")).toBe("bontarien brakmar");
    expect(importKey(null)).toBe("");
  });
});

describe("rush-import — plan (dry-run)", () => {
  it("sur un guide vide, tout est neuf", () => {
    const plan = planRushImport(
      {
        blocks: [
          {
            title: "Alignement 1-20",
            sequences: [
              { subGuideName: "#55 Entraînement avec Tarche", alignReq: "bontarien", alignLevelReq: 20 },
              { subGuideName: "#56 Premiers pas", alignReq: "bontarien" },
            ],
          },
        ],
      },
      EMPTY
    );
    expect(plan.totals).toEqual({ blocksNew: 1, blocksExisting: 0, sequencesNew: 2, sequencesExisting: 0, sequencesSkipped: 0 });
    expect(plan.blocks[0].status).toBe("new");
    expect(plan.blocks[0].toCreate).toBe(2);
    expect(isRushImportNoop(plan)).toBe(false);
  });

  it("rapproche un bloc par son titre normalisé et ne recrée pas ce qui existe", () => {
    const plan = planRushImport(
      {
        blocks: [
          {
            title: "quetes incarnam astrub et pandala",
            sequences: [
              { subGuideName: "#2502 Bien débuter" },
              { subGuideName: "#9999 Nouvelle quête" },
            ],
          },
        ],
      },
      CURRENT
    );
    expect(plan.totals.blocksExisting).toBe(1);
    expect(plan.totals.sequencesExisting).toBe(1);
    expect(plan.totals.sequencesNew).toBe(1);
    expect(plan.blocks[0].existingMilestoneId).toBe("ms-incarnam");
    expect(plan.blocks[0].sequences[0].existingSequenceId).toBe("seq-1");
  });

  it("un second passage sur le même fichier ne crée plus rien", () => {
    const payload = {
      blocks: [{ title: "Quêtes Incarnam, Astrub et Pandala", sequences: [{ subGuideName: "#2502 Bien débuter" }] }],
    };
    const plan = planRushImport(payload, CURRENT);
    expect(isRushImportNoop(plan)).toBe(true);
    expect(plan.totals.sequencesNew).toBe(0);
  });

  it("écarte un doublon du fichier — la première occurrence gagne", () => {
    const plan = planRushImport(
      { blocks: [{ title: "Bloc", sequences: [{ subGuideName: "Même quête" }, { subGuideName: "meme quete" }] }] },
      EMPTY
    );
    expect(plan.totals.sequencesNew).toBe(1);
    expect(plan.totals.sequencesSkipped).toBe(1);
    expect(plan.blocks[0].sequences[1].warnings.join(" ")).toMatch(/Doublon/);
  });

  it("signale une cité, un Ordre, une classe ou un donjon inconnus sans bloquer l'import", () => {
    const plan = planRushImport(
      {
        blocks: [
          {
            title: "Bloc",
            sequences: [
              {
                subGuideName: "Quête douteuse",
                alignReq: "neutre",
                alignOrderCode: "ordre-du-chaos",
                classReq: "pirate",
                dungeonIds: ["inconnu-123"],
              },
            ],
          },
        ],
      },
      EMPTY,
      { knownDungeonIds: new Set(["d1"]), knownClassIds: new Set(["feca"]) }
    );
    const warnings = plan.blocks[0].sequences[0].warnings.join(" ");
    expect(warnings).toMatch(/Cité inconnue/);
    expect(warnings).toMatch(/Ordre inconnu/);
    expect(warnings).toMatch(/Classe inconnue/);
    expect(warnings).toMatch(/Donjon inconnu/);
    expect(plan.totals.sequencesNew).toBe(1);
  });

  it("accepte l'ancien vocabulaire d'Ordre sans avertissement", () => {
    const plan = planRushImport(
      { blocks: [{ title: "Bloc", sequences: [{ subGuideName: "Ordre", alignReq: "Bontarien", alignOrderCode: "vaillant" }] }] },
      EMPTY
    );
    expect(plan.blocks[0].sequences[0].warnings).toEqual([]);
  });

  it("écarte un nom vide et un bloc sans titre", () => {
    const plan = planRushImport(
      { blocks: [{ title: "   ", sequences: [{ subGuideName: "x" }] }, { title: "Bloc", sequences: [{ subGuideName: "  " }] }] },
      EMPTY
    );
    expect(plan.warnings.join(" ")).toMatch(/bloc sans titre/);
    expect(plan.totals.sequencesSkipped).toBe(1);
    expect(plan.totals.blocksNew).toBe(1);
  });
});

/** Verrou de source : l'action serveur ne peut pas être destructive ni écrire en dry-run. */
describe("importRushGuide — garde de l'action serveur", () => {
  const code = readFileSync(path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"), "utf8");
  const start = code.indexOf("export async function importRushGuide");
  const body = code.slice(start, start + 5200);

  it("est protégée par le guard Rush et rend le plan sans écrire quand `apply` est faux", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("await requireRushAccess();");
    expect(body).toContain('if (!apply) return { success: true as const, data: { dryRun: true as const, plan } };');
  });

  it("n'efface ni ne réécrit rien : aucun delete/update dans son corps", () => {
    expect(body).not.toMatch(/\.deleteMany\(|\.delete\(|\.update\(|\.updateMany\(/);
  });

  it("borne les ids de quête et ne garde que les codes d'Ordre canoniques", () => {
    expect(body).toContain("boundQuestDbIds(sequence.questDbIds)");
    expect(body).toContain("normalizeOrderCode(sequence.alignOrderCode)");
  });
});

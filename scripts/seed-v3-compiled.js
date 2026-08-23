"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/seed-v3-compiled.ts
var import_client = require("@prisma/client");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var db = new import_client.PrismaClient();
var DATA_DIR = path.join(process.cwd(), "prisma/seed-data/dofus-quests");
var CHAIN_FILES = [
  { slug: "emeraude", file: "emeraude-compiled.json" },
  { slug: "turquoise", file: "turquoise-compiled.json" },
  { slug: "ivoire", file: "ivoire-compiled.json" },
  { slug: "ebene", file: "ebene-compiled.json" },
  { slug: "ocre", file: "ocre-compiled.json" },
  { slug: "pourpre", file: "pourpre-compiled.json" },
  { slug: "vulbis", file: "vulbis-compiled.json" },
  { slug: "tachet\xE9", file: "tachete-compiled.json" },
  { slug: "argent\xE9", file: "argent-compiled.json" },
  { slug: "dom-de-pin", file: "dom-de-pin-compiled.json" },
  { slug: "des-glaces", file: "glace-compiled.json" },
  { slug: "domakuro", file: "domakuro-compiled.json" },
  { slug: "dorigami", file: "dorigami-compiled.json" },
  { slug: "du-cauchemar", file: "cauchemar-compiled.json" },
  { slug: "abyssal", file: "abyssal-compiled.json" },
  { slug: "nebuleux", file: "nebuleux-compiled.json" },
  { slug: "forgelave", file: "forgelave-compiled.json" },
  { slug: "cacao", file: "cacao-compiled.json" },
  { slug: "dokoko", file: "dokoko-compiled.json" },
  { slug: "veilleur", file: "veilleurs-compiled.json" },
  { slug: "argente-scintillant", file: "argent-scint-compiled.json" },
  { slug: "sylvestre", file: "sylvestre-compiled.json" },
  { slug: "cawotte", file: "cawotte-compiled.json" },
  { slug: "dolmanax", file: "dolmanax-compiled.json" }
];
async function main() {
  console.log("\u{1F331} Seed V3 \u2014 Compiled JSON \u2192 Database\n");
  let totalChains = 0, totalEntries = 0, skipped = 0;
  for (const { slug, file } of CHAIN_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  \u23ED  SKIP (no file): ${slug}`);
      skipped++;
      continue;
    }
    const item = await db.dofusItem.findFirst({ where: { slug } });
    if (!item) {
      console.log(`  \u23ED  SKIP (no DofusItem): ${slug}`);
      skipped++;
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const chainCount = (data.chains ?? []).length;
    const entryCount = (data.chains ?? []).flatMap((c) => c.entries ?? []).length;
    await db.dofusQuestChain.deleteMany({ where: { dofusId: item.id } });
    for (const section of data.chains ?? []) {
      const chain = await db.dofusQuestChain.create({
        data: {
          dofusId: item.id,
          sectionType: section.sectionType ?? "MAIN_CHAIN",
          sectionName: section.sectionName,
          description: section.description ?? null,
          chainOrder: section.chainOrder ?? 0
        }
      });
      totalChains++;
      for (const entry of section.entries ?? []) {
        await db.dofusQuestEntry.create({
          data: {
            chainId: chain.id,
            name: entry.name,
            zone: entry.zone ?? null,
            questType: "QUEST",
            stepOrder: entry.stepOrder ?? 0,
            isOptional: false,
            isLast: entry.isLast ?? false,
            isDungeon: entry.isDungeon ?? false,
            dofusdbId: entry.dofusdbId ?? null,
            npcName: entry.npcName ?? null,
            npcSubArea: entry.npcSubArea ?? null,
            requirements: entry.requirements ?? null,
            itemsRequired: entry.itemsRequired ?? null,
            dungeonsRequired: entry.dungeonsRequired ?? null,
            objectives: entry.objectives ?? null,
            coords: entry.coords ?? null,
            level: entry.level ?? null,
            isSynergyCandidate: entry.isSynergyCandidate ?? false,
            weight: 1
          }
        });
        totalEntries++;
      }
    }
    console.log(`  \u2705 ${slug.padEnd(25)} \u2192 ${chainCount} sections, ${entryCount} qu\xEAtes`);
  }
  console.log(`
${"\u2550".repeat(50)}`);
  console.log(`\u2728 Seed termin\xE9 !`);
  console.log(`   ${totalChains} sections | ${totalEntries} qu\xEAtes | ${skipped} skipped`);
  console.log("\u2550".repeat(50));
}
main().catch((e) => {
  console.error("\u{1F4A5}", e);
  process.exit(1);
}).finally(() => db.$disconnect());

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

// scripts/v3/multi-source-siphoner.ts
var import_client = require("@prisma/client");
var import_pg = require("pg");
var import_adapter_pg = require("@prisma/adapter-pg");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_axios = __toESM(require("axios"));
var cheerio = __toESM(require("cheerio"));
var import_sharp = __toESM(require("sharp"));
var import_config = require("dotenv/config");
var https = __toESM(require("https"));
var httpsAgent = new https.Agent({ rejectUnauthorized: false });
var cleanEnv = (val) => !val ? "" : val.replace(/^['"]|['"]$/g, "").trim();
var getConnectionString = () => {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER);
  const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
  const db_name = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || "localhost";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5433/${db_name}?schema=public`;
};
var connectionString = getConnectionString();
var pool = new import_pg.Pool({ connectionString });
var adapter = new import_adapter_pg.PrismaPg(pool);
var prisma = new import_client.PrismaClient({ adapter });
var API_BASE = "https://api.dofusdb.fr";
var RENDER_BASE = "https://render.dofusdb.fr";
var TOUGLI_MAP = {
  "argent": "Dofus Argent\xE9.html",
  "emeraude": "Dofus Emeraude.html",
  "pourpre": "Dofus Pourpre.html",
  "turquoise": "Dofus Turquoise.html",
  "ivoire": "Dofus Ivoire.html",
  "ebene": "Dofus Ebene.html",
  "ocre": "Dofus Ocre.html",
  "vulbis": "Dofus Vulbis.html",
  "abyssal": "Dofus Abyssal.html",
  "glace": "Dofus des Gla\xE7es.html",
  "nebuleux": "Dofus Nebuleux.html",
  "cawotte": "Dofus Cawotte.html",
  "dokoko": "Dokoko.html",
  "dolmanax": "Dolmanax.html"
};
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalize(txt) {
  return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}
async function siphonDofus(slug) {
  console.log(`
\u{1F30A} SIPHONING DOFUS V3 (Deep Enrichment): ${slug.toUpperCase()}`);
  const normSlug = normalize(slug);
  const htmlFile = TOUGLI_MAP[normSlug];
  if (!htmlFile) return;
  const htmlPath = path.join(process.cwd(), "Tougli_HTML", htmlFile);
  if (!fs.existsSync(htmlPath)) return;
  const html = fs.readFileSync(htmlPath, "utf-8");
  const $ = cheerio.load(html);
  let dofus = await prisma.dofusItem.findUnique({ where: { slug: normSlug } });
  if (!dofus) {
    dofus = await prisma.dofusItem.create({ data: { slug: normSlug, name: slug, nameShort: slug, levelRecommended: 100 } });
  }
  const questsFromTougli = [];
  $("a[href*='dofuspourlesnoobs.com']").each((i, el) => {
    const name = $(el).text().trim();
    const url = $(el).attr("href");
    if (name && url && !questsFromTougli.find((q) => q.name === name)) {
      questsFromTougli.push({ name, dpnUrl: url });
    }
  });
  let mainChain = await prisma.dofusQuestChain.findFirst({ where: { dofusId: dofus.id, sectionType: "MAIN" } });
  if (!mainChain) {
    mainChain = await prisma.dofusQuestChain.create({ data: { dofusId: dofus.id, sectionType: "MAIN", sectionName: "Qu\xEAtes de l'oeuf", coordinatesV3: { x: 0, y: 0, zoom: 1 } } });
  }
  for (let i = 0; i < questsFromTougli.length; i++) {
    const q = questsFromTougli[i];
    const questSlug = `v3-${normSlug}-${normalize(q.name)}`;
    console.log(`   [${i + 1}/${questsFromTougli.length}] ${q.name}...`);
    try {
      const res = await import_axios.default.get(`${API_BASE}/quests`, { params: { "name.fr": q.name, lang: "fr" } });
      const match = res.data?.data?.[0];
      if (match) {
        console.log(`      \u2705 DofusDB Match: ID #${match.id}`);
        const fullQuest = (await import_axios.default.get(`${API_BASE}/quests/${match.id}?lang=fr`)).data;
        let localImage = null;
        if (fullQuest.npc?.id) {
          try {
            const npcRes = await import_axios.default.get(`${API_BASE}/npcs/${fullQuest.npc.id}?lang=fr`);
            if (npcRes.data.look) {
              const renderUrl = `${RENDER_BASE}/look/${encodeURIComponent(npcRes.data.look)}/head/2/128_128.png`;
              localImage = await downloadAndConvert(renderUrl, `npc-${fullQuest.npc.id}`);
            }
          } catch (e) {
          }
        }
        await prisma.dofusQuestEntry.upsert({
          where: { id: questSlug },
          update: {
            name: q.name,
            dofusdbId: match.id,
            level: fullQuest.level,
            npcName: fullQuest.npc?.name?.fr || null,
            npcSubArea: fullQuest.npc?.subArea?.name?.fr || null,
            coords: fullQuest.npc?.map?.coords ? { x: fullQuest.npc.map.coords.x, y: fullQuest.npc.map.coords.y } : import_client.Prisma.JsonNull,
            mapId: fullQuest.npc?.mapId || null,
            objectives: fullQuest.steps?.[0]?.objectives || [],
            notes: `Walkthrough: ${q.dpnUrl}`,
            localImageUrl: localImage,
            stepOrder: i,
            chainId: mainChain.id
          },
          create: {
            id: questSlug,
            name: q.name,
            dofusdbId: match.id,
            level: fullQuest.level,
            npcName: fullQuest.npc?.name?.fr || null,
            npcSubArea: fullQuest.npc?.subArea?.name?.fr || null,
            coords: fullQuest.npc?.map?.coords ? { x: fullQuest.npc.map.coords.x, y: fullQuest.npc.map.coords.y } : import_client.Prisma.JsonNull,
            mapId: fullQuest.npc?.mapId || null,
            objectives: fullQuest.steps?.[0]?.objectives || [],
            notes: `Walkthrough: ${q.dpnUrl}`,
            localImageUrl: localImage,
            stepOrder: i,
            chainId: mainChain.id
          }
        });
      } else {
        await prisma.dofusQuestEntry.upsert({ where: { id: questSlug }, update: { name: q.name, notes: `Walkthrough: ${q.dpnUrl}`, stepOrder: i, chainId: mainChain.id }, create: { id: questSlug, name: q.name, notes: `Walkthrough: ${q.dpnUrl}`, stepOrder: i, chainId: mainChain.id } });
      }
    } catch (e) {
      console.error(`      \u274C Erreur ${q.name}: ${e.message}`);
    }
    await sleep(200);
  }
  console.log(`\u2705 SYNC DOFUS TERMIN\xC9 POUR ${slug.toUpperCase()}`);
}
async function downloadAndConvert(url, filename) {
  const targetDir = path.join(process.cwd(), "public", "assets", "dofus", "npcs");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const webpPath = path.join(targetDir, `${filename}.webp`);
  const publicUrl = `/assets/dofus/npcs/${filename}.webp`;
  if (fs.existsSync(webpPath)) return publicUrl;
  try {
    const response = await (0, import_axios.default)({ url, responseType: "arraybuffer", httpsAgent });
    await (0, import_sharp.default)(response.data).webp({ quality: 80 }).toFile(webpPath);
    return publicUrl;
  } catch (e) {
    console.error(`      \u{1F5BC}\uFE0F Erreur image (${filename}):`, e.message);
    return null;
  }
}
var arg = process.argv[2];
if (arg) {
  siphonDofus(arg).then(() => prisma.$disconnect()).catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
} else {
  console.log("Usage: node scripts/v3/multi-source-siphoner.js <slug>");
}

import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import sharp from "sharp";
import 'dotenv/config';
import * as https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// --- Prisma Initialization ---
const cleanEnv = (val: string | undefined) => (!val) ? '' : val.replace(/^['"]|['"]$/g, '').trim();
const getConnectionString = () => {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER);
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || 'localhost';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5433/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool) as any;
const prisma = new PrismaClient({ adapter });

const API_BASE = "https://api.dofusdb.fr";
const RENDER_BASE = "https://render.dofusdb.fr";

const TOUGLI_MAP: Record<string, string> = {
    "argent": "Dofus Argenté.html", "emeraude": "Dofus Emeraude.html", "pourpre": "Dofus Pourpre.html", "turquoise": "Dofus Turquoise.html", "ivoire": "Dofus Ivoire.html", "ebene": "Dofus Ebene.html", "ocre": "Dofus Ocre.html", "vulbis": "Dofus Vulbis.html", "abyssal": "Dofus Abyssal.html", "glace": "Dofus des Glaçes.html", "nebuleux": "Dofus Nebuleux.html", "cawotte": "Dofus Cawotte.html", "dokoko": "Dokoko.html", "dolmanax": "Dolmanax.html"
};

async function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
function normalize(txt: string): string { return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim(); }

async function siphonDofus(slug: string) {
    console.log(`\n🌊 SIPHONING DOFUS V3 (Deep Enrichment): ${slug.toUpperCase()}`);
    const normSlug = normalize(slug);
    const htmlFile = TOUGLI_MAP[normSlug];
    if (!htmlFile) return;

    const htmlPath = path.join(process.cwd(), "Tougli_HTML", htmlFile);
    if (!fs.existsSync(htmlPath)) return;

    const html = fs.readFileSync(htmlPath, "utf-8");
    const $ = cheerio.load(html);

    let dofus = await prisma.dofusItem.findUnique({ where: { slug: normSlug } });
    if (!dofus) { dofus = await prisma.dofusItem.create({ data: { slug: normSlug, name: slug, nameShort: slug, levelRecommended: 100 } }); }

    const questsFromTougli: any[] = [];
    $("a[href*='dofuspourlesnoobs.com']").each((i, el) => {
        const name = $(el).text().trim();
        const url = $(el).attr("href");
        if (name && url && !questsFromTougli.find(q => q.name === name)) { questsFromTougli.push({ name, dpnUrl: url }); }
    });

    let mainChain = await prisma.dofusQuestChain.findFirst({ where: { dofusId: dofus.id, sectionType: "MAIN" } });
    if (!mainChain) { mainChain = await prisma.dofusQuestChain.create({ data: { dofusId: dofus.id, sectionType: "MAIN", sectionName: "Quêtes de l'oeuf", coordinatesV3: { x: 0, y: 0, zoom: 1 } as Prisma.InputJsonValue } }); }

    for (let i = 0; i < questsFromTougli.length; i++) {
        const q = questsFromTougli[i];
        const questSlug = `v3-${normSlug}-${normalize(q.name)}`;
        console.log(`   [${i+1}/${questsFromTougli.length}] ${q.name}...`);

        try {
            const res = await axios.get(`${API_BASE}/quests`, { params: { "name.fr": q.name, lang: "fr" }, timeout: 5000 });
            const match = res.data?.data?.[0];
            
            if (match) {
                console.log(`      ✅ DofusDB Match: ID #${match.id}`);
                const fullQuest = (await axios.get(`${API_BASE}/quests/${match.id}?lang=fr`, { timeout: 5000 })).data;
                let localImage = null;

                // Priority for Icon: 1. Rendered NPC Head, 2. Quest Metadata Icon, 3. Fallback
                if (fullQuest.npc?.id) {
                    try {
                        const npcRes = await axios.get(`${API_BASE}/npcs/${fullQuest.npc.id}?lang=fr`, { timeout: 5000 });
                        if (npcRes.data.look) {
                            const renderUrl = `${RENDER_BASE}/look/${encodeURIComponent(npcRes.data.look)}/head/2/128_128-10.png`;
                            localImage = await downloadAndConvert(renderUrl, `npc-${fullQuest.npc.id}`);
                        }
                    } catch (e: any) { console.error(`      ⚠️ NPC Head Render Failed (#${fullQuest.npc.id}): ${e.message}`); }
                }

                if (!localImage && match.type?.id) {
                    try {
                        const iconUrl = `https://static.dofusdb.fr/img/items/quests/category_${match.type.id}.png`;
                        localImage = await downloadAndConvert(iconUrl, `quest-cat-${match.type.id}`);
                    } catch (e) { }
                }

                await (prisma.dofusQuestEntry as any).upsert({
                    where: { id: questSlug },
                    update: {
                        name: q.name,
                        dofusdbId: match.id,
                        level: fullQuest.level,
                        npcName: fullQuest.npc?.name?.fr || null,
                        npcSubArea: fullQuest.npc?.subArea?.name?.fr || null,
                        coords: fullQuest.npc?.map?.coords ? { x: fullQuest.npc.map.coords.x, y: fullQuest.npc.map.coords.y } : Prisma.JsonNull,
                        mapId: fullQuest.npc?.mapId || null,
                        objectives: (fullQuest.steps?.[0]?.objectives || []) as Prisma.InputJsonValue,
                        notes: `Walkthrough: ${q.dpnUrl}`,
                        localImageUrl: localImage || "/assets/dofus/npcs/fallback.webp",
                        stepOrder: i,
                        chainId: mainChain.id
                    },
                    create: {
                        id: questSlug,
                        chainId: mainChain.id,
                        name: q.name,
                        dofusdbId: match.id,
                        level: fullQuest.level,
                        npcName: fullQuest.npc?.name?.fr || null,
                        npcSubArea: fullQuest.npc?.subArea?.name?.fr || null,
                        coords: fullQuest.npc?.map?.coords ? { x: fullQuest.npc.map.coords.x, y: fullQuest.npc.map.coords.y } : Prisma.JsonNull,
                        mapId: fullQuest.npc?.mapId || null,
                        objectives: (fullQuest.steps?.[0]?.objectives || []) as Prisma.InputJsonValue,
                        notes: `Walkthrough: ${q.dpnUrl}`,
                        localImageUrl: localImage || "/assets/dofus/npcs/fallback.webp",
                        stepOrder: i
                    }
                });
            } else {
                await (prisma.dofusQuestEntry as any).upsert({ 
                    where: { id: questSlug }, 
                    update: { name: q.name, notes: `Walkthrough: ${q.dpnUrl}`, stepOrder: i, chainId: mainChain.id, localImageUrl: "/assets/dofus/npcs/fallback.webp" }, 
                    create: { id: questSlug, name: q.name, notes: `Walkthrough: ${q.dpnUrl}`, stepOrder: i, chainId: mainChain.id, localImageUrl: "/assets/dofus/npcs/fallback.webp" } 
                });
            }
        } catch (e: any) { console.error(`      ❌ Erreur ${q.name}: ${e.message}`); }
        await sleep(200);
    }
    console.log(`✅ SYNC DOFUS TERMINÉ POUR ${slug.toUpperCase()}`);
}

async function downloadAndConvert(url: string, filename: string): Promise<string | null> {
    const targetDir = path.join(process.cwd(), "public", "assets", "dofus", "npcs");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const webpPath = path.join(targetDir, `${filename}.webp`);
    const publicUrl = `/assets/dofus/npcs/${filename}.webp`;
    if (fs.existsSync(webpPath)) return publicUrl;
    try {
        const response = await axios({ url, responseType: "arraybuffer", httpsAgent, timeout: 10000 });
        await sharp(response.data).webp({ quality: 80 }).toFile(webpPath);
        return publicUrl;
    } catch (e: any) { 
        console.error(`      🖼️ Erreur image retrieval (${filename}):`, e.message); 
        return null; 
    }
}

const arg = process.argv[2];
if (arg) {
    siphonDofus(arg).then(() => {
        console.log("🌊 Siphoner run complete.");
        process.exit(0);
    }).catch(e => { 
        console.error(e); 
        process.exit(1);
    });
} else {
    console.log("Usage: npx ts-node scripts/v3/multi-source-siphoner.ts <slug>");
    process.exit(1);
}

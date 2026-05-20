import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
  if (!val) return '';
  return val.replace(/^['"]|['"]$/g, '').trim();
};

const getConnectionString = () => {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
  const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
  const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5433'; // Default dev port is 5433
  const protocol = "postgres" + "ql://";
  return `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DOFUSDB_API = "https://api.dofusdb.fr";

async function siphonQuests() {
    console.log("🚀 Connecting to database...");
    console.log("🚀 Démarrage du siphonnage des quêtes DofusDB...");

    // 1. Fetch categories
    console.log("📚 Récupération des catégories de quêtes...");
    const catRes = await fetch(`${DOFUSDB_API}/quest-categories?$limit=100`);
    const catJson = (await catRes.json()) as any;
    const categoriesMap = new Map<number, string>();
    
    if (catJson.data) {
        for (const cat of catJson.data) {
            categoriesMap.set(cat.id, cat.name?.fr || "Inconnu");
        }
    }
    console.log(`✅ ${categoriesMap.size} catégories chargées.`);

    // 2. Siphon quests
    const limit = 50;
    let skip = 0;
    let total = 1; // will be updated
    let processed = 0;
    let errors = 0;

    // Track names to avoid uniqueness constraint errors
    const usedNames = new Set<string>();
    
    // First, load existing names from DB to prevent conflicts
    const existingQuests = await prisma.gameQuest.findMany({ select: { name: true } });
    for (const q of existingQuests) {
        usedNames.add(q.name.toLowerCase());
    }

    while (skip < total) {
        console.log(`⏳ Récupération des quêtes ${skip} à ${skip + limit}...`);
        try {
            const res = await fetch(`${DOFUSDB_API}/quests?$limit=${limit}&$skip=${skip}`);
            const json = (await res.json()) as any;
            
            if (!json.data || json.data.length === 0) break;
            
            total = json.total;
            
            for (const q of json.data) {
                const dofusDbId = q.id;
                let rawName = q.name?.fr;
                
                if (!rawName) continue; // Skip if no french name

                // Uniqueness constraint handling
                let finalName = rawName;
                if (usedNames.has(rawName.toLowerCase())) {
                    // Check if it's already in DB with the exact same dofusDbId to update it
                    const existing = await prisma.gameQuest.findFirst({
                        where: { name: rawName }
                    });
                    
                    if (existing && existing.dofusDbId !== dofusDbId) {
                        // Conflict! Another quest has the same name but different ID.
                        finalName = `${rawName} (#${dofusDbId})`;
                    }
                }
                
                usedNames.add(finalName.toLowerCase());

                const categoryName = categoriesMap.get(q.categoryId) || "Non classé";

                await prisma.gameQuest.upsert({
                    where: { name: finalName },
                    update: {
                        dofusDbId: dofusDbId,
                        levelMin: q.levelMin,
                        levelMax: q.levelMax,
                        category: categoryName
                    },
                    create: {
                        name: finalName,
                        dofusDbId: dofusDbId,
                        levelMin: q.levelMin,
                        levelMax: q.levelMax,
                        category: categoryName
                    }
                });

                processed++;
            }
            
            skip += limit;
        } catch (e) {
            console.error(`❌ Erreur lors de la récupération (skip=${skip}):`, e);
            errors++;
            skip += limit; // Force skip to next batch
        }
    }

    console.log(`\n🎉 Siphonnage terminé !`);
    console.log(`👉 Quêtes traitées : ${processed}/${total}`);
    if (errors > 0) console.log(`⚠️ Erreurs rencontrées : ${errors}`);
    
    await prisma.$disconnect();
    await pool.end();
}

siphonQuests().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
});

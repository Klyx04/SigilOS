import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

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
  const port = process.env.DB_PORT || '5433';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

async function main() {
  const connectionString = getConnectionString();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🔗 Updating DPLN links for Argenté Scintillant...");

  const links: Record<string, string> = {
    "Les coûts du sort": "https://www.dofuspourlesnoobs.com/les-couts-du-sort.html",
    "Une ombre au tableau": "https://www.dofuspourlesnoobs.com/une-ombre-au-tableau.html",
    "Un remède draconien": "https://www.dofuspourlesnoobs.com/un-remede-draconien.html",
    "Le dragon des vents": "https://www.dofuspourlesnoobs.com/le-dragon-des-vents.html",
    "Le dragon des flammes": "https://www.dofuspourlesnoobs.com/le-dragon-des-flammes.html",
    "Le destin de Kalisthe": "https://www.dofuspourlesnoobs.com/le-destin-de-kalisthe.html",
    "Dans la gueule du dragon": "https://www.dofuspourlesnoobs.com/dans-la-gueule-du-dragon.html",
    "Le silence est d'Aure": "https://www.dofuspourlesnoobs.com/le-silence-est-daure.html"
  };

  try {
    for (const [name, url] of Object.entries(links)) {
      const result = await prisma.dofusQuestEntry.updateMany({
        where: { name },
        data: { externalRef: url }
      });
      console.log(`✅ Updated '${name}': ${result.count} occurrences`);
    }
    console.log("🎉 All links updated!");
  } catch (err) {
    console.error("❌ Update failed:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Clean helper for environment variables
const cleanEnv = (val: string | undefined) => {
  if (!val) return "";
  return val.replace(/^['"]|['"]$/g, "").trim();
};

const getConnectionString = () => {
  if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
  const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
  const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
  const db_name = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5433";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
};

async function main() {
  const connectionString = getConnectionString();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Analyzing unique images in SubGuideData steps...");
  const guides = await prisma.subGuideData.findMany({
    select: {
      guideRef: true,
      steps: true
    }
  });

  const imgRegex = /<img[^>]+src=["']?([^"']+)["']?/gi;
  const uniqueUrlsByHost: Record<string, Map<string, number>> = {};

  for (const guide of guides) {
    const stepsArray = guide.steps as any[];
    if (!Array.isArray(stepsArray)) continue;

    for (const step of stepsArray) {
      const text = step.web_text || "";
      let match;
      while ((match = imgRegex.exec(text)) !== null) {
        const src = match[1];
        try {
          const parsed = new URL(src);
          const host = parsed.hostname;
          if (!uniqueUrlsByHost[host]) {
            uniqueUrlsByHost[host] = new Map();
          }
          uniqueUrlsByHost[host].set(src, (uniqueUrlsByHost[host].get(src) || 0) + 1);
        } catch (e) {
          const host = "relative/invalid";
          if (!uniqueUrlsByHost[host]) {
            uniqueUrlsByHost[host] = new Map();
          }
          uniqueUrlsByHost[host].set(src, (uniqueUrlsByHost[host].get(src) || 0) + 1);
        }
      }
    }
  }

  console.log("\nUnique URLs summary per host:");
  for (const [host, urlsMap] of Object.entries(uniqueUrlsByHost)) {
    console.log(`- ${host}: ${urlsMap.size} unique URLs (total occurrences: ${Array.from(urlsMap.values()).reduce((a, b) => a + b, 0)})`);
    if (urlsMap.size < 15) {
      console.log("  Unique URLs list:");
      for (const [url, count] of urlsMap.entries()) {
        console.log(`    - [${count}x] ${url}`);
      }
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);

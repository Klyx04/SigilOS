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

  console.log("Analyzing images in SubGuideData steps...");
  const guides = await prisma.subGuideData.findMany({
    select: {
      guideRef: true,
      guideName: true,
      steps: true
    }
  });

  const imgRegex = /<img[^>]+src=["']?([^"']+)["']?/gi;
  const imageHosts: Record<string, string[]> = {};

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
          if (!imageHosts[host]) {
            imageHosts[host] = [];
          }
          if (imageHosts[host].length < 20) {
            imageHosts[host].push(`${guide.guideRef} - Step ${step.stepNumber}: ${src}`);
          }
        } catch (e) {
          const host = "relative/invalid";
          if (!imageHosts[host]) {
            imageHosts[host] = [];
          }
          if (imageHosts[host].length < 20) {
            imageHosts[host].push(`${guide.guideRef} - Step ${step.stepNumber}: ${src}`);
          }
        }
      }
    }
  }

  console.log("\nImage Hosts and Samples:");
  for (const [host, samples] of Object.entries(imageHosts)) {
    console.log(`\n--- Host: ${host} (Total samples shown: ${samples.length}) ---`);
    console.log(samples.join("\n"));
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);

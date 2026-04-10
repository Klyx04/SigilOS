import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const compiledDir = path.join(process.cwd(), "prisma/seed-data/dofus-quests");

if (!fs.existsSync(compiledDir)) {
  console.error("❌ Compiled data directory not found.");
  process.exit(1);
}

const files = fs.readdirSync(compiledDir).filter(f => f.endsWith("-compiled.json"));

console.log(`\n🚀 Starting Global Seed for ${files.length} Dofus chains...\n`);

for (const file of files) {
  const slug = file.replace("-compiled.json", "");
  console.log(`\n============================================================`);
  console.log(`🌱 Seeding: ${slug}`);
  console.log(`============================================================`);
  
  try {
    execSync(`npx tsx scripts/seed-argent-tree.ts --dofus ${slug}`, { 
      stdio: "inherit",
      env: { ...process.env, SKIP_ENV_CHECK: "true" } 
    });
  } catch (err) {
    console.error(`\n❌ Failed to seed ${slug}`);
  }
}

console.log("\n✅ Global Seeding Process Complete!");

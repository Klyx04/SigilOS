/**
 * Script de siphonnage et compression des images de guides
 * 
 * Télécharge les captures d'écran hébergées sur des services tiers
 * (Imgur, Gyazo, Dofuspourlesnoobs, Ganymède) et les stocke localement
 * en WebP compressé. Met à jour la base de données pour pointer vers
 * les copies locales.
 * 
 * Usage:
 *   # En local (dev)
 *   npx tsx scripts/siphon-guide-images.ts
 * 
 *   # Dans Docker (prod/beta) — utiliser le bundle compilé :
 *   node scripts/siphon-guide-images.js
 */

import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

// The local pre-configured 'prisma' instance is imported directly.
// This preserves all multi-tenant pool configuration and encryption middleware.

const TARGET_HOSTS = new Set([
  "i.imgur.com",
  "imgur.com",
  "i.gyazo.com",
  "www.dofuspourlesnoobs.com",
  "ganymede-dofus.com",
  "ganymede-app.com"
]);

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads/guides");

async function main() {
  console.log("🚀 Initialisation du siphonneur d'images de guides...");

  // Ensure output directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`📁 Dossier créé : ${UPLOADS_DIR}`);
  }

  console.log("📚 Récupération des guides en base de données...");
  const guides = await prisma.subGuideData.findMany();
  console.log(`✅ ${guides.length} guides récupérés.`);

  // 1. Extract all target image URLs
  const imgRegex = /<img[^>]+src=["']?([^"']+)["']?/gi;
  const urlToLocalMap = new Map<string, string>(); // original URL -> local path /uploads/guides/...
  const urlsToDownload = new Set<string>();

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

          if (TARGET_HOSTS.has(host)) {
            // Special rule: only download guides.png from ganymede, skip small icons
            if (
              (host === "ganymede-dofus.com" || host === "ganymede-app.com") &&
              !src.includes("guides.png")
            ) {
              continue;
            }

            const hash = crypto.createHash("md5").update(src).digest("hex");
            const filename = `guide_${hash}.webp`;
            urlToLocalMap.set(src, `/uploads/guides/${filename}`);
            urlsToDownload.add(src);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    }
  }

  console.log(`📦 Trouvé ${urlsToDownload.size} images uniques cibles à siphonner.`);

  // 2. Download and compress images
  const urlList = Array.from(urlsToDownload);
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  console.log("⚡ Démarrage du siphonnage (par groupes de 8)...");

  async function processBatch(urls: string[], concurrency: number) {
    let index = 0;

    async function worker() {
      while (index < urls.length) {
        const url = urls[index++];
        const localPath = path.join(UPLOADS_DIR, path.basename(urlToLocalMap.get(url)!));

        // Skip downloading if already exists
        if (fs.existsSync(localPath)) {
          skippedCount++;
          continue;
        }

        try {
          // Slight delay between worker startups to be polite
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 50));

          const res = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              "Accept-Language": "fr,en-US;q=0.9,en;q=0.8"
            }
          });

          if (!res.ok) {
            throw new Error(`HTTP Status ${res.status}`);
          }

          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Compress to WebP via sharp
          await sharp(buffer)
            .webp({ quality: 65, effort: 6 })
            .toFile(localPath);

          downloadedCount++;
          if (downloadedCount % 50 === 0 || downloadedCount === 1) {
            console.log(`  [Téléchargement] ${downloadedCount} images siphonnées avec succès...`);
          }
        } catch (err: any) {
          console.error(`  ❌ Échec pour ${url}: ${err.message}`);
          failedCount++;
        }
      }
    }

    const workers = Array.from({ length: concurrency }, worker);
    await Promise.all(workers);
  }

  await processBatch(urlList, 8);

  console.log("\n📊 Bilan du siphonnage :");
  console.log(`- Téléchargées & compressées : ${downloadedCount}`);
  console.log(`- Déjà présentes (passées)   : ${skippedCount}`);
  console.log(`- Échecs                     : ${failedCount}`);

  // 3. Update the database step JSON fields
  console.log("\n🔄 Mise à jour de la base de données...");
  let updatedGuidesCount = 0;
  let totalReplacementsCount = 0;

  for (const guide of guides) {
    const stepsArray = guide.steps as any[];
    if (!Array.isArray(stepsArray)) continue;

    let guideModified = false;
    const updatedSteps = stepsArray.map((step) => {
      let stepText = step.web_text || "";
      let stepModified = false;

      // Scan step HTML for image tags and replace their src
      let match;
      imgRegex.lastIndex = 0; // reset regex state
      while ((match = imgRegex.exec(stepText)) !== null) {
        const src = match[1];
        if (urlToLocalMap.has(src)) {
          const localRelPath = urlToLocalMap.get(src)!;
          // Verify if local image was actually successfully downloaded/exists before replacing
          const localFilename = path.basename(localRelPath);
          const fullLocalPath = path.join(UPLOADS_DIR, localFilename);

          if (fs.existsSync(fullLocalPath)) {
            // Replace external URL with local one in HTML
            stepText = stepText.split(src).join(localRelPath);
            stepModified = true;
            totalReplacementsCount++;
          }
        }
      }

      if (stepModified) {
        guideModified = true;
        return {
          ...step,
          web_text: stepText
        };
      }
      return step;
    });

    if (guideModified) {
      await prisma.subGuideData.update({
        where: { id: guide.id },
        data: { steps: updatedSteps }
      });
      updatedGuidesCount++;
    }
  }

  console.log(`✅ Base de données mise à jour !`);
  console.log(`- Guides modifiés en DB : ${updatedGuidesCount}`);
  console.log(`- URL d'images remplacées dans les étapes : ${totalReplacementsCount}`);

  await prisma.$disconnect();
  console.log("✨ Opération de siphonnage et compression terminée avec succès !");
}

main().catch(console.error);

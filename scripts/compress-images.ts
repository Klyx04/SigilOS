import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIRS_TO_COMPRESS = [
    'public/game-data/hd_maps',
    'public/game-data/tiles'
];

async function getAllFiles(dirPath: string): Promise<string[]> {
    let results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await getAllFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.jpg')) {
            results.push(fullPath);
        }
    }
    return results;
}

async function processBatch(files: string[], concurrency: number) {
    let i = 0;
    let totalSaved = 0;
    let processed = 0;

    async function worker() {
        while (i < files.length) {
            const index = i++;
            const fullPath = files[index];
            const webpPath = fullPath.replace(/\.jpg$/, '.webp');

            if (fs.existsSync(webpPath)) {
                // If it exists, but the jpg is still there, we just remove the jpg
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
                processed++;
                continue;
            }

            try {
                await sharp(fullPath)
                    .webp({ quality: 80, effort: 4 })
                    .toFile(webpPath);

                const oldSize = fs.statSync(fullPath).size;
                const newSize = fs.statSync(webpPath).size;
                totalSaved += (oldSize - newSize);

                // On efface le JPG orphelin pour éviter l'encombrement du VPS !
                fs.unlinkSync(fullPath);
            } catch (err) {
                console.error(`Failed to compress ${fullPath}:`, err);
            }
            processed++;
            if (processed % 500 === 0) {
                console.log(`[Progression] ${processed} / ${files.length} images converties...`);
            }
        }
    }

    const workers = Array.from({ length: concurrency }, worker);
    await Promise.all(workers);
    return totalSaved;
}

async function run() {
    console.log("🔍 Récupération de tous les JPGs à compresser...");
    let allFiles: string[] = [];
    for (const dir of DIRS_TO_COMPRESS) {
        const fullDir = path.join(process.cwd(), dir);
        allFiles = allFiles.concat(await getAllFiles(fullDir));
    }

    if (allFiles.length === 0) {
        console.log("✅ Aucun JPG détecté, tout est déjà compressé !");
        return;
    }

    console.log(`🚀 Démarrage de la compression WebP Parallèle (sur ${allFiles.length} fichiers)...`);

    // On utilise 16 processus asynchrones en parallèle pour libérer la puissance CPU au maximum (ça prendra 1 ou 2 min)
    const saved = await processBatch(allFiles, 16);

    console.log(`\n🏆 Compression et nettoyage terminés !`);
    console.log(`💾 Espace économisé sur ton VPS : ${(saved / 1024 / 1024).toFixed(2)} MB`);
}

run();

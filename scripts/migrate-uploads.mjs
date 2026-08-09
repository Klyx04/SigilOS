// SigilOS — Migration des fichiers uploads (public/uploads → private_uploads)
// Silencieux par défaut : n'affiche qu'un résumé. Pour le détail fichier par
// fichier : MIGRATE_UPLOADS_VERBOSE=1 node scripts/migrate-uploads.mjs
import { mkdir, rename, access, readdir, stat, copyFile, unlink } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_UPLOADS = join(PROJECT_ROOT, "public", "uploads");
const PRIVATE_UPLOADS = join(PROJECT_ROOT, "private_uploads");
const VERBOSE = process.env.MIGRATE_UPLOADS_VERBOSE === "1";

let moved = 0;
const categories = {};

// Catégorise un chemin relatif pour un résumé lisible (docs, guildes, etc.)
function categoryOf(relativePath) {
    const seg = relativePath.split("/").filter(Boolean)[0] || "autres";
    const map = {
        docs: "docs",
        guilds: "guildes",
        achievements: "achievements",
        "ocr-debug": "ocr-debug",
    };
    return map[seg] || "autres";
}

async function safeRename(src, dest) {
    try {
        await rename(src, dest);
    } catch (err) {
        if (err.code === "EXDEV") {
            await copyFile(src, dest);
            await unlink(src);
        } else {
            throw err;
        }
    }
}

async function migrate(dir) {
    try {
        const files = await readdir(dir);
        for (const file of files) {
            const currentPath = join(dir, file);
            const relativePath = currentPath.replace(PUBLIC_UPLOADS, "");
            const targetPath = join(PRIVATE_UPLOADS, relativePath);

            const stats = await stat(currentPath);
            if (stats.isDirectory()) {
                await migrate(currentPath);
            } else {
                await mkdir(dirname(targetPath), { recursive: true });
                await safeRename(currentPath, targetPath);
                moved++;
                const cat = categoryOf(relativePath);
                categories[cat] = (categories[cat] || 0) + 1;
                if (VERBOSE) console.log(`✅ Migrated: ${relativePath}`);
            }
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.error(`❌ Error migrating ${dir}:`, err.message);
        }
    }
}

async function start() {
    console.log("🚀 Migration des fichiers uploads...");

    try {
        await access(PUBLIC_UPLOADS);
    } catch {
        console.log("ℹ️  Rien à migrer (aucun dossier public/uploads).");
        return;
    }

    await mkdir(PRIVATE_UPLOADS, { recursive: true });
    await migrate(PUBLIC_UPLOADS);

    if (moved === 0) {
        console.log("✅ Aucun fichier à migrer (public/uploads vide).");
    } else {
        const detail = Object.entries(categories)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        console.log(`✅ ${moved} fichier(s) migré(s) (${detail}).`);
    }
}

start().catch(console.error);

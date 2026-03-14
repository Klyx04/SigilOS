import { mkdir, rename, access, readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_UPLOADS = join(PROJECT_ROOT, "public", "uploads");
const PRIVATE_UPLOADS = join(PROJECT_ROOT, "private_uploads");

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
                await rename(currentPath, targetPath);
                console.log(`✅ Migrated: ${relativePath}`);
            }
        }
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.error(`❌ Error migrating ${dir}:`, err.message);
        }
    }
}

async function start() {
    console.log("🚀 Starting migration from public/uploads to private_uploads...");
    
    try {
        await access(PUBLIC_UPLOADS);
    } catch {
        console.log("ℹ️ No public/uploads folder found. Nothing to migrate.");
        return;
    }

    await mkdir(PRIVATE_UPLOADS, { recursive: true });
    await migrate(PUBLIC_UPLOADS);
    
    console.log("✨ Migration complete!");
}

start().catch(console.error);

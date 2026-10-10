// SigilOS — Migration des fichiers uploads (public/uploads → private_uploads)
// Silencieux par défaut : n'affiche qu'un résumé. Pour le détail fichier par
// fichier : MIGRATE_UPLOADS_VERBOSE=1 node scripts/migrate-uploads.mjs
//
// Pourquoi ce déplacement : `public/uploads` est servi **en direct** par le
// serveur, `private_uploads` n'est servi que par les routes contrôlées
// (`/api/storage/…`, `/api/upload`). Le déploiement rejoue cette migration à
// chaque fois : tout ce qui reste dans `public/uploads` est rangé côté privé.
import { mkdir, rename, access, readdir, stat, copyFile, unlink } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_UPLOADS = join(PROJECT_ROOT, "public", "uploads");
const PRIVATE_UPLOADS = join(PROJECT_ROOT, "private_uploads");
const VERBOSE = process.env.MIGRATE_UPLOADS_VERBOSE === "1";

// 🔒 Dossiers qui RESTENT dans `public/uploads` : ce sont des **caches d'assets servis en
// statique** (`/uploads/assets-dofus/items/{id}.webp`, le chemin que `getLocalAssetUrl` et
// `resolveItemImage` renvoient au navigateur, et le cache d'images de `/api/proxy-image`).
// Mesure du 10/10/2026 : les ranger côté privé les sort du chemin que le code interroge ⇒
// **404**, puis re-siphonage à la demande — c'est ce qui vidait le cache d'icônes à CHAQUE
// déploiement, alors que le volume `assets-*-data` existe précisément pour le préserver
// (`docker-compose.prod.yml`). On ne descend même pas dans ces dossiers.
const KEEP_IN_PUBLIC = new Set(["assets-dofus", "proxy-cache"]);

let moved = 0;
let kept = 0;
const categories = {};

// Catégorise un chemin relatif pour un résumé lisible : le **premier dossier réel**
// (`assets-dofus`, `proofs`, `guilds`, `docs`…). 🐛 Avant le 30/09/2026, une liste
// blanche incomplète rangeait tout le reste sous « autres » ⇒ le déploiement
// affichait « 310 fichier(s) migré(s) (autres: 310) », illisible pour qui lit la
// sortie. Le nom du dossier est toujours plus parlant qu'un fourre-tout.
// Séparateurs `/` **et** `\` : le script tourne aussi sur un poste Windows.
function categoryOf(relativePath) {
    const segments = relativePath.split(/[/\\]/).filter(Boolean);
    // Un fichier posé à la racine de `public/uploads` n'a pas de dossier : on le
    // regroupe sous « (racine) » au lieu d'afficher son nom en guise de catégorie.
    return segments.length > 1 ? segments[0] : "(racine)";
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
            // Caches d'assets servis en statique : jamais déplacés (cf. KEEP_IN_PUBLIC).
            if (dir === PUBLIC_UPLOADS && KEEP_IN_PUBLIC.has(file)) {
                kept++;
                if (VERBOSE) console.log(`🔒 Conservé: ${file}/`);
                continue;
            }
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
        console.log("✅ Rien à ranger : aucun fichier en attente dans public/uploads.");
    } else {
        const detail = Object.entries(categories)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        console.log(`✅ ${moved} fichier(s) déplacé(s) de public/uploads vers private_uploads (${detail}).`);
    }

    // Dit ce qui est protégé : un lecteur de la sortie de déploiement doit pouvoir vérifier
    // que le cache d'assets n'a pas été touché, sans ouvrir le script.
    if (kept > 0) {
        console.log(`🔒 ${kept} dossier(s) de cache conservé(s) en public (${Array.from(KEEP_IN_PUBLIC).join(", ")}).`);
    }
}

start().catch(console.error);

import { writeFile, mkdir } from "fs/promises";
import { resolve, basename, join, sep } from "path";
import sharp from "sharp";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/safe-fetch";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB before optimization

// ─── SSRF (F-03 + audit 13/11) ──────────────────────────────────────────────
// Tout téléchargement sortant passe par `safeFetch` (src/lib/safe-fetch.ts) :
// protocole http(s), IP privées refusées **pendant** la connexion (fin du TOCTOU
// DNS) et redirections revalidées. Aucun `fetch` nu dans ce module.
// -----------------------------------------------------------------------------

// Optimization settings per type
const IMAGE_SIZES = {
    monster: 512,      // Monsters: 512px max
    achievement: 256,  // Achievements: 256px max (icons)
    dungeon: 512,      // Dungeons: 512px max
    item: 256,         // Items/Bonuses: 256px max
    legendary: 256,    // Legendary items: 256px max
    defi: 512,         // Défis : 512px max (illustration)
    titan: 512,        // Titans : 512px max (illustration)
};

export type ImageType = "monster" | "achievement" | "dungeon" | "item" | "legendary" | "defi" | "titan";

/**
 * 🔒 CodeQL js/path-injection (fix PR #505) : répertoires de destination FIXES
 * (constantes du code), indexés par type. Aucune partie du répertoire ne peut être
 * influencée par l'utilisateur — les sinks (mkdir/writeFile) ne reçoivent que ce
 * répertoire + un nom de fichier assaini (basename + allowlist) dans processAndSaveImage.
 */
function destDirFor(type: ImageType): string {
    switch (type) {
        case "monster": return "public/game-data/monsters";
        case "achievement": return "public/game-data/achievements";
        case "dungeon": return "public/game-data/dungeons";
        case "item": return "public/game-data/items";
        case "legendary": return "public/game-data/legendary";
        case "defi": return "public/game-data/defis";
        case "titan": return "public/game-data/titans";
    }
}

export async function downloadExternalImage(
    url: string,
    fileName: string,
    type: ImageType
): Promise<{ success: boolean; path?: string; error?: string; sizeReduction?: string }> {
    try {
        // 🔐 SSRF (F-03 + audit 13/11) : `safeFetch` vérifie l'IP **pendant la connexion**
        // (plus de fenêtre TOCTOU entre le contrôle DNS et le fetch) et revalide chaque
        // redirection. Un God compromis ne peut donc pas scanner le réseau interne.
        // 2. Fetch image
        const response = await safeFetch(url, {
            headers: {
                "User-Agent": "SigilOS/1.0",
                "Accept": "image/*"
            },
            // Bound the download: abort after 20s so a hanging external host
            // cannot pin the process.
            signal: AbortSignal.timeout(20_000),
            maxRedirects: 3,
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // 3. Validate content-type
        const contentType = response.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
            return { success: false, error: `Not an image (got ${contentType})` };
        }

        // 4. Get buffer and check size (bounded before processing)
        const buffer = Buffer.from(await response.arrayBuffer());
        const originalSize = buffer.length;

        if (originalSize > MAX_FILE_SIZE) {
            return { success: false, error: `File too large (${(originalSize / 1024 / 1024).toFixed(2)} MB)` };
        }

        return await processAndSaveImage(buffer, fileName, type, originalSize);
    } catch (error: any) {
        logger.error("[ImageDownloader] Error:", { error: error?.message || String(error) });
        return { success: false, error: error.message || "Unknown error" };
    }
}

export async function processAndSaveImage(
    buffer: Buffer,
    fileName: string,
    type: ImageType,
    originalSize: number
): Promise<{ success: boolean; path?: string; error?: string; sizeReduction?: string }> {
    try {
        // 5. Optimize image with sharp
        const maxSize = IMAGE_SIZES[type];
        const optimizedBuffer = await sharp(buffer)
            .resize(maxSize, maxSize, {
                fit: "inside",           // Preserve aspect ratio
                withoutEnlargement: true // Don't upscale small images
            })
            .webp({ quality: 80 })     // Convert to WebP @ 80% quality
            .toBuffer();

        const optimizedSize = optimizedBuffer.length;
        const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(0);

        // 🔒 CodeQL js/path-injection (fix PR #505) : le chemin d'écriture est construit
        // UNIQUEMENT depuis ① un répertoire CONSTANT indexé par type (destDirFor) et ② un
        // nom de fichier assaini via basename() + allowlist stricte [a-zA-Z0-9._-] (aucun
        // séparateur de chemin ni ".." possible). L'input utilisateur ne peut donc JAMAIS
        // influencer les sinks mkdir/writeFile.
        const name = basename(fileName).replace(/\.(png|jpg|jpeg|gif)$/i, ".webp");
        if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
            return { success: false, error: "Nom de fichier invalide" };
        }

        // Répertoire : constante du code, normalisée et re-vérifiée confinée sous
        // process.cwd() (défense en profondeur — triviale ici, le répertoire est fixe).
        const cwd = process.cwd();
        const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep;
        const dir = resolve(cwd, destDirFor(type));
        if (dir !== cwd && !dir.startsWith(cwdWithSep)) {
            return { success: false, error: "Chemin de destination invalide (hors racine)" };
        }

        const safePath = join(dir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(safePath, optimizedBuffer);

        // 8. Return relative path for DB (URL-style : on retire le préfixe "/public")
        const urlPath = safePath.replace(/\\/g, "/");
        const publicIdx = urlPath.indexOf("/public/");
        const relativePath = publicIdx >= 0 ? urlPath.slice(publicIdx + "/public".length) : urlPath;

        return {
            success: true,
            path: relativePath,
            sizeReduction: `${reduction}% (${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`
        };
    } catch (error: any) {
        logger.error("[ImageDownloader] Error:", { error: error?.message || String(error) });
        return { success: false, error: error.message || "Unknown error" };
    }
}

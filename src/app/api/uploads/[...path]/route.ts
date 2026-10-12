import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, normalize, extname } from "path";
import { logger } from "@/lib/logger";

// =============================================================================
// 📂 STATIC UPLOADS SERVING ROUTE
// =============================================================================
// Next.js standalone mode does NOT serve files from `public/` at runtime.
// This API route serves uploaded files (proofs, guild images, docs) from disk.
// Caddy may serve them first via file_server, but this route acts as fallback.
//
// 🚨 ICI, `console.error` EST UNE ALERTE (mesuré le 07/10/2026) :
// `sentry.server.config.ts` active `captureConsoleIntegration({ levels: ["error"] })`,
// donc chaque `console.error` serveur devient une **Issue Sentry** (+ alerte Discord).
// Or un asset absent est le cas **NORMAL** : l'icône d'un sort pas encore siphonnée
// (ex. `/uploads/assets-dofus/spells/sort_15534.webp`) fait basculer le navigateur sur le
// proxy `/api/assets-dofus/*`. Trois `console.error` par appel — dont un **à chaque
// requête réussie** — produisaient des alertes `[uploads] Request…`,
// `[uploads] Resolved path…` et `Error: ENOENT…` pour de simples 404.
// D'où : `logger` (jamais `console`), et **jamais** le chemin absolu (`/app/public/…`)
// dans un log — c'est une fuite d'infrastructure (constat d'audit du 20/09/2026).
// =============================================================================

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");

// Allowed MIME types for uploaded files
const MIME_TYPES: Record<string, string> = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: segments } = await params;

    // Reconstruct the relative path from URL segments
    const relativePath = segments.join("/");

    // 🛡️ Security: Prevent directory traversal attacks
    const resolvedPath = normalize(join(UPLOAD_ROOT, relativePath));
    if (!resolvedPath.startsWith(UPLOAD_ROOT)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check file extension is an allowed image type
    const ext = extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext];
    if (!contentType) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        // Verify file exists and is a regular file
        const fileStat = await stat(resolvedPath);
        if (!fileStat.isFile()) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const fileBuffer = await readFile(resolvedPath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": fileStat.size.toString(),
                // Cache for 1 hour, allow stale for 1 day while revalidating
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
                // Security: prevent MIME sniffing
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err) {
        const code = (err as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR") {
            // Cas NORMAL : l'asset n'est pas encore siphonné. `debug` = dev seulement —
            // journaliser chaque miss inonderait les logs de prod sans rien apporter.
            logger.debug(`[uploads] asset absent (non siphonné): ${relativePath}`);
        } else {
            // Anomalie réelle (EACCES, EIO…) : `warn`, jamais `error` — un simple fichier
            // manquant ne doit pas devenir une Issue Sentry.
            logger.warn(`[uploads] lecture impossible: ${relativePath}`, { code });
        }
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

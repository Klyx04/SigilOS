import { NextRequest, NextResponse } from "next/server";
import { canGodAccess } from "@/server/actions/super-admin-actions";
import { logger } from "@/lib/logger";
import { readdir, unlink, mkdir } from "fs/promises";
import { join, normalize, basename } from "path";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VALID_TYPES = ["achievement", "monster", "dungeon", "item", "legendary", "defi"];

// Chemin relatif sous /public pour chaque type (source unique, utilisé par GET + DELETE).
function subPathFor(type: string): string {
    switch (type) {
        case "achievement": return "game-data/achievements";
        case "monster": return "game-data/monsters";
        case "dungeon": return "game-data/dungeons";
        case "item": return "game-data/items";
        case "legendary": return "game-data/legendary";
        case "defi": return "game-data/defis";
        default: return "";
    }
}

export async function GET(req: NextRequest) {
    try {
        // 1. R3 : lecture des images game-data = scope "game-data" (cohérent R1).
        const hasGameDataScope = await canGodAccess("game-data");
        if (!hasGameDataScope) {
            return NextResponse.json(
                { success: false, error: "Unauthorized: game-data scope required" },
                { status: 403 }
            );
        }

        // 2. Get type from query
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "achievement";

        // Validate type
        if (!VALID_TYPES.includes(type)) {
            return NextResponse.json(
                { success: false, error: "Invalid type" },
                { status: 400 }
            );
        }

        // 3. Build path - String concatenation to bypass Turbopack's static analysis
        const root = process.cwd();
        const subPath = subPathFor(type);
        const dirPath = normalize(root + "/public/" + subPath);

        // 4. Read directory — fail-soft : crée le dossier s'il est absent (ex. `game-data/defis`
        //    avant le premier téléchargement) pour ne jamais lever ENOENT sur un scan de galerie.
        try {
            await mkdir(dirPath, { recursive: true });
        } catch {
            // ignore : la lecture ci-dessous lèvera une erreur explicite si le dossier est inaccessible.
        }
        const files = await readdir(dirPath, { withFileTypes: true });

        // 5. Filter images and map to response format
        const images = files
            .filter(file => {
                if (!file.isFile()) return false;
                const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
                return ext && IMAGE_EXTENSIONS.includes(ext);
            })
            .map(file => ({
                filename: file.name,
                path: type === "legendary" ? `/game-data/legendary/${file.name}` : `/game-data/${type}s/${file.name}`,
                name: file.name.replace(/\.[^.]+$/, "") // Remove extension for display
            }));

        return NextResponse.json({
            success: true,
            images,
            count: images.length
        });

    } catch (error: any) {
        logger.error("[ListLocalImages API] Error", { error: String(error) });
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * Supprime une image locale de la galerie game-data.
 * Auditabilité + fail-closed :
 *  - scope "game-data" requis (même garde que GET) ;
 *  - type validé parmi la liste blanche ;
 *  - filename revalidé (basename, pas de séparateur, pas de "..", extension image) ;
 *  - le chemin résolu est vérifié pour rester dans le dossier attendu (anti path-traversal).
 */
export async function DELETE(req: NextRequest) {
    try {
        const hasGameDataScope = await canGodAccess("game-data");
        if (!hasGameDataScope) {
            return NextResponse.json(
                { success: false, error: "Unauthorized: game-data scope required" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "";
        const filename = searchParams.get("filename") || "";

        if (!VALID_TYPES.includes(type)) {
            return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
        }

        // Anti path-traversal : on n'accepte qu'un nom de fichier nu (pas de séparateur, pas de "..").
        const safeName = basename(filename);
        const isUnsafe =
            !safeName ||
            safeName !== filename ||
            filename.includes("/") ||
            filename.includes("\\") ||
            filename.includes("..");
        const ext = safeName.split(".").pop()?.toLowerCase();
        const extensionOk = ext && IMAGE_EXTENSIONS.includes("." + ext);
        if (isUnsafe || !extensionOk) {
            return NextResponse.json({ success: false, error: "Invalid filename" }, { status: 400 });
        }

        const root = process.cwd();
        const dirPath = normalize(root + "/public/" + subPathFor(type));
        const filePath = normalize(join(dirPath, safeName));

        // Double vérification : le fichier résolu doit rester dans le dossier attendu.
        if (!filePath.startsWith(dirPath)) {
            return NextResponse.json({ success: false, error: "Invalid path" }, { status: 400 });
        }

        try {
            await unlink(filePath);
        } catch (e: any) {
            // ENOENT => déjà absent, suppression idempotente.
            if (e?.code !== "ENOENT") throw e;
        }

        logger.info("[DeleteLocalImage API] Deleted", { type, filename: safeName });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        logger.error("[DeleteLocalImage API] Error", { error: String(error) });
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

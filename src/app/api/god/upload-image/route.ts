import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { processAndSaveImage, type ImageType } from "@/lib/image-downloader";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        // 1. Check super admin
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            return NextResponse.json(
                { success: false, error: "Unauthorized: Super admin only" },
                { status: 403 }
            );
        }

        // 2. Parse form data
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string;
        const identifier = formData.get("identifier") as string;

        if (!file || !type || !identifier) {
            return NextResponse.json(
                { success: false, error: "Missing required fields (file, type, identifier)" },
                { status: 400 }
            );
        }

        if (!["monster", "achievement", "dungeon", "item", "legendary", "landing", "defi"].includes(type)) {
            return NextResponse.json(
                { success: false, error: "Invalid type" },
                { status: 400 }
            );
        }

        if (!/^[a-z0-9-]+$/.test(identifier)) {
            return NextResponse.json(
                { success: false, error: "Identifier must be lowercase alphanumeric with hyphens" },
                { status: 400 }
            );
        }

        // #47 — bornage fail-closed de la taille d'upload (anti-DoS) : 10 Mo max,
        // refusé AVANT de lire le buffer en mémoire.
        const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { success: false, error: `Fichier trop volumineux (max 10 Mo, reçu ${Math.round(file.size / 1024 / 1024 * 10) / 10} Mo)` },
                { status: 413 }
            );
        }

        // 3. Destination : le répertoire (`public/game-data/{type}`) est une CONSTANTE gérée
        // dans image-downloader.ts (destDirFor(type)) — on ne passe ici que le nom de fichier,
        // déjà validé par le regex /^[a-z0-9-]+$/ ci-dessus (fail-closed avant écriture).
        const destination = `${identifier}.webp`;

        // 4. Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const originalSize = buffer.length;

        // 5. Optimize and save
        const result = await processAndSaveImage(buffer, destination, type as ImageType, originalSize);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        // 6. Return success with local path
        return NextResponse.json({
            success: true,
            localPath: result.path,
            sizeReduction: result.sizeReduction
        });

    } catch (error: any) {
        logger.error("[UploadImage API] Error", { error: String(error) });
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

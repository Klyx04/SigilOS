import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { downloadExternalImage } from "@/lib/image-downloader";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
    url: z.string().url(),
    type: z.enum(["monster", "achievement", "dungeon", "item", "legendary", "defi", "titan"]),
    identifier: z.string()
        .min(1, "Identifier required")
        .max(100, "Identifier too long")
        .regex(/^[a-z0-9-]+$/, "Identifier must be lowercase alphanumeric with hyphens")
});

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

        // 2. Parse and validate body
        const body = await req.json();
        const validation = schema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: validation.error.errors[0].message
                },
                { status: 400 }
            );
        }

        const { url, type, identifier } = validation.data;

        // 3. Destination : le répertoire (`public/game-data/{type}`) est une CONSTANTE gérée
        // dans image-downloader.ts (destDirFor(type)) — on ne passe ici que le nom de fichier,
        // déjà validé par le regex /^[a-z0-9-]+$/ ci-dessus (fail-closed avant écriture).
        const destination = `${identifier}.webp`;

        // 4. Download and optimize image
        const result = await downloadExternalImage(url, destination, type);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        // 5. Return success with local path
        return NextResponse.json({
            success: true,
            localPath: result.path,
            sizeReduction: result.sizeReduction
        });

    } catch (error: any) {
        logger.error("[DownloadImage API] Error", { error: String(error) });
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

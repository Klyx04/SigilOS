import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { downloadExternalImage } from "@/lib/image-downloader";
import { z } from "zod";
import { join, normalize } from "path";

const schema = z.object({
    url: z.string().url(),
    type: z.enum(["monster", "achievement", "dungeon", "item", "legendary"]),
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

        // 3. Construct destination path - Concat to bypass Turbopack analysis
        const root = process.cwd();
        let folder = "";
        switch (type) {
            case "achievement": folder = "achievements"; break;
            case "monster": folder = "monsters"; break;
            case "dungeon": folder = "dungeons"; break;
            case "item": folder = "items"; break;
            case "legendary": folder = "legendary"; break;
        }
        const destination = normalize(root + "/public/game-data/" + folder + "/" + identifier + ".webp");

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
        console.error("[DownloadImage API] Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

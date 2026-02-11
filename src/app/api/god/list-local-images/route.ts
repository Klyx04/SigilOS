import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { readdir } from "fs/promises";
import { join } from "path";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export async function GET(req: NextRequest) {
    try {
        // 1. Check super admin
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            return NextResponse.json(
                { success: false, error: "Unauthorized: Super admin only" },
                { status: 403 }
            );
        }

        // 2. Get type from query
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "achievement";

        // Validate type
        const validTypes = ["achievement", "monster", "dungeon"];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { success: false, error: "Invalid type" },
                { status: 400 }
            );
        }

        // 3. Build path
        const dirPath = join(process.cwd(), "public", "game-data", `${type}s`);

        // 4. Read directory
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
                path: `/game-data/${type}s/${file.name}`,
                name: file.name.replace(/\.[^.]+$/, "") // Remove extension for display
            }));

        return NextResponse.json({
            success: true,
            images,
            count: images.length
        });

    } catch (error: any) {
        console.error("[ListLocalImages API] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

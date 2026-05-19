import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { readdir } from "fs/promises";
import { join, normalize } from "path";

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
        const validTypes = ["achievement", "monster", "dungeon", "item", "legendary"];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { success: false, error: "Invalid type" },
                { status: 400 }
            );
        }

        // 3. Build path - String concatenation to bypass Turbopack's static analysis
        const root = process.cwd();
        let subPath = "";
        switch (type) {
            case "achievement": subPath = "game-data/achievements"; break;
            case "monster": subPath = "game-data/monsters"; break;
            case "dungeon": subPath = "game-data/dungeons"; break;
            case "item": subPath = "game-data/items"; break;
            case "legendary": subPath = "game-data/legendary"; break;
        }
        const dirPath = normalize(root + "/public/" + subPath);

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
                path: type === "legendary" ? `/game-data/legendary/${file.name}` : `/game-data/${type}s/${file.name}`,
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

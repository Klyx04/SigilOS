import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { processAndSaveImage } from "@/lib/image-downloader";
import { normalize } from "path";

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

        if (!["monster", "achievement", "dungeon", "item", "legendary"].includes(type)) {
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

        // 3. Construct destination path
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

        // 4. Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const originalSize = buffer.length;

        // 5. Optimize and save
        const result = await processAndSaveImage(buffer, destination, type as any, originalSize);

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
        console.error("[UploadImage API] Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { join, normalize } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { getUserContext } from "@/server/actions/user-actions";

/**
 * RBAC-Protected Asset Server
 * Serves files from private_storage with permission checks.
 * Usage: /api/storage/proofs/{guildId}/{filename}.webp
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const filePath = path.join("/");
    
    // 🛡️ SECURITY: Prevent Path Traversal
    const safePath = normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = join(process.cwd(), "private_uploads", safePath);
    const storageRoot = join(process.cwd(), "private_uploads");

    if (!absolutePath.startsWith(storageRoot)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    if (!existsSync(absolutePath)) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const [segment, guildId, ...rest] = path;

    // 🌟 Identify Public vs Private Assets
    // Pattern: guilds/{guildId}/{filename} -> Presentation Banner/Photo
    const isPublicPresentationAsset = segment === "guilds" && !!guildId && rest.length === 1;

    // 🛡️ Authentication Check (Bypass for public images)
    let session = null;
    if (!isPublicPresentationAsset) {
        session = await auth();
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 🛡️ RBAC: Check permissions for private areas
        if (segment === "guilds" || segment === "proofs") {
            if (!guildId) return new NextResponse("Forbidden", { status: 403 });
            
            // Check membership for any private image in guilds/ or proofs/
            const context = await getUserContext(guildId);
            if (!context.isMember) {
                return new NextResponse("Forbidden: You are not a member of this guild", { status: 403 });
            }
        }
    }
    
    // Pattern: docs/...
    if (segment === "docs") {
        // Docs are generally accessible to all logged in users of the platform
        // because they are wiki assets.
    }

    try {
        const fileBuffer = await readFile(absolutePath);
        const ext = absolutePath.split(".").pop()?.toLowerCase();
        
        let contentType = "application/octet-stream";
        if (ext === "webp") contentType = "image/webp";
        if (ext === "png") contentType = "image/png";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";

        return new Response(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": isPublicPresentationAsset 
                    ? "public, max-age=86400" // Publicly cache for 24h
                    : "private, max-age=3600", // Private cache for 1h
            },
        });
    } catch (error) {
        console.error("[Storage API] Error serving file:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

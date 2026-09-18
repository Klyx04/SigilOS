import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { join, normalize, sep } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { getUserContext } from "@/server/actions/user-actions";
import { verifyStorageToken } from "@/lib/storage-utils";

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

    // SECURITY FIX: `startsWith(storageRoot)` is vulnerable to prefix bypass
    // (e.g. `private_uploads_evil` starts with `private_uploads`).
    // Use an exact root match, or a root + path separator match.
    const storageRootWithSep = storageRoot.endsWith(sep) ? storageRoot : storageRoot + sep;
    if (absolutePath !== storageRoot && !absolutePath.startsWith(storageRootWithSep)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    if (!existsSync(absolutePath)) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const [segment, guildId, ...rest] = path;

    // 🌟 Identify Public vs Private Assets
    // Pattern: guilds/{guildId}/{filename} -> Presentation Banner/Photo
    // Pattern: assets/ -> General public assets
    const isPublicPresentationAsset = (segment === "guilds" && !!guildId && rest.length === 1) || segment === "assets" || segment === "guides";

    // 🛡️ Authentication Check (Bypass for public images)
    let session = null;
    if (!isPublicPresentationAsset) {
        session = await auth();
        
        // 🛡️ TOKEN: Check for signed public token (used by Discord)
        const token = req.nextUrl.searchParams.get("token");
        const isTokenValid = token ? verifyStorageToken(safePath, token) : false;

        if (!session?.user && !isTokenValid) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 🛡️ RBAC: Check permissions for private areas (Only if not using a valid token)
        if (!isTokenValid && (segment === "guilds" || segment === "proofs")) {
            if (!guildId) return new NextResponse("Forbidden", { status: 403 });
            
            const baseContext = await getUserContext();
            if (!baseContext.isAdmin) {
                let resolvedDiscordGuildId = guildId;
                // If the guildId is a Prisma CUID/UUID (not numeric), we must map it to the discordGuildId
                if (!/^\d+$/.test(guildId)) {
                    const { db } = await import("@/lib/prisma");
                    const g = await db.guildConfig.findUnique({ 
                        where: { id: guildId }, 
                        select: { discordGuildId: true } 
                    });
                    if (g) resolvedDiscordGuildId = g.discordGuildId;
                }

                // Check membership for any private image in guilds/ or proofs/
                const targetContext = await getUserContext(resolvedDiscordGuildId);
                if (!targetContext.isMember) {
                    return new NextResponse("Forbidden: You are not a member of this guild", { status: 403 });
                }
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

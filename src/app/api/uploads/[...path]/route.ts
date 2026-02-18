import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, normalize, extname } from "path";

// =============================================================================
// 📂 STATIC UPLOADS SERVING ROUTE
// =============================================================================
// Next.js standalone mode does NOT serve files from `public/` at runtime.
// This API route serves uploaded files (proofs, guild images, docs) from disk.
// Caddy may serve them first via file_server, but this route acts as fallback.
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
    console.error(`[uploads] Request: /api/uploads/${relativePath}`);

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
        console.error(`[uploads] Resolved path: ${resolvedPath}`);
        const fileStat = await stat(resolvedPath);
        if (!fileStat.isFile()) {
            console.error(`[uploads] Not a file: ${resolvedPath}`);
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
        console.error(`[uploads] File not found: ${resolvedPath}`, err);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}

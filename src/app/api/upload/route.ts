import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { detectMimeType, validateMagicBytes, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from "@/lib/image-security";

/**
 * Dossiers de destination autorisés sous `private_uploads/`.
 * ⚠️ `guides` et `assets` sont exposés PUBLIQUEMENT par
 * `/api/storage/*` (cf. isPublicPresentationAsset) : n'y écrire que des visuels
 * publics (images de guides indexés, assets de site). Le scope `landing` a existé
 * pour la feature #140 : il a été retiré le 17/09/2026 avec le pilotage God.
 */
const ALLOWED_UPLOAD_SCOPES = new Set(["docs", "guides", "assets"]);

export async function POST(req: NextRequest) {
    const session = await auth();

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🛡️ SECURITY HARDENING: Only super-admins can upload docs
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
        return NextResponse.json({ error: "Forbidden: Super-admin access required" }, { status: 403 });
    }

    // 🛡️ RATE LIMITING: Protect CPU (sharp) and Disk from spam/DoS
    const { rateLimit } = await import("@/lib/ratelimit");
    const { success } = await rateLimit(`upload_doc_${session.user.id}`, 10, 60_000); // 10 uploads / min
    if (!success) {
        return NextResponse.json({ error: "Trop de requêtes, veuillez patienter." }, { status: 429 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // 1. Scope de destination — allowlist stricte.
        //    `docs`       : documents privés (défaut, comportement historique)
        //    `guides`     : images de guides → servies PUBLIQUEMENT (le guide Rush
        //                   Sylvestre est indexé, un visiteur anonyme doit voir
        //                   l'image : `/api/storage/docs/*` exige une session).
        //    `assets` : assets publics du site.
        const rawScope = String(formData.get("scope") ?? "docs").trim().toLowerCase();
        const scope = ALLOWED_UPLOAD_SCOPES.has(rawScope) ? rawScope : "docs";

        // 2. Validate File Size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large" }, { status: 400 });
        }

        // 3. Validate MIME Type (Header)
        if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
            return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // 4. Validate Magic Bytes (Content)
        if (!validateMagicBytes(buffer, file.type)) {
            return NextResponse.json({ error: "Invalid file content (Magic Bytes mismatch)" }, { status: 400 });
        }

        // 5. Optimize Image
        // - Resize to max 1920px width (preserve aspect ratio)
        // - Convert to WebP (better compression)
        // - Quality 80%
        // Sharp also acts as a validator here - it will fail if the image is malformed
        const optimizedBuffer = await sharp(buffer)
            .resize(1920, null, {
                withoutEnlargement: true, // Don't upscale small images
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        // 6. Save File
        // Use a UUID to avoid collisions
        const fileName = `${uuidv4()}.webp`;
        const uploadDir = join(process.cwd(), "private_uploads", scope);

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = join(uploadDir, fileName);
        await writeFile(filePath, optimizedBuffer);

        // 7. Return URL
        const publicUrl = `/uploads/${scope}/${fileName}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            originalName: file.name
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

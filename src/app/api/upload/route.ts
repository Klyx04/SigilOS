/**
 * Secure Image Upload API
 * POST /api/upload
 * 
 * Flow:
 * 1. Auth check
 * 2. Fetch mission data (category, payload)
 * 3. Validate file (magic number)
 * 4. Process image (convert to WebP, strip metadata)
 * 5. Upload to R2 (or local storage fallback)
 * 6. Return URLs (OCR disabled for now due to Next.js compatibility)
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { processImage, MAX_FILE_SIZE } from "@/lib/image-processor";
import { isR2Configured, getUploadUrl, generateProofKey, getPublicUrl } from "@/lib/r2";
import { db } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// Local storage fallback path (when R2 is not configured)
const LOCAL_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "proofs");

export async function POST(request: NextRequest) {
    try {
        // 1. Auth check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const guildId = formData.get("guildId") as string | null;
        const missionId = formData.get("missionId") as string | null;

        if (!file || !guildId || !missionId) {
            return NextResponse.json(
                { error: "Missing required fields: file, guildId, missionId" },
                { status: 400 }
            );
        }

        // 3. Fetch mission data for smart OCR validation
        const mission = await db.mission.findUnique({
            where: { id: missionId },
            select: {
                category: true,
                payload: true,
                title: true,
            }
        });

        if (!mission) {
            return NextResponse.json(
                { error: "Mission not found" },
                { status: 404 }
            );
        }

        console.log(`[Upload] Processing proof for ${mission.category} mission: ${mission.title || 'Untitled'}`);

        // 4. Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // 5. Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 6. Process image (validate + convert to WebP)
        const processResult = await processImage(buffer);
        if (!processResult.success) {
            return NextResponse.json(
                { error: processResult.error },
                { status: 400 }
            );
        }

        const processedBuffer = processResult.data;

        // 7. Generate unique key for this proof
        const proofKey = generateProofKey(guildId, missionId, session.user.id);
        let publicUrl: string;

        // 8. Upload to storage
        if (isR2Configured()) {
            // Production: Upload to Cloudflare R2
            const uploadUrl = await getUploadUrl(proofKey, "image/webp");

            // Upload the processed image (convert Buffer to Uint8Array for fetch)
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: new Uint8Array(processedBuffer),
                headers: {
                    "Content-Type": "image/webp",
                },
            });

            if (!uploadResponse.ok) {
                console.error("[Upload] R2 upload failed:", await uploadResponse.text());
                return NextResponse.json(
                    { error: "Failed to upload to storage" },
                    { status: 500 }
                );
            }

            publicUrl = getPublicUrl(proofKey);
        } else {
            // Development: Save locally
            console.log("[Upload] R2 not configured, using local storage");

            // Create directory structure
            const guildDir = join(LOCAL_UPLOAD_DIR, guildId, missionId);
            await mkdir(guildDir, { recursive: true });

            // Save file
            const fileName = `${session.user.id}-${Date.now()}.webp`;
            const filePath = join(guildDir, fileName);
            await writeFile(filePath, processedBuffer);

            // Generate public URL (relative to public folder)
            publicUrl = `/uploads/proofs/${guildId}/${missionId}/${fileName}`;
        }

        // 9. OCR DISABLED - Tesseract.js has compatibility issues with Next.js App Router
        // TODO: Re-enable when using external OCR API (Google Vision, etc.)
        console.log("[Upload] Image stored successfully. OCR disabled - manual validation required");

        const ocrResult = {
            isValid: false,
            score: 0,
            categoryMatch: false,
            contentMatch: false,
            victoryDetected: false,
            matchedElements: [] as string[],
            missingElements: ["Validation manuelle requise"],
            confidence: 0,
        };

        // 10. Return success response
        return NextResponse.json({
            success: true,
            proofUrl: publicUrl,
            ocr: ocrResult,
        });

    } catch (error) {
        console.error("[Upload] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Note: Request body size is configured in next.config.js

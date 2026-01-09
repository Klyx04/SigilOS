import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { processImage, MAX_FILE_SIZE } from "@/lib/image-processor";
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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const guildId = formData.get("guildId") as string | null;
        const missionId = formData.get("missionId") as string | null;

        if (!file || !guildId || !missionId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 3. Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large" }, { status: 400 });
        }

        // 4. Process image
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert/Validate (WebP)
        const processResult = await processImage(buffer);
        if (!processResult.success) {
            return NextResponse.json({ error: processResult.error }, { status: 400 });
        }
        const processedBuffer = processResult.data;

        // 5. OCR Analysis (Placeholder / TODO)
        // In a real scenario, we would run Tesseract/Vision here on `processedBuffer`.
        // For now, we simulate a check. 
        // If we firmly believe it's valid, we set `isAutoValidated = true`.
        // Currently, we default to FALSE to force manual check as requested by user fallback.
        const isAutoValidated = false; // TODO: Connect real OCR

        const ocrResult = {
            isValid: isAutoValidated,
            score: isAutoValidated ? 100 : 0,
            confidence: isAutoValidated ? 100 : 0,
            missingElements: isAutoValidated ? [] : ["Validation manuelle requise"]
        };

        let publicUrl: string | null = null;

        // 6. Storage Decision (Ephemeral)
        if (isAutoValidated) {
            // CASE A: Auto-Success -> Do NOT save file.
            console.log("[Upload] Auto-validated. Skipping storage.");
            publicUrl = null; // No proof needed, it's trusted.
        } else {
            // CASE B: Pending -> Save to Temp Local Storage
            console.log("[Upload] Pending validation. Saving to ephemeral temp storage.");

            // Dir: public/uploads/temp/[guildId]/[missionId]
            const tempDir = join(LOCAL_UPLOAD_DIR, "temp", guildId, missionId);
            await mkdir(tempDir, { recursive: true });

            // File: [userId]-[timestamp].webp
            const fileName = `${session.user.id}-${Date.now()}.webp`;
            const filePath = join(tempDir, fileName);

            await writeFile(filePath, processedBuffer);

            // Public URL
            publicUrl = `/uploads/proofs/temp/${guildId}/${missionId}/${fileName}`;
        }

        // 7. Return result
        return NextResponse.json({
            success: true,
            proofUrl: publicUrl,
            ocr: ocrResult,
        });

    } catch (error) {
        console.error("[Upload] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Note: Request body size is configured in next.config.js

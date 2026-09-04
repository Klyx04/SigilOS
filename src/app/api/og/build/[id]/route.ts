import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import sharp, { type OverlayOptions } from "sharp";
import path from "node:path";
import fs from "node:fs";

// Layout grid matching the Dofusbook / SigilOS web preview
const SLOT_COORDINATES: Record<string, { x: number; y: number }> = {
    ch: { x: 40,  y: 40 },   // Coiffe
    ca: { x: 40,  y: 130 },  // Cape
    ce: { x: 40,  y: 220 },  // Ceinture
    bo: { x: 40,  y: 310 },  // Bottes

    am: { x: 480, y: 40 },   // Amulette
    a1: { x: 480, y: 130 },  // Anneau 1
    a2: { x: 480, y: 220 },  // Anneau 2
    br: { x: 480, y: 310 },  // Bouclier

    ar: { x: 215, y: 310 },  // Corps à corps
    fa: { x: 305, y: 310 },  // Familier / Monture

    d1: { x: 40,  y: 400 },  // Dofus 1
    d2: { x: 128, y: 400 },  // Dofus 2
    d3: { x: 216, y: 400 },  // Dofus 3
    d4: { x: 304, y: 400 },  // Dofus 4
    d5: { x: 392, y: 400 },  // Dofus 5
    d6: { x: 480, y: 400 },  // Dofus 6
};

const ITEM_SIZE = 64;
const CANVAS_WIDTH = 584;
const CANVAS_HEIGHT = 490;

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: itemId } = await context.params;
        if (!itemId) {
            return new NextResponse("Build ID required", { status: 400 });
        }

        // 1. Fetch Build previewData from UserProfile in DB
        const profiles = await db.userProfile.findMany({
            where: { status: "ACTIVE" },
            select: { dofusBookLinks: true }
        });

        let build: any = null;
        for (const p of profiles) {
            const b = (p.dofusBookLinks as any[])?.find(x => x.id === itemId);
            if (b) {
                build = b;
                break;
            }
        }

        if (!build) {
            return new NextResponse("Build not found", { status: 404 });
        }

        const pd = build.previewData;
        const items = pd?.items || {};
        const classNum = Number(pd?.classId || build.classId || 0);

        // 2. Fetch or load item pictures
        const compositeOperations: OverlayOptions[] = [];

        // Center class icon
        if (classNum > 0) {
            const classFile = classNum === 19 ? 20 : classNum;
            const classIconPath = path.join(process.cwd(), "public", "assets", "dofus", "classes", `${classFile}.png`);
            if (fs.existsSync(classIconPath)) {
                try {
                    const classBuffer = await sharp(classIconPath)
                        .resize(110, 110, { fit: "contain" })
                        .toBuffer();
                    
                    compositeOperations.push({
                        input: classBuffer,
                        top: 135,
                        left: 237,
                    });
                } catch {
                    // Ignore class icon error
                }
            }
        }

        // Slots background frames & items
        const slotKeys = Object.keys(SLOT_COORDINATES);
        const fetchPromises = slotKeys.map(async (slot) => {
            const coord = SLOT_COORDINATES[slot];
            const item = slot === "fa" ? (items["fa"] || items["mo"]) : items[slot];

            if (item && item.picture) {
                try {
                    const imgUrl = `https://www.dofusbook.net/static/dist/items/${item.picture}-70.webp`;
                    const res = await fetch(imgUrl, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
                            "Referer": "https://www.dofusbook.net/",
                        },
                        // Cache for 1 day
                        next: { revalidate: 86400 }
                    });

                    if (res.ok) {
                        const arrBuffer = await res.arrayBuffer();
                        const resized = await sharp(Buffer.from(arrBuffer))
                            .resize(ITEM_SIZE - 8, ITEM_SIZE - 8, { fit: "contain" })
                            .toBuffer();

                        return {
                            input: resized,
                            top: coord.y + 4,
                            left: coord.x + 4,
                        };
                    }
                } catch {
                    // Fallback to empty slot
                }
            }
            return null;
        });

        const loadedItems = await Promise.all(fetchPromises);
        for (const itemOp of loadedItems) {
            if (itemOp) compositeOperations.push(itemOp);
        }

        // 3. SVG Base Background with luxury slot sockets and pedistal
        const svgBackground = `
        <svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#181824" />
                    <stop offset="100%" stop-color="#0a0a10" />
                </radialGradient>
                <radialGradient id="pedestalGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
                </radialGradient>
                <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.5" />
                </filter>
            </defs>

            <!-- Main card background -->
            <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="28" fill="url(#bgGrad)" stroke="#262837" stroke-width="2" />

            <!-- Pedestal central circle -->
            <circle cx="292" cy="190" r="85" fill="url(#pedestalGlow)" />
            <circle cx="292" cy="190" r="68" fill="#141520" stroke="#2a2c3d" stroke-width="2" />

            <!-- Equipment slot frames -->
            ${slotKeys.map(slot => {
                const c = SLOT_COORDINATES[slot];
                return `
                    <g filter="url(#shadow)">
                        <rect x="${c.x}" y="${c.y}" width="${ITEM_SIZE}" height="${ITEM_SIZE}" rx="14" fill="#141520" stroke="#2a2c3d" stroke-width="1.5" />
                        <rect x="${c.x + 2}" y="${c.y + 2}" width="${ITEM_SIZE - 4}" height="${ITEM_SIZE - 4}" rx="12" fill="#171926" />
                    </g>
                `;
            }).join("")}

            <!-- SigilOS watermark -->
            <text x="${CANVAS_WIDTH - 20}" y="${CANVAS_HEIGHT - 12}" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="800" fill="#475569" letter-spacing="1">SIGILOS · DOFUSBOOK</text>
        </svg>
        `;

        // 4. Render and Composite
        const pngBuffer = await sharp(Buffer.from(svgBackground))
            .composite(compositeOperations)
            .png({ quality: 90 })
            .toBuffer();

        return new NextResponse(pngBuffer as any, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
            },
        });
    } catch (err: any) {
        return new NextResponse(`Error rendering build image: ${err?.message || err}`, { status: 500 });
    }
}

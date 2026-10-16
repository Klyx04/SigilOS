import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";

import { db } from "@/lib/prisma";
import { questMapIdFromImageUrl, resolveQuestMinimap } from "@/lib/quest-minimap";
import { getWorldmapData, getWorldsData } from "@/server/game/worldmap-data";
import { MAP_OCEAN_TONE, WORLDMAP_TILE_SIZE } from "@/lib/worldmap-tiles";

export const runtime = "nodejs";

/**
 * `GET /api/dj/minimap?quest=<id DofusDB>` — **capture de zone** d'une quête en PNG : la carte du
 * monde autour de sa map de lancement, avec le repère.
 *
 * Pourquoi une image et pas le composant : **Discord ne lit pas de HTML** — un embed ne peut
 * porter qu'une URL d'image. La route est donc **publique** (comme `/api/og/build/[id]`) et
 * réutilise la même source que le dashboard : `resolveQuestMinimap` (`worldmap.json` +
 * `worlds.json` du dépôt), donc l'embed et le site montrent **la même zone**.
 *
 * Mesure du 16/10/2026 : DofusDB n'expose **aucune** image de quête (`/img/quests/153.png` → 404)
 * — le visuel ne peut venir que de nos tuiles (`/game-data/tiles/w{monde}/{échelle}/{n}.webp`).
 *
 * Coût borné : 5×3 tuiles de 250 px lues une fois par URL (Discord et son CDN mettent en cache).
 * Aucune écriture, aucune donnée de guilde : uniquement la donnée de jeu publique.
 */
export async function GET(request: NextRequest) {
    const dofusDbId = Number(request.nextUrl.searchParams.get("quest"));
    if (!Number.isSafeInteger(dofusDbId) || dofusDbId <= 0) {
        return new NextResponse("Requête invalide", { status: 400 });
    }

    try {
        const quest = await db.gameQuest.findFirst({
            where: { dofusDbId },
            select: { imageUrl: true },
        });
        const minimap = resolveQuestMinimap(getWorldmapData(), getWorldsData(), questMapIdFromImageUrl(quest?.imageUrl));
        if (!minimap) return new NextResponse("Zone inconnue", { status: 404 });

        const tileSize = WORLDMAP_TILE_SIZE;
        const width = minimap.grid.cols * tileSize;
        const height = minimap.grid.rows * tileSize;
        const composites: OverlayOptions[] = [];

        for (const tile of minimap.grid.tiles) {
            try {
                const raw = await readFile(path.join(process.cwd(), "public", tile.tileUrl));
                composites.push({
                    input: await sharp(raw).resize(tileSize, tileSize, { fit: "cover" }).png().toBuffer(),
                    left: tile.col * tileSize,
                    top: tile.row * tileSize,
                });
            } catch {
                // Tuile absente : la teinte océan du fond fait le travail (jamais d'erreur visible).
            }
        }

        /* Repère : anneau sombre + anneau ambre + pastille rouge — lisible sur n'importe quelle
           map, et dessiné par nous (aucun asset externe, aucune dépendance à DofusDB). */
        const markerSize = 72;
        const marker = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">`
            + `<circle cx="36" cy="36" r="26" fill="#111827" fill-opacity="0.7"/>`
            + `<circle cx="36" cy="36" r="20" fill="none" stroke="#f59e0b" stroke-width="7"/>`
            + `<circle cx="36" cy="36" r="9" fill="#dc2626"/>`
            + `</svg>`
        );
        composites.push({
            input: marker,
            left: Math.round((minimap.grid.leftPct / 100) * width) - markerSize / 2,
            top: Math.round((minimap.grid.topPct / 100) * height) - markerSize / 2,
        });

        const png = await sharp({
            create: { width, height, channels: 4, background: MAP_OCEAN_TONE },
        })
            .composite(composites)
            .png({ compressionLevel: 9 })
            .toBuffer();

        return new NextResponse(new Uint8Array(png), {
            headers: {
                "Content-Type": "image/png",
                // La zone d'une quête ne bouge pas : cache long, côté Discord comme côté CDN.
                "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
            },
        });
    } catch (error) {
        console.error("[dj/minimap] échec de composition", error);
        return new NextResponse("Erreur de composition", { status: 500 });
    }
}

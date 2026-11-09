import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { verifyCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ASSET_DIRS, ensureAssetDirsExist } from "@/lib/dofus-asset-siphon";
import {
    MIN_SPRITE_BYTES,
    gfxIdFromDofusDbImageUrl,
    spriteAssetFileName,
} from "@/lib/dofus-monster-assets";

export const dynamic = "force-dynamic";
/** Une passe peut durer : on borne le travail par `limit`, jamais par le temps. */
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CONCURRENCY = 4;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/**
 * 🖼️ **Siphon hors ligne des visuels de monstres** (chantier `souverainete-images`, lot S1).
 *
 * Mesure du 09/11/2026 : le proxy `/api/assets-dofus` télécharge encore chez l'amont **au moment
 * de la requête**. Tant que ce cache n'est pas rempli, chaque vignette dépend d'un service qu'on
 * ne maîtrise pas — et une panne de téléchargement se traduit par un picto générique.
 *
 * Cette route **remplit le frigo** : pour chaque `Archimonstre` de type `archimonstre` ou `boss`
 * qui porte une image, elle écrit le WebP dans l'**espace apparence** (`<gfx>.sprite.webp`), la
 * clé que le proxy sert déjà. Ensuite, plus aucun appel réseau n'est nécessaire pour l'afficher.
 *
 * Idempotente : un fichier de plus de `MIN_SPRITE_BYTES` est sauté (aucune requête réseau).
 * Dry-run par défaut ; écrire exige `?apply=1`.
 *
 * Paramètres : `apply=1` · `limit` (1–200, défaut 100) · `offset` (pagination).
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apply = req.nextUrl.searchParams.get("apply") === "1";
    const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(rawLimit)
        ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)))
        : DEFAULT_LIMIT;
    const rawOffset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;

    const report = {
        apply,
        total: 0,
        alreadyThere: 0,
        siphoned: 0,
        failed: 0,
        remaining: 0,
        failures: [] as string[],
    };

    try {
        const rows = await db.archimonstre.findMany({
            // La clé est le NOM côté affichage, mais ici on ne dépend que de l'image : on prend
            // les deux familles qui portent les cibles de la quête Ocre (archis + gardiens).
            where: { type: { in: ["archimonstre", "boss"] }, imageUrl: { not: null } },
            select: { name: true, imageUrl: true },
            orderBy: { name: "asc" },
        });

        // `gfxId` dédupliqué : deux noms peuvent partager une apparence.
        const byGfx = new Map<string, string>();
        for (const row of rows) {
            const gfx = gfxIdFromDofusDbImageUrl(row.imageUrl);
            if (gfx && !byGfx.has(gfx)) byGfx.set(gfx, row.name);
        }
        const all = [...byGfx.entries()];
        report.total = all.length;

        const slice = all.slice(offset, offset + limit);
        report.remaining = Math.max(0, all.length - (offset + slice.length));


        ensureAssetDirsExist();
        const dir = ASSET_DIRS.monsters;

        /** Idempotence : un fichier suffisamment gros est déjà servi par le proxy. */
        const isCached = (file: string) => {
            try {
                return fs.existsSync(file) && fs.statSync(file).size >= MIN_SPRITE_BYTES;
            } catch {
                return false;
            }
        };

        let cursor = 0;
        const worker = async () => {
            while (cursor < slice.length) {
                const [gfx, name] = slice[cursor++];
                const file = path.join(dir, spriteAssetFileName(gfx));

                if (!apply) {
                    if (isCached(file)) report.alreadyThere++;
                    else report.siphoned++;
                    continue;
                }

                if (isCached(file)) {
                    report.alreadyThere++;
                    continue;
                }

                try {
                    const res = await fetch(`https://api.dofusdb.fr/img/monsters/${gfx}.png`, {
                        headers: { "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)" },
                        redirect: "error",
                        signal: AbortSignal.timeout(15_000),
                    });
                    if (!res.ok) {
                        report.failed++;
                        if (report.failures.length < 20) report.failures.push(`${gfx} (${name}) : HTTP ${res.status}`);
                        continue;
                    }
                    const raw = Buffer.from(await res.arrayBuffer());
                    if (raw.length === 0 || raw.length > MAX_IMAGE_BYTES) {
                        report.failed++;
                        if (report.failures.length < 20) report.failures.push(`${gfx} (${name}) : taille ${raw.length}`);
                        continue;
                    }
                    const webp = await sharp(raw).webp({ quality: 80, effort: 2 }).toBuffer();
                    fs.writeFileSync(file, webp);
                    report.siphoned++;
                } catch (error) {
                    report.failed++;
                    if (report.failures.length < 20) {
                        report.failures.push(`${gfx} (${name}) : ${String(error)}`);
                    }
                }
            }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, worker));

        logger.info("[siphon-monster-assets] passe terminée", {
            apply,
            total: report.total,
            siphoned: report.siphoned,
            alreadyThere: report.alreadyThere,
            failed: report.failed,
            remaining: report.remaining,
        });

        return NextResponse.json(report);
    } catch (error) {
        logger.error("[siphon-monster-assets] échec", { error: String(error) });
        return NextResponse.json({ error: "Siphon impossible" }, { status: 500 });
    }
}

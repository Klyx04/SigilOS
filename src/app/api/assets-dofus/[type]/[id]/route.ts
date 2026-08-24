import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ASSET_DIRS, ensureAssetDirsExist } from '@/lib/dofus-asset-siphon';

export const dynamic = 'force-dynamic';

const REMOTE_BASE_URLS = {
    monsters: 'https://api.dofusdb.fr/img/monsters',
    items: 'https://api.dofusdb.fr/img/items',
    spells: 'https://api.dofusdb.fr/img/spells',
};

/**
 * 🛡️ Proxy & Siphon Automatique à la Volée (Zero 404 in DevTools)
 *
 * 1. Si le fichier WebP existe en local sur le serveur -> Stream direct (HTTP 200, cache 1 an)
 * 2. Si absent -> Télécharge depuis DofusDB, compresse en WebP, enregistre sur disque et renvoie HTTP 200
 * 3. Si introuvable -> Renvoie une image de fallback sans planter
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ type: string; id: string }> }
) {
    try {
        const { type, id: rawId } = await context.params;
        const validTypes = ['monsters', 'items', 'spells'] as const;
        type AssetType = (typeof validTypes)[number];

        if (!validTypes.includes(type as AssetType)) {
            return new NextResponse('Type invalide', { status: 400 });
        }

        const assetType = type as AssetType;
        const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '').replace(/\.webp$/, '');
        if (!safeId) return new NextResponse('ID invalide', { status: 400 });

        ensureAssetDirsExist();
        const localFilePath = path.join(ASSET_DIRS[assetType], `${safeId}.webp`);

        // 1. Si le fichier WebP existe déjà en local sur disque, on le sert directement
        if (fs.existsSync(localFilePath)) {
            try {
                const buffer = fs.readFileSync(localFilePath);
                if (buffer.length > 50) {
                    return new NextResponse(buffer, {
                        headers: {
                            'Content-Type': 'image/webp',
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                    });
                }
            } catch {
                // Re-téléchargement si corrompu
            }
        }

        // 2. Sinon, on siphonne à la volée depuis la source (Auto Self-Healing)
        const urlParam = req.nextUrl.searchParams.get('url');
        let remoteUrl = urlParam || `${REMOTE_BASE_URLS[assetType]}/${safeId}.png`;

        let downloaded = false;
        let inputBuffer: Buffer | null = null;

        // Tentative 1 : Téléchargement direct depuis remoteUrl
        try {
            const remoteRes = await fetch(remoteUrl, {
                headers: {
                    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                },
                signal: AbortSignal.timeout(8_000),
            });

            if (remoteRes.ok) {
                const arrayBuffer = await remoteRes.arrayBuffer();
                inputBuffer = Buffer.from(arrayBuffer);
                downloaded = true;
            }
        } catch {
            // Échec première tentative
        }

        // Tentative 2 : Si c'est un item et que l'URL par défaut a échoué, résolution via l'API DofusDB (iconId)
        if (!downloaded && assetType === 'items') {
            try {
                const itemRes = await fetch(`https://api.dofusdb.fr/items/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(6_000),
                });
                if (itemRes.ok) {
                    const itemData = await itemRes.json();
                    const iconId = itemData.iconId || itemData.id;
                    if (iconId) {
                        const iconRes = await fetch(`https://api.dofusdb.fr/img/items/${iconId}.png`, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: AbortSignal.timeout(6_000),
                        });
                        if (iconRes.ok) {
                            const arrayBuffer = await iconRes.arrayBuffer();
                            inputBuffer = Buffer.from(arrayBuffer);
                            downloaded = true;
                        }
                    }
                }
            } catch {
                // Échec résolution iconId
            }
        }

        // Tentative 3 : Si c'est un monstre et que l'URL par défaut a échoué, résolution via l'API DofusDB (graphicLookId)
        if (!downloaded && assetType === 'monsters') {
            try {
                const monsterRes = await fetch(`https://api.dofusdb.fr/monsters/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(6_000),
                });
                if (monsterRes.ok) {
                    const monsterData = await monsterRes.json();
                    const realImgUrl = monsterData.img;
                    if (realImgUrl && realImgUrl.startsWith('http')) {
                        const imgRes = await fetch(realImgUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: AbortSignal.timeout(6_000),
                        });
                        if (imgRes.ok) {
                            const arrayBuffer = await imgRes.arrayBuffer();
                            inputBuffer = Buffer.from(arrayBuffer);
                            downloaded = true;
                        }
                    }
                }
            } catch {
                // Échec résolution monstre
            }
        }

        if (downloaded && inputBuffer) {
            try {
                // Compression WebP via Sharp
                const webpBuffer = await sharp(inputBuffer)
                    .webp({ quality: 85, effort: 4 })
                    .toBuffer();

                // Sauvegarde asynchrone sur disque pour les prochaines requêtes
                fs.writeFile(localFilePath, webpBuffer, () => {});

                return new NextResponse(webpBuffer, {
                    headers: {
                        'Content-Type': 'image/webp',
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                });
            } catch {
                // Erreur Sharp
            }
        }

        // 3. Fallback SVG transparent / écusson neutre pour éviter tout 404 rouge dans DevTools
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 3 3"/><path d="m19 21 2-2"/></svg>`;

        return new NextResponse(placeholderSvg, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch {
        return new NextResponse('Erreur serveur', { status: 500 });
    }
}

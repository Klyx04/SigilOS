import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ASSET_DIRS, ensureAssetDirsExist } from '@/lib/dofus-asset-siphon';
import { assertSafeUrl } from '@/lib/image-downloader';

// 🛡️ Garde-fou mémoire : limite Sharp pour éviter tout crash V8 OOM lors de rafales
if (typeof (sharp as any)?.cache === 'function') {
    (sharp as any).cache({ memory: 40, files: 20, items: 50 });
}
if (typeof (sharp as any)?.concurrency === 'function') {
    (sharp as any).concurrency(1);
}

export const dynamic = 'force-dynamic';

const REMOTE_BASE_URLS = {
    monsters: 'https://api.dofusdb.fr/img/monsters',
    items: 'https://api.dofusdb.fr/img/items',
    spells: 'https://api.dofusdb.fr/img/spells',
};

// 🔒 SSRF fail-closed : seuls ces hôtes sont autorisés pour `?url=` et les
// redirections d'images DofusDB (monsterData.img). Tout le reste → placeholder.
const ALLOWED_IMAGE_HOSTS = new Set(['api.dofusdb.fr']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getAllowedRemoteUrl(raw: string | null): string | null {
    if (!raw) return null;
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return null;
    }
    if (u.protocol !== 'https:') return null;
    if (!ALLOWED_IMAGE_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
}

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

        // 1.5 Source Prioritaire Locale : Assets officiels HD sur la machine (C:\Users\user\Desktop\dofus_assets)
        // Permet un rendu instantané (0ms), zéro dépendance DofusDB, 100% autonome
        const desktopDirMap: Record<string, string> = {
            monsters: 'C:\\Users\\user\\Desktop\\dofus_assets\\monsters_2x',
            spells: 'C:\\Users\\user\\Desktop\\dofus_assets\\spells_2x',
            items: 'C:\\Users\\user\\Desktop\\dofus_assets\\items_2x',
        };
        const desktopDir = desktopDirMap[assetType];
        if (desktopDir) {
            const candidateFiles = [
                path.join(desktopDir, `${safeId}.png`),
                path.join(desktopDir, `${safeId}.webp`),
            ];
            for (const desktopFile of candidateFiles) {
                if (fs.existsSync(desktopFile)) {
                    try {
                        const rawBuffer = fs.readFileSync(desktopFile);
                        const webpBuffer = await sharp(rawBuffer)
                            .webp({ quality: 80, effort: 2 })
                            .toBuffer();
                        fs.writeFileSync(localFilePath, webpBuffer);
                        return new NextResponse(webpBuffer, {
                            headers: {
                                'Content-Type': 'image/webp',
                                'Cache-Control': 'public, max-age=31536000, immutable',
                            },
                        });
                    } catch {}
                }
            }
        }

        // 2. Sinon, on siphonne à la volée depuis la source (Auto Self-Healing)
        // 🔒 `?url=` durci : hôte allowlisté + assertSafeUrl (DNS + IP privées) + HTTPS only.
        const rawUrlParam = req.nextUrl.searchParams.get('url');
        const safeUrlParam = getAllowedRemoteUrl(rawUrlParam);

        // Si une URL est fournie et qu'on peut en extraire un id numérique pour chercher sur le desktop
        if (safeUrlParam) {
            const urlMatch = safeUrlParam.match(/\/(\d+)\.(png|webp|jpg)/i);
            if (urlMatch && desktopDir) {
                const altDesktopFile = path.join(desktopDir, `${urlMatch[1]}.png`);
                if (fs.existsSync(altDesktopFile)) {
                    try {
                        const rawBuffer = fs.readFileSync(altDesktopFile);
                        const webpBuffer = await sharp(rawBuffer)
                            .webp({ quality: 80, effort: 2 })
                            .toBuffer();
                        fs.writeFileSync(localFilePath, webpBuffer);
                        return new NextResponse(webpBuffer, {
                            headers: {
                                'Content-Type': 'image/webp',
                                'Cache-Control': 'public, max-age=31536000, immutable',
                            },
                        });
                    } catch {}
                }
            }
        }

        // Guard : si l'ID n'est pas purement numérique (ex: CUID Prisma comme "cmrwd97k..."),
        // on ne peut pas faire un lookup DofusDB fiable → on tente uniquement le ?url= fourni
        // sinon on renvoie directement le placeholder pour éviter de retourner le mauvais monstre.
        const isNumericId = /^\d+$/.test(safeId);

        const remoteUrl = safeUrlParam || (isNumericId ? `${REMOTE_BASE_URLS[assetType]}/${safeId}.png` : null);

        let downloaded = false;
        let inputBuffer: Buffer | null = null;

        // Tentative 1 : Téléchargement direct depuis remoteUrl (si disponible)
        if (remoteUrl) {
            try {
                // 🔒 SSRF : re-valide DNS/IP juste avant fetch (anti-rebinding), fail-closed.
                await assertSafeUrl(remoteUrl);
                const remoteRes = await fetch(remoteUrl, {
                    headers: {
                        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    },
                    signal: AbortSignal.timeout(8_000),
                });

                if (remoteRes.ok) {
                    const contentType = remoteRes.headers.get('content-type') || '';
                    // 🔒 Rejette HTML/JS déguisés (fail-closed, évite XSS via image).
                    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
                        throw new Error('Contenu non-image rejeté');
                    }
                    const contentLength = Number(remoteRes.headers.get('content-length') || '0');
                    if (contentLength > MAX_IMAGE_BYTES) {
                        throw new Error('Image trop volumineuse');
                    }
                    const arrayBuffer = await remoteRes.arrayBuffer();
                    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
                        throw new Error('Image trop volumineuse');
                    }
                    inputBuffer = Buffer.from(arrayBuffer);
                    downloaded = true;
                }
            } catch {
                // Échec première tentative
            }
        }

        // Tentative 2 : Si c'est un item et que l'URL par défaut a échoué, résolution via l'API DofusDB (iconId)
        if (!downloaded && isNumericId && assetType === 'items') {
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
        if (!downloaded && isNumericId && assetType === 'monsters') {
            try {
                const monsterRes = await fetch(`https://api.dofusdb.fr/monsters/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(6_000),
                });
                if (monsterRes.ok) {
                    const monsterData = await monsterRes.json();
                    const realImgUrl = getAllowedRemoteUrl(monsterData.img);
                    if (realImgUrl) {
                        await assertSafeUrl(realImgUrl);
                        const imgRes = await fetch(realImgUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: AbortSignal.timeout(6_000),
                        });
                        if (imgRes.ok) {
                            const contentType = imgRes.headers.get('content-type') || '';
                            if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
                                throw new Error('Contenu non-image rejeté');
                            }
                            const arrayBuffer = await imgRes.arrayBuffer();
                            if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
                                throw new Error('Image trop volumineuse');
                            }
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
                // Compression WebP via Sharp (quality 80, effort 2 pour vitesse et basse conso RAM)
                const webpBuffer = await sharp(inputBuffer)
                    .webp({ quality: 80, effort: 2 })
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

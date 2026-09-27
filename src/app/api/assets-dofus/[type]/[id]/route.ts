import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
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

        // Un id purement numérique est adressable sur DofusDB (fiche + asset) ; un CUID Prisma
        // ne l'est pas → aucun lookup devinable (fail-closed, plus bas).
        const isNumericId = /^\d+$/.test(safeId);

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

        // 1.5 Sources locales « game data » (assets officiels, ZÉRO réseau)
        // 👑 « God » = dump du client de jeu (`items_2x`, `spells_2x`, `monsters_2x`).
        //    • dev  : <Bureau>/dofus_assets, résolu via le dossier utilisateur
        //      (jamais de chemin absolu en dur — cf. docs/RULES.md §Sécurité)
        //    • prod : `DOFUS_ASSETS_DIR` (ex. /data/dofus_assets monté en lecture seule)
        //      → les icônes sont alors servies LOCALEMENT, sans dépendre de DofusDB.
        //    Plusieurs racines possibles, séparées par « ; » ou « , ».
        const godRoots = [
            ...String(process.env.DOFUS_ASSETS_DIR || '')
                .split(/[;,]/)
                .map((dir) => dir.trim())
                .filter(Boolean),
            path.join(os.homedir(), 'Desktop', 'dofus_assets'), // héritage dev (ignoré si absent)
        ];
        const godSubDir = assetType === 'items' ? 'items_2x' : assetType === 'monsters' ? 'monsters_2x' : 'spells_2x';

        /** Fichier 2x local correspondant à un id, dans les racines configurées. */
        const findGodFile = (id: string): string | null => {
            for (const root of godRoots) {
                for (const candidate of [
                    path.join(root, godSubDir, `${id}.png`),
                    path.join(root, godSubDir, `${id}.webp`),
                ]) {
                    if (fs.existsSync(candidate)) return candidate;
                }
            }
            return null;
        };

        const godFile = findGodFile(safeId);
        if (godFile) {
            try {
                const rawBuffer = fs.readFileSync(godFile);
                const webpBuffer = await sharp(rawBuffer)
                    .webp({ quality: 80, effort: 2 })
                    .toBuffer();
                fs.writeFile(localFilePath, webpBuffer, () => {});
                return new NextResponse(webpBuffer, {
                    headers: {
                        'Content-Type': 'image/webp',
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                });
            } catch {
                // Fichier local illisible → on continue vers le siphonnage réseau
            }
        }

        // 2. Sinon, on siphonne à la volée depuis la source (Auto Self-Healing)
        // 🔒 `?url=` durci : hôte allowlisté + assertSafeUrl (DNS + IP privées) + HTTPS only.
        const rawUrlParam = req.nextUrl.searchParams.get('url');
        const safeUrlParam = getAllowedRemoteUrl(rawUrlParam);

        // Si une URL est fournie et qu'on peut en extraire un id numérique, on tente le fichier « god » local
        // ⚠️ Jamais pour un MONSTRE à id numérique : son apparence est résolue par l'API juste en
        // dessous (autorité DofusDB). Ici le dump est indexé par le gfx contenu dans l'URL, donc une
        // URL périmée (l'apparence d'un autre monstre) serait servie ET mise en cache 1 an.
        if (safeUrlParam && !(assetType === 'monsters' && isNumericId)) {
            const urlMatch = safeUrlParam.match(/\/(\d+)\.(png|webp|jpg)/i);
            const altGodFile = urlMatch ? findGodFile(urlMatch[1]) : null;
            if (altGodFile) {
                try {
                    const rawBuffer = fs.readFileSync(altGodFile);
                    const webpBuffer = await sharp(rawBuffer)
                        .webp({ quality: 80, effort: 2 })
                        .toBuffer();
                    fs.writeFile(localFilePath, webpBuffer, () => {});
                    return new NextResponse(webpBuffer, {
                        headers: {
                            'Content-Type': 'image/webp',
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                    });
                } catch {}
            }
        }

        // Guard : si l'ID n'est pas purement numérique (ex: CUID Prisma comme "cmrwd97k..."),
        // on ne peut pas faire un lookup DofusDB fiable → on tente uniquement le ?url= fourni
        // sinon on renvoie directement le placeholder pour éviter de retourner le mauvais monstre.
        //
        // 🐛 `img/{type}/{id}.png` n'est VALABLE QUE POUR LES ITEMS (leur clé de cache EST leur id).
        // Mesure du 27/09/2026 sur 300 monstres DofusDB : **100 % ont `gfxId ≠ id`**
        // (Predagob 4834 → `img/monsters/1583.png` ; `img/monsters/4834.png` → **404**). Deviner
        // l'apparence d'un monstre par son id servait donc l'image d'un AUTRE monstre (ou un 404),
        // puis la figeait en cache. Les monstres sont désormais résolus par l'API (bloc MONSTRES).
        const remoteUrl = safeUrlParam || (isNumericId && assetType === 'items' ? `${REMOTE_BASE_URLS.items}/${safeId}.png` : null);

        let downloaded = false;
        let inputBuffer: Buffer | null = null;

        // ── MONSTRES : DofusDB est la SEULE autorité de l'apparence ─────────────────────────
        // L'apparence est indexée par le **gfxId**, jamais par l'id du monstre. Mesure du
        // 27/09/2026 : 100 % des 300 monstres DofusDB testés ont `gfxId ≠ id` (Predagob 4834 →
        // gfx 1583) et le dump local `monsters_2x/` est indexé par gfx lui aussi (281/300 des
        // ids de monstres portent AUSSI un fichier de dump — celui d'un autre monstre).
        // Ordre : API + garde d'identité → dump par **gfx** → `img` de l'API. Le résultat est
        // mis en cache sous `{id}.webp` (notre clé d'affichage) = l'apparence DU BON monstre.
        let monsterImageHandled = false;
        if (isNumericId && assetType === 'monsters') {
            monsterImageHandled = true;
            try {
                const monsterRes = await fetch(`https://api.dofusdb.fr/monsters/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(6_000),
                });
                if (monsterRes.ok) {
                    const monsterData = await monsterRes.json();
                    // 🛡️ Garde d'identité (même règle que les items) : DofusDB répond 200 avec un
                    // monstre de repli quand l'id n'existe pas ⇒ jamais l'apparence d'un autre.
                    if (Number(monsterData?.id) === Number(safeId)) {
                        const gfxId = Math.floor(Number(monsterData?.gfxId) || 0);
                        const dumpFile = gfxId > 0 ? findGodFile(String(gfxId)) : null;
                        if (dumpFile) {
                            inputBuffer = fs.readFileSync(dumpFile);
                            downloaded = true;
                        } else {
                            const imgUrl = getAllowedRemoteUrl(monsterData?.img);
                            if (imgUrl) {
                                await assertSafeUrl(imgUrl);
                                const imgRes = await fetch(imgUrl, {
                                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                                    signal: AbortSignal.timeout(6_000),
                                });
                                if (imgRes.ok) {
                                    const contentType = imgRes.headers.get('content-type') || '';
                                    if (contentType.startsWith('image/') || contentType.startsWith('application/octet-stream')) {
                                        const arrayBuffer = await imgRes.arrayBuffer();
                                        if (arrayBuffer.byteLength > 0 && arrayBuffer.byteLength <= MAX_IMAGE_BYTES) {
                                            inputBuffer = Buffer.from(arrayBuffer);
                                            downloaded = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {
                // API/réseau indisponible → repli déclaré ci-dessous, puis placeholder neutre.
            }

            // Repli **déclaré** (`?url=` allowlisté) joué APRÈS l'autorité : une URL périmée
            // (apparence d'un autre monstre) ne peut donc plus passer devant la fiche DofusDB.
            if (!downloaded && safeUrlParam) {
                try {
                    await assertSafeUrl(safeUrlParam);
                    const declared = await fetch(safeUrlParam, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(6_000),
                    });
                    if (declared.ok) {
                        const arrayBuffer = await declared.arrayBuffer();
                        if (arrayBuffer.byteLength > 0 && arrayBuffer.byteLength <= MAX_IMAGE_BYTES) {
                            inputBuffer = Buffer.from(arrayBuffer);
                            downloaded = true;
                        }
                    }
                } catch {
                    // Repli déclaré indisponible → placeholder neutre plus bas.
                }
            }
        }

        // ── SORTS : DofusDB est la SEULE autorité de l'icône ────────────────────────────────
        // L'icône réelle d'un sort est `img/spells/sort_{iconId}.png` (`iconId` ≠ id du sort ; il
        // vaut **-1** quand le sort n'a PAS d'icône — mesuré le 22/09/2026 : `Ancrépulsion` 15144 →
        // `iconId: -1`, `img: sort_0.png`). Or le CDN Dofensive renvoie une image **par défaut**
        // pour tout id inconnu (1 066 octets pour `/spells/15144` COMME pour `/spells/45397`) : le
        // `?url=` de nos payloads affichait donc une icône étrangère (« icône fausse »).
        // Ici : pour les sorts, on IGNORE le `?url=`, on résout `iconId`, et sans icône réelle on
        // sert NOTRE placeholder neutre — jamais l'image d'un autre sort.
        let spellIconHandled = false;
        if (isNumericId && assetType === 'spells') {
            spellIconHandled = true;
            try {
                const spellRes = await fetch(`https://api.dofusdb.fr/spells/${safeId}?lang=fr`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(6_000),
                });
                if (spellRes.ok) {
                    const spellData = await spellRes.json();
                    const directIcon = Number(spellData?.iconId);
                    const fromImg = Number(String(spellData?.img ?? '').match(/sort_(\d+)\.png/)?.[1]);
                    const iconId = Number.isFinite(directIcon) && directIcon > 0
                        ? directIcon
                        : (Number.isFinite(fromImg) && fromImg > 0 ? fromImg : null);
                    const candidates = iconId
                        ? [
                            `https://api.dofusdb.fr/img/spells/sort_${iconId}.png`,
                            `https://api.dofusdb.fr/img/spells/${iconId}.png`,
                        ]
                        : [];
                    for (const candidate of candidates) {
                        try {
                            const iconRes = await fetch(candidate, {
                                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                                signal: AbortSignal.timeout(6_000),
                            });
                            if (!iconRes.ok) continue;
                            const contentType = iconRes.headers.get('content-type') || '';
                            if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) continue;
                            const arrayBuffer = await iconRes.arrayBuffer();
                            if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) continue;
                            inputBuffer = Buffer.from(arrayBuffer);
                            downloaded = true;
                            break;
                        } catch {
                            // Candidat suivant
                        }
                    }
                }
            } catch {
                // Résolution d'icône impossible → placeholder neutre ci-dessous
            }
        }

        // Tentative 1 : Téléchargement direct depuis remoteUrl (si disponible)
        // (jamais pour les sorts : leur icône est résolue ci-dessus, cf. § SORTS ;
        //  jamais pour les monstres : apparence résolue par l'API, cf. § MONSTRES.)
        if (remoteUrl && !spellIconHandled && !monsterImageHandled) {
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
                    // 🛡️ Garde d'identité : quand l'id n'existe pas, DofusDB répond quand même
                    // HTTP 200 avec un item de repli (« Purée pique-fêle » id 666). Sans ce
                    // contrôle, on servait l'icône d'un AUTRE item — cause du bug « mauvais
                    // items » de la galerie (id interne Dofusbook ≠ id de jeu).
                    if (Number(itemData?.id) === Number(safeId)) {
                        const iconId = Number(itemData.iconId) || Number(itemData.id);
                        if (iconId > 0) {
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
                }
            } catch {
                // Échec résolution iconId
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

        // 3. Fallback SVG neutre pour éviter tout 404 rouge dans DevTools.
        // ⚠️ `no-store` OBLIGATOIRE : sinon un échec TRANSITOIRE de siphonnage est figé
        // 24 h dans le cache du navigateur → l'utilisateur voit des icônes manquantes
        // (placeholder « lien cassé ») alors que la source est de nouveau disponible.
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 3 3"/><path d="m19 21 2-2"/></svg>`;

        return new NextResponse(placeholderSvg, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'no-store',
                'X-SigilOS-Placeholder': '1',
            },
        });
    } catch {
        return new NextResponse('Erreur serveur', { status: 500 });
    }
}

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '@/lib/logger';
import { dofusDbFetch } from '@/lib/dofusdb-limiter';
import { recordGameDataChanges } from '@/lib/game-data-changelog';

// ─── Répertoires de stockage des assets siphonnés ───────────────────────────
export const ASSET_DIRS = {
    monsters: path.join(process.cwd(), 'public', 'uploads', 'assets-dofus', 'monsters'),
    items: path.join(process.cwd(), 'public', 'uploads', 'assets-dofus', 'items'),
    spells: path.join(process.cwd(), 'public', 'uploads', 'assets-dofus', 'spells'),
};

export const PUBLIC_ASSET_PATHS = {
    monsters: '/uploads/assets-dofus/monsters',
    items: '/uploads/assets-dofus/items',
    spells: '/uploads/assets-dofus/spells',
};

// S'assure que les dossiers de stockage existent au démarrage
export function ensureAssetDirsExist() {
    Object.values(ASSET_DIRS).forEach((dir) => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// ─── Gardes anti-détection & politesse réseau (Stealth & Rate-Limiting) ──────
const DEFAULT_HEADERS = {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr; Game Asset Cache Service)',
};

/** Domaines stricts autorisés pour le siphonnage d'assets (SSRF Guard) */
const ALLOWED_ASSET_DOMAINS = new Set([
    'dofusdb.fr',
    'api.dofusdb.fr',
    'static.dofusdb.fr',
    'static.ankama.com',
    's.ankama.com',
    'staticns.ankama.com',
    'www.ankama.com',
    'ankama.com',
    'dofensive.com',
    'api.dofensive.com',
    'www.dofensive.com',
    'metamob.fr',
    'api.metamob.fr',
    'www.metamob.fr',
    'dofus.com',
    'www.dofus.com',
]);

/**
 * Valide et reconstruit une URL absolue vérifiée contre la liste blanche anti-SSRF.
 * Retourne null si le protocole ou le domaine n'est pas strictement autorisé.
 */
export function getValidatedAssetUrl(rawUrl: string | null | undefined): string | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        const host = parsed.hostname.toLowerCase();
        if (!ALLOWED_ASSET_DOMAINS.has(host)) return null;
        return `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}`;
    } catch {
        return null;
    }
}

/** Vérifie et parse l'URL pour empêcher tout SSRF */
export function isSafeAssetUrl(rawUrl: string): boolean {
    return getValidatedAssetUrl(rawUrl) !== null;
}

/** Délai aléatoire (jitter) pour simuler un trafic naturel et éviter tout flag */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ⏱️ Délai maximal d'un téléchargement d'asset — **volontairement supérieur à l'attente
 * maximale du limiteur partagé** (60 s, `dofusdb-limiter`) : sinon la requête est avortée
 * *pendant qu'elle attend son tour de fenêtre*.
 *
 * Mesure du 24/09/2026 (bouton « Siphonner manquants » du panneau de couverture) : une rafale
 * de 143 images sur une API limitée à 30 req/min donnait **21 échecs** avec l'ancien timeout de
 * 12 s — alors que ces images **existaient** (`/img/monsters/827.png` → `200 image/png`, vérifié).
 * Les succès étaient ceux dont le tour venait immédiatement ; les échecs, ceux qui patientaient.
 */
const ASSET_FETCH_TIMEOUT_MS = 70_000;

/**
 * Télécharge une image distante, la compresse en WebP (85% qualité, lossless optionnel)
 * et l'enregistre sur le disque local si elle n'existe pas encore.
 * Idempotent : si le fichier existe déjà, aucun appel réseau n'est effectué.
 */
export async function siphonAndCompressImage(
    remoteUrl: string | null | undefined,
    targetType: 'monsters' | 'items' | 'spells',
    entityId: number | string,
    force = false
): Promise<{ success: boolean; localUrl?: string; sizeBytes?: number; error?: string }> {
    ensureAssetDirsExist();

    const parsedId = typeof entityId === 'number' ? entityId : parseInt(String(entityId).replace(/[^0-9]/g, ''), 10);
    if (!parsedId || isNaN(parsedId) || parsedId <= 0) {
        return { success: false, error: 'Identifiant d\'asset invalide' };
    }
    const cleanId = Math.floor(Math.abs(parsedId));

    const filename = `${cleanId}.webp`;
    const targetFilePath = path.join(ASSET_DIRS[targetType], filename);
    const localPublicUrl = `${PUBLIC_ASSET_PATHS[targetType]}/${filename}`;

    // 1. Vérification locale : si déjà présent et valide, zéro requête externe
    if (!force && fs.existsSync(targetFilePath)) {
        try {
            const stat = fs.statSync(targetFilePath);
            if (stat.size > 100) {
                return { success: true, localUrl: localPublicUrl, sizeBytes: stat.size };
            }
        } catch {
            // Re-téléchargement si corrompu
        }
    }

    let downloadedBuffer: Buffer | null = null;

    try {
        // Jitter poli : pause de 250ms à 550ms pour ne pas bombarder le serveur source
        await sleep(Math.floor(Math.random() * 300) + 250);

        // Tentative 0 : URL réelle fournie par l'appelant (ex. `monster.img` DofusDB).
        // L'ID logique ≠ toujours l'ID image (ex. Cadob 3220 → img 499) : deviner
        // le pattern en premier faisait échouer des assets pourtant disponibles.
        const validatedRemoteUrl = getValidatedAssetUrl(remoteUrl);
        if (validatedRemoteUrl) {
            try {
                const providedRes = await dofusDbFetch(validatedRemoteUrl, {
                    headers: DEFAULT_HEADERS,
                    signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                    cache: 'no-store',
                });
                if (providedRes.ok) {
                    const arrayBuffer = await providedRes.arrayBuffer();
                    downloadedBuffer = Buffer.from(arrayBuffer);
                }
            } catch {}
        }

        // Tentative 1 : Téléchargement direct depuis l'API officielle DofusDB avec URL statique
        // (seulement si la tentative 0 n'a rien donné — ne jamais écraser un succès).
        if (!downloadedBuffer) {
            const targetUrl = new URL('https://api.dofusdb.fr');
            targetUrl.pathname = targetType === 'items'
                ? `/img/items/${cleanId}.png`
                : targetType === 'spells'
                ? `/img/spells/${cleanId}.png`
                : `/img/monsters/${cleanId}.png`;

            try {
                const response = await dofusDbFetch(targetUrl.toString(), {
                    headers: DEFAULT_HEADERS,
                    signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                    cache: 'no-store',
                });
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    downloadedBuffer = Buffer.from(arrayBuffer);
                }
            } catch {}
        }

        // Tentative 2 (Auto-Healing) : Si échec et cible monster -> résolution du graphicLookId via DofusDB
        if (!downloadedBuffer && targetType === 'monsters') {
            try {
                const monsterApiUrl = new URL('https://api.dofusdb.fr');
                monsterApiUrl.pathname = `/monsters/${cleanId}`;
                const monsterRes = await dofusDbFetch(monsterApiUrl.toString(), {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                });
                if (monsterRes.ok) {
                    const monsterData = await monsterRes.json();
                    if (monsterData.img && typeof monsterData.img === 'string') {
                        const parsedImg = new URL(monsterData.img);
                        const imgHost = parsedImg.hostname.toLowerCase();
                        if (ALLOWED_ASSET_DOMAINS.has(imgHost)) {
                            const cleanImgPath = parsedImg.pathname.replace(/[^a-zA-Z0-9_.\-\/]/g, '');
                            const safeImgUrl = new URL(`https://${imgHost}`);
                            safeImgUrl.pathname = cleanImgPath;
                            const imgRes = await dofusDbFetch(safeImgUrl.toString(), {
                                headers: DEFAULT_HEADERS,
                                signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                            });
                            if (imgRes.ok) {
                                const arrayBuffer = await imgRes.arrayBuffer();
                                downloadedBuffer = Buffer.from(arrayBuffer);
                            }
                        }
                    }
                }
            } catch {}
        }

        // Tentative 3 (Auto-Healing) : Si échec et cible item -> résolution de l'iconId via DofusDB
        if (!downloadedBuffer && targetType === 'items') {
            try {
                const itemApiUrl = new URL('https://api.dofusdb.fr');
                itemApiUrl.pathname = `/items/${cleanId}`;
                const itemRes = await dofusDbFetch(itemApiUrl.toString(), {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                });
                if (itemRes.ok) {
                    const itemData = await itemRes.json();
                    // 🛡️ Garde d'identité : DofusDB renvoie HTTP 200 avec un item de repli
                    // (« Purée pique-fêle » id 666) quand l'id demandé n'existe pas. Sans ce
                    // contrôle, l'auto-healing retournait l'icône d'un AUTRE item (bug
                    // « mauvais items » galerie/perso : id interne Dofusbook ≠ id de jeu).
                    if (Number(itemData?.id) === Number(cleanId)) {
                        const iconId = Number(itemData.iconId) || Number(itemData.id);
                        if (iconId > 0) {
                            const directItemUrl = new URL('https://api.dofusdb.fr');
                            directItemUrl.pathname = `/img/items/${iconId}.png`;
                            const imgRes = await dofusDbFetch(directItemUrl.toString(), {
                                headers: DEFAULT_HEADERS,
                                signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
                            });
                            if (imgRes.ok) {
                                const arrayBuffer = await imgRes.arrayBuffer();
                                downloadedBuffer = Buffer.from(arrayBuffer);
                            }
                        }
                    }
                }
            } catch {}
        }

        if (!downloadedBuffer) {
        // ⚠️ On nomme les URL essayées : « impossible de récupérer » sans URL est
        // indiagnosticable (leçon du 24/09/2026, 21 échecs inexpliqués sur 143 images).
        const triedDetail =
            targetType === 'items'
                ? `essayé : img/items/${cleanId}.png puis la fiche /items/${cleanId} → imgset`
                : targetType === 'spells'
                ? `essayé : img/spells/${cleanId}.png`
                : `essayé : img/monsters/${cleanId}.png puis la fiche /monsters/${cleanId} → img`;
        throw new Error(`Impossible de récupérer l'image pour ${targetType} #${cleanId} (${triedDetail})`);
        }

        // Compression WebP via Sharp avec suppression des métadonnées superflues
        await sharp(downloadedBuffer)
            .webp({ quality: 85, effort: 4 })
            .toFile(targetFilePath);

        const stat = fs.statSync(targetFilePath);
        // 🔍 Journal (dataset ASSETS_WEBP) : l'image est **nouvellement** sur disque (les fichiers
        // déjà présents sortent plus haut, sans téléchargement) ⇒ entrée « Nouveau » assumée.
        await recordGameDataChanges('ASSETS_WEBP', [
            {
                entityType: 'image',
                entityId: `${targetType}/${cleanId}`,
                entityName: `${targetType}/${cleanId}.webp`,
                changeType: 'NEW',
            },
        ]);
        return { success: true, localUrl: localPublicUrl, sizeBytes: stat.size };
    } catch (error) {
        logger.warn(`[asset-siphon] Échec du téléchargement (${targetType} #${cleanId}):`, {
            error: String(error),
        });
        return { success: false, error: String(error) };
    }
}

/**
 * Retourne l'URL publique locale si le fichier existe sur disque, sinon l'URL distante.
 */
export function getLocalAssetUrl(
    targetType: 'monsters' | 'items' | 'spells',
    entityId: number | string,
    fallbackRemoteUrl?: string | null
): string | null {
    if (!entityId) return fallbackRemoteUrl || null;
    const safeId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
    const targetFilePath = path.join(ASSET_DIRS[targetType], `${safeId}.webp`);

    if (fs.existsSync(targetFilePath)) {
        return `${PUBLIC_ASSET_PATHS[targetType]}/${safeId}.webp`;
    }

    return fallbackRemoteUrl || null;
}

/**
 * Calcule les statistiques d'espace disque et de volumétrie du stockage local d'assets.
 */
export function getAssetStorageStats() {
    ensureAssetDirsExist();

    const stats = {
        monsters: { count: 0, sizeBytes: 0 },
        items: { count: 0, sizeBytes: 0 },
        spells: { count: 0, sizeBytes: 0 },
        totalCount: 0,
        totalSizeBytes: 0,
        totalSizeFormatted: '0 Mo',
    };

    (Object.keys(ASSET_DIRS) as Array<keyof typeof ASSET_DIRS>).forEach((type) => {
        const dir = ASSET_DIRS[type];
        try {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                let typeSize = 0;
                let validCount = 0;
                files.forEach((file) => {
                    if (file.endsWith('.webp')) {
                        try {
                            const fstat = fs.statSync(path.join(dir, file));
                            typeSize += fstat.size;
                            validCount++;
                        } catch {}
                    }
                });
                stats[type].count = validCount;
                stats[type].sizeBytes = typeSize;
                stats.totalCount += validCount;
                stats.totalSizeBytes += typeSize;
            }
        } catch (err) {
            logger.warn(`[asset-siphon] Erreur lecture stats ${type}:`, { error: String(err) });
        }
    });

    const sizeInMb = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);
    stats.totalSizeFormatted = `${sizeInMb} Mo`;

    return stats;
}

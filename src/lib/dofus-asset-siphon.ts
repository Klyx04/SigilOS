import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '@/lib/logger';

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
const ALLOWED_ASSET_DOMAINS = [
    'dofusdb.fr',
    'api.dofusdb.fr',
    'static.ankama.com',
    's.ankama.com',
    'staticns.ankama.com',
    'dofensive.com',
    'api.dofensive.com',
    'metamob.fr',
    'api.metamob.fr',
    'dofus.com',
    'ankama.com'
];

/** Vérifie et parse l'URL pour empêcher tout SSRF */
export function isSafeAssetUrl(rawUrl: string): boolean {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
        const host = parsed.hostname.toLowerCase();
        return ALLOWED_ASSET_DOMAINS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
        return false;
    }
}

/** Délai aléatoire (jitter) pour simuler un trafic naturel et éviter tout flag */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Télécharge une image distante, la compresse en WebP (85% qualité, lossless optionnel)
 * et l'enregistre sur le disque local si elle n'existe pas encore.
 * Idempotent : si le fichier existe déjà, aucun appel réseau n'est effectué.
 */
export async function siphonAndCompressImage(
    remoteUrl: string,
    targetType: 'monsters' | 'items' | 'spells',
    entityId: number | string,
    force = false
): Promise<{ success: boolean; localUrl?: string; sizeBytes?: number; error?: string }> {
    if (!remoteUrl || !isSafeAssetUrl(remoteUrl)) {
        return { success: false, error: 'URL distante invalide ou domaine non autorisé' };
    }

    ensureAssetDirsExist();

    const safeId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safeId}.webp`;
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

    let actualUrl = remoteUrl;
    let downloadedBuffer: Buffer | null = null;

    try {
        // Jitter poli : pause de 250ms à 550ms pour ne pas bombarder le serveur source
        await sleep(Math.floor(Math.random() * 300) + 250);

        // Tentative 1 : Téléchargement direct
        try {
            if (isSafeAssetUrl(actualUrl)) {
                const response = await fetch(actualUrl, {
                    headers: DEFAULT_HEADERS,
                    signal: AbortSignal.timeout(12_000),
                    cache: 'no-store',
                });
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    downloadedBuffer = Buffer.from(arrayBuffer);
                }
            }
        } catch {}

        // Tentative 2 (Auto-Healing) : Si échec et cible monster -> résolution du graphicLookId via DofusDB
        if (!downloadedBuffer && targetType === 'monsters' && /^\d+$/.test(safeId)) {
            try {
                const monsterRes = await fetch(`https://api.dofusdb.fr/monsters/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(8_000),
                });
                if (monsterRes.ok) {
                    const monsterData = await monsterRes.json();
                    if (monsterData.img && isSafeAssetUrl(monsterData.img)) {
                        actualUrl = monsterData.img;
                        const imgRes = await fetch(actualUrl, {
                            headers: DEFAULT_HEADERS,
                            signal: AbortSignal.timeout(12_000),
                        });
                        if (imgRes.ok) {
                            const arrayBuffer = await imgRes.arrayBuffer();
                            downloadedBuffer = Buffer.from(arrayBuffer);
                        }
                    }
                }
            } catch {}
        }

        // Tentative 3 (Auto-Healing) : Si échec et cible item -> résolution de l'iconId via DofusDB
        if (!downloadedBuffer && targetType === 'items' && /^\d+$/.test(safeId)) {
            try {
                const itemRes = await fetch(`https://api.dofusdb.fr/items/${safeId}`, {
                    headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
                    signal: AbortSignal.timeout(8_000),
                });
                if (itemRes.ok) {
                    const itemData = await itemRes.json();
                    const iconId = itemData.iconId || itemData.id;
                    if (iconId) {
                        const directItemUrl = `https://api.dofusdb.fr/img/items/${iconId}.png`;
                        if (isSafeAssetUrl(directItemUrl)) {
                            actualUrl = directItemUrl;
                            const imgRes = await fetch(actualUrl, {
                                headers: DEFAULT_HEADERS,
                                signal: AbortSignal.timeout(12_000),
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
            throw new Error(`Impossible de récupérer l'image depuis ${actualUrl}`);
        }

        // Compression WebP via Sharp avec suppression des métadonnées superflues
        await sharp(downloadedBuffer)
            .webp({ quality: 85, effort: 4 })
            .toFile(targetFilePath);

        const stat = fs.statSync(targetFilePath);
        return { success: true, localUrl: localPublicUrl, sizeBytes: stat.size };
    } catch (error) {
        logger.warn(`[asset-siphon] Échec du téléchargement (${targetType} #${entityId}):`, {
            url: actualUrl,
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

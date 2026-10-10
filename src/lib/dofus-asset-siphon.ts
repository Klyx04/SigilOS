import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '@/lib/logger';
import { dofusDbFetch } from '@/lib/dofusdb-limiter';
// 🚦 Le refus **local** du budget partagé n'est pas une panne : ces helpers purs le nomment
// (même sémantique que les items, mesure du 28/09/2026 — « DofusDB a renvoyé HTTP 429 » mentait).
import {
    LocalThrottleDeferredError,
    isLocalThrottle,
    isLocalThrottleDeferredMessage,
    throttleWaitMs,
} from '@/lib/dofusdb-throttle';
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
 * Options d'un siphon d'image. Ajouté le 10/10/2026 pour le **pré-chauffage des icônes d'objets**
 * du guide : c'est la seule façon d'écrire une image d'objet **sans jamais deviner** son chemin.
 */
export interface SiphonAndCompressOptions {
    /**
     * Autoriser la **Tentative 1** — le chemin **deviné** `/img/{type}/{id}.png`.
     *
     * ⚠️ Pour un **objet**, l'id qu'on manipule est l'id d'**entité** (celui du guide, celui du nom
     * de fichier local) alors que `/img/items/*` est indexé par id d'**apparence** (mesure du
     * 09/10/2026 : l'objet 11107 a pour `iconId` 38677). Le chemin deviné peut donc répondre
     * **200 avec l'image d'un AUTRE objet**, qui serait alors écrite en cache… pour un an.
     *
     * Les appelants qui ne peuvent pas garantir l'identité (pré-chauffage) passent `false` : la
     * résolution se fait alors par la **Tentative 3** (fiche `/items/{id}` + **garde d'identité**
     * `id === itemData.id` → `iconId`), correcte par construction.
     *
     * Défaut `true` = comportement historique **inchangé** (monstres, sorts, appels qui passent
     * une URL autoritative).
     */
    allowGuessedPath?: boolean;
}

/**
 * Télécharge une image distante, la compresse en WebP (85% qualité, lossless optionnel)
 * et l'enregistre sur le disque local si elle n'existe pas encore.
 * Idempotent : si le fichier existe déjà, aucun appel réseau n'est effectué.
 *
 * Ordre des tentatives : URL fournie par l'appelant → chemin deviné (désactivable) → auto-healing
 * par la fiche (monstres : `img` ; objets : `iconId` **avec garde d'identité**).
 */
export async function siphonAndCompressImage(
    remoteUrl: string | null | undefined,
    targetType: 'monsters' | 'items' | 'spells',
    entityId: number | string,
    force = false,
    opts: SiphonAndCompressOptions = {}
): Promise<{ success: boolean; localUrl?: string; sizeBytes?: number; error?: string; retryAfterMs?: number }> {
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
    /**
     * 🚦 Dernière réponse **locale** du limiteur partagé (budget épuisé) : elle n'est PAS un
     * « asset manquant ». Sans cette distinction, un pré-chauffage concurrent d'un autre siphon
     * peignait chaque icône en échec (« Impossible de récupérer l'image ») alors que la source
     * allait très bien — mesuré le 10/10/2026 : **391/391 icônes** en échec, toutes par budget.
     */
    let throttledRes: Response | null = null;
    /** Causes réelles d'un échec, NOMMÉES (leçon du 24/09/2026 : « essayé : … » sans pourquoi). */
    const failureReasons: string[] = [];

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
                } else if (isLocalThrottle(providedRes)) {
                    throttledRes = providedRes;
                }
            } catch {}
        }

        // Tentative 1 : Téléchargement direct depuis l'API officielle DofusDB avec URL statique
        // (seulement si la tentative 0 n'a rien donné — ne jamais écraser un succès).
        // ⚠️ Désactivable (`opts.allowGuessedPath === false`) : pour un OBJET, cet id est l'id
        // d'ENTITÉ alors que `/img/items/*` est indexé par id d'APPARENCE ⇒ le chemin deviné peut
        // répondre 200 avec l'image d'un AUTRE objet (mesure du 09/10/2026). Le pré-chauffage du
        // guide s'interdit ce raccourci : il passe par la fiche + garde d'identité (Tentative 3).
        if (!downloadedBuffer && opts.allowGuessedPath !== false) {
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
                            } else if (isLocalThrottle(imgRes)) {
                                throttledRes = imgRes;
                            } else {
                                failureReasons.push(`img/items/${iconId}.png → HTTP ${imgRes.status}`);
                            }
                        } else {
                            failureReasons.push(`fiche /items/${cleanId} : aucun iconId exploitable`);
                        }
                    } else {
                        failureReasons.push(
                            `garde d'identité : la fiche renvoie l'id ${itemData?.id ?? 'inconnu'} au lieu de ${cleanId}`
                        );
                    }
                } else if (isLocalThrottle(itemRes)) {
                    throttledRes = itemRes;
                } else {
                    failureReasons.push(`fiche /items/${cleanId} → HTTP ${itemRes.status}`);
                }
            } catch {}
        }

        if (!downloadedBuffer) {
        // 🚦 Avant de conclure, la VRAIE question : est-ce que notre propre budget partagé a
        // refusé ? Si oui, ce n'est ni une panne ni un asset manquant — c'est « reviens plus
        // tard ». On le rend **typé par son message** (la classe partagée porte la formulation)
        // + l'attente conseillée : aucun appelant existant n'est cassé (contrat inchangé).
        if (throttledRes) {
            const retryAfterMs = throttleWaitMs(throttledRes);
            return {
                success: false,
                error: new LocalThrottleDeferredError(retryAfterMs).message,
                retryAfterMs,
            };
        }
        // ⚠️ On nomme les URL essayées : « impossible de récupérer » sans URL est
        // indiagnosticable (leçon du 24/09/2026, 21 échecs inexpliqués sur 143 images).
        const triedDetail =
            targetType === 'items'
                ? opts.allowGuessedPath === false
                    ? `essayé : la fiche /items/${cleanId} → iconId (résolution gardée ; chemin deviné volontairement désactivé)`
                    : `essayé : img/items/${cleanId}.png puis la fiche /items/${cleanId} → imgset`
                : targetType === 'spells'
                ? `essayé : img/spells/${cleanId}.png`
                : `essayé : img/monsters/${cleanId}.png puis la fiche /monsters/${cleanId} → img`;
        const why = failureReasons.length > 0 ? ` — cause : ${failureReasons.join(' | ')}` : '';
        throw new Error(`Impossible de récupérer l'image pour ${targetType} #${cleanId} (${triedDetail}${why})`);
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
 * 🔥 Bilan d'une tranche de pré-chauffage d'icônes — jamais un échec muet.
 */
export interface ItemIconSiphonResult {
    /** Icônes **écrites** sur le disque pendant cette tranche. */
    siphoned: number;
    /** Déjà présentes (aucun appel réseau) ou ids illisibles. */
    skipped: number;
    errors: number;
    /** Messages lisibles des échecs (bornés à la tranche) — le journal du panneau les affiche. */
    details: string[];
    /**
     * 🚦 `true` = la tranche s'est arrêtée parce que **notre budget partagé** a refusé la suite
     * (un autre siphon le consomme, un cron, …). Ce n'est **pas** un échec d'icône : l'appelant
     * doit attendre `retryAfterMs` puis rejouer la même tranche (les icônes déjà écrites
     * ressortiront « ignorées », sans réseau).
     */
    deferred?: boolean;
    /** Attente conseillée avant de rejouer (reste de fenêtre, borné par le module de cadence). */
    retryAfterMs?: number;
}

/**
 * 🔥 Pré-chauffe **une tranche** d'icônes d'objets : chaque id finit par avoir son fichier
 * `/uploads/assets-dofus/items/{id}.webp`, celui que `ResourceImage` cherche en premier
 * (modale « Ressources à prévoir » du guide Rush Sylvestre, entre autres).
 *
 * ⚠️ **Jamais de chemin deviné** : on passe `allowGuessedPath: false`. Pour un objet, l'id de
 * fichier est l'id d'**entité** alors que `/img/items/*` est indexé par id d'**apparence** — la
 * Tentative 1 pourrait donc graver l'icône d'un AUTRE objet pour un an (mesure du 09/10/2026,
 * cf. `SiphonAndCompressOptions`). L'image vient donc de la fiche `/items/{id}` **avec garde
 * d'identité**, ou bien la ligne est un échec **nommé**.
 *
 *   · **idempotent** : un id déjà présent sort sans aucun appel réseau ;
 *   · **budget partagé** : tout passe par `dofusDbFetch` (30 req/min) — la boucle appelante
 *     découpe en tranches courtes (`GUIDE_ICON_CHUNK_SIZE`, module pur `rush-resources-preheat`).
 */
export async function siphonItemIconsBatchCore(ids: readonly number[]): Promise<ItemIconSiphonResult> {
    const result: ItemIconSiphonResult = { siphoned: 0, skipped: 0, errors: 0, details: [] };

    for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0) {
            result.skipped++;
            result.details.push(`#${String(id)} : identifiant illisible, ignoré`);
            continue;
        }
        // Déjà sur disque : rien à faire (et surtout, aucun appel réseau).
        if (getLocalAssetUrl('items', id, null)) {
            result.skipped++;
            continue;
        }
        try {
            const res = await siphonAndCompressImage(null, 'items', id, false, { allowGuessedPath: false });
            if (res.success) {
                result.siphoned++;
                continue;
            }
            // 🚦 Notre budget partagé a refusé la suite : ce n'est **pas** un échec d'icône (mesure
            // du 10/10/2026 : 391/391 « échecs » alors que DofusDB allait très bien — un autre
            // siphon consommait le budget). On arrête la tranche ICI, sans brûler les refus
            // suivants, et on le dit à l'appelant : il attendra la fin de fenêtre puis rejouera.
            if (isLocalThrottleDeferredMessage(res.error)) {
                result.deferred = true;
                result.retryAfterMs = res.retryAfterMs;
                break;
            }
            result.errors++;
            result.details.push(`#${id} : ${res.error ?? 'échec inconnu'}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isLocalThrottleDeferredMessage(message)) {
                result.deferred = true;
                break;
            }
            result.errors++;
            result.details.push(`#${id} : ${message}`);
        }
    }

    return result;
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

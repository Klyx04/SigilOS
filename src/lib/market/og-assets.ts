/**
 * Module « Marché » — **chargement des assets de la carte OG** (BUG-5).
 *
 * ⚠️ Fichier **serveur uniquement** (fs + sharp), importé par
 * `src/app/api/og/market/[id]/route.tsx`.
 *
 * 🎯 Pourquoi ce fichier existe : la carte était rendue avec des `<img src="…">`
 * pointant vers **notre propre domaine** (`${baseUrl}/api/...`) et vers un
 * **WebP**. Résultat constaté en beta : `ImageResponse` (Satori) ne rendait ni
 * les icônes de stats, ni l'image de l'objet (Satori ne décode pas le WebP), et
 * l'auto-appel HTTP pouvait échouer dans le conteneur.
 *
 * ✅ Solution : tout est **lu sur disque** et **inliné en data-URI** (base64) :
 *   · icônes de stats officielles (PNG) : `public/assets/dofus/stats/*.png` ;
 *   · icône **Kamas** : `public/assets/dofus/game-icons/kamas.png` ;
 *   · image de l'objet : WebP **siphonné** converti en **PNG** par Sharp (ou, à
 *     défaut, l'image officielle DofusDB, bornée) ⇒ jamais de 404, jamais de
 *     dépendance à un aller-retour réseau du conteneur.
 *
 * 🔒 Sécurité : aucune donnée privée n'est lue ; les fichiers servis viennent
 * exclusivement de `public/` et du dossier de siphon. Le téléchargement de repli
 * est **borné** (hôte autorisé + taille maximale) — même politique que
 * `/api/assets-dofus`.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ASSET_DIRS } from "@/lib/dofus-asset-siphon";

/** Cache process : une carte = au plus quelques kilo-octets, jamais de relecture. */
const dataUrlCache = new Map<string, string | null>();

/** Chemin absolu d'un asset public (`/assets/...` → `public/assets/...`). */
function publicPath(publicUrl: string): string {
    return path.join(process.cwd(), "public", publicUrl.replace(/^\/+/, ""));
}

/** Lit un fichier image local et le renvoie en `data:` URI (mémoïsé). */
function readLocalImageAsDataUrl(filePath: string, mime: string): string | null {
    const cached = dataUrlCache.get(filePath);
    if (cached !== undefined) return cached;
    try {
        if (!fs.existsSync(filePath)) {
            dataUrlCache.set(filePath, null);
            return null;
        }
        const buffer = fs.readFileSync(filePath);
        if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) {
            dataUrlCache.set(filePath, null);
            return null;
        }
        const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        dataUrlCache.set(filePath, dataUrl);
        return dataUrl;
    } catch {
        dataUrlCache.set(filePath, null);
        return null;
    }
}

/**
 * Icône officielle d'une statistique (`pv.png`, `terre.png`, `critique.png`…)
 * sous forme de `data:` URI — `null` si le fichier n'existe pas (l'appelant
 * garde son repli visuel : jamais une icône cassée).
 */
export function loadStatIconDataUrl(asset: string): string | null {
    if (typeof asset !== "string" || !/^[a-zA-Z0-9_.-]+\.png$/.test(asset)) return null;
    return readLocalImageAsDataUrl(
        path.join(process.cwd(), "public", "assets", "dofus", "stats", asset),
        "image/png"
    );
}

/** Icône **Kamas** officielle (`game-icons/kamas.png`) en `data:` URI. */
export function loadKamasIconDataUrl(): string | null {
    const icons = ["game-icons/kamas.png", "icons/kamas.png"];
    for (const relative of icons) {
        const dataUrl = readLocalImageAsDataUrl(
            path.join(process.cwd(), "public", "assets", "dofus", relative),
            "image/png"
        );
        if (dataUrl) return dataUrl;
    }
    return null;
}

const ALLOWED_ITEM_IMAGE_HOSTS = new Set(["api.dofusdb.fr"]);
const MAX_ITEM_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Image d'un objet en `data:` URI **PNG** (Satori ne décode pas le WebP).
 *
 * 1. WebP siphonné en local (`ASSET_DIRS.items/{id}.webp`) ;
 * 2. sinon, téléchargement officiel DofusDB (hôte autorisé, taille bornée) ;
 * 3. sinon `null` (la carte affiche son repli, jamais un 404 rouge).
 */
export async function loadItemImageDataUrl(ankamaId: number | null | undefined): Promise<string | null> {
    if (typeof ankamaId !== "number" || !Number.isInteger(ankamaId) || ankamaId <= 0) return null;

    let input: Buffer | null = null;

    try {
        const localFile = path.join(ASSET_DIRS.items, `${ankamaId}.webp`);
        if (fs.existsSync(localFile)) {
            const buffer = fs.readFileSync(localFile);
            if (buffer.length > 50) input = buffer;
        }
    } catch {
        input = null;
    }

    if (!input) {
        try {
            const url = new URL(`https://api.dofusdb.fr/img/items/${ankamaId}.png`);
            if (!ALLOWED_ITEM_IMAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
            const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
            if (res.ok) {
                const contentType = res.headers.get("content-type") ?? "";
                if (contentType.startsWith("image/") || contentType.startsWith("application/octet-stream")) {
                    const arrayBuffer = await res.arrayBuffer();
                    if (arrayBuffer.byteLength > 0 && arrayBuffer.byteLength <= MAX_ITEM_IMAGE_BYTES) {
                        input = Buffer.from(arrayBuffer);
                    }
                }
            }
        } catch {
            input = null;
        }
    }

    if (!input) return null;

    try {
        const png = await sharp(input).png({ compressionLevel: 9 }).toBuffer();
        return `data:image/png;base64,${png.toString("base64")}`;
    } catch {
        return null;
    }
}

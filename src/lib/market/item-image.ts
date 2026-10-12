/**
 * Module « Marché » — **normalisation des URLs d'images d'objets** (BUG-3).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma / Node) : importable côté
 * client, côté serveur et en test unitaire.
 *
 * 🎯 Problème constaté en beta (`debug.md`) :
 *   · l'API de recherche renvoyait un **nom nu** (`25757.webp`) ⇒ le navigateur
 *     le résolvait en `/marche/25757.webp` ⇒ **404** ;
 *   · le repli pointait vers le **chemin statique** `/uploads/assets-dofus/items/*.webp`,
 *     qui n'existe que si le siphon a déjà tourné ⇒ `404` sur un catalogue neuf.
 *
 * ✅ Solution : **une seule** forme d'URL pour tout le module —
 * `/api/assets-dofus/items/{ankamaId}` = le proxy **auto-siphon** (sert le WebP
 * local s'il existe, sinon le télécharge, sinon un placeholder : jamais de 404).
 */

/** Base du proxy auto-siphon des icônes d'objets. */
export const DOFUS_ITEM_IMAGE_PROXY_BASE = "/api/assets-dofus/items";

/** Hôte de l'API officielle : ses `img` sont ramenés sur **notre** proxy (siphon). */
const DOFUSDB_IMAGE_HOST = "api.dofusdb.fr";

/**
 * URL de proxy canonique d'un objet du catalogue Dofus.
 * Retourne `null` si l'identifiant Ankama n'est pas un entier positif.
 */
export function itemImageProxyUrl(ankamaId: number | null | undefined): string | null {
    if (typeof ankamaId !== "number" || !Number.isInteger(ankamaId) || ankamaId <= 0) return null;
    return `${DOFUS_ITEM_IMAGE_PROXY_BASE}/${ankamaId}`;
}

/** Extrait un identifiant Ankama d'un nom de fichier (`25757.webp` → `25757`). */
function extractAnkamaIdFromName(raw: string): number | null {
    const match = /(\d{1,12})(?:\.(?:webp|png|jpg|jpeg|gif))?$/i.exec(raw.trim());
    if (!match) return null;
    const id = Number.parseInt(match[1], 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Normalise l'icône d'un objet vers **une URL exploitable par le navigateur**.
 *
 * Cascade (la première règle qui s'applique gagne) :
 *   1. non-string / vide / `undefined.png` ⇒ proxy depuis `ankamaId` (ou `null`) ;
 *   2. URL absolue `https://api.dofusdb.fr/img/items/*` ⇒ **notre** proxy (siphon
 *      local : 0 appel réseau au rendu) ;
 *   3. autre URL absolue `http(s)://` ⇒ conservée telle quelle (déjà servie) ;
 *   4. **nom nu** (`25757.webp`) ⇒ proxy depuis le nom, sinon depuis `ankamaId` ;
 *   5. chemin relatif (`/uploads/...`, `/api/...`) ⇒ proxy depuis `ankamaId`
 *      (le chemin statique n'existe pas tant que le siphon n'a pas tourné).
 *
 * Query-string : seul `v` (version d'image, 10/10/2026) est **préservé** — sans lui,
 * `…/32115?v=123` serait relu comme l'id `123`. Tout autre paramètre est abandonné
 * (comportement historique : le proxy résout par l'id, jamais par `?url=` relatif).
 *
 * `null` ⇒ l'appelant garde son repli visuel (icône lucide) : jamais d'image cassée.
 */
export function normalizeItemIconUrl(
    raw: string | null | undefined,
    ankamaId: number | null | undefined
): string | null {
    const fallback = itemImageProxyUrl(ankamaId);
    if (typeof raw !== "string") return withItemImageVersion(fallback, null);

    const value = raw.trim();
    // `?v=` préservé (version d'image), le reste de la query abandonné (cf. doc ci-dessus).
    let carriedVersion: string | null = null;
    let path = value;
    const queryIndex = value.indexOf("?");
    if (queryIndex !== -1) {
        path = value.slice(0, queryIndex);
        const params = new URLSearchParams(value.slice(queryIndex + 1));
        const v = (params.get("v") ?? "").trim();
        if (/^\d{1,20}$/.test(v)) carriedVersion = v;
    }
    const finish = (url: string | null): string | null =>
        withItemImageVersion(url, carriedVersion);
    if (path === "" || /^undefined\.(?:webp|png|jpg|jpeg|gif)$/i.test(path)) return finish(fallback);

    // URL absolue : DofusDB → notre proxy (siphon), sinon on la conserve.
    if (/^https?:\/\//i.test(path)) {
        try {
            const url = new URL(path);
            if (url.hostname.toLowerCase() === DOFUSDB_IMAGE_HOST && url.pathname.startsWith("/img/items/")) {
                // Mesure du 09/10/2026 : le nombre d une URL img/items/... est un ICONID, jamais l id
                // de l objet (item 11107 -> iconId 38677 ; l id 38677 est un AUTRE objet). On garde
                // donc l ankamaId comme cle du proxy : le serveur resout iconId avec garde d identite.
                return finish(itemImageProxyUrl(ankamaId) ?? path);
            }
        } catch {
            return finish(fallback);
        }
        return finish(path);
    }

    // Chemin relatif du catalogue local / chemin absolu depuis la racine.
    if (path.startsWith("/")) {
        return finish(itemImageProxyUrl(extractAnkamaIdFromName(path.split("/").pop() ?? "") ?? ankamaId) ?? fallback);
    }

    // Nom nu renvoyé par certaines intégrations (`25757.webp`).
    return finish(itemImageProxyUrl(extractAnkamaIdFromName(path) ?? ankamaId) ?? fallback);
}

/**
 * Version d'image depuis un `updatedAt` (Date, ISO ou epoch) : millisecondes, ou `null`.
 * Le siphon bump `GameItem.updatedAt` à chaque upsert ⇒ `?v=` change à chaque resiphon.
 */
export function iconVersionOf(updatedAt: unknown): number | null {
    if (updatedAt instanceof Date) {
        const ms = updatedAt.getTime();
        return Number.isFinite(ms) && ms > 0 ? Math.trunc(ms) : null;
    }
    if (typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt > 0) {
        return Math.trunc(updatedAt);
    }
    if (typeof updatedAt === "string" && updatedAt.trim() !== "") {
        const ms = Date.parse(updatedAt);
        return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    return null;
}

/**
 * Correctif long terme 10/10/2026 — **invalidation des icônes** : le proxy sert avec
 * `immutable` (1 an), donc une icône re-siphonnée sous la même URL restait invisible
 * (navigateurs + Discord) pour toutes les guildes. Avec `?v=<updatedAt>`, chaque resiphon
 * est une **nouvelle** URL ⇒ propagation automatique, plus jamais de purge manuelle.
 * Le proxy ignore `v` pour la résolution (fichier `{id}.webp`) : `immutable` redevient sain.
 *
 * Ne versionne QUE notre proxy (les URL externes sont des replis keyés par contenu).
 * Sans version (ou URL non-proxy) : retour tel quel, jamais de `?v=` inventé.
 */
export function withItemImageVersion(
    url: string | null | undefined,
    version: number | string | null | undefined
): string | null {
    if (!url) return url ?? null;
    const v = typeof version === "number"
        ? (Number.isFinite(version) && version > 0 ? String(Math.trunc(version)) : "")
        : (version ?? "").trim();
    if (!v) return url;
    if (!url.startsWith(DOFUS_ITEM_IMAGE_PROXY_BASE)) return url;
    const cleaned = url
        .replace(/([?&])v=[^&]*/g, "$1")
        .replace(/[?&]$/, "")
        .replace(/\?&/, "?");
    const separator = cleaned.includes("?") ? "&" : "?";
    return `${cleaned}${separator}v=${encodeURIComponent(v)}`;
}

/** Proxy canonique + version en un appel (recherche, fiches, embeds). */
export function versionedItemImageUrl(
    ankamaId: number | null | undefined,
    version: number | string | null | undefined
): string | null {
    return withItemImageVersion(itemImageProxyUrl(ankamaId), version);
}

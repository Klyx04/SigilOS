/**
 * Module « Marché » — **normalisation des URLs d'images d'objets** (BUG-3).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma / Node) : importable côté
 * client, côté serveur et en test unitaire.
 *
 * 🎯 Problème constaté en beta (`src/temp/debug.md`) :
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
 * `null` ⇒ l'appelant garde son repli visuel (icône lucide) : jamais d'image cassée.
 */
export function normalizeItemIconUrl(
    raw: string | null | undefined,
    ankamaId: number | null | undefined
): string | null {
    const fallback = itemImageProxyUrl(ankamaId);
    if (typeof raw !== "string") return fallback;

    const value = raw.trim();
    if (value === "" || /^undefined\.(?:webp|png|jpg|jpeg|gif)$/i.test(value)) return fallback;

    // URL absolue : DofusDB → notre proxy (siphon), sinon on la conserve.
    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            if (url.hostname.toLowerCase() === DOFUSDB_IMAGE_HOST && url.pathname.startsWith("/img/items/")) {
                const idFromName = extractAnkamaIdFromName(url.pathname.slice("/img/items/".length));
                return itemImageProxyUrl(idFromName ?? ankamaId) ?? value;
            }
        } catch {
            return fallback;
        }
        return value;
    }

    // Chemin relatif du catalogue local / chemin absolu depuis la racine.
    if (value.startsWith("/")) {
        return itemImageProxyUrl(extractAnkamaIdFromName(value.split("/").pop() ?? "") ?? ankamaId) ?? fallback;
    }

    // Nom nu renvoyé par certaines intégrations (`25757.webp`).
    return itemImageProxyUrl(extractAnkamaIdFromName(value) ?? ankamaId) ?? fallback;
}

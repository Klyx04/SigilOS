/**
 * Résolution centralisée de l'URL d'icône d'un Dofus (et des assets DofusDB).
 *
 * Objectif : servir les icônes Dofus depuis nos ASSETS LOCAUX (/module-dofus/*.png)
 * plutôt que depuis `dofusdb.fr` (external). Tous les Dofus canoniques ont une icône
 * locale dans `public/module-dofus/`. Ce module centralise :
 *   - la normalisation nom → nom de fichier (accents, alias, préfixe "Dofus"...),
 *   - le mapping nom → chemin local (`resolveDofusLocalImage`),
 *   - le wrapper `resolveDofusImageUrl(slug, imageUrl, name?)` qui renvoie le local
 *     quand le Dofus est connu, sinon retombe sur l'`imageUrl` (dofusdb) d'origine,
 *   - la **réécriture des icônes d'assets DofusDB vers le proxy interne**
 *     (`resolveDofusAssetImageUrl` / `internalDofusDbImageUrl`).
 *
 * 🐛 Correctif 18/09/2026 (« on tape encore chez DofusDB pour les icônes des sorts ») :
 * la modale de build rendait `spell.imageUrl`, une URL **absolue**
 * (`https://api.dofusdb.fr/img/spells/sort_12160.png`) stockée en base ⇒ 57 requêtes
 * navigateur → DofusDB (latence, dépendance externe, fuite de referer). Toute URL
 * DofusDB est désormais réécrite vers `/api/assets-dofus/{type}/{id}` : le serveur
 * sert le WebP **siphonné sur disque** (cache 1 an) ou le siphonne à la volée, et le
 * navigateur ne parle plus jamais à DofusDB.
 *
 * ⚠️ Module PUR (aucun fs / IO / API) : utilisable côté client ET serveur.
 */

/**
 * Registre des Dofus disposant d'un asset local dans `public/module-dofus/`.
 * Clé = nom de fichier normalisé (minuscules) ; valeur = chemin local servi.
 * Ne pas retirer un Dofus présent ici sans avoir supprimé son asset.
 */
const LOCAL_DOFUS_IMAGE: Record<string, string> = {
    emeraude: "/module-dofus/Dofus_Emeraude.png",
    turquoise: "/module-dofus/Dofus_Turquoise.png",
    ivoire: "/module-dofus/Dofus_Ivoire.png",
    ebene: "/module-dofus/Dofus_Ebene.png",
    ocre: "/module-dofus/Dofus_Ocre.png",
    pourpre: "/module-dofus/Dofus_Pourpre.png",
    vulbis: "/module-dofus/Dofus_Vulbis.png",
    abyssal: "/module-dofus/Dofus_Abyssal.png",
    sylvestre: "/module-dofus/Dofus_Sylvestre.png",
    cawotte: "/module-dofus/Dofus_Cawotte.png",
    dom_de_pin: "/module-dofus/Dom_De_Pin.png",
    des_glaces: "/module-dofus/Dofus_Des_Glaces.png",
    nebuleux: "/module-dofus/Dofus_Nebuleux.png",
    dokoko: "/module-dofus/Dofus_Dokoko.png",
    domakuro: "/module-dofus/Dofus_Domakuro.png",
    dolmanax: "/module-dofus/Dofus_Dolmanax.png",
    dorigami: "/module-dofus/Dofus_Dorigami.png",
    du_cauchemar: "/module-dofus/Dofus_Du_Cauchemar.png",
    forgelave: "/module-dofus/Dofus_Forgelave.png",
    argente: "/module-dofus/Dofus_Argente.png",
    argente_scintillant: "/module-dofus/Dofus_Argente_Scintillant.png",
    cacao: "/module-dofus/Dofus_Cacao.png",
    tachete: "/module-dofus/Dofus_Tachete.png",
    veilleur: "/module-dofus/Dofus_Veilleur.png",
    dofoozbz: "/module-dofus/Dofus_Dofoozbz.png",
    dokille: "/module-dofus/Dokille.png",
};

/**
 * Normalise un nom de Dofus vers un nom de fichier stable (sans accents, alias,
 * préfixe "Dofus" retiré). Reprend le mapping éprouvé de `DofusIcon`.
 */
export function normalizeDofusName(str: string): string {
    const n = str.trim().replace(/^Dofus\s+/i, "");
    const lower = n.toLocaleLowerCase();

    // Alias spécifiques (audit du filesystem)
    if (lower === "glaces" || lower === "des glaces") return "Des_Glaces";
    if (lower === "cauchemar" || lower === "du cauchemar") return "Du_Cauchemar";
    if (lower === "scintillant" || lower === "argente scintillant" || lower === "argenté scintillant") return "Argente_Scintillant";
    if (lower === "veilleurs" || lower === "veilleur" || lower === "des veilleurs") return "Veilleur";
    if (lower === "tacheté" || lower === "tachete") return "Tachete";
    if (lower === "dofoozbz") return "Dofoozbz";
    if (lower === "dom de pin" || lower === "dom_de_pin") return "Dom_De_Pin";

    // Retire tous les accents (ex. Ébène -> Ebene, Argenté -> Argente, Émeraude -> Emeraude)
    const deaccented = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return deaccented.replace(/\s+/g, "_");
}

/**
 * Renvoie le chemin d'asset LOCAL d'un Dofus, ou `null` si ce Dofus n'a pas
 * d'icône locale connue (ex. Dofus custom créé via l'admin).
 */
export function resolveDofusLocalImage(name: string): string | null {
    const norm = normalizeDofusName(name);
    return LOCAL_DOFUS_IMAGE[norm.toLocaleLowerCase()] ?? null;
}

/**
 * URL d'icône à servir au client.
 *
 * - `dofoozbz` : toujours l'asset local (cas historique #206, icône dofusdb KO).
 * - Dofus canonique avec asset local connu (`name` ou `slug` fourni) → chemin local,
 *   quelle que soit la valeur d'`imageUrl` en base (dofusdb) : on ne dépend plus du CDN externe.
 * - Dofus inconnu / custom → retombe sur l'`imageUrl` (ou `null`).
 *
 * @param slug     Slug du Dofus (ex. `emeraude`, `dofoozbz`).
 * @param imageUrl URL d'icône stockée en base (souvent `dofusdb.fr`).
 * @param name     Nom du Dofus (`nameShort`) pour un mapping fiable (ex. « Émeraude »).
 */
export function resolveDofusImageUrl(
    slug: string | null | undefined,
    imageUrl: string | null | undefined,
    name?: string | null | undefined,
): string | null {
    if (slug === "dofoozbz") {
        return "/module-dofus/Dofus_Dofoozbz.png";
    }
    const sourceName = (name ?? slug ?? "").trim();
    if (sourceName) {
        const local = resolveDofusLocalImage(sourceName);
        if (local) return local;
    }
    return imageUrl ?? null;
}

/** Types d'assets servis par le proxy interne (`/api/assets-dofus/[type]/[id]`). */
export type DofusAssetType = "spells" | "items" | "monsters";

/**
 * Hôtes acceptés pour le paramètre `?url=` du proxy (allowlist SSRF du route handler).
 * Une URL d'un autre hôte n'est PAS transmise : le proxy retombe alors sur son schéma
 * `/{type}/{id}.png` — on ne sert jamais un `?url=` qui serait rejeté.
 */
const PROXY_UPSTREAM_HOSTS = new Set(["api.dofusdb.fr"]);

/** `/img/{type}/{id|sort_id}.png` → `{ type, id }` (id = id d'icône DofusDB). */
function parseDofusDbImageUrl(rawUrl: string): { type: DofusAssetType; id: string } | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "dofusdb.fr" && !host.endsWith(".dofusdb.fr")) return null;

    const match = url.pathname.match(/^\/img\/(spells|items|monsters)\/(?:sort_)?(\d+)\.(?:png|webp|jpg)$/i);
    if (!match) return null;
    return { type: match[1].toLowerCase() as DofusAssetType, id: match[2] };
}

/** `?url=` (encodé) quand l'URL amont est acceptée par le proxy, sinon chaîne vide. */
function upstreamQuery(rawUrl?: string | null): string {
    if (!rawUrl) return "";
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        if (!PROXY_UPSTREAM_HOSTS.has(host)) return "";
    } catch {
        return "";
    }
    return `?url=${encodeURIComponent(rawUrl)}`;
}

/**
 * URL **interne** d'une icône d'asset DofusDB : `/api/assets-dofus/{type}/{id}`.
 *
 * Le serveur sert alors le WebP siphonné (`public/uploads/assets-dofus/{type}/{id}.webp`,
 * cache 1 an), ou le télécharge une seule fois à la volée — **aucun appel navigateur
 * → DofusDB**. `id` est prioritaire (c'est la clé du cache disque, ex. l'id du sort) ;
 * à défaut, l'id est extrait de l'URL amont (`…/img/spells/sort_12160.png` → `12160`).
 *
 * @returns `null` quand aucun id exploitable : l'appelant garde alors SON repli
 *          (jamais de hotlink DofusDB servi depuis notre code).
 */
export function resolveDofusAssetImageUrl(
    type: DofusAssetType,
    id?: number | string | null,
    upstreamUrl?: string | null,
): string | null {
    const fromUrl = upstreamUrl ? parseDofusDbImageUrl(upstreamUrl) : null;
    const rawId = id != null && String(id).trim() !== "" ? String(id).trim() : fromUrl?.id ?? "";
    if (!rawId || !/^[\w-]+$/.test(rawId)) return null;

    return `/api/assets-dofus/${type}/${encodeURIComponent(rawId)}${upstreamQuery(upstreamUrl)}`;
}

/**
 * Réécrit une URL **absolue** DofusDB (`https://api.dofusdb.fr/img/spells/sort_12160.png`,
 * items, monstres) en URL interne. `null` quand l'URL n'est pas une icône DofusDB
 * reconnaissable (l'appelant garde la sienne : asset local, URL déjà interne…).
 */
export function internalDofusDbImageUrl(upstreamUrl?: string | null): string | null {
    const parsed = upstreamUrl ? parseDofusDbImageUrl(upstreamUrl) : null;
    return parsed ? resolveDofusAssetImageUrl(parsed.type, parsed.id, upstreamUrl) : null;
}

/**
 * Module « Marché » — **tags de forum Discord** (D20 / S3.13, §9.4).
 *
 * Objectif : permettre aux membres de **filtrer** les annonces depuis Discord
 * (par famille et par statut) sans ouvrir le site.
 *
 * Règles actées (D20, §9.4) — le module ne fait **que** consommer des tags
 * **déjà existants** :
 *   · source = `available_tags` du salon forum (l'admin les crée côté Discord) ;
 *   · **aucun tag n'est créé automatiquement** ;
 *   · mapping `GuildConfig.marketForumTags` : `clé (type|statut) → id de tag` ;
 *   · **maximum 5 tags par sujet** (limite Discord) ;
 *   · salon **textuel** ⇒ aucun tag (la notion n'existe pas) ;
 *   · mapping vide / salon sans tag ⇒ publication **normale**, sans erreur.
 *
 * ⚠️ Fichier **pur** (aucune I/O, aucun import serveur) : partagé entre l'UI
 * (sélecteurs alimentés par `available_tags`), le moteur Discord et les tests.
 */

/** Clés acceptées dans `marketForumTags` (union fermée : rien d'autre n'est écrit). */
export const MARKET_FORUM_TAG_KEYS = [
    "EQUIPMENT",
    "RESOURCE",
    "ACTIVE",
    "RESERVED",
    "SOLD",
    "EXPIRED",
    "WITHDRAWN",
] as const;

export type MarketForumTagKey = (typeof MARKET_FORUM_TAG_KEYS)[number];

/** Clés de **famille** (type d'annonce) : posées une fois, à la création du sujet. */
export const MARKET_FORUM_TYPE_TAG_KEYS: MarketForumTagKey[] = ["EQUIPMENT", "RESOURCE"];

/** Clés de **statut** : retirées/posées à chaque transition (§9.4). */
export const MARKET_FORUM_STATUS_TAG_KEYS: MarketForumTagKey[] = [
    "ACTIVE",
    "RESERVED",
    "SOLD",
    "EXPIRED",
    "WITHDRAWN",
];

/** Libellés FR affichés dans les sélecteurs (jamais la clé brute). */
export const MARKET_FORUM_TAG_LABELS: Record<MarketForumTagKey, string> = {
    EQUIPMENT: "Équipement (famille)",
    RESOURCE: "Ressources (famille)",
    ACTIVE: "Disponible (statut)",
    RESERVED: "Réservé (statut)",
    SOLD: "Vendu (statut)",
    EXPIRED: "Expiré (statut)",
    WITHDRAWN: "Retiré (statut)",
};

/** Limite Discord : au plus 5 tags appliqués par sujet. */
export const MARKET_FORUM_TAGS_MAX = 5;

/** Longueur maximale d'un id de tag Discord (borne de validation, jamais de valeur libre). */
const TAG_ID_MAX_LENGTH = 32;

/** Mapping normalisé : uniquement des clés connues → id de tag borné. */
export type MarketForumTagMap = Partial<Record<MarketForumTagKey, string>>;

/** `true` si la chaîne est une clé de mapping connue. */
export function isMarketForumTagKey(value: string): value is MarketForumTagKey {
    return (MARKET_FORUM_TAG_KEYS as readonly string[]).includes(value);
}

/**
 * Normalise un Json Prisma (ou une saisie d'UI) en mapping exploitable :
 * clés connues uniquement, ids non vides et bornés, doublons d'id supprimés.
 * Une valeur inexploitable est **ignorée** (jamais d'exception).
 */
export function normalizeMarketForumTags(value: unknown): MarketForumTagMap {
    const out: MarketForumTagMap = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;

    const usedTagIds = new Set<string>();
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
        if (!isMarketForumTagKey(rawKey)) continue;
        if (typeof rawValue !== "string") continue;

        const tagId = rawValue.trim().slice(0, TAG_ID_MAX_LENGTH);
        if (tagId.length === 0 || usedTagIds.has(tagId)) continue;

        usedTagIds.add(tagId);
        out[rawKey] = tagId;
    }
    return out;
}

/**
 * Ne garde que les tags **réellement présents** dans le salon
 * (`available_tags`) : un id inventé par le client est **écarté** (fail-closed).
 */
export function restrictMarketForumTags(value: unknown, allowedTagIds: string[]): MarketForumTagMap {
    const allowed = new Set(allowedTagIds.filter((id) => typeof id === "string" && id.length > 0));
    const normalized = normalizeMarketForumTags(value);

    const out: MarketForumTagMap = {};
    for (const [key, tagId] of Object.entries(normalized) as [MarketForumTagKey, string][]) {
        if (allowed.has(tagId)) out[key] = tagId;
    }
    return out;
}

/**
 * Tags à appliquer à un sujet pour un état donné : **famille** (type) puis
 * **statut**, dédoublonnés, bornés à `MARKET_FORUM_TAGS_MAX`. Renvoie `[]`
 * quand le mapping ne couvre pas cet état (publication normale, sans tag).
 */
export function resolveMarketForumTags(
    value: unknown,
    listing: { type: string; status: string }
): string[] {
    const mapping = normalizeMarketForumTags(value);
    const typeKey = listing.type as MarketForumTagKey;
    const statusKey = listing.status as MarketForumTagKey;

    const candidates: (string | undefined)[] = [];
    if (isMarketForumTagKey(typeKey) && MARKET_FORUM_TYPE_TAG_KEYS.includes(typeKey)) {
        candidates.push(mapping[typeKey]);
    }
    if (isMarketForumTagKey(statusKey) && MARKET_FORUM_STATUS_TAG_KEYS.includes(statusKey)) {
        candidates.push(mapping[statusKey]);
    }

    const unique: string[] = [];
    for (const candidate of candidates) {
        if (!candidate || unique.includes(candidate)) continue;
        unique.push(candidate);
        if (unique.length >= MARKET_FORUM_TAGS_MAX) break;
    }
    return unique;
}

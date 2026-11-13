/**
 * Module « Services » — mapping des **tags de forum** Discord (25/10/2026).
 *
 * Objectif : les membres filtrent les **annonces de service** directement dans le
 * forum, par catégorie (`PASSAGE_DONJON`, `FORGEMAGIE`, `METIER`…), sans ouvrir le site.
 *
 * Règles (même modèle que le Marché, D20/§9.4) :
 *   · source = `available_tags` du salon **forum** (les tags sont créés côté Discord
 *     par un admin) ;
 *   · **aucun tag n'est créé automatiquement** par SigilOS ;
 *   · mapping `GuildConfig.servicesForumTags` : `ServiceCategory → id de tag` ;
 *   · limite Discord : **au plus 5 tags** appliqués par sujet ;
 *   · salon textuel ou mapping vide ⇒ publication **normale**, sans erreur.
 *
 * ⚠️ Fichier **pur** (aucune I/O, aucun import serveur) : partagé par l'UI
 * (sélecteurs alimentés par `available_tags`), le moteur Discord et les tests.
 */

/** Clés acceptées : exactement l'enum `ServiceCategory` (union fermée). */
export const SERVICE_FORUM_TAG_KEYS = [
    "PASSAGE_DONJON",
    "FORGEMAGIE",
    "METIER",
    "QUETE",
    "OCRE",
    "TUTORAT",
    "AUTRE",
] as const;

export type ServiceForumTagKey = (typeof SERVICE_FORUM_TAG_KEYS)[number];

/** Libellés FR affichés dans les sélecteurs (jamais la clé brute). */
export const SERVICE_FORUM_TAG_LABELS: Record<ServiceForumTagKey, string> = {
    PASSAGE_DONJON: "Passage de donjon",
    FORGEMAGIE: "Forgemagie",
    METIER: "Métier / artisanat",
    QUETE: "Quête",
    OCRE: "Ocre",
    TUTORAT: "Tutorat",
    AUTRE: "Autre",
};

/** Limite Discord : au plus 5 tags appliqués par sujet. */
export const SERVICE_FORUM_TAGS_MAX = 5;

/** Longueur maximale d'un id de tag Discord (borne de validation, jamais de valeur libre). */
const TAG_ID_MAX_LENGTH = 32;

/** Mapping normalisé : uniquement des clés connues → id de tag borné. */
export type ServiceForumTagMap = Partial<Record<ServiceForumTagKey, string>>;

/** `true` si la chaîne est une catégorie de service connue. */
export function isServiceForumTagKey(value: string): value is ServiceForumTagKey {
    return (SERVICE_FORUM_TAG_KEYS as readonly string[]).includes(value);
}

/**
 * Normalise un Json Prisma (ou une saisie d'UI) en mapping exploitable : clés
 * connues uniquement, ids non vides et bornés, doublons d'id supprimés. Une
 * valeur inexploitable est **ignorée** (jamais d'exception).
 */
export function normalizeServiceForumTags(value: unknown): ServiceForumTagMap {
    const out: ServiceForumTagMap = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;

    const usedTagIds = new Set<string>();
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
        if (!isServiceForumTagKey(rawKey)) continue;
        if (typeof rawValue !== "string") continue;

        const tagId = rawValue.trim().slice(0, TAG_ID_MAX_LENGTH);
        if (tagId.length === 0 || usedTagIds.has(tagId)) continue;

        usedTagIds.add(tagId);
        out[rawKey] = tagId;
    }
    return out;
}

/**
 * Ne garde que les tags **réellement présents** dans le salon (`available_tags`) :
 * un id inventé par le client est **écarté** (fail-closed).
 */
export function restrictServiceForumTags(value: unknown, allowedTagIds: string[]): ServiceForumTagMap {
    const allowed = new Set(allowedTagIds.filter((id) => typeof id === "string" && id.length > 0));
    const normalized = normalizeServiceForumTags(value);

    const out: ServiceForumTagMap = {};
    for (const [key, tagId] of Object.entries(normalized) as [ServiceForumTagKey, string][]) {
        if (allowed.has(tagId)) out[key] = tagId;
    }
    return out;
}

/**
 * Tags à appliquer au sujet d'une annonce selon sa catégorie. Renvoie `[]` quand
 * le mapping ne couvre pas cette catégorie (publication normale, sans tag).
 */
export function resolveServiceForumTags(value: unknown, category: string): string[] {
    const mapping = normalizeServiceForumTags(value);
    if (!isServiceForumTagKey(category)) return [];
    const tagId = mapping[category];
    return tagId ? [tagId] : [];
}

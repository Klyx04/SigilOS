/**
 * « Stand-by » d'un groupe — module **pur** (aucun import serveur, importable par un
 * composant client).
 *
 * Demande user (30/10/2026) : « un bouton stand-by pour mettre en pause un post
 * donjon/quête/songes → cron rappel pas déclenché + message affiché dans l'embed et le
 * post Discord ». Contrat tranché le 30/10/2026 :
 *
 *  - la pause suspend le **rappel H-1**, les **relances d'inactivité** (J+7 / J+15 / J+20)
 *    et la **clôture automatique** (J+21, +48 h pour un raid) ;
 *  - les **inscriptions restent ouvertes** : le statut du post ne change pas (aucune valeur
 *    d'enum ajoutée, donc aucune garde existante à rouvrir) ;
 *  - la levée est **manuelle**, par le **créateur** ou un **administrateur** (avec motif) ;
 *  - un `standBy` **illisible** ne produit **jamais** de ping : on préfère le silence à une
 *    notification qu'on croyait suspendue (fail-closed, même doctrine que `h1-reminder`).
 *
 * Le stockage est **une** colonne `standBy Json?` sur `DjSearchPost`, `DreamRun` et
 * `GuildEvent` (migration additive `20270122000000_group_standby`). Une seule fonction
 * écrit la valeur (`buildStandBy`), une seule la relit (`readStandBy`) : aucune autre
 * forme n'est acceptée, et tout ce qui n'est pas reconnu est ignoré — jamais recopié.
 */

/** Longueur maximale du pseudo **figé** au moment de la pause. */
export const STAND_BY_MAX_NAME = 64;
/** Longueur maximale d'un identifiant interne (`User.id`, cuid). */
export const STAND_BY_MAX_USER_ID = 40;
/** Motif de refus compté par les crons quand un groupe est en pause. */
export const STAND_BY_SKIP_REASON = "stand-by";

/** Pause **relue** (jamais une valeur brute venue de Discord ou d'un client). */
export type StandByState = {
    /** Horodatage ISO de la mise en pause. */
    at: string;
    /** `User.id` de l'auteur de la pause — jamais un snowflake Discord. */
    userId: string;
    /** Pseudo **figé** à la pause : le profil peut être anonymisé ensuite. */
    name: string;
};

/** Caractères de contrôle (dont les retours ligne) : jamais dans un embed ni dans un nom. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
/**
 * Même classe **sans `g`** pour les tests d'appartenance : un `RegExp` global garde
 * `lastIndex` entre deux `.test()` — un identifiant invalide pouvait passer au 2ᵉ appel.
 */
const HAS_CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

/**
 * Texte borné : espaces compactés, caractères de contrôle retirés, longueur plafonnée.
 * `null` si le résultat est vide — on n'écrit pas une chaîne vide en base.
 */
function cleanText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const flat = value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
    if (!flat) return null;
    return flat.slice(0, max);
}

/** Identifiant interne acceptable (`User.id`) : borné, sans espace ni caractère de contrôle. */
function cleanUserId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > STAND_BY_MAX_USER_ID) return null;
    if (/\s/.test(trimmed) || HAS_CONTROL_CHAR.test(trimmed)) return null;
    return trimmed;
}

/** Date ISO exploitable, sinon `null` (valeur absente ou corrompue). */
function toIso(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value !== "string" || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Valeur **à écrire** en base. `null` si l'auteur est inexploitable : l'appelant refuse
 * alors la pause (jamais une pause « anonyme » écrite par erreur).
 */
export function buildStandBy(input: {
    /** Instant de la pause (défaut côté appelant : `new Date()`). */
    at: Date | string;
    /** `User.id` de l'auteur (créateur ou admin). */
    userId: string;
    /** Pseudo affiché ; repli assumé par l'appelant s'il est vide. */
    name: string | null | undefined;
}): StandByState | null {
    const at = toIso(input.at);
    const userId = cleanUserId(input.userId);
    if (!at || !userId) return null;
    return {
        at,
        userId,
        name: cleanText(input.name, STAND_BY_MAX_NAME) ?? "un membre",
    };
}

/**
 * Pause **relue** : forme stricte, sinon `null`. Ne lève jamais — une valeur corrompue en
 * base ne doit pas casser un cron ni une page.
 */
export function readStandBy(raw: unknown): StandByState | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const at = toIso(record.at);
    const userId = cleanUserId(record.userId);
    const name = cleanText(record.name, STAND_BY_MAX_NAME);
    if (!at || !userId || !name) return null;
    return { at, userId, name };
}

/**
 * Le groupe est-il en pause ? **Fail-closed** : toute valeur non nulle compte comme une
 * pause, même illisible — c'est ce qui garantit qu'un `standBy` corrompu n'envoie pas de
 * ping que le créateur croyait suspendu. Seul `null` / `undefined` (colonne SQL NULL)
 * signifie « actif ».
 */
export function isStandByActive(raw: unknown): boolean {
    return raw !== null && raw !== undefined;
}

/** Auteur affichable ; `null` si la valeur est illisible (l'UI choisit son repli). */
export function standByAuthorName(raw: unknown): string | null {
    return readStandBy(raw)?.name ?? null;
}

/** Instant de la pause (`Date`), `null` si illisible. */
export function standBySince(raw: unknown): Date | null {
    const state = readStandBy(raw);
    if (!state) return null;
    const date = new Date(state.at);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Ligne d'embed Discord : « ⏸️ Mis en stand-by par **X** · il y a 2 heures ».
 * `null` si le groupe n'est pas en pause.
 *
 * Une valeur illisible affiche « auteur inconnu » et **aucune** date : on ne fabrique pas
 * un horodatage, et on ne laisse pas croire que la pause est levée.
 */
export function standByEmbedLine(raw: unknown): string | null {
    if (!isStandByActive(raw)) return null;
    const state = readStandBy(raw);
    if (!state) return "⏸️ **Mis en stand-by** — auteur inconnu";
    const startTs = Math.floor(new Date(state.at).getTime() / 1000);
    return `⏸️ **Mis en stand-by par ${state.name}** · <t:${startTs}:R>`;
}

/**
 * Libellé de bouton (l'état est calculé au rendu, jamais figé dans l'embed) :
 * « Reprendre » quand le groupe est en pause, « Stand-by » sinon.
 */
export function standByButtonLabel(raw: unknown): string {
    return isStandByActive(raw) ? "Reprendre" : "Stand-by";
}

/** Qui peut poser / lever une pause : le créateur du groupe, ou un administrateur. */
export function canToggleStandBy(input: { isCreator: boolean; isAdmin: boolean }): boolean {
    return Boolean(input.isCreator || input.isAdmin);
}

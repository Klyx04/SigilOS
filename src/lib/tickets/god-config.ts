/**
 * 🎫 God — configuration **dédiée** du module support.
 *
 * Règle pure, sans I/O : c'est la **seule** lecture des réglages God
 * (`GodTicketConfig`, `GodTicketCategory`). Le panneau (`/god/ticket-bot`) écrit,
 * le runtime Discord lit à travers ce fichier — jamais de constante de libellé
 * ou de couleur dans les actions.
 *
 * Défauts = comportement historique du 14/11/2026 :
 * - quatre catégories (Accès, Bug, Idée, Autre) ;
 * - fil nommé `🎫-{num}-{author}` ;
 * - le créateur peut fermer (`STAFF_OR_CREATOR`) et le fil est archivé ;
 * - aucune demande de satisfaction.
 *
 * Aucune ligne en base ⇒ ces défauts, sans erreur. Une valeur hors bornes est
 * ignorée, jamais propagée (fail-closed).
 */

/** Identifiant de guilde/rôle : snowflake Discord (17 à 20 chiffres). */
const SNOWFLAKE = /^\d{17,20}$/;

export const GOD_TICKET_DEFAULT_NAMING_PATTERN = "🎫-{num}-{author}";
export const GOD_TICKET_MAX_THREAD_NAME = 100;
export const GOD_TICKET_CATEGORY_KEY_PATTERN = /^[a-z0-9-]{2,40}$/;
export const GOD_TICKET_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const GOD_TICKET_DEFAULT_COLOR = "#6366f1";

export const GOD_TICKET_CLOSE_POLICIES = ["STAFF_ONLY", "STAFF_OR_CREATOR"] as const;
export type GodTicketClosePolicy = (typeof GOD_TICKET_CLOSE_POLICIES)[number];
export const GOD_TICKET_DEFAULT_CLOSE_POLICY: GodTicketClosePolicy = "STAFF_OR_CREATOR";

export const GOD_TICKET_LEGACY_CATEGORIES = [
    "ACCESS_REQUEST",
    "BUG_REPORT",
    "FEATURE_REQUEST",
    "OTHER",
] as const;
export type GodTicketLegacyCategory = (typeof GOD_TICKET_LEGACY_CATEGORIES)[number];

export type GodTicketCategoryRow = {
    id: string;
    key: string;
    label: string;
    emoji: string;
    color: string;
    legacyCategory: string | null;
    order: number;
    isEnabled: boolean;
};

export type GodTicketConfigRow = {
    supportGuildId?: string | null;
    supportChannelId?: string | null;
    staffRoleIds?: readonly string[] | null;
    notifyRoleIds?: readonly string[] | null;
    namingPattern?: string | null;
    closePolicy?: string | null;
    archiveOnClose?: boolean | null;
    csatEnabled?: boolean | null;
};

export type GodTicketConfigView = {
    supportGuildId: string | null;
    supportChannelId: string | null;
    staffRoleIds: string[];
    notifyRoleIds: string[];
    namingPattern: string;
    closePolicy: GodTicketClosePolicy;
    archiveOnClose: boolean;
    csatEnabled: boolean;
};

/**
 * Les quatre catégories historiques, reprises telles quelles par la migration
 * `20270204000000_god_ticket_config`. Elles servent de repli quand la table est
 * vide (base neuve, lecture avant seed) — jamais de panneau sans catégorie.
 */
export const GOD_TICKET_DEFAULT_CATEGORIES: readonly GodTicketCategoryRow[] = [
    {
        id: "default:acces",
        key: "acces",
        label: "Demande d'accès",
        emoji: "🔑",
        color: "#10b981",
        legacyCategory: "ACCESS_REQUEST",
        order: 0,
        isEnabled: true,
    },
    {
        id: "default:bug",
        key: "bug",
        label: "Signaler un bug",
        emoji: "🐛",
        color: "#ef4444",
        legacyCategory: "BUG_REPORT",
        order: 10,
        isEnabled: true,
    },
    {
        id: "default:idee",
        key: "idee",
        label: "Proposer une idée",
        emoji: "💡",
        color: "#8b5cf6",
        legacyCategory: "FEATURE_REQUEST",
        order: 20,
        isEnabled: true,
    },
    {
        id: "default:autre",
        key: "autre",
        label: "Autre demande",
        emoji: "📩",
        color: "#6366f1",
        legacyCategory: "OTHER",
        order: 30,
        isEnabled: true,
    },
];

function isSnowflake(value: string | null | undefined): value is string {
    return typeof value === "string" && SNOWFLAKE.test(value);
}

function sanitizeRoleIds(values: readonly string[] | null | undefined): string[] {
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        if (!isSnowflake(value) || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }
    return result;
}

function sanitizePattern(value: string | null | undefined): string {
    const pattern = typeof value === "string" ? value.trim() : "";
    return (pattern || GOD_TICKET_DEFAULT_NAMING_PATTERN).slice(0, GOD_TICKET_MAX_THREAD_NAME);
}

/**
 * Applique les défauts et les bornes à une ligne `GodTicketConfig`.
 *
 * `legacy` porte l'ancien réglage `PlatformConfig.ticketSupportGuildId` : il
 * n'est lu **que** si la nouvelle configuration ne fournit pas de serveur, ce
 * qui permet de retirer l'ancien champ du panneau sans perdre la valeur.
 */
export function resolveGodTicketConfig(
    row: GodTicketConfigRow | null | undefined,
    legacy?: { supportGuildId?: string | null }
): GodTicketConfigView {
    const staffRoleIds = sanitizeRoleIds(row?.staffRoleIds);
    const notifyRoleIds = sanitizeRoleIds(row?.notifyRoleIds);
    const policy = row?.closePolicy;

    return {
        supportGuildId:
            (isSnowflake(row?.supportGuildId) ? row?.supportGuildId ?? null : null) ??
            (isSnowflake(legacy?.supportGuildId) ? legacy?.supportGuildId ?? null : null),
        supportChannelId: isSnowflake(row?.supportChannelId) ? row.supportChannelId : null,
        staffRoleIds,
        notifyRoleIds: notifyRoleIds.length > 0 ? notifyRoleIds : staffRoleIds,
        namingPattern: sanitizePattern(row?.namingPattern),
        closePolicy: GOD_TICKET_CLOSE_POLICIES.includes(policy as GodTicketClosePolicy)
            ? (policy as GodTicketClosePolicy)
            : GOD_TICKET_DEFAULT_CLOSE_POLICY,
        archiveOnClose: typeof row?.archiveOnClose === "boolean" ? row.archiveOnClose : true,
        csatEnabled: typeof row?.csatEnabled === "boolean" ? row.csatEnabled : false,
    };
}

/**
 * Normalise et ordonne les catégories. Table vide ⇒ les quatre catégories
 * historiques. Les libellés/couleurs sont bornés à la lecture pour qu'une ligne
 * abîmée ne casse jamais le panneau Discord.
 */
export function resolveGodTicketCategories(
    rows: readonly GodTicketCategoryRow[] | null | undefined
): GodTicketCategoryRow[] {
    const source = Array.isArray(rows) && rows.length > 0 ? rows : GOD_TICKET_DEFAULT_CATEGORIES;
    return source
        .map((row) => ({
            id: row.id,
            key: row.key,
            label: row.label.trim().slice(0, 80),
            emoji: row.emoji.trim().slice(0, 8) || "🎫",
            color: GOD_TICKET_COLOR_PATTERN.test(row.color) ? row.color : GOD_TICKET_DEFAULT_COLOR,
            legacyCategory: GOD_TICKET_LEGACY_CATEGORIES.includes(
                row.legacyCategory as GodTicketLegacyCategory
            )
                ? row.legacyCategory
                : null,
            order: Number.isFinite(row.order) ? row.order : 0,
            isEnabled: row.isEnabled,
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"));
}

export function resolveEnabledGodTicketCategories(
    rows: readonly GodTicketCategoryRow[] | null | undefined
): GodTicketCategoryRow[] {
    return resolveGodTicketCategories(rows).filter((category) => category.isEnabled);
}

/**
 * Retrouve une catégorie **active** par sa clé stable. Toute clé inconnue ou
 * désactivée renvoie `null` : le runtime refuse alors le ticket (fail-closed).
 */
export function resolveGodTicketCategory(
    key: string | null | undefined,
    categories: readonly GodTicketCategoryRow[]
): GodTicketCategoryRow | null {
    if (!key) return null;
    return categories.find((category) => category.key === key && category.isEnabled) ?? null;
}

/**
 * Construit le nom du fil Discord. Les jetons `{num}` et `{author}` sont
 * remplacés, les sauts de ligne et espaces multiples sont aplatis, le résultat
 * est borné à 100 caractères. Nom vide ⇒ `ticket-<n>`.
 */
export function buildSupportThreadName(
    pattern: string | null | undefined,
    input: { num: number; author: string }
): string {
    const raw = sanitizePattern(pattern)
        .replaceAll("{num}", String(input.num))
        .replaceAll("{author}", input.author || "membre")
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const name = raw || `ticket-${input.num}`;
    let clamped = "";
    for (const char of name) {
        if (clamped.length + char.length > GOD_TICKET_MAX_THREAD_NAME) break;
        clamped += char;
    }
    return clamped.trim();
}

/** Type historique porté par `SupportTicket.category` (jamais vide). */
export function toLegacyTicketCategory(category: GodTicketCategoryRow): GodTicketLegacyCategory {
    return GOD_TICKET_LEGACY_CATEGORIES.includes(category.legacyCategory as GodTicketLegacyCategory)
        ? (category.legacyCategory as GodTicketLegacyCategory)
        : "OTHER";
}

/** Couleur d'embed Discord : entier 24 bits, repli sur l'indigo historique. */
export function categoryColorToInt(color: string | null | undefined): number {
    if (!color || !GOD_TICKET_COLOR_PATTERN.test(color)) return 0x6366f1;
    return Number.parseInt(color.slice(1), 16);
}

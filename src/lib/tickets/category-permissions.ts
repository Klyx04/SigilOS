/**
 * 🎫 Tickets — **permissions par motif sans migration** (pur : aucun I/O).
 *
 * Constat : `TicketBotCategory` n'a ni politique de fermeture ni confirmation,
 * et `AGENTS.md` impose de ne pas migrer sans décision. On stocke donc les
 * réglages dans `TicketGuildConfig.settingsJson` (colonne JSON existante) :
 *
 * ```json
 * {
 *   "allowUserClose": true,
 *   "requireCloseConfirm": true,
 *   "blacklistRoleIds": ["123"],
 *   "categories": { "<categoryId>": { "closePolicy": "STAFF_ONLY", "requireConfirm": true } }
 * }
 * ```
 *
 * Règles :
 *   · défaut global : le demandeur **peut** fermer, confirmation **exigée** ;
 *   · surcharge par motif (le motif décide, le global est le repli) ;
 *   · `STAFF_ONLY` = seule l'équipe ferme ; `STAFF_OR_CREATOR` = le demandeur aussi ;
 *   · blacklist = rôles qui ne peuvent **ni ouvrir ni agir** (fail-closed : inconnu = autorisé,
 *     c'est l'action qui vérifie, jamais l'ouverture seule).
 */

export const TICKET_CLOSE_POLICIES = ["STAFF_ONLY", "STAFF_OR_CREATOR"] as const;
export type TicketCategoryClosePolicy = (typeof TICKET_CLOSE_POLICIES)[number];

export type TicketCategoryPermissionOverride = {
    closePolicy?: TicketCategoryClosePolicy;
    requireConfirm?: boolean;
    /** Rôles invités du motif (observateurs) : overwrites « additional » de la matrice. */
    additionalRoleIds?: string[];
};

export type TicketGuildPermissionSettings = {
    allowUserClose: boolean;
    requireCloseConfirm: boolean;
    blacklistRoleIds: string[];
    categories: Record<string, TicketCategoryPermissionOverride>;
};

const DEFAULT_SETTINGS: TicketGuildPermissionSettings = {
    allowUserClose: true,
    requireCloseConfirm: true,
    blacklistRoleIds: [],
    categories: {},
};

function isSnowflake(value: unknown): value is string {
    return typeof value === "string" && /^\d{5,}$/.test(value);
}

/** Lit `settingsJson` **sans jamais jeter** (JSON invalide = défauts). */
export function readTicketPermissionSettings(raw: unknown): TicketGuildPermissionSettings {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_SETTINGS, categories: {} };
    const input = raw as Record<string, unknown>;
    const categories: Record<string, TicketCategoryPermissionOverride> = {};
    const rawCategories = input.categories;
    if (rawCategories && typeof rawCategories === "object" && !Array.isArray(rawCategories)) {
        for (const [categoryId, override] of Object.entries(rawCategories as Record<string, unknown>)) {
            if (!override || typeof override !== "object") continue;
            const entry = override as Record<string, unknown>;
            const clean: TicketCategoryPermissionOverride = {};
            if (entry.closePolicy === "STAFF_ONLY" || entry.closePolicy === "STAFF_OR_CREATOR") {
                clean.closePolicy = entry.closePolicy;
            }
            if (typeof entry.requireConfirm === "boolean") clean.requireConfirm = entry.requireConfirm;
            if (Array.isArray(entry.additionalRoleIds)) {
                const roles = (entry.additionalRoleIds as unknown[]).filter(isSnowflake).slice(0, 25);
                if (roles.length > 0) clean.additionalRoleIds = roles;
            }
            if (
                clean.closePolicy !== undefined ||
                clean.requireConfirm !== undefined ||
                clean.additionalRoleIds !== undefined
            ) {
                categories[String(categoryId).slice(0, 40)] = clean;
            }
        }
    }
    const blacklist = Array.isArray(input.blacklistRoleIds)
        ? (input.blacklistRoleIds as unknown[]).filter(isSnowflake).slice(0, 25)
        : [];
    return {
        allowUserClose: input.allowUserClose === false ? false : true,
        requireCloseConfirm: input.requireConfirm === false || input.requireCloseConfirm === false ? false : true,
        blacklistRoleIds: blacklist,
        categories,
    };
}

/** Politique de fermeture effective d'un motif (surcharge > global > défaut). */
export function resolveCategoryClosePolicy(
    settings: TicketGuildPermissionSettings,
    categoryId: string | null | undefined
): TicketCategoryClosePolicy {
    const override = categoryId ? settings.categories[categoryId]?.closePolicy : undefined;
    if (override) return override;
    return settings.allowUserClose ? "STAFF_OR_CREATOR" : "STAFF_ONLY";
}

/** Confirmation de fermeture exigée pour ce motif (surcharge > global). */
export function requireCloseConfirm(
    settings: TicketGuildPermissionSettings,
    categoryId: string | null | undefined
): boolean {
    const override = categoryId ? settings.categories[categoryId]?.requireConfirm : undefined;
    if (override !== undefined) return override;
    return settings.requireCloseConfirm;
}

/** `true` = acteur blacklisté (aucun de ses rôles ne doit être blacklisté sinon). */
export function isBlacklisted(
    settings: TicketGuildPermissionSettings,
    actorRoleIds: string[]
): boolean {
    if (settings.blacklistRoleIds.length === 0) return false;
    const blocked = new Set(settings.blacklistRoleIds);
    return actorRoleIds.some((roleId) => blocked.has(roleId));
}

/** Fusionne un réglage dans `settingsJson` (ce que le dashboard enregistre). */
export function writeTicketPermissionSettings(
    current: unknown,
    patch: Partial<{
        allowUserClose: boolean;
        requireCloseConfirm: boolean;
        blacklistRoleIds: string[];
        category: { id: string; override: TicketCategoryPermissionOverride };
    }>
): Record<string, unknown> {
    const base = (current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : {}) as Record<string, unknown>;
    if (patch.allowUserClose !== undefined) base.allowUserClose = patch.allowUserClose;
    if (patch.requireCloseConfirm !== undefined) base.requireCloseConfirm = patch.requireCloseConfirm;
    if (patch.blacklistRoleIds !== undefined) {
        base.blacklistRoleIds = patch.blacklistRoleIds.filter(isSnowflake).slice(0, 25);
    }
    if (patch.category) {
        const categories =
            base.categories && typeof base.categories === "object" && !Array.isArray(base.categories)
                ? { ...(base.categories as Record<string, unknown>) }
                : {};
        categories[patch.category.id.slice(0, 40)] = { ...patch.category.override };
        base.categories = categories;
    }
    return base;
}

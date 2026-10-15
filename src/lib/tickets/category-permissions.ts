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
    /** Message d'accueil personnalisé dans le salon ticket (markdown, mentions autorisées). */
    welcomeMessage?: string;
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
            if (typeof entry.welcomeMessage === "string" && entry.welcomeMessage.trim()) {
                clean.welcomeMessage = entry.welcomeMessage.trim().slice(0, 2000);
            }
            if (
                clean.closePolicy !== undefined ||
                clean.requireConfirm !== undefined ||
                clean.additionalRoleIds !== undefined ||
                clean.welcomeMessage !== undefined
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

/**
 * 📩 **Messagerie des avis + langue du serveur** (sans migration, même tiroir
 * `settingsJson`) : où part l'enquête de satisfaction (`DM` = message privé,
 * `TICKET` = boutons dans le salon fermé non supprimé) et dans quelle langue
 * le bot parle sur Discord (`fr` / `en`, jamais les deux à la fois).
 */
export const TICKET_CSAT_DESTINATIONS = ["DM", "TICKET"] as const;
export type TicketCsatDestination = (typeof TICKET_CSAT_DESTINATIONS)[number];

export type TicketMessagingSettings = {
    csatDestination: TicketCsatDestination;
    ticketLanguage: "fr" | "en";
};

/** Valeurs sûres : en privé, en français (le créateur vote même salon fermé). */
export function readTicketMessagingSettings(raw: unknown): TicketMessagingSettings {
    const input =
        raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};
    return {
        csatDestination: input.csatDestination === "TICKET" ? "TICKET" : "DM",
        ticketLanguage: input.ticketLanguage === "en" ? "en" : "fr",
    };
}

/** Fusionne un réglage dans `settingsJson` (ce que le dashboard enregistre). */
export function writeTicketPermissionSettings(
    current: unknown,
    patch: Partial<{
        allowUserClose: boolean;
        requireCloseConfirm: boolean;
        blacklistRoleIds: string[];
        category: { id: string; override: TicketCategoryPermissionOverride };
        csatDestination: TicketCsatDestination;
        ticketLanguage: "fr" | "en";
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
    if (patch.csatDestination === "DM" || patch.csatDestination === "TICKET") {
        base.csatDestination = patch.csatDestination;
    }
    if (patch.ticketLanguage === "fr" || patch.ticketLanguage === "en") {
        base.ticketLanguage = patch.ticketLanguage;
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

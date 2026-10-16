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

import {
    resolveTicketButton,
    ticketButtonLayout,
    type ResolvedTicketButton,
    type TicketButtonKey,
    type TicketButtonSettings,
} from "./button-config";
import type { TicketLang } from "./ticket-texts";

export const TICKET_CLOSE_POLICIES = ["STAFF_ONLY", "STAFF_OR_CREATOR"] as const;
export type TicketCategoryClosePolicy = (typeof TICKET_CLOSE_POLICIES)[number];

/**
 * 🆕 **Boutons surchargés par motif** (one-shot R2, sans migration : même tiroir
 * `settingsJson.categories[<motif>]`). Seuls deux réglages sont surchargeables :
 * `disabled` (retire le bouton de CE salon) et `label` (renomme pour CE salon).
 * Tout le reste (emoji, couleur, droit) hérite du réglage global de
 * `Configuration` (`settingsJson.buttons`) — une seule source par niveau.
 */
export type TicketMotifButtonOverride = {
    disabled?: boolean;
    label?: string;
};

export type TicketMotifButtonOverrides = Partial<
    Record<"claim" | "close" | "reopen" | "transcript" | "delete", TicketMotifButtonOverride>
>;

export type TicketCategoryPermissionOverride = {
    closePolicy?: TicketCategoryClosePolicy;
    requireConfirm?: boolean;
    /** Rôles invités du motif (observateurs) : overwrites « additional » de la matrice. */
    additionalRoleIds?: string[];
    /** Message d'accueil personnalisé dans le salon ticket (markdown, mentions autorisées). */
    welcomeMessage?: string;
    /**
     * 🆕 **Qui peut ouvrir** ce motif (RBAC). Liste **vide = tout membre** non blacklisté
     * (comportement historique) ; non vide = seuls ces rôles (le staff/admin passe toujours).
     */
    allowedRoleIds?: string[];
    /**
     * 🆕 **Prévenir l'équipe** à l'ouverture (interrupteur explicite). `false` = aucun ping,
     * même si des rôles sont configurés — avant, « pas de ping » se disait seulement par
     * une liste vide, ce qui n'était pas un choix lisible.
     */
    notifyEnabled?: boolean;
    /** 🆕 Message personnalisé envoyé **avec le ping des rôles** (`{membre}`, `{motif}`, `{numero}`). */
    notifyMessage?: string;
    /** 🆕 Message personnalisé envoyé **au demandeur** à l'ouverture (`{membre}` = sa mention). */
    creatorMessage?: string;
    /**
     * 🆕 **Boutons de CE motif** (surcharge du global). Absent ou vide = héritage
     * total du réglage `Configuration` ; une entrée `{ disabled: true }` retire le
     * bouton de ce salon, `{ label }` le renomme pour ce salon.
     */
    buttons?: TicketMotifButtonOverrides;
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

/** Boutons surchargeables par motif (mêmes 5 clés que le réglage global). */
const MOTIF_BUTTON_KEYS = ["claim", "close", "reopen", "transcript", "delete"] as const;

function isSnowflake(value: unknown): value is string {
    return typeof value === "string" && /^\d{5,}$/.test(value);
}

/** Lit la surcharge de boutons d'un motif **sans jamais jeter** (illisible = héritage). */
export function readTicketMotifButtons(raw: unknown): TicketMotifButtonOverrides {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const input = raw as Record<string, unknown>;
    const clean: TicketMotifButtonOverrides = {};
    for (const key of MOTIF_BUTTON_KEYS) {
        const entry = input[key];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const candidate = entry as Record<string, unknown>;
        const override: TicketMotifButtonOverride = {};
        if (candidate.disabled === true) override.disabled = true;
        if (typeof candidate.label === "string" && candidate.label.trim()) {
            override.label = candidate.label.trim().slice(0, 80);
        }
        if (override.disabled !== undefined || override.label !== undefined) clean[key] = override;
    }
    return clean;
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
            // 🆕 Qui peut ouvrir (RBAC) + notification explicite + messages personnalisés.
            if (Array.isArray(entry.allowedRoleIds)) {
                const roles = (entry.allowedRoleIds as unknown[]).filter(isSnowflake).slice(0, 25);
                // Une liste vide **signifie** « tout le monde » : on la garde pour rester
                // fidèle au choix de l'admin (et non pour retomber dans l'ambiguïté).
                clean.allowedRoleIds = roles;
            }
            if (typeof entry.notifyEnabled === "boolean") clean.notifyEnabled = entry.notifyEnabled;
            if (typeof entry.notifyMessage === "string" && entry.notifyMessage.trim()) {
                clean.notifyMessage = entry.notifyMessage.trim().slice(0, 900);
            }
            if (typeof entry.creatorMessage === "string" && entry.creatorMessage.trim()) {
                clean.creatorMessage = entry.creatorMessage.trim().slice(0, 900);
            }
            // 🆕 Surcharge de boutons du motif (héritage du global sinon).
            if (entry.buttons && typeof entry.buttons === "object" && !Array.isArray(entry.buttons)) {
                const motifButtons = readTicketMotifButtons(entry.buttons);
                if (Object.keys(motifButtons).length > 0) clean.buttons = motifButtons;
            }
            if (
                clean.closePolicy !== undefined ||
                clean.requireConfirm !== undefined ||
                clean.additionalRoleIds !== undefined ||
                clean.welcomeMessage !== undefined ||
                clean.allowedRoleIds !== undefined ||
                clean.notifyEnabled !== undefined ||
                clean.notifyMessage !== undefined ||
                clean.creatorMessage !== undefined ||
                clean.buttons !== undefined
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
 * 🆕 **Qui peut ouvrir ce motif ?** (RBAC demandé le 16/10/2026).
 *   · liste **vide ou absente** ⇒ tout membre non blacklisté (comportement historique : on
 *     n'invente jamais une restriction que l'admin n'a pas posée) ;
 *   · liste non vide ⇒ il faut **au moins un** de ces rôles Discord ;
 *   · administrateur/propriétaire Discord ⇒ passe toujours (jamais enfermé dehors).
 * La blacklist est vérifiée **avant** par l'appelant (`isBlacklisted`).
 */
export function isTicketOpenAllowedByRoles(input: {
    settings: TicketGuildPermissionSettings;
    /** Clé du motif (`journeyId` en v2, `categoryId` en v1). */
    motifKey?: string | null;
    actorRoleIds: string[];
    actorIsAdmin?: boolean;
}): boolean {
    if (input.actorIsAdmin) return true;
    const allowed =
        (input.motifKey ? input.settings.categories[input.motifKey]?.allowedRoleIds : undefined) ?? [];
    if (allowed.length === 0) return true;
    return input.actorRoleIds.some((roleId) => allowed.includes(roleId));
}

/**
 * 🆕 L'équipe est-elle prévenue à l'ouverture ? Interrupteur **explicite** : avant, « pas de
 * ping » se disait uniquement par une liste de rôles vide, ce qui n'était pas lisible.
 * Défaut : oui (le comportement d'aujourd'hui).
 */
export function isTicketNotifyEnabled(
    settings: TicketGuildPermissionSettings,
    motifKey?: string | null
): boolean {
    return (motifKey ? settings.categories[motifKey]?.notifyEnabled : undefined) !== false;
}

/** 🆕 Messages personnalisés d'un motif (ping de l'équipe / message au demandeur). */
export function readTicketMotifMessages(
    settings: TicketGuildPermissionSettings,
    motifKey?: string | null
): { notifyMessage: string | null; creatorMessage: string | null } {
    const override = motifKey ? settings.categories[motifKey] : undefined;
    return {
        notifyMessage: override?.notifyMessage ?? null,
        creatorMessage: override?.creatorMessage ?? null,
    };
}

/**
 * 🆕 **Bouton résolu pour UN motif** : surcharge du motif, sinon réglage global,
 * sinon défaut restrictif. `disabled` (motif ou global) retire le bouton.
 */
export function resolveTicketButtonForMotif(
    key: TicketButtonKey,
    motifButtons: TicketMotifButtonOverrides | null | undefined,
    globalSettings: TicketButtonSettings | null | undefined,
    lang: TicketLang = "fr"
): ResolvedTicketButton {
    const base = resolveTicketButton(key, globalSettings, lang);
    const override = motifButtons?.[key];
    if (!override) return base;
    if (override.disabled === true) return { ...base, access: "disabled" };
    if (override.label) return { ...base, label: override.label.slice(0, 80) };
    return base;
}

/**
 * 🆕 **Barre de boutons d'un motif** : même ordre et mêmes états que le global
 * (ouvert → Prendre en charge + Fermer ; fermé → Rouvrir + Transcript + Supprimer),
 * avec la surcharge du motif appliquée bouton par bouton.
 */
export function ticketButtonLayoutForMotif(
    status: string,
    motifButtons: TicketMotifButtonOverrides | null | undefined,
    globalSettings: TicketButtonSettings | null | undefined,
    lang: TicketLang = "fr"
): ResolvedTicketButton[] {
    return ticketButtonLayout(status, globalSettings, lang).map((button) => {
        const override = motifButtons?.[button.key];
        if (!override) return button;
        if (override.disabled === true) return null;
        if (override.label) return { ...button, label: override.label.slice(0, 80) };
        return button;
    }).filter((button): button is ResolvedTicketButton => button !== null);
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

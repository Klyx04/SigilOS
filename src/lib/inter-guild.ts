// ============================================================================
// Chantier Inter-Guilde (19/08) — types & logique partagée (client + serveur).
// Ce fichier n'a PAS de "use server" : importable des deux côtés.
//
// Sémantique fail-closed :
//  - `interGuildEnabled` (guilde) ET `interGuildGlobalEnabled` (God) doivent être true
//    pour que l'inter-guilde soit effective → effectif = guilde ET God.
//  - Le scope effectif d'un module = le PLUS RESTRICTIF entre le défaut/override guilde
//    et l'override God. Un override God "OFF" coupe le module partout.
// ============================================================================

export type InterGuildScope = "OFF" | "SERVER" | "GLOBAL";

export const INTER_GUILD_SCOPE_RANK: Record<InterGuildScope, number> = {
    // OFF (0) = fermé · SERVER (1) = même serveur Dofus · GLOBAL (2) = toutes guildes
    "OFF": 0,
    "SERVER": 1,
    "GLOBAL": 2,
};

/** Ordre : plus grand = plus permissif. */
export function scopeRank(scope: InterGuildScope): number {
    return INTER_GUILD_SCOPE_RANK[scope] ?? 0;
}

/** Scope le plus restrictif des deux (fail-closed). */
export function restrictScope(a: InterGuildScope, b: InterGuildScope): InterGuildScope {
    return scopeRank(a) <= scopeRank(b) ? a : b;
}

/** Un scope est "ouvert" s'il n'est pas OFF. */
export function isScopeOpen(scope: InterGuildScope | null | undefined): boolean {
    return !!scope && scope !== "OFF";
}

/**
 * Modules éligibles à l'inter-guilde (ceux qui ont un sens cross-guilde).
 * Les modules absents (missions, ressources, sondages, worldmap, docs, roster,
 * stats, profile, logs, admin…) restent STRUCTURELLEMENT cloisonnés par guilde.
 */
export const INTER_GUILD_MODULES = [
    "welcome",
    "members",
    "gallery",
    "minigames",
    "calendar",
    "ladder",
    "ocre",
    "songes",
    "donjons",
    "services",
    "quests",
] as const;

export type InterGuildModuleKey = (typeof INTER_GUILD_MODULES)[number];

/**
 * Scopes par défaut (aucune surcharge guilde/God). Décision produit D-02 :
 *  - SERVER pour les modules de guilde (même serveur Dofus) ;
 *  - GLOBAL pour la galerie de stuffs et les mini-jeux ;
 *  - OFF n'apparaît pas ici : un module absent de la liste est cloisonné.
 */
export const INTER_GUILD_DEFAULTS: Record<InterGuildModuleKey, InterGuildScope> = {
    welcome: "SERVER",
    members: "SERVER",
    gallery: "GLOBAL",
    minigames: "GLOBAL",
    calendar: "SERVER",
    ladder: "SERVER",
    ocre: "SERVER",
    songes: "SERVER",
    donjons: "SERVER",
    services: "SERVER",
    quests: "SERVER",
};

/** Parse sûr d'un scope provenant d'un Json (fail-closed → OFF si invalide). */
export function parseScope(value: unknown): InterGuildScope {
    return value === "SERVER" || value === "GLOBAL" ? value : "OFF";
}

/**
 * Scope effectif d'un module pour une guilde, en combinant :
 *  - le choix de la guilde (`guildOverrides`, ex. `GuildConfig.interGuildModules`) ;
 *  - le plafond God (`godOverrides`, ex. `PlatformConfig.interGuildModules`).
 *
 * Sémantique (fail-closed) :
 *  - Niveau guilde = override valide sinon défaut du module (SERVER/GLOBAL) sinon OFF.
 *  - Plafond God = override valide sinon GLOBAL (aucune restriction). Le God ne PEUT JAMAIS élargir.
 *  - Effectif = le PLUS RESTRICTIF entre niveau guilde et plafond God.
 *  - Une valeur PRÉSENTE mais invalide → OFF (fail-closed : on n'expose pas un réglage douteux).
 */
export function resolveInterGuildScope(
    module: string,
    guildOverrides?: Record<string, unknown> | null,
    godOverrides?: Record<string, unknown> | null
): InterGuildScope {
    const def: InterGuildScope = (INTER_GUILD_DEFAULTS as Record<string, InterGuildScope>)[module] ?? "OFF";
    const guildVal = guildOverrides?.[module];
    const godVal = godOverrides?.[module];

    let guildLevel: InterGuildScope = def;
    if (guildVal === "OFF" || guildVal === "SERVER" || guildVal === "GLOBAL") {
        guildLevel = guildVal;
    } else if (guildVal !== undefined && guildVal !== null) {
        // Valeur présente mais invalide → fail-closed OFF.
        guildLevel = "OFF";
    }

    let godCeiling: InterGuildScope = "GLOBAL";
    if (godVal === "OFF" || godVal === "SERVER" || godVal === "GLOBAL") {
        godCeiling = godVal;
    } else if (godVal !== undefined && godVal !== null) {
        godCeiling = "OFF";
    }

    return restrictScope(guildLevel, godCeiling);
}

/** État admin (serveur) : liste des modules éligibles + scope effectif courant + défaut. */
export type InterGuildAdminModuleState = {
    module: InterGuildModuleKey;
    label: string;
    defaultScope: InterGuildScope;
    currentScope: InterGuildScope;
};

export type InterGuildAdminState = {
    enabled: boolean;
    godGlobalEnabled: boolean;
    peerCount: number;
    modules: InterGuildAdminModuleState[];
};

// Shared types and constants for the Guild Modules system.
// This file has NO "use server" — it's safe to import from both client and server.

export type ModuleKey =
    // Général
    | "presentation"
    | "roster"
    | "stats"
    | "calendar"
    // Fonctionnalités
    | "missions"
    | "songes"
    | "ocre"
    | "ladder"
    // Outils
    | "services"
    | "donjons"
    | "profile"
    | "docs"
    | "polls"
    // Planning
    | "availability"
    // Admin
    | "logs"
    | "admin"
    // Coming Soon
    | "quests"
    | "worldmap"
    | "resources"
    // Nouveau
    | "gallery"
    | "ladderSync"
    | "manualLadderSync"
    | "minigames";

export type GuildModulesState = {
    // Général
    presentation: boolean;
    roster: boolean;
    stats: boolean;
    calendar: boolean;
    // Fonctionnalités
    missions: boolean;
    songes: boolean;
    ocre: boolean;
    ladder: boolean;
    // Outils
    services: boolean;
    donjons: boolean;
    profile: boolean;
    docs: boolean;
    gallery: boolean;
    // Planning
    availability: boolean;
    // Admin
    logs: boolean;
    polls: boolean;
    admin: boolean;
    // Coming Soon
    quests: boolean;
    worldmap: boolean;
    resources: boolean;
    // Nouveau
    ladderSync: boolean;
    manualLadderSync: boolean;
    minigames: boolean;
};

/**
 * États par défaut d'une NOUVELLE guilde (aucune ligne GuildModules en BDD).
 * « Rien d'actif par défaut sauf ce qui est nécessaire à l'arrivée » :
 * seul `admin` reste actif pour que l'admin puisse se configurer (settings,
 * permissions, modules). Tous les autres modules sont inactifs — l'admin les
 * active explicitement via /admin/modules, guidé par le tour d'accueil.
 *
 * ⚠️ Ce fallback ne concerne QUE les guildes sans enregistrement GuildModules.
 * Les guildes existantes avec une ligne GuildModules en BDD ne sont PAS
 * impactées (module-actions.ts ne reporte sur DEFAULT_MODULES que les champs
 * explicitement à `null`).
 */
export const DEFAULT_MODULES: GuildModulesState = {
    presentation: false,
    roster: false,
    stats: false,
    calendar: false,
    missions: false,
    songes: false,
    ocre: false,
    ladder: false,
    services: false,
    donjons: false,
    profile: false,
    docs: false,
    gallery: false,
    availability: false,
    logs: false,
    polls: false,
    admin: true, // nécessaire à l'admin pour se configurer à l'arrivée
    quests: false,
    worldmap: false,
    resources: false,
    ladderSync: false,
    manualLadderSync: false,
    minigames: false,
};

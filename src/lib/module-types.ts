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
    // Admin
    | "logs"
    | "admin"
    // Coming Soon
    | "quests"
    | "worldmap"
    | "resources"
    // Nouveau
    | "chat"
    | "gartic";

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
    // Admin
    logs: boolean;
    polls: boolean;
    admin: boolean;
    // Coming Soon
    quests: boolean;
    worldmap: boolean;
    resources: boolean;
    // Nouveau
    chat: boolean;
    gartic: boolean;
};

export const DEFAULT_MODULES: GuildModulesState = {
    presentation: true,
    roster: true,
    stats: true,
    calendar: true,
    missions: true,
    songes: true,
    ocre: true,
    ladder: true,
    services: true,
    donjons: true,
    profile: true,
    docs: true,
    logs: false,
    polls: true,
    admin: true,
    quests: false,
    worldmap: false,
    resources: false,
    chat: false,
    gartic: false,
};

export const PERMISSIONS = {
    // Admin & Core
    ADMIN_ACCESS: "admin:access",
    DASHBOARD_VIEW: "dashboard:view",
    STATS_VIEW: "stats:view",

    // Members & Profiles
    PROFILE_VIEW: "profile:view",
    PROFILE_VIEW_ALL: "profile:view_all", // Full guild roster
    MEMBER_MANAGE: "admin:member_manage", // Lifecycle (Archive, Ban)

    // Missions & Bonus
    MISSIONS_VIEW: "missions:view",
    MISSIONS_CREATE: "missions:create",
    MISSIONS_VALIDATE: "missions:validate",
    BONUS_MANAGE: "missions:bonus_manage",

    // Game Features
    SONGES_VIEW: "songes:view",
    SONGES_CREATE: "songes:create",
    SONGES_JOIN: "songes:join",
    ARCHIS_VIEW: "archis:view",
    LADDER_VIEW: "ladder:view",
    FINDER_VIEW: "donjons:view",
    SERVICES_VIEW: "services:view",
    SERVICES_CREATE: "services:create",
    POLLS_VIEW: "polls:view",
    POLLS_MANAGE: "polls:manage",

    // Guild Info & Presentation
    PRESENTATION_VIEW: "presentation:view",
    PRESENTATION_EDIT: "presentation:edit",
    WELCOME_VIEW: "welcome:view",
    DOCS_VIEW: "docs:view",
    DOCS_VIEW_ADMIN: "docs:view_admin",

    // Coming Soon Modules
    QUESTS_VIEW: "quests:view",
    QUESTS_MANAGE: "quests:manage",
    WORLDMAP_VIEW: "worldmap:view",
    WORLDMAP_MANAGE: "worldmap:manage",
    RESOURCES_VIEW: "resources:view",
    RESOURCES_MANAGE: "resources:manage",

    // Calendar
    CALENDAR_VIEW: "calendar:view",
    CALENDAR_MANAGE: "calendar:manage",
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionModule = "admin" | "missions" | "profile" | "songes" | "features" | "tools" | "info" | "calendar";

export const PERMISSION_MODULES: Record<PermissionModule, { label: string; icon: string; color: string }> = {
    admin: { label: "Administration", icon: "🛡️", color: "#f59e0b" },
    missions: { label: "Missions", icon: "📜", color: "#3b82f6" },
    profile: { label: "Profils", icon: "👤", color: "#ec4899" },
    songes: { label: "Songes Infinis", icon: "🌙", color: "#8b5cf6" },
    features: { label: "Activités", icon: "🎮", color: "#10b981" },
    tools: { label: "Outils", icon: "🧩", color: "#06b6d4" },
    info: { label: "Information", icon: "📖", color: "#a855f7" },
    calendar: { label: "Calendrier", icon: "📅", color: "#10b981" },
};

export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string; module: PermissionModule }> = {
    // Core & Access (Grouped in Info/Tools depending on use)
    [PERMISSIONS.ADMIN_ACCESS]: { label: "Accès Admin Complet", description: "Accès total à l'administration.", module: "admin" },
    [PERMISSIONS.DASHBOARD_VIEW]: { label: "Voir Dashboard", description: "Accès à l'accueil du dashboard.", module: "info" },
    [PERMISSIONS.STATS_VIEW]: { label: "Voir Stats Guilde", description: "Accès aux statistiques globales.", module: "info" },

    // Profiles
    [PERMISSIONS.PROFILE_VIEW]: { label: "Voir Mon Profil", description: "S'autoriser à voir son propre profil.", module: "profile" },
    [PERMISSIONS.PROFILE_VIEW_ALL]: { label: "Voir l'Annuaire", description: "Consulter la liste des membres.", module: "profile" },
    [PERMISSIONS.MEMBER_MANAGE]: { label: "Gérer les Membres", description: "Archiver ou bannir des membres.", module: "admin" },

    // Missions
    [PERMISSIONS.MISSIONS_VIEW]: { label: "Voir les Missions", description: "Consulter les missions hebdo.", module: "missions" },
    [PERMISSIONS.MISSIONS_CREATE]: { label: "Gérer les Missions", description: "Créer et modifier les missions.", module: "missions" },
    [PERMISSIONS.MISSIONS_VALIDATE]: { label: "Valider Preuves", description: "Valider les screenshots soumis.", module: "missions" },
    [PERMISSIONS.BONUS_MANAGE]: { label: "Gérer les Bonus", description: "Acheter des bonus de guilde.", module: "missions" },

    // Game Features
    [PERMISSIONS.SONGES_VIEW]: { label: "Songes Infinis", description: "Accès au module Songes.", module: "songes" },
    [PERMISSIONS.SONGES_CREATE]: { label: "Créer Runs Songes", description: "Gérer ses propres runs.", module: "songes" },
    [PERMISSIONS.SONGES_JOIN]: { label: "Rejoindre Runs Songes", description: "Demander à rejoindre une run.", module: "songes" },
    [PERMISSIONS.ARCHIS_VIEW]: { label: "Bourse aux Archis", description: "Accès à l'échange d'archis.", module: "features" },
    [PERMISSIONS.LADDER_VIEW]: { label: "Classements", description: "Accès aux ladders de guilde.", module: "features" },
    [PERMISSIONS.FINDER_VIEW]: { label: "Donjons & Quêtes", description: "Accès au chercheur d'activités.", module: "tools" },
    [PERMISSIONS.SERVICES_VIEW]: { label: "Services Guilde", description: "Accès à la marketplace.", module: "tools" },
    [PERMISSIONS.SERVICES_CREATE]: { label: "Créer Services/Prêts/Coffre", description: "Publier des annonces, enregistrer des prêts et dépôts coffre.", module: "tools" },
    [PERMISSIONS.POLLS_VIEW]: { label: "Voir Sondages", description: "Consulter et voter aux sondages.", module: "tools" },
    [PERMISSIONS.POLLS_MANAGE]: { label: "Gérer Sondages", description: "Créer et modifier les sondages.", module: "admin" },

    // Guild Info
    [PERMISSIONS.PRESENTATION_VIEW]: { label: "Voir Présentation", description: "Accès à la page de guilde.", module: "info" },
    [PERMISSIONS.PRESENTATION_EDIT]: { label: "Éditer Présentation", description: "Modifier la page publique.", module: "admin" },
    [PERMISSIONS.WELCOME_VIEW]: { label: "Voir Bienvenue", description: "Accès au canal Bienvenue des nouveaux membres.", module: "info" },
    [PERMISSIONS.DOCS_VIEW]: { label: "Voir Documentation", description: "Accès au Wiki public.", module: "info" },
    [PERMISSIONS.DOCS_VIEW_ADMIN]: { label: "Voir Documentation Admin", description: "Accès au Wiki réservé.", module: "admin" },
    [PERMISSIONS.RESOURCES_VIEW]: { label: "Voir Ressources", description: "Accès au hub des ressources Dofus.", module: "info" },
    [PERMISSIONS.RESOURCES_MANAGE]: { label: "Gérer Ressources", description: "Gérer les ressources communautaires.", module: "admin" },

    // Coming Soon Modules (placed in tools for now)
    [PERMISSIONS.QUESTS_VIEW]: { label: "Voir Quêtes Dofus", description: "Suivre et trouver des partenaires de quêtes.", module: "tools" },
    [PERMISSIONS.QUESTS_MANAGE]: { label: "Gérer Quêtes Dofus", description: "Gérer les arbres de progression.", module: "admin" },
    [PERMISSIONS.WORLDMAP_VIEW]: { label: "Voir Carte & Mini-Jeux", description: "Accès à la carte du monde et jeux.", module: "tools" },
    [PERMISSIONS.WORLDMAP_MANAGE]: { label: "Gérer Carte & Mini-Jeux", description: "Gérer les marqueurs de la carte.", module: "admin" },

    // Calendar
    [PERMISSIONS.CALENDAR_VIEW]: { label: "Voir le Calendrier", description: "Consulter l'agenda.", module: "calendar" },
    [PERMISSIONS.CALENDAR_MANAGE]: { label: "Gérer le Calendrier", description: "Créer des événements.", module: "calendar" },
};

export const PERMISSION_LABELS: Record<PermissionId, string> =
    Object.fromEntries(
        Object.entries(PERMISSION_DETAILS).map(([k, v]) => [k, v.label])
    ) as Record<PermissionId, string>;

export function getPermissionsByModule(module: PermissionModule): PermissionId[] {
    return (Object.entries(PERMISSION_DETAILS) as [PermissionId, { module: PermissionModule }][])
        .filter(([, details]) => details.module === module)
        .map(([permId]) => permId);
}


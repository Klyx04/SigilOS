export const PERMISSIONS = {
    // ⬇️  ACCÈS PLATEFORME — PRIORITAIRE
    DASHBOARD_ACCESS: "dashboard:access",

    // Platform Access & Global Admin
    ADMIN_FULL: "admin:full",
    ADMIN_SETTINGS: "admin:settings",
    ADMIN_AUDIT: "admin:audit",

    // Core Dashboard Modules
    BIENVENUE_VIEW: "bienvenue:view",
    PRESENTATION_VIEW: "presentation:view",
    PRESENTATION_EDIT: "presentation:edit",
    RESOURCES_VIEW: "resources:view",
    STATS_VIEW: "stats:view",
    DOCS_VIEW: "docs:view",
    DOCS_VIEW_ADMIN: "docs:view_admin",

    // Members & Community
    MEMBER_VIEW_ALL: "profile:view_all", // Annuaire
    MEMBER_MANAGE: "admin:member_manage", // Includes Archives & Sync
    RELANCE_MANAGE: "admin:relance_manage", // Discord Reminders
    CALENDAR_VIEW: "calendar:view",
    CALENDAR_MANAGE: "calendar:manage",
    CHAT_VIEW: "chat:view",
    CHAT_MODERATE: "chat:moderate",
    POLLS_VIEW: "polls:view",

    // Missions & Progression
    MISSIONS_VIEW: "missions:view",
    MISSIONS_MANAGE: "missions:manage", // Config & Bonus
    MISSIONS_VALIDATE: "missions:validate", // Screen Proofs

    // Game Features
    SONGES_VIEW: "songes:view",
    SONGES_CREATE: "songes:create",
    SONGES_JOIN: "songes:join",
    OCRE_VIEW: "game:ocre_view",
    LADDER_VIEW: "game:ladder_view",
    QUESTS_VIEW: "game:quests_view",
    DJ_QUESTS_VIEW: "game:dj_quests_view",
    SERVICES_VIEW: "game:services_view",
    MINIGAMES_VIEW: "game:minigames_view",
    WORLDMAP_VIEW: "game:worldmap_view",
    MEMBER_VACATION_EDIT: "admin:member_vacation_edit",
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionModule = "access" | "admin" | "missions" | "profile" | "songes" | "game" | "community" | "info";

export const MODULE_ORDER: PermissionModule[] = ["access", "admin", "missions", "profile", "songes", "game", "community", "info"];

export const PERMISSION_MODULES: Record<PermissionModule, { label: string; icon: string; color: string }> = {
    access: { label: "Accès Dashboard", icon: "🚪", color: "#22c55e" },
    admin: { label: "Administration", icon: "🛡️", color: "#f59e0b" },
    missions: { label: "Missions", icon: "📜", color: "#3b82f6" },
    profile: { label: "Profils", icon: "👤", color: "#ec4899" },
    songes: { label: "Songes Infinis", icon: "🌙", color: "#8b5cf6" },
    game: { label: "Activités Dofus", icon: "🎮", color: "#10b981" },
    community: { label: "Communauté", icon: "🤝", color: "#6366f1" },
    info: { label: "Information", icon: "📖", color: "#a855f7" },
};

export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string; module: PermissionModule }> = {
    // Accès Dashboard (obligatoire)
    [PERMISSIONS.DASHBOARD_ACCESS]: { label: "🚪 Accès Dashboard", description: "Permet à ce rôle de se connecter et créer son compte sur le dashboard. OBLIGATOIRE pour tout accès.", module: "access" },

    // Admin
    [PERMISSIONS.ADMIN_FULL]: { label: "Administrateur Système", description: "Bypass total de toutes les restrictions.", module: "admin" },
    [PERMISSIONS.ADMIN_SETTINGS]: { label: "Configuration Serveur", description: "Gérer les modules et paramètres de base.", module: "admin" },
    [PERMISSIONS.ADMIN_AUDIT]: { label: "Audit Logs", description: "Voir l'historique des actions administratives.", module: "admin" },
    [PERMISSIONS.MEMBER_MANAGE]: { label: "Gestion des Membres", description: "Gérer le roster, les archives et la synchro.", module: "admin" },
    [PERMISSIONS.RELANCE_MANAGE]: { label: "Gérer les Relances", description: "Flicage bienveillant des inactifs sur Discord.", module: "admin" },
    [PERMISSIONS.STATS_VIEW]: { label: "Statistiques Guilde", description: "Accès aux graphiques d'activité.", module: "admin" },

    // Information
    [PERMISSIONS.BIENVENUE_VIEW]: { label: "Page Bienvenue", description: "Accès à l'onglet d'accueil.", module: "info" },
    [PERMISSIONS.PRESENTATION_VIEW]: { label: "Voir Présentation", description: "Consulter la page publique.", module: "info" },
    [PERMISSIONS.PRESENTATION_EDIT]: { label: "Éditer Présentation", description: "Modifier le contenu de la présentation.", module: "info" },
    [PERMISSIONS.RESOURCES_VIEW]: { label: "Page Ressources", description: "Accès aux guides et liens utiles.", module: "info" },
    [PERMISSIONS.DOCS_VIEW]: { label: "Wiki Guilde", description: "Accès à la documentation publique.", module: "info" },
    [PERMISSIONS.DOCS_VIEW_ADMIN]: { label: "Wiki Staff", description: "Accès à la documentation réservée aux officiers.", module: "admin" },

    // Community
    [PERMISSIONS.MEMBER_VIEW_ALL]: { label: "Consulter l'Annuaire", description: "Voir la liste complète des membres.", module: "profile" },
    [PERMISSIONS.CALENDAR_VIEW]: { label: "Voir l'Agenda", description: "Consulter les événements et sorties.", module: "community" },
    [PERMISSIONS.CALENDAR_MANAGE]: { label: "Gérer l'Agenda", description: "Créer et modifier des événements.", module: "community" },
    [PERMISSIONS.CHAT_VIEW]: { label: "Accès Live Chat", description: "Participer aux discussions en direct.", module: "community" },
    [PERMISSIONS.CHAT_MODERATE]: { label: "Modération Chat", description: "Nettoyer les messages ou muter des utilisateurs.", module: "admin" },
    [PERMISSIONS.POLLS_VIEW]: { label: "Voir les Sondages", description: "Accès à l'onglet des sondages de guilde.", module: "community" },

    // Missions
    [PERMISSIONS.MISSIONS_VIEW]: { label: "Voir Missions", description: "Consulter les missions de la semaine.", module: "missions" },
    [PERMISSIONS.MISSIONS_MANAGE]: { label: "Config Missions & Bonus", description: "Gérer les missions et la boutique bonus.", module: "missions" },
    [PERMISSIONS.MISSIONS_VALIDATE]: { label: "Validation Screens", description: "Approuver les preuves de réussite.", module: "missions" },

    // Game
    [PERMISSIONS.SONGES_VIEW]: { label: "Module Songes", description: "Accès au tracker de runs songes.", module: "songes" },
    [PERMISSIONS.SONGES_CREATE]: { label: "Créer une Run", description: "Annoncer ses propres runs.", module: "songes" },
    [PERMISSIONS.SONGES_JOIN]: { label: "Rejoindre une Run", description: "Candidater aux runs ouvertes.", module: "songes" },
    [PERMISSIONS.OCRE_VIEW]: { label: "Quête Ocre", description: "Accès au suivi de l'Éternelle Moisson.", module: "game" },
    [PERMISSIONS.LADDER_VIEW]: { label: "Classements", description: "Voir le ladder d'expérience guilde.", module: "game" },
    [PERMISSIONS.QUESTS_VIEW]: { label: "Quêtes Dofus", description: "Consulter les arbres de progression.", module: "game" },
    [PERMISSIONS.DJ_QUESTS_VIEW]: { label: "Donjons & Quêtes", description: "Accès au module DJ/Quêtes groupées.", module: "game" },
    [PERMISSIONS.SERVICES_VIEW]: { label: "Services Guilde", description: "Voir les services proposés par les membres.", module: "game" },
    [PERMISSIONS.MINIGAMES_VIEW]: { label: "Mini-jeux", description: "Accès aux jeux de guilde (Gartic, etc).", module: "game" },
    [PERMISSIONS.WORLDMAP_VIEW]: { label: "Carte Interactive", description: "Consulter la worldmap.", module: "game" },
    [PERMISSIONS.MEMBER_VACATION_EDIT]: { label: "Éditer Vacances", description: "Droit de modifier les dates de vacances des membres.", module: "admin" },
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

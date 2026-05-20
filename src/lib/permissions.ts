export const PERMISSIONS = {
    // ⬇️  ACCÈS PLATEFORME — PRIORITAIRE
    DASHBOARD_LOGIN: "dashboard:login",

    // System & Global Admin
    SYSTEM_GOD: "system:god",
    SYSTEM_CONFIG: "system:config",
    SYSTEM_RBAC: "system:rbac",

    // Staff & Supervision
    STAFF_MEMBER_MGMT: "staff:member_mgmt",
    STAFF_CONTENT: "staff:content",
    STAFF_AUDIT: "staff:audit",

    // Modules & Information
    PRESENTATION_VIEW: "presentation:view",

    // Community
    COMMUNITY_ACCESS: "community:access",
    COMMUNITY_MOD: "community:mod",

    // Missions
    MISSIONS_PLAY: "missions:play",
    MISSIONS_OFFICER: "missions:officer",

    // Game & Activities
    GAME_VIEW: "game:view",
    GAME_OPERATIONS: "game:operations",
    RAID_OFFICER: "game:raid_officer",
    RAID_MEMBER: "game:raid_member",
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionModule = "access" | "admin" | "missions" | "game" | "community" | "info";

export const MODULE_ORDER: PermissionModule[] = ["access", "admin", "missions", "game", "community", "info"];

export const PERMISSION_MODULES: Record<PermissionModule, { label: string; icon: string; color: string }> = {
    access: { label: "Accès & Identité", icon: "🚪", color: "#22c55e" },
    admin: { label: "Système & Staff", icon: "🛡️", color: "#f59e0b" },
    missions: { label: "Missions", icon: "📜", color: "#3b82f6" },
    community: { label: "Communauté", icon: "🤝", color: "#6366f1" },
    game: { label: "Activités Dofus", icon: "🎮", color: "#10b981" },
    info: { label: "Information", icon: "📖", color: "#a855f7" },
};

export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string; module: PermissionModule; modules: string[] }> = {
    // Access
    [PERMISSIONS.DASHBOARD_LOGIN]: { 
        label: "Accès Dashboard", 
        description: "Accès de base au Cockpit. Permet la connexion et la consultation des ressources fondamentales.", 
        module: "access",
        modules: ["Accueil", "Docs", "Wiki Membre", "Resources"]
    },
    
    // Info
    [PERMISSIONS.PRESENTATION_VIEW]: { 
        label: "Voir Présentation", 
        description: "Consulter la page de présentation, de recrutement et lire les objectifs de la guilde en jeu.", 
        module: "info",
        modules: ["Présentation", "Objectifs"]
    },

    // Admin
    [PERMISSIONS.STAFF_MEMBER_MGMT]: { 
        label: "Ressources Humaines", 
        description: "Gestion globale du Roster, synchronisation des données, archivage et relances d'inactivité.", 
        module: "admin",
        modules: ["Annuaire (Admin)", "Synchronisation", "Relances", "Vacances"]
    },
    [PERMISSIONS.STAFF_CONTENT]: { 
        label: "Communication Interne", 
        description: "Droit d'édition totale sur le contenu de la page de présentation et accès au Wiki Officier.", 
        module: "admin",
        modules: ["Édition Présentation", "Wiki Officier", "Admin Docs"]
    },
    [PERMISSIONS.STAFF_AUDIT]: { 
        label: "Supervision & Analytics", 
        description: "Accès aux Audit Logs détaillés et aux graphiques/statistiques avancées d'activité.", 
        module: "admin",
        modules: ["Audit Logs", "Statistiques"]
    },
    [PERMISSIONS.SYSTEM_CONFIG]: { 
        label: "Paramétrage Technique", 
        description: "Configuration des intégrations Discord (rôles/webhooks), Metamob, Dofus et modules.", 
        module: "admin",
        modules: ["Réglages", "Intégrations", "Webhooks", "Metamob"]
    },
    [PERMISSIONS.SYSTEM_RBAC]: { 
        label: "Gestion des Accès", 
        description: "Gérer le mapping des permissions pour les utilisateurs et attribuer des droits RBAC.", 
        module: "admin",
        modules: ["Matrice RBAC", "Permissions Individuelles"]
    },
    [PERMISSIONS.SYSTEM_GOD]: { 
        label: "Administrateur Suprême", 
        description: "Bypass absolu de sécurité. Autorisation inconditionnelle et totale sur toutes les fonctionnalités.", 
        module: "admin",
        modules: ["TOUS LES MODULES (Full Access)"]
    },

    // Community
    [PERMISSIONS.COMMUNITY_ACCESS]: { 
        label: "Participation Sociale", 
        description: "Accès sans restriction à l'Annuaire, au Calendrier de guilde et aux sondages actifs.", 
        module: "community",
        modules: ["Annuaire", "Calendrier", "Sondages"]
    },
    [PERMISSIONS.COMMUNITY_MOD]: { 
        label: "Modération & Animation", 
        description: "Droit de créer, de modifier et de supprimer des événements dans le calendrier de guilde.", 
        module: "community",
        modules: ["Gestion Calendrier"]
    },

    // Missions
    [PERMISSIONS.MISSIONS_PLAY]: { 
        label: "Joueur de Missions", 
        description: "Accès aux missions de la semaine, consultation des objectifs et progression.", 
        module: "missions",
        modules: ["Missions (Joueur)", "Progression"]
    },
    [PERMISSIONS.MISSIONS_OFFICER]: { 
        label: "Officier de Missions", 
        description: "Configuration des objectifs, création de missions, validation des preuves et boutique.", 
        module: "missions",
        modules: ["Gestion Missions", "Validation", "Boutique", "Bonus"]
    },

    // Game
    [PERMISSIONS.GAME_VIEW]: { 
        label: "Encyclopédie de Jeu", 
        description: "Accès global au tracker Ocre, ladders, quêtes, mini-jeux et carte interactive.", 
        module: "game",
        modules: ["Ocre", "Ladder", "Quêtes", "Worldmap", "Mini-Jeux", "Galerie Stuff"]
    },
    [PERMISSIONS.GAME_OPERATIONS]: { 
        label: "Organisation d'Activités", 
        description: "Organisation des runs de Songes, services VIP et gestion du module Donjons & Quêtes.", 
        module: "game",
        modules: ["Songes", "Services VIP", "Donjons & Quêtes (Finder)"]
    },
    [PERMISSIONS.RAID_OFFICER]: { 
        label: "Gestion des Raids", 
        description: "Autorisation de créer, modifier et clôturer des Raids Officiels 3.6.", 
        module: "game",
        modules: ["Création Raid", "Clôture Raid", "Gestion Points"]
    },
    [PERMISSIONS.RAID_MEMBER]: { 
        label: "Participation aux Raids", 
        description: "Autorisation de s'inscrire et de participer aux Raids Officiels (Dashboard & Discord).", 
        module: "game",
        modules: ["Inscription Raid", "Canaux Raid"]
    },
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

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

export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string; module: PermissionModule }> = {
    // Access
    [PERMISSIONS.DASHBOARD_LOGIN]: { label: "Accès Dashboard", description: "Accès de base au Cockpit. Permet la connexion, la consultation de l'accueil, des ressources publiques et du Wiki membre.", module: "access" },
    
    // Info
    [PERMISSIONS.PRESENTATION_VIEW]: { label: "Voir Présentation", description: "Consulter la page de présentation, de recrutement et lire les objectifs de la guilde en jeu.", module: "info" },

    // Admin
    [PERMISSIONS.STAFF_MEMBER_MGMT]: { label: "Ressources Humaines", description: "Gestion globale du Roster, synchronisation des données depuis DofusDB, archivage ciblé des membres, gestion des vacances et lancement des relances d'inactivité Discord.", module: "admin" },
    [PERMISSIONS.STAFF_CONTENT]: { label: "Communication Interne", description: "Droit d'édition totale sur le contenu de la page de présentation et permission d'accéder au Wiki Officier comportant les protocoles internes.", module: "admin" },
    [PERMISSIONS.STAFF_AUDIT]: { label: "Supervision & Analytics", description: "Accès aux Audit Logs détaillés (traçabilité parfaite des actions du staff) et aux graphiques/statistiques avancées d'activité de guilde.", module: "admin" },
    [PERMISSIONS.SYSTEM_CONFIG]: { label: "Paramétrage Technique", description: "Configuration des intégrations Discord (rôles/webhooks), Metamob, Dofus, des configurations de bienvenue et activation/désactivation des modules.", module: "admin" },
    [PERMISSIONS.SYSTEM_RBAC]: { label: "Gestion des Accès", description: "Gérer le mapping des permissions pour les utilisateurs et attribuer des droits RBAC. Réservé aux détenteurs de la permission Administrateur sur Discord.", module: "admin" },
    [PERMISSIONS.SYSTEM_GOD]: { label: "Administrateur Suprême", description: "Bypass absolu de sécurité. Autorisation inconditionnelle et totale sur toutes les fonctionnalités du système, aucune restriction de contexte.", module: "admin" },

    // Community
    [PERMISSIONS.COMMUNITY_ACCESS]: { label: "Participation Sociale", description: "Accès sans restriction à l'Annuaire, au Calendrier de guilde et consultation/droit de vote aux sondages actifs.", module: "community" },
    [PERMISSIONS.COMMUNITY_MOD]: { label: "Modération & Animation", description: "Droit de créer, de modifier et de supprimer des événements dans le calendrier de guilde, ainsi que d'orchestrer la communauté.", module: "community" },

    // Missions
    [PERMISSIONS.MISSIONS_PLAY]: { label: "Joueur de Missions", description: "Accès aux missions de la semaine, consultation des objectifs demandés et visualisation détaillée de sa progression et de ses gains en guildatons.", module: "missions" },
    [PERMISSIONS.MISSIONS_OFFICER]: { label: "Officier de Missions", description: "Droit de configurer les objectifs pour les mois, créer de nouvelles missions 100% personnalisées, valider les screens probatoires et paramétrer la boutique Guildatons.", module: "missions" },

    // Game
    [PERMISSIONS.GAME_VIEW]: { label: "Encyclopédie de Jeu", description: "Accès global pour la consultation du tracker Ocre, de tous les ladders XP/Guilde, des arbres complets de quêtes (Dofus), de la zone mini-jeux et à la carte interactive du Monde des Douze.", module: "game" },
    [PERMISSIONS.GAME_OPERATIONS]: { label: "Organisation d'Activités", description: "Organisation complète des runs de Songes (création/gestion/candidatures), accès VIP au marché des services entre membres et gestion du module Donjons & Quêtes groupées.", module: "game" },
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

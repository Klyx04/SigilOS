export const PERMISSIONS = {
    // Admin Core
    ADMIN_ACCESS: "admin:access", // Access to dashboard/admin

    // Missions
    MISSIONS_VIEW: "missions:view",
    MISSIONS_CREATE: "missions:create",
    MISSIONS_DELETE: "missions:delete",
    MISSIONS_VALIDATE: "missions:validate", // Validate submissions

    // User Profile
    PROFILE_VIEW_ALL: "profile:view_all", // See full guild roster
    PROFILE_UPDATE_SELF: "profile:update_self", // Edit own profile


    // Archimonstres / Quête Ocre
    ARCHIS_VIEW: "archis:view", // Accès à la Bourse aux Archis

    // Ladder / Classements
    LADDER_VIEW: "ladder:view", // Accès aux classements de guilde

    // Songes Infinis
    SONGES_VIEW: "songes:view", // Accès à la page Songes
    SONGES_CREATE: "songes:create", // Créer une run
    SONGES_JOIN: "songes:join", // Envoyer une demande pour rejoindre une run
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Module categories for filtering
export type PermissionModule = "admin" | "missions" | "profile" | "songes" | "modules";

export const PERMISSION_MODULES: Record<PermissionModule, { label: string; icon: string; color: string }> = {
    admin: { label: "Administration", icon: "🛡️", color: "#f59e0b" },
    missions: { label: "Missions", icon: "📜", color: "#3b82f6" },
    profile: { label: "Profils", icon: "👤", color: "#ec4899" },
    songes: { label: "Songes Infinis", icon: "🌙", color: "#8b5cf6" },
    modules: { label: "Autres Modules", icon: "🧩", color: "#10b981" },
};

// Rich metadata for UI with module categories
export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string; module: PermissionModule }> = {
    [PERMISSIONS.ADMIN_ACCESS]: {
        label: "Accès Admin",
        description: "Accès complet au tableau de bord d'administration et à la configuration.",
        module: "admin",
    },
    [PERMISSIONS.MISSIONS_VIEW]: {
        label: "Voir les Missions",
        description: "Permet de voir la liste des missions hebdomadaires.",
        module: "missions",
    },
    [PERMISSIONS.MISSIONS_CREATE]: {
        label: "Gérer les Missions",
        description: "Créer, modifier et supprimer des missions (Staff).",
        module: "missions",
    },
    [PERMISSIONS.MISSIONS_DELETE]: {
        label: "Supprimer Missions",
        description: "Droit spécifique de suppression (souvent réservé Admin).",
        module: "missions",
    },
    [PERMISSIONS.MISSIONS_VALIDATE]: {
        label: "Valider Preuves",
        description: "Accepter ou refuser les screenshots des membres.",
        module: "missions",
    },
    [PERMISSIONS.PROFILE_VIEW_ALL]: {
        label: "Voir l'Annuaire",
        description: "Consulter la liste de tous les membres de la guilde.",
        module: "profile",
    },
    [PERMISSIONS.PROFILE_UPDATE_SELF]: {
        label: "Modifier Profil",
        description: "Mettre à jour ses propres infos (Pseudo, Métiers...).",
        module: "profile",
    },

    [PERMISSIONS.ARCHIS_VIEW]: {
        label: "Bourse aux Archis",
        description: "Accès au module d'échange d'archimonstres (Quête Ocre).",
        module: "modules",
    },
    [PERMISSIONS.LADDER_VIEW]: {
        label: "Classements",
        description: "Accès aux ladders de guilde (Activité, Ancienneté, Succès).",
        module: "modules",
    },
    [PERMISSIONS.SONGES_VIEW]: {
        label: "Songes Infinis",
        description: "Accès à la page Songes Infinis et visualisation des runs.",
        module: "songes",
    },
    [PERMISSIONS.SONGES_CREATE]: {
        label: "Créer Runs Songes",
        description: "Créer et gérer ses propres runs Songes Infinis.",
        module: "songes",
    },
    [PERMISSIONS.SONGES_JOIN]: {
        label: "Rejoindre Runs Songes",
        description: "Envoyer des demandes pour rejoindre les runs d'autres joueurs.",
        module: "songes",
    },
};

// Deprecated but kept for compatibility if needed (mapped to new structure)
export const PERMISSION_LABELS: Record<PermissionId, string> =
    Object.fromEntries(
        Object.entries(PERMISSION_DETAILS).map(([k, v]) => [k, v.label])
    ) as Record<PermissionId, string>;

// Helper to get permissions by module
export function getPermissionsByModule(module: PermissionModule): PermissionId[] {
    return (Object.entries(PERMISSION_DETAILS) as [PermissionId, { module: PermissionModule }][])
        .filter(([, details]) => details.module === module)
        .map(([permId]) => permId);
}


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

    // Absence/Vacation
    ABSENCE_CONFIG: "absence:config", // Configure absence notification channel

    // Archimonstres / Quête Ocre
    ARCHIS_VIEW: "archis:view", // Accès à la Bourse aux Archis

    // Ladder / Classements
    LADDER_VIEW: "ladder:view", // Accès aux classements de guilde
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Rich metadata for UI
export const PERMISSION_DETAILS: Record<PermissionId, { label: string; description: string }> = {
    [PERMISSIONS.ADMIN_ACCESS]: {
        label: "Accès Admin",
        description: "Accès complet au tableau de bord d'administration et à la configuration.",
    },
    [PERMISSIONS.MISSIONS_VIEW]: {
        label: "Voir les Missions",
        description: "Permet de voir la liste des missions hebdomadaires.",
    },
    [PERMISSIONS.MISSIONS_CREATE]: {
        label: "Gérer les Missions",
        description: "Créer, modifier et supprimer des missions (Staff).",
    },
    [PERMISSIONS.MISSIONS_DELETE]: {
        label: "Supprimer Missions",
        description: "Droit spécifique de suppression (souvent réservé Admin).",
    },
    [PERMISSIONS.MISSIONS_VALIDATE]: {
        label: "Valider Preuves",
        description: "Accepter ou refuser les screenshots des membres.",
    },
    [PERMISSIONS.PROFILE_VIEW_ALL]: {
        label: "Voir l'Annuaire",
        description: "Consulter la liste de tous les membres de la guilde.",
    },
    [PERMISSIONS.PROFILE_UPDATE_SELF]: {
        label: "Modifier Profil",
        description: "Mettre à jour ses propres infos (Pseudo, Métiers...).",
    },
    [PERMISSIONS.ABSENCE_CONFIG]: {
        label: "Configurer Absences",
        description: "Configurer le salon Discord pour les notifications d'absence.",
    },
    [PERMISSIONS.ARCHIS_VIEW]: {
        label: "Bourse aux Archis",
        description: "Accès au module d'échange d'archimonstres (Quête Ocre).",
    },
    [PERMISSIONS.LADDER_VIEW]: {
        label: "Classements",
        description: "Accès aux ladders de guilde (Activité, Ancienneté, Succès).",
    },
};

// Deprecated but kept for compatibility if needed (mapped to new structure)
export const PERMISSION_LABELS: Record<PermissionId, string> =
    Object.fromEntries(
        Object.entries(PERMISSION_DETAILS).map(([k, v]) => [k, v.label])
    ) as Record<PermissionId, string>;

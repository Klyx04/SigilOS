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
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionId, string> = {
    [PERMISSIONS.ADMIN_ACCESS]: "Arranger le Dashboard",
    [PERMISSIONS.MISSIONS_VIEW]: "Voir les Missions",
    [PERMISSIONS.MISSIONS_CREATE]: "Créer/Modifier Missions",
    [PERMISSIONS.MISSIONS_DELETE]: "Supprimer Missions",
    [PERMISSIONS.MISSIONS_VALIDATE]: "Valider les Preuves",
    [PERMISSIONS.PROFILE_VIEW_ALL]: "Voir l'Annuaire",
    [PERMISSIONS.PROFILE_UPDATE_SELF]: "Modifier son Profil",
};

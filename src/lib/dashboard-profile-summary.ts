/**
 * Sélection Prisma de la synthèse d'accueil du dashboard (B-3, 21/11/2026).
 *
 * La page d'accueil n'utilise que ces **trois** champs. `getUserProfile` chargeait en
 * plus le compte, les skins, les rôles accordés, les services actifs et la candidature
 * en attente (4 lectures) pour un rendu qui n'en lit aucun. Cette constante est le
 * contrat de performance : l'élargir sans mesure re-crée les lectures supprimées.
 */
export const DASHBOARD_PROFILE_SUMMARY_SELECT = {
    hasSeenWelcome: true,
    availability: true,
    pseudoDofus: true,
} as const;

export type DashboardProfileSummary = {
    hasSeenWelcome: boolean;
    availability: unknown;
    pseudoDofus: string | null;
};

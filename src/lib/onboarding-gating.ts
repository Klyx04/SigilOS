/**
 * Helpers purs du funnel onboarding (landing → portail → invite bot → getting-started).
 *
 * Fichier sans "use server" : importable côté serveur ET testé en unitaire.
 * Toute règle métier testée ici DOIT rester synchronisée avec :
 * - `getUserContext` (src/server/actions/user-actions.ts)
 * - `getGettingStartedProgress` (src/server/actions/onboarding-actions.ts)
 */

export const DASHBOARD_LOGIN = "dashboard:login";

/** Rôle @everyone : son ID est toujours l'ID Discord de la guilde. */
export function isEveryoneRole(roleId: string, discordGuildId: string): boolean {
    return roleId === discordGuildId;
}

/**
 * RBAC configuré = au moins un rôle EXPLICITE (hors @everyone) porte
 * `dashboard:login`. Accorder `dashboard:login` à @everyone ouvrirait le
 * dashboard à tout le serveur sans contrôle → fail-closed, on l'ignore.
 */
export function isRbacConfigured(
    rolesMapping: Record<string, string[] | undefined | null> | null | undefined,
    everyoneId?: string,
): boolean {
    if (!rolesMapping || typeof rolesMapping !== "object") return false;
    return Object.entries(rolesMapping).some(([roleId, perms]) => {
        if (!Array.isArray(perms)) return false;
        if (!perms.includes(DASHBOARD_LOGIN)) return false;
        if (everyoneId && roleId === everyoneId) return false;
        return true;
    });
}

/** Onboarding complet = serveur de jeu + RBAC explicite (cohérent getting-started). */
export function isOnboardingComplete(
    rolesMapping: Record<string, string[] | undefined | null> | null | undefined,
    dofusServerId: string | number | null | undefined,
    discordGuildId?: string,
): boolean {
    return isRbacConfigured(rolesMapping, discordGuildId) && !!dofusServerId;
}

/** Icône Discord d'une guilde candidate du portail (format léger borné). */
export function buildPendingGuildIconUrl(guildId: string, iconHash: string | null): string | null {
    if (!guildId || !iconHash) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

export type GettingStartedStepLite = {
    id: string;
    status: "COMPLETED" | "IN_PROGRESS" | "TO_DO";
    mandatory: boolean;
    points: number;
};

/**
 * % affiché sur getting-started : tant que les OBLIGATOIRES ne sont pas
 * complètes, on progresse sur les obligatoires seules (0% anxiogène évité —
 * la 1re étape complétée affiche 50%, pas 20%). Ensuite, % global.
 */
export function getGettingStartedPercent(
    steps: GettingStartedStepLite[],
): { percent: number; mandatoryComplete: boolean; mandatoryPercent: number } {
    const mandatory = steps.filter((s) => s.mandatory);
    const mandatoryMax = mandatory.reduce((acc, s) => acc + s.points, 0);
    const mandatoryDone = mandatory
        .filter((s) => s.status === "COMPLETED")
        .reduce((acc, s) => acc + s.points, 0);
    const mandatoryComplete =
        mandatory.length > 0 && mandatory.every((s) => s.status === "COMPLETED");
    const totalMax = steps.reduce((acc, s) => acc + s.points, 0);
    const totalDone = steps
        .filter((s) => s.status === "COMPLETED")
        .reduce((acc, s) => acc + s.points, 0);
    const mandatoryPercent = mandatoryMax > 0 ? Math.round((mandatoryDone / mandatoryMax) * 100) : 100;
    const totalPercent = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0;
    return {
        percent: mandatoryComplete ? totalPercent : mandatoryPercent,
        mandatoryComplete,
        mandatoryPercent,
    };
}

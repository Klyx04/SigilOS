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

/**
 * Classification de l'échec de `GET /users/@me/guilds` pour le portail.
 * - SCOPE : 401/403 → le token n'a pas le scope `guilds` (autorisation
 *   ancienne, Discord ne redemande jamais seul). Seul un re-consentement
 *   explicite répare : ni F5 ni rechargement auto ne servent à rien.
 * - RATE_LIMIT : 429 → backoff + re-vérification plafonnée.
 * - TRANSIENT : le reste (500, réseau…) → réessai simple.
 */
export type GuildsFetchErrorKind = "SCOPE" | "RATE_LIMIT" | "TRANSIENT";

export function classifyGuildsFetchError(status: number): GuildsFetchErrorKind {
    if (status === 401 || status === 403) return "SCOPE";
    if (status === 429) return "RATE_LIMIT";
    return "TRANSIENT";
}

/**
 * Plafond anti-tempête de la re-vérification auto du portail.
 * Sans plafond, un échec permanent (scope manquant) + reload toutes les
 * 10 s = matraquage de l'API Discord jusqu'au 429, en boucle. Au-delà du
 * plafond, on affiche un état fixe + bouton manuel.
 */
export const MAX_PORTAL_AUTO_RELOAD = 6;

export function shouldAutoReloadPortal(args: {
    rateLimited: boolean;
    needsReconnect: boolean;
    attempts: number;
}): boolean {
    if (args.needsReconnect) return false;
    if (!args.rateLimited) return false;
    return args.attempts < MAX_PORTAL_AUTO_RELOAD;
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

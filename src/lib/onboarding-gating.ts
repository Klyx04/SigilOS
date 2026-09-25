/**
 * Helpers purs du funnel onboarding (landing → portail → invite bot → getting-started).
 *
 * Fichier sans "use server" : importable côté serveur ET testé en unitaire.
 * Toute règle métier testée ici DOIT rester synchronisée avec :
 * - `getUserContext` (src/server/actions/user-actions.ts)
 * - `getGettingStartedProgress` (src/server/actions/onboarding-actions.ts)
 */

import { DEFAULT_MODULES } from "@/lib/module-types";

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

/**
 * Verrou navigation pendant la mise en route : l'admin ne voit que le
 * Centre Admin (ni Dashboard, ni La guilde, ni Commandes…). God exempté.
 */
export function isNavLockedDuringOnboarding(args: {
    isOnboardingComplete: boolean;
    isSuperAdmin: boolean;
}): boolean {
    return !args.isOnboardingComplete && !args.isSuperAdmin;
}

/**
 * Parcours sans échappatoire : un admin en onboarding incomplet ne navigue
 * que dans `/dashboard/[guildId]/admin/*` (étapes obligatoires + modules).
 * Toute autre page du dashboard le renvoie vers la mise en route.
 */
export function isOnboardingAllowedPath(pathname: string, guildId: string): boolean {
    return pathname.startsWith(`/dashboard/${guildId}/admin`);
}

/**
 * ── ORIGINE d'une guilde (self-onboarding vs pré-approuvée) — SOURCE UNIQUE ──
 *
 * Audit du 24/09/2026 : **trois définitions concurrentes** de « guilde autonome »
 * coexistaient et se contredisaient :
 * 1. `onboardGuild` (`admin-actions.ts`) : `isAutonomous = !existingAllowed` ;
 * 2. la console God (`guild-table.tsx`) : `notes ~ /autonomie/i || tier === "COMMUNITY"` ;
 * 3. la notif God : déduite de (1).
 *
 * Conséquence mesurée : `GuildCreate` (le bot invité) crée la ligne avec
 * `tier: "BETA"` + `addedBy: "SYSTEM_GATEWAY"` **avant** que l'admin clique
 * « Déployer » ⇒ la ligne existe déjà ⇒ (1) annonçait « VIP / WHITELIST » pour un
 * self-onboarding, et (2) affichait « 👑 VIP Manuel » pour la même guilde.
 *
 * Vraie règle : une guilde est **autonome** quand AUCUNE validation humaine n'a
 * eu lieu — bot invité (`SYSTEM_GATEWAY`), ligne créée par `onboardGuild`
 * (`tier: "COMMUNITY"`), ou note historique « autonomie ». Tout le reste est
 * **pré-approuvé** : whitelist God (`tier: "BETA"`, `addedBy` = id du God) ou
 * ticket (`tier: "VIP"`).
 */

/** Valeur d'`AllowedGuild.addedBy` posée par le gateway Discord (aucun humain). */
export const SYSTEM_GATEWAY_ADDED_BY = "SYSTEM_GATEWAY";

export type OnboardingOriginKind = "AUTONOME" | "ACCOMPAGNEE";

export type AllowedGuildOriginInput = {
    tier?: string | null;
    notes?: string | null;
    addedBy?: string | null;
} | null | undefined;

export type OnboardingOrigin = {
    kind: OnboardingOriginKind;
    /** Libellé humain (badge console God, message de notif). */
    label: string;
    /** Badge court (console God). */
    badge: string;
    /** Tag court repris dans `metadata.type` des notifs/audits. */
    tag: "AUTONOME" | "VIP" | "WHITELIST";
};

/** Vrai si la guilde s'est déployée SANS validation humaine. */
export function isSelfOnboardedGuild(allowed: AllowedGuildOriginInput): boolean {
    // Aucune ligne = créée par `onboardGuild` (self-onboarding) : aucun humain n'a validé.
    if (!allowed) return true;
    if (allowed.addedBy === SYSTEM_GATEWAY_ADDED_BY) return true;
    if (allowed.tier === "COMMUNITY") return true;
    if (typeof allowed.notes === "string" && /autonomie/i.test(allowed.notes)) return true;
    return false;
}

export function resolveOnboardingOrigin(allowed: AllowedGuildOriginInput): OnboardingOrigin {
    if (isSelfOnboardedGuild(allowed)) {
        return {
            kind: "AUTONOME",
            label: "🚀 Autonome (aucune action requise)",
            badge: "🚀 Autonome",
            tag: "AUTONOME",
        };
    }
    if (allowed?.tier === "VIP") {
        return {
            kind: "ACCOMPAGNEE",
            label: "🧑‍🚀 Accompagnée (ticket)",
            badge: "🧑‍🚀 Ticket",
            tag: "VIP",
        };
    }
    return {
        kind: "ACCOMPAGNEE",
        label: "🛡️ Pré-approuvée par le staff",
        badge: "🛡️ Pré-approuvée",
        tag: "WHITELIST",
    };
}

/** Icône Discord d'une guilde candidate du portail (format léger borné). */
export function buildPendingGuildIconUrl(guildId: string, iconHash: string | null): string | null {
    if (!guildId || !iconHash) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

/**
 * Clés qui comptent comme « un module a été configuré ».
 *
 * Dérivées du **registre** (`DEFAULT_MODULES`) — jamais recopiées : la liste codée en dur qui vivait
 * dans le layout avait dérivé (14 clés du registre manquaient : `marche`, `commandes`, `tickets`,
 * `succes`, `minigames`, `logs`, `gallery`, `reactionRoles`, `worldmap`, `quests`, `resources`,
 * `ladderSync`, `manualLadderSync`, `availability`) et comptait `admin` — le panneau de
 * configuration, actif **par construction**, qui ne peut donc jamais valoir « un module choisi ».
 */
export const COUNTED_MODULE_KEYS: readonly string[] = Object.keys(DEFAULT_MODULES).filter(
    (key) => key !== "admin",
);

/**
 * Faut-il proposer les « prochaines étapes » (2ᵉ modale, une fois par navigateur) ?
 *
 * Règle corrigée le 22/09/2026 : la condition historique (`row` présente ET aucun module actif)
 * rendait la modale **inatteignable au moment prévu** — une guilde qui vient de terminer
 * l'onboarding n'a **aucune ligne `GuildModules`** (seul écrivain : `updateGuildModules`) ⇒ le
 * prompt ne s'affichait jamais le jour de l'activation. Désormais : aucune ligne = aucun choix
 * enregistré = modules non configurés ⇒ on propose les étapes optionnelles.
 */
export function shouldPromptOptionalNextSteps(
    modulesRow: Record<string, unknown> | null | undefined,
): boolean {
    if (!modulesRow) return true;
    return !COUNTED_MODULE_KEYS.some((key) => modulesRow[key] === true);
}

export type GettingStartedStepLite = {
    id: string;
    status: "COMPLETED" | "IN_PROGRESS" | "TO_DO";
    mandatory: boolean;
    points: number;
};

/** Nom du rôle d'accès que SigilOS crée quand la guilde n'a AUCUN rôle utilisable. */
export const DASHBOARD_ACCESS_ROLE_NAME = "Accès Dashboard";

export type DiscordRoleLite = { id: string; name: string; managed?: boolean };

/**
 * Normalise un nom de rôle Discord pour comparaison (accents, casse, espaces).
 * « Accès Dashboard », « acces dashboard » et « ACCÈS  DASHBOARD » = le même rôle :
 * l'admin doit le reconnaître, pas le chercher à l'œil.
 */
export function normalizeRoleName(name: string | null | undefined): string {
    return (name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        // Espaces multiples repliés : « ACCÈS  dashboard » (double espace, cas réel
        // d'un rôle renommé à la main) doit matcher « Accès Dashboard ».
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/**
 * Rôles réellement proposables à l'admin : ni `@everyone` (son id EST l'id de la
 * guilde), ni rôles managés (ceux des bots/intégrations — l'API refuse de les
 * piloter, et `completeMandatoryOnboarding` les rejette).
 */
export function pickAssignableRoles<T extends DiscordRoleLite>(
    roles: readonly T[] | null | undefined,
    discordGuildId: string,
): T[] {
    if (!Array.isArray(roles)) return [];
    return roles.filter((r) => !!r && !r.managed && r.id !== discordGuildId);
}

/**
 * Faut-il créer le rôle d'accès ? **Uniquement** quand la guilde n'a aucun rôle
 * utilisable (cas « @everyone seul » = cul-de-sac mesuré le 22/09 : liste vide,
 * « Valider » désactivé, modale non-fermable). Dès qu'un rôle existe, l'admin
 * choisit le sien : on ne pollue pas son serveur.
 */
export function shouldCreateDashboardAccessRole(
    roles: readonly DiscordRoleLite[] | null | undefined,
    discordGuildId: string,
): boolean {
    return pickAssignableRoles(roles, discordGuildId).length === 0;
}

/** Rôle à pré-sélectionner à l'étape 2 (celui créé par SigilOS), sinon `null`. */
export function pickDashboardAccessRolePreselect<T extends DiscordRoleLite>(
    roles: readonly T[] | null | undefined,
    discordGuildId: string,
): T | null {
    const wanted = normalizeRoleName(DASHBOARD_ACCESS_ROLE_NAME);
    return (
        pickAssignableRoles(roles, discordGuildId).find((r) => normalizeRoleName(r.name) === wanted) ?? null
    );
}

/**
 * CTA unique « prochaine action » de la mise en route : obligatoires d'abord (dans
 * l'ordre du parcours), puis l'étape déjà entamée (`IN_PROGRESS` = le geste
 * interrompu, le plus probable), puis la première recommandée. `null` = tout est fait.
 */
export function getNextOnboardingAction<T extends GettingStartedStepLite>(
    steps: readonly T[],
): T | null {
    const pending = (steps ?? []).filter((s) => s.status !== "COMPLETED");
    if (pending.length === 0) return null;
    return (
        pending.find((s) => s.mandatory) ??
        pending.find((s) => s.status === "IN_PROGRESS") ??
        pending[0]
    );
}

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

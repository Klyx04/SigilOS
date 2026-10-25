/**
 * Roster unifié du module Membres — règles pures (sans I/O, testables).
 *
 * Une seule source de vérité pour la liste unique du module : elle FUSIONNE les trois vues
 * historiques (profils dashboard, registre RH, membres Discord hors dashboard) en **une ligne
 * par personne**, porte **`profileId` ET `discordId`**, et règle filtres, tri et pagination.
 *
 * La liste ne porte **aucune** logique serveur : les données viennent des actions existantes
 * (`getGuildLifecycleData`, `getMemberRegistryDiscordIndex`, `getGuildMembers`).
 */

import {
    computeSeniorityDays,
    getTrialDecision,
    matchesDiscordRole,
    matchesRegistrySearch,
    registryRoleOptions,
    type DiscordRoleOption,
    type RegistryComment,
    type TrialDecision,
} from "./member-registry";

export type { DiscordRoleOption, RegistryComment, TrialDecision };

/** Statut de profil dashboard. Une ligne « hors dashboard » n'a **pas** de statut (`null`). */
export type RosterStatus = "ACTIVE" | "ARCHIVED" | "BANNED";

/** Mule déclarée (pseudo, classe et niveau optionnels). */
export interface RosterMule {
    pseudo: string;
    classe?: string;
    level?: number;
    /**
     * La mule est **en guilde en jeu** (déclaration du staff, onglet Mules).
     * Optionnel et **rétrocompatible** : une mule sans ce champ n'est pas comptée.
     */
    inGameGuild?: boolean;
}

/** État d'essai d'un membre (registre). */
export interface RosterTrial {
    validated: boolean;
    endsAt: string | null;
    remainingDays: number | null;
    decision: TrialDecision;
}

/** Recruteur d'un membre (registre). */
export interface RosterRecruiter {
    id: string;
    name: string;
    avatar: string | null;
}

/**
 * Une ligne de la liste unifiée du module Membres.
 *
 * `profileId` **et** `discordId` sont portés dès B-1 : c'est la contrainte de conception qui permet
 * à B-2 d'ajouter les éditeurs « hors dashboard » sans remanier la liste ni la modale.
 */
export interface RosterRow {
    /** Clé stable : `profile:<profileId>` (profil dashboard) ou `discord:<discordId>` (hors dashboard). */
    key: string;
    profileId: string | null;
    discordId: string | null;
    userId: string | null;
    displayName: string;
    username: string | null;
    avatar: string | null;
    /** `null` = membre Discord **hors dashboard** (aucun profil). */
    status: RosterStatus | null;
    /** Vrai si la personne possède un profil dashboard (`UserProfile`). */
    dashboard: boolean;
    /**
     * Compte **Discord de bot**. La source (`getMemberRegistryDiscordIndex`) les écarte
     * déjà (`member.user.bot`), mais la règle de comptage « en guilde en jeu » le vérifie
     * explicitement : un bot n'est jamais un joueur en guilde.
     */
    isBot?: boolean;
    roles: string[];
    joinedAt: string | null;
    seniorityDays: number | null;
    pseudoDofus: string | null;
    discordNickname: string | null;
    ankamaId: string | null;
    trial: RosterTrial | null;
    recruiter: RosterRecruiter | null;
    mules: RosterMule[];
    comments: RegistryComment[];
    /** Vacances déclarées (dates ISO), `null` = aucune. */
    vacationStart: string | null;
    vacationEnd: string | null;
}

/** Profil dashboard vu par la liste (forme structurelle d'un `LifecycleMemberSummary`). */
export interface RosterProfileInput {
    profileId: string;
    userId: string;
    discordId: string | null;
    displayName: string;
    avatar: string | null;
    status: RosterStatus;
    pseudoDofus: string | null;
    discordNickname: string | null;
    ankamaId: string | null;
    joinedAt: string;
    seniorityDays: number;
    trialValidated: boolean;
    trialEndsAt: string | null;
    trialRemainingDays: number | null;
    recruitedById: string | null;
    recruiterName: string | null;
    recruiterAvatar: string | null;
    mules: RosterMule[];
    comments: RegistryComment[];
    /** Vacances déclarées (optionnel : les lignes hors dashboard n'en portent pas). */
    vacationStart?: string | null;
    vacationEnd?: string | null;
    /** Compte de bot Discord (jamais compté comme joueur en guilde). */
    isBot?: boolean;
}

/** Membre Discord **sans profil** (forme structurelle d'un `RegistryDiscordOnlyMember`). */
export interface RosterDiscordOnlyInput {
    discordId: string;
    displayName: string;
    username: string;
    avatar: string | null;
    joinedAt: string | null;
    roles: string[];
    /**
     * Ligne de registre du membre (B-2) : `null`/absent tant que le staff n'a rien saisi.
     * Sa présence rend le membre **éditable** depuis la modale, comme un profil dashboard.
     */
    entry?: {
        pseudoDofus: string | null;
        ankamaId: string | null;
        guildJoinedAt: string | null;
        trialValidated: boolean;
        trialEndsAt: string | null;
        mules: RosterMule[];
        comments: RegistryComment[];
    } | null;
    recruiterId?: string | null;
    recruiterName?: string | null;
    recruiterAvatar?: string | null;
    /** Ancienneté calculée côté serveur (date d'arrivée retenue). */
    seniorityDays?: number | null;
    /** Compte de bot Discord (jamais compté comme joueur en guilde). */
    isBot?: boolean;
}

/** Rôle Discord proposé au filtre (id, libellé, couleur, position). */
export interface RosterRoleInput {
    id: string;
    name: string;
    color?: number | null;
    position?: number | null;
    /** Rôle géré par une intégration/bot (jamais proposé au choix « en guilde en jeu »). */
    managed?: boolean;
}

// ─── Fusion des trois vues en une seule liste ───────────────────────────────────────────────────

/**
 * Fusionne les profils dashboard et les membres Discord hors dashboard en **une seule liste**.
 *
 * - Une ligne dashboard garde son statut, son essai, son recruteur, ses mules et son journal.
 * - Une ligne hors dashboard n'a **ni** statut, **ni** essai, **ni** recruteur (elle n'existe pas
 *   au registre) : `status`/`trial`/`recruiter` valent `null`, `dashboard` vaut `false`.
 * - Un membre Discord déjà représenté par un profil (même `discordId`) n'est **jamais** dupliqué.
 */
export function buildMemberRoster(input: {
    profiles: readonly RosterProfileInput[];
    discordOnly: readonly RosterDiscordOnlyInput[];
    rolesByProfileId?: Record<string, string[]> | null;
    trialDurationDays: number;
    now?: Date;
}): RosterRow[] {
    const { profiles, discordOnly, rolesByProfileId, trialDurationDays } = input;
    const now = input.now ?? new Date();

    const rows: RosterRow[] = [];
    const seenDiscordIds = new Set<string>();

    for (const p of profiles) {
        if (p.discordId) seenDiscordIds.add(p.discordId);
        rows.push({
            key: `profile:${p.profileId}`,
            profileId: p.profileId,
            discordId: p.discordId,
            userId: p.userId,
            displayName: p.displayName,
            username: null,
            avatar: p.avatar,
            status: p.status,
            dashboard: true,
            // La clé n'apparaît que pour un bot : aucune ligne existante n'est modifiée.
            ...(p.isBot === true ? { isBot: true } : {}),
            roles: rolesByProfileId?.[p.profileId] ?? [],
            joinedAt: p.joinedAt,
            seniorityDays: p.seniorityDays,
            pseudoDofus: p.pseudoDofus,
            discordNickname: p.discordNickname,
            ankamaId: p.ankamaId,
            trial: {
                validated: p.trialValidated,
                endsAt: p.trialEndsAt,
                remainingDays: p.trialRemainingDays,
                decision: getTrialDecision({
                    trialValidated: p.trialValidated,
                    trialEndsAt: p.trialEndsAt,
                    joinedAtIso: p.joinedAt,
                    trialDurationDays,
                    now,
                }),
            },
            recruiter:
                p.recruitedById && p.recruiterName
                    ? { id: p.recruitedById, name: p.recruiterName, avatar: p.recruiterAvatar }
                    : null,
            mules: p.mules,
            comments: p.comments,
            vacationStart: p.vacationStart ?? null,
            vacationEnd: p.vacationEnd ?? null,
        });
    }

    for (const d of discordOnly) {
        if (seenDiscordIds.has(d.discordId)) continue;
        seenDiscordIds.add(d.discordId);

        const entry = d.entry ?? null;
        // Date d'arrivée retenue : saisie du registre si présente, sinon arrivée Discord.
        const joinedAt = entry?.guildJoinedAt ?? d.joinedAt ?? null;
        const seniorityDays = d.seniorityDays ?? (joinedAt ? computeSeniorityDays(joinedAt, now) : null);

        rows.push({
            key: `discord:${d.discordId}`,
            profileId: null,
            discordId: d.discordId,
            userId: null,
            displayName: d.displayName,
            username: d.username || null,
            avatar: d.avatar,
            status: null,
            dashboard: false,
            ...(d.isBot === true ? { isBot: true } : {}),
            roles: Array.isArray(d.roles) ? d.roles : [],
            joinedAt,
            seniorityDays,
            pseudoDofus: entry?.pseudoDofus ?? null,
            discordNickname: null,
            ankamaId: entry?.ankamaId ?? null,
            // L'essai n'apparaît que si une ligne de registre a été créée (sinon « — »).
            trial: entry
                ? {
                      validated: entry.trialValidated,
                      endsAt: entry.trialEndsAt,
                      remainingDays: null,
                      decision: getTrialDecision({
                          trialValidated: entry.trialValidated,
                          trialEndsAt: entry.trialEndsAt,
                          joinedAtIso: joinedAt ?? now.toISOString(),
                          trialDurationDays,
                          now,
                      }),
                  }
                : null,
            recruiter:
                d.recruiterId && d.recruiterName
                    ? { id: d.recruiterId, name: d.recruiterName, avatar: d.recruiterAvatar ?? null }
                    : null,
            mules: entry?.mules ?? [],
            comments: entry?.comments ?? [],
            vacationStart: null,
            vacationEnd: null,
        });
    }

    return rows;
}

// ─── Filtres (règles pures : une seule source de vérité, testable sans UI) ───────────────────────

/** Inscription au dashboard : `ALL` (les deux), `DASHBOARD` (profils), `MISSING` (hors dashboard). */
export type RosterDashboardFilter = "ALL" | "DASHBOARD" | "MISSING";

/**
 * Statut de la liste. `ALL` inclut **tout le monde** (y compris les lignes hors dashboard) ;
 * un statut précis, lui, ne peut viser qu'un profil dashboard (les lignes sans profil n'ont pas
 * de statut — elles ne « matchent » jamais par accident).
 */
export type RosterStatusFilter = "ALL" | RosterStatus;

/** État des filtres de la liste unifiée. */
export interface RosterFilters {
    search: string;
    dashboard: RosterDashboardFilter;
    status: RosterStatusFilter;
    /** `ALL` = tous ; sinon l'id du rôle Discord. */
    roleId: string;
}

export const DEFAULT_ROSTER_FILTERS: RosterFilters = {
    search: "",
    dashboard: "ALL",
    status: "ALL",
    roleId: "ALL",
};

/** Durée d'essai par défaut si la guilde n'a jamais réglé `trialDurationDays` (même valeur que le schéma). */
export const DEFAULT_TRIAL_DURATION_DAYS = 15;

/**
 * Une ligne passe-t-elle les filtres ? Même contrat pour les deux natures de lignes :
 * recherche libre (pseudo, pseudo Dofus, surnom Discord, tag Ankama, ID Discord) · rôle Discord ·
 * inscription · statut. Le filtre `status` n'exclut **pas** les lignes hors dashboard quand il vaut
 * `ALL` (elles font partie du roster), mais aucune ligne sans statut ne passe un statut précis.
 */
export function matchesRosterFilters(row: RosterRow, filters: RosterFilters): boolean {
    if (
        !matchesRegistrySearch(
            {
                displayName: row.displayName,
                discordId: row.discordId ?? "",
                pseudoDofus: row.pseudoDofus,
                discordNickname: row.discordNickname,
                ankamaId: row.ankamaId,
            },
            filters.search
        )
    ) {
        return false;
    }
    if (!matchesDiscordRole(row.roles, filters.roleId)) return false;
    if (filters.dashboard === "DASHBOARD" && !row.dashboard) return false;
    if (filters.dashboard === "MISSING" && row.dashboard) return false;
    if (filters.status !== "ALL" && row.status !== filters.status) return false;
    return true;
}

/** Compteurs par statut (badges de filtres) + total, profils dashboard et hors dashboard. */
export interface RosterCounts {
    total: number;
    active: number;
    archived: number;
    banned: number;
    dashboard: number;
    discordOnly: number;
}

export function rosterCounts(rows: readonly RosterRow[]): RosterCounts {
    let active = 0;
    let archived = 0;
    let banned = 0;
    let dashboard = 0;
    for (const row of rows) {
        if (row.dashboard) dashboard += 1;
        if (row.status === "ACTIVE") active += 1;
        else if (row.status === "ARCHIVED") archived += 1;
        else if (row.status === "BANNED") banned += 1;
    }
    return {
        total: rows.length,
        active,
        archived,
        banned,
        dashboard,
        discordOnly: rows.length - dashboard,
    };
}

/** Compteurs **facetés** par statut : calculés sur les lignes qui passent **toutes les autres**
 * facettes (recherche, rôle, inscription) — le nombre annoncé est donc celui qu'on voit après clic. */
export function rosterStatusCounts(
    rows: readonly RosterRow[],
    filters: RosterFilters
): Record<RosterStatusFilter, number> {
    const scope = rows.filter((row) => matchesRosterFilters(row, { ...filters, status: "ALL" }));
    return {
        ACTIVE: scope.filter((row) => row.status === "ACTIVE").length,
        ARCHIVED: scope.filter((row) => row.status === "ARCHIVED").length,
        BANNED: scope.filter((row) => row.status === "BANNED").length,
        ALL: scope.length,
    };
}

/** Compteurs **facetés** dashboard / hors dashboard (mêmes règles que `rosterStatusCounts`). */
export function rosterDashboardCounts(
    rows: readonly RosterRow[],
    filters: RosterFilters
): Record<RosterDashboardFilter, number> {
    const scope = rows.filter((row) => matchesRosterFilters(row, { ...filters, dashboard: "ALL" }));
    const dashboard = scope.filter((row) => row.dashboard).length;
    return { ALL: scope.length, DASHBOARD: dashboard, MISSING: scope.length - dashboard };
}

// ─── Tri & pagination ───────────────────────────────────────────────────────────────────────────

export type RosterSortKey = "name" | "joinedAt" | "seniority";
export type RosterSortDirection = "asc" | "desc";

export interface RosterSort {
    key: RosterSortKey;
    direction: RosterSortDirection;
}

/** Tri par défaut : arrivée la plus récente d'abord (mêmes attentes que l'ancien registre). */
export const DEFAULT_ROSTER_SORT: RosterSort = { key: "joinedAt", direction: "desc" };

/** Valeur de tri absente pour la clé demandée ? (ces lignes passent toujours en dernier) */
function isMissingSortValue(row: RosterRow, key: RosterSortKey): boolean {
    if (key === "seniority") return row.seniorityDays === null;
    if (key === "joinedAt") return !row.joinedAt || Number.isNaN(new Date(row.joinedAt).getTime());
    return false;
}

/** Compare deux lignes **dont la valeur de tri existe** (le sens est appliqué par l'appelant). */
function compareRows(a: RosterRow, b: RosterRow, key: RosterSortKey): number {
    switch (key) {
        case "name":
            return a.displayName.localeCompare(b.displayName, "fr");
        case "seniority":
            return (a.seniorityDays ?? 0) - (b.seniorityDays ?? 0);
        case "joinedAt":
        default:
            return new Date(a.joinedAt as string).getTime() - new Date(b.joinedAt as string).getTime();
    }
}

export function sortRoster(rows: readonly RosterRow[], sort: RosterSort): RosterRow[] {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
        const aMissing = isMissingSortValue(a, sort.key);
        const bMissing = isMissingSortValue(b, sort.key);
        // Les valeurs absentes passent en dernier **quel que soit le sens**.
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        if (!aMissing && !bMissing) {
            const cmp = compareRows(a, b, sort.key);
            if (cmp !== 0) return cmp * factor;
        }
        // Départage stable et lisible : le pseudo, puis la clé.
        const byName = a.displayName.localeCompare(b.displayName, "fr");
        return byName !== 0 ? byName : a.key.localeCompare(b.key);
    });
}

export interface RosterPage<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
}

/** Pagination **numérotée** (1-indexée), bornée : une page hors plage retombe sur la dernière. */
export function paginateRoster<T>(rows: readonly T[], page: number, pageSize: number): RosterPage<T> {
    const size = Math.max(1, Math.floor(pageSize));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
    const start = (safePage - 1) * size;
    return {
        items: rows.slice(start, start + size),
        page: safePage,
        pageSize: size,
        total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
    };
}

/** Chaîne complète : filtres → tri → pagination (une seule source pour l'écran). */
export function queryRoster(
    rows: readonly RosterRow[],
    filters: RosterFilters,
    sort: RosterSort,
    page: number,
    pageSize: number
): { filtered: RosterRow[]; page: RosterPage<RosterRow> } {
    const filtered = sortRoster(
        rows.filter((row) => matchesRosterFilters(row, filters)),
        sort
    );
    return { filtered, page: paginateRoster(filtered, page, pageSize) };
}

/**
 * Photo **serveur** d'une fiche membre (lot 2) : ce que la base vient de rendre après une
 * écriture du registre. Elle ne porte que des champs que le serveur possède — jamais une
 * identité de ligne (`key`, `profileId`, `discordId`, `roles`, `avatar`) ni une donnée
 * Discord qui n'existe pas en base (le pseudo serveur d'un hors-dashboard).
 */
export interface MemberRosterSnapshot {
    /** Vrai pour un profil dashboard : seuls ces membres ont un statut et des vacances. */
    dashboard: boolean;
    /** Nom d'affichage recalculé par le serveur (`pseudoDofus` → surnom → nom du compte). */
    displayName: string | null;
    pseudoDofus: string | null;
    ankamaId: string | null;
    status: RosterStatus | null;
    /** Date d'arrivée retenue côté serveur (saisie manuelle, sinon création du profil). */
    joinedAt: string | null;
    seniorityDays: number | null;
    trial: RosterTrial | null;
    recruiter: RosterRecruiter | null;
    mules: RosterMule[];
    comments: RegistryComment[];
    vacationStart: string | null;
    vacationEnd: string | null;
    /** Horloge **serveur** de la relecture (ISO) — jamais l'horloge du poste. */
    readAt: string;
}

/**
 * Applique une photo serveur à une ligne de la liste — **règle unique** du lot 2.
 *
 * Invariants :
 * - l'identité de la ligne est **conservée** (`key`, `profileId`, `discordId`, `userId`,
 *   `roles`, `username`, `avatar`, `dashboard`) : la photo ne la porte pas ;
 * - un champ que le serveur ne connaît pas (`null`) ne **efface** pas une valeur locale
 *   légitime — c'est le cas de la date d'arrivée Discord d'un hors-dashboard et de son
 *   nom d'affichage (mesurés par le bot, absents de la base) ;
 * - `0` est une valeur (ancienneté, compteurs), pas un « vide » ;
 * - l'objet d'entrée n'est **jamais** muté.
 */
export function applyRosterSnapshot(row: RosterRow, snapshot: MemberRosterSnapshot): RosterRow {
    return {
        ...row,
        displayName: snapshot.displayName ?? row.displayName,
        status: snapshot.status ?? row.status,
        joinedAt: snapshot.joinedAt ?? row.joinedAt,
        seniorityDays: snapshot.seniorityDays ?? row.seniorityDays,
        pseudoDofus: snapshot.pseudoDofus,
        ankamaId: snapshot.ankamaId,
        trial: snapshot.trial,
        recruiter: snapshot.recruiter,
        mules: snapshot.mules,
        comments: snapshot.comments,
        // Les vacances n'existent que sur un profil dashboard : pour un hors-dashboard,
        // la photo ne doit pas remplacer la valeur de la ligne par `null`.
        vacationStart: snapshot.dashboard ? snapshot.vacationStart : row.vacationStart,
        vacationEnd: snapshot.dashboard ? snapshot.vacationEnd : row.vacationEnd,
    };
}

/** Options du filtre « rôle Discord » : seulement les rôles portés par au moins un membre. */
export function rosterRoleOptions(
    roles: readonly RosterRoleInput[] | null | undefined,
    rows: readonly RosterRow[],
    /**
     * Restriction RBAC : seuls les rôles **autorisés dashboard** (mappés) sont proposés — les rôles
     * de jeu ou cosmétiques n'ouvrent aucune page, ils n'ont rien à faire dans un filtre de gestion.
     * `null`/`undefined` = aucune restriction (vue God, écrans historiques).
     */
    allowedRoleIds?: readonly string[] | null
): DiscordRoleOption[] {
    return registryRoleOptions(roles, rows, allowedRoleIds);
}

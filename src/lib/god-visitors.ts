/**
 * God — **visiteurs** (V3, rang 57) : règles **pures** de la liste.
 *
 * Le périmètre est volontairement étroit :
 *  · bornes d'entrée (page, recherche, consentement, serveur) — jamais une valeur
 *    venue de l'URL qui piloterait une requête non bornée ;
 *  · `where` unique pour la liste, avec le **consentement** comme filtre explicite ;
 *  · DTO de liste : ni `userId`, ni `metamobApiKey`, ni `altPseudos` (mules) — un
 *    champ absent du DTO ne peut pas fuir dans le payload RSC.
 *
 * La garde d'accès (`isSuperAdmin`) vit dans `src/server/god-visitors.ts` : une
 * règle pure ne décide jamais d'un droit.
 */

import type { Prisma } from "@prisma/client";
import { toTotalDofusLevel } from "@/lib/dofus-level";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";

/** Taille de page fixe : le client ne choisit pas son volume de lecture. */
export const GOD_VISITORS_PAGE_SIZE = 24;
/** Recherche bornée : pseudo ou guilde déclarée, jamais une requête libre. */
export const GOD_VISITORS_SEARCH_MAX = 40;
/** Plafond de pagination : évite un `skip` arbitrairement grand. */
export const GOD_VISITORS_MAX_PAGE = 100_000;

export type GodVisitorsConsent = "all" | "listed" | "hidden";

export type GodVisitorsQuery = {
    page: number;
    q: string;
    consent: GodVisitorsConsent;
    serverId?: number;
};

export type GodVisitorsRawQuery = {
    page?: string | string[];
    q?: string | string[];
    consent?: string | string[];
    serverId?: string | string[];
    /** Détail nominatif (`?visiteur=<id>`) — lu par le serveur, jamais par la liste. */
    visiteur?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

/**
 * Normalise l'entrée d'URL. Toute valeur illisible retombe sur un défaut **sûr** :
 * page 1, recherche vide, tous les consentements — jamais une erreur qui casserait
 * l'écran, jamais une valeur hors bornes transmise à Prisma.
 */
export function parseGodVisitorsQuery(raw: GodVisitorsRawQuery = {}): GodVisitorsQuery {
    const pageRaw = Number.parseInt(firstValue(raw.page) ?? "", 10);
    const page = Number.isFinite(pageRaw)
        ? Math.min(Math.max(pageRaw, 1), GOD_VISITORS_MAX_PAGE)
        : 1;

    const q = (firstValue(raw.q) ?? "").trim().slice(0, GOD_VISITORS_SEARCH_MAX);

    const consentRaw = firstValue(raw.consent);
    const consent: GodVisitorsConsent =
        consentRaw === "listed" || consentRaw === "hidden" ? consentRaw : "all";

    const serverRaw = Number.parseInt(firstValue(raw.serverId) ?? "", 10);
    const serverId =
        Number.isFinite(serverRaw) && serverRaw >= 1 && serverRaw <= 10_000
            ? serverRaw
            : undefined;

    return { page, q, consent, serverId };
}

/**
 * `where` de la liste. Le consentement n'est pas un ornement : `listed` et `hidden`
 * doivent produire deux ensembles qui ne se recouvrent pas.
 */
export function buildGodVisitorsWhere(query: GodVisitorsQuery): Prisma.PublicProfileWhereInput {
    const where: Prisma.PublicProfileWhereInput = {};

    if (query.consent === "listed") where.showOnDirectory = true;
    if (query.consent === "hidden") where.showOnDirectory = false;

    if (query.serverId) where.dofusServerId = query.serverId;

    if (query.q) {
        where.OR = [
            { pseudoDofus: { contains: query.q, mode: "insensitive" } },
            { declaredGuildName: { contains: query.q, mode: "insensitive" } },
        ];
    }

    return where;
}

/** Nom du serveur Unity à partir de son identifiant officiel. */
export function resolveGodVisitorServerName(serverId: number): string {
    const entry = ALL_DOFUS_SERVER_ENTRIES.find((server) => server.id === serverId);
    return entry?.name ?? `Serveur ${serverId}`;
}

/** Vignette officielle du serveur (asset Dofus réel), `null` si l'id est inconnu. */
export function resolveGodVisitorServerIcon(serverId: number): string | null {
    const entry = ALL_DOFUS_SERVER_ENTRIES.find((server) => server.id === serverId);
    return entry?.icon ?? null;
}

export type GodVisitorRowSource = {
    id: string;
    dofusServerId: number;
    pseudoDofus: string | null;
    classe: string | null;
    dofusLevel: number | null;
    totalXp: bigint | number | string | null;
    successPoints: number | null;
    showOnDirectory: boolean;
    showPresence: boolean;
    showRushProgress: boolean;
    lastLadderSync: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { achievements: number; professions: number };
};

export type GodVisitorRow = {
    id: string;
    pseudo: string | null;
    serverId: number;
    serverName: string;
    serverIcon: string | null;
    classe: string | null;
    level: number | null;
    successPoints: number | null;
    showOnDirectory: boolean;
    showPresence: boolean;
    showRushProgress: boolean;
    achievements: number;
    jobs: number;
    lastLadderSync: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

/** Projection de liste : aucune donnée privée ne traverse cette fonction. */
export function toGodVisitorRow(source: GodVisitorRowSource): GodVisitorRow {
    return {
        id: source.id,
        pseudo: source.pseudoDofus?.trim() || null,
        serverId: source.dofusServerId,
        serverName: resolveGodVisitorServerName(source.dofusServerId),
        serverIcon: resolveGodVisitorServerIcon(source.dofusServerId),
        classe: source.classe,
        level: toTotalDofusLevel(source.dofusLevel, source.totalXp),
        successPoints: source.successPoints,
        showOnDirectory: source.showOnDirectory,
        showPresence: source.showPresence,
        showRushProgress: source.showRushProgress,
        achievements: source._count.achievements,
        jobs: source._count.professions,
        lastLadderSync: source.lastLadderSync,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}

export function godVisitorsTotalPages(total: number): number {
    if (!Number.isFinite(total) || total <= 0) return 1;
    return Math.max(1, Math.ceil(total / GOD_VISITORS_PAGE_SIZE));
}

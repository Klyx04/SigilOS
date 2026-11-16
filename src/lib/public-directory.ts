/**
 * Espace visiteur (rang 57) — **règles pures** de l'annuaire des visiteurs (aucune I/O).
 *
 * V2e (révisé le 16/11/2026, D3) : l'annuaire reste **privé** — il ne se lit que par un
 * compte connecté qui possède un profil public. Le serveur du lecteur est le **défaut**, mais
 * il devient un **filtre** : `serverId` explore un serveur précis, `serverId=all` les montre
 * tous. Le consentement `showOnDirectory` est **global** (D-V4) : un profil consenti est
 * visible depuis n'importe quel serveur, liste **et** fiche.
 *
 * Ce module ne connaît ni session ni base : il borne les filtres, construit le `where`, et
 * fabrique les deux DTO (liste et fiche). C'est lui que `tests/unit/visitor-directory.test.ts`
 * verrouille.
 *
 * Invariants :
 *  · **jamais** de mule (`altPseudos`), de clé Metamob, ni de `userId` dans un DTO : la fiche
 *    publique ne montre que ce que le visiteur a déclaré pour l'annuaire ;
 *  · un filtre inconnu est **ignoré** (jamais une exception, jamais une page blanche) ;
 *  · le **serveur est un filtre fail-soft** : absent ⇒ serveur du lecteur (résolu côté
 *    serveur) ; `serverId` borné à un serveur connu, `serverId=all` ⇒ aucun filtre serveur.
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { toTotalDofusLevel } from "@/lib/dofus-level";
import { getClass, getJob } from "@/lib/dofus-assets";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";
import { ALLOWED_JOB_IDS } from "@/lib/public-profile-input";

/** Taille d'une page d'annuaire — dite à l'écran et bornée côté serveur. */
export const PUBLIC_DIRECTORY_PAGE_SIZE = 24;

/** Longueur maximale d'une recherche (pseudo ou nom de guilde déclaré). */
export const PUBLIC_DIRECTORY_SEARCH_MAX = 40;

/** Métiers affichés sur une ligne de liste (la fiche les montre tous). */
export const PUBLIC_DIRECTORY_JOBS_ON_CARD = 4;

/**
 * Paliers proposés par le filtre « métier + niveau » (F17b). Le niveau d'un métier
 * Dofus va de 1 à 200 (`PublicProfession.level`) ; l'URL accepte n'importe quelle
 * valeur de cette plage, les paliers ne sont que l'offre de l'écran.
 */
export const PUBLIC_DIRECTORY_JOB_LEVELS = [50, 100, 150, 200] as const;
export const PUBLIC_DIRECTORY_JOB_LEVEL_MIN = 1;
export const PUBLIC_DIRECTORY_JOB_LEVEL_MAX = 200;

/**
 * Bornes du filtre serveur. Les ids Ankama connus vivent entre 50 et 355 ; la borne haute
 * (9 999) n'est qu'un garde-fou d'URL — un id absent de `ALL_DOFUS_SERVER_ENTRIES` est ignoré.
 */
export const PUBLIC_DIRECTORY_SERVER_ID_MIN = 1;
export const PUBLIC_DIRECTORY_SERVER_ID_MAX = 9999;

/** Valeur d'URL qui demande **tous** les serveurs (le défaut reste celui du lecteur). */
export const PUBLIC_DIRECTORY_ALL_SERVERS_PARAM = "all";

/** Longueur maximale d'un identifiant de curseur (cuid Prisma). */
const CURSOR_MAX = 64;

/** Un identifiant public plausible (`cuid`), borné — refuse tout le reste avant la requête. */
export function isPublicProfileId(value: unknown): value is string {
    return typeof value === "string" && /^[a-z0-9]{12,64}$/i.test(value);
}

/** Filtres normalisés : seules les valeurs reconnues survivent. */
export type VisitorDirectoryFilters = {
    q?: string;
    classe?: string;
    metier?: string;
    /** Niveau **minimum** du métier filtré — n'a de sens qu'avec `metier`. */
    niveau?: number;
    /** Serveur exploré ; absent = serveur du lecteur (défaut, résolu côté serveur). */
    serverId?: number;
    /** `serverId=all` : tous les serveurs consentants. */
    allServers?: boolean;
    cursor?: string;
};

const rawSearchSchema = z.string().max(PUBLIC_DIRECTORY_SEARCH_MAX * 10);
const rawLabelSchema = z.string().max(40);
const rawLevelSchema = z.string().max(4).regex(/^\d{1,3}$/);
const rawServerSchema = z.string().max(4);
const rawCursorSchema = z.string().max(CURSOR_MAX);

/**
 * Lit les `searchParams` d'une page d'annuaire. **Fail-soft, jamais fail-closed** : un filtre
 * invalide est ignoré (on montre la liste non filtrée), parce qu'il s'agit d'une **lecture**
 * — un refus fermé n'aurait ici aucun sens et casserait le deep-link.
 *
 * Chaque champ est validé **séparément** : une recherche de 10 000 caractères ne doit pas
 * faire perdre le filtre de classe déjà choisi.
 */
export function parseVisitorDirectoryFilters(
    raw: Record<string, string | string[] | undefined> | undefined
): VisitorDirectoryFilters {
    const first = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;

    const out: VisitorDirectoryFilters = {};

    const rawQ = first(raw?.q);
    const q = rawSearchSchema.safeParse(
        typeof rawQ === "string" ? rawQ.slice(0, PUBLIC_DIRECTORY_SEARCH_MAX * 10) : rawQ
    );
    if (q.success) {
        const trimmed = q.data.trim().slice(0, PUBLIC_DIRECTORY_SEARCH_MAX);
        if (trimmed) out.q = trimmed;
    }

    const classe = rawLabelSchema.safeParse(first(raw?.classe));
    if (classe.success) {
        const resolved = getClass(classe.data)?.id;
        if (resolved) out.classe = resolved;
    }

    const metier = rawLabelSchema.safeParse(first(raw?.metier));
    if (metier.success && ALLOWED_JOB_IDS.has(metier.data)) out.metier = metier.data;

    // F17b — le niveau n'a de sens qu'avec un métier : seul, il est ignoré (pas de
    // « tous les métiers à partir du niveau 100 », qui ne veut rien dire).
    const rawNiveau = first(raw?.niveau);
    const niveau = rawLevelSchema.safeParse(
        typeof rawNiveau === "string" ? rawNiveau.trim() : rawNiveau
    );
    if (out.metier && niveau.success) {
        const value = Number(niveau.data);
        if (value >= PUBLIC_DIRECTORY_JOB_LEVEL_MIN && value <= PUBLIC_DIRECTORY_JOB_LEVEL_MAX) {
            out.niveau = value;
        }
    }

    // D3 — le serveur est un filtre : absent = serveur du lecteur, `all` = tous. Un id
    // inconnu (ou hors bornes) est ignoré, sans perdre les autres filtres.
    const rawServer = first(raw?.serverId);
    if (rawServer === PUBLIC_DIRECTORY_ALL_SERVERS_PARAM) {
        out.allServers = true;
    } else {
        const server = rawServerSchema.safeParse(
            typeof rawServer === "string" ? rawServer.trim() : rawServer
        );
        if (server.success && /^\d{1,4}$/.test(server.data)) {
            const value = Number(server.data);
            if (
                value >= PUBLIC_DIRECTORY_SERVER_ID_MIN &&
                value <= PUBLIC_DIRECTORY_SERVER_ID_MAX &&
                ALL_DOFUS_SERVER_ENTRIES.some((entry) => entry.id === value)
            ) {
                out.serverId = value;
            }
        }
    }

    const cursor = rawCursorSchema.safeParse(first(raw?.cursor));
    if (cursor.success && isPublicProfileId(cursor.data)) out.cursor = cursor.data;

    return out;
}

/**
 * Lien d'annuaire recalculé : les filtres vides disparaissent. `cursor` n'est recopié que
 * lorsque l'appelant le passe (pagination) — les menus de filtre ne le passent jamais.
 */
export function buildVisitorDirectoryHref(filters: VisitorDirectoryFilters): string {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.classe) params.set("classe", filters.classe);
    if (filters.metier) {
        params.set("metier", filters.metier);
        // Le niveau suit le métier : sans métier, il n'a plus de sens.
        if (filters.niveau) params.set("niveau", String(filters.niveau));
    }
    if (filters.serverId) params.set("serverId", String(filters.serverId));
    else if (filters.allServers) params.set("serverId", PUBLIC_DIRECTORY_ALL_SERVERS_PARAM);
    if (filters.cursor) params.set("cursor", filters.cursor);
    const query = params.toString();
    return query ? `/visiteurs?${query}` : "/visiteurs";
}

/**
 * Lien vers une fiche visiteur : le **pseudo** quand il existe (lisible, partageable),
 * le cuid en repli. La fiche accepte les deux ; un pseudo porté par deux profils du même
 * serveur ouvre un choix, jamais un 404.
 */
export function visitorProfileHref(entry: { id: string; pseudo: string | null }): string {
    const pseudo = entry.pseudo?.trim();
    return pseudo ? `/visiteurs/${encodeURIComponent(pseudo)}` : `/visiteurs/${entry.id}`;
}

/**
 * `where` de l'annuaire. Le serveur du lecteur est le **défaut** ; `filters.serverId` explore
 * un autre serveur, `filters.allServers` retire le filtre. Toute lecture porte le consentement.
 */
export function buildVisitorDirectoryWhere(
    viewerServerId: number,
    filters: VisitorDirectoryFilters
): Prisma.PublicProfileWhereInput {
    return {
        showOnDirectory: true,
        ...(filters.serverId
            ? { dofusServerId: filters.serverId }
            : filters.allServers
              ? {}
              : { dofusServerId: viewerServerId }),
        ...(filters.classe ? { classe: filters.classe } : {}),
        ...(filters.metier
            ? {
                  professions: {
                      some: {
                          metierId: filters.metier,
                          // F17b — « qui a ce métier à ce niveau » = au moins ce niveau
                          // (`@@index([metierId, level])` porte la requête). Le plancher **1**
                          // est volontaire : un métier à 0 n'est pas une déclaration valide
                          // (le niveau est obligatoire dans le profil) et ne doit ni apparaître
                          // ni être filtrable.
                          level: { gte: filters.niveau ?? PUBLIC_DIRECTORY_JOB_LEVEL_MIN },
                      },
                  },
              }
            : {}),
        ...(filters.q
            ? {
                  OR: [
                      { pseudoDofus: { contains: filters.q, mode: "insensitive" } },
                      { declaredGuildName: { contains: filters.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    };
}

/** Ligne brute d'un profil public, telle que la couche serveur la `select` (liste). */
export type VisitorDirectoryRow = {
    id: string;
    pseudoDofus: string | null;
    classe: string | null;
    dofusServerId: number;
    declaredGuildName: string | null;
    dofusLevel: number | null;
    /** BigInt lu uniquement pour convertir le niveau Oméga en niveau total. */
    totalXp: bigint | null;
    successPoints: number | null;
    updatedAt: Date;
    professions: ReadonlyArray<{ metierId: string; level: number }>;
    _count: { achievements: number };
};

/** Ligne de fiche : la liste + la présentation (jamais lue sur la liste — poids inutile). */
export type VisitorProfileRow = Omit<VisitorDirectoryRow, "_count"> & {
    introduction: string | null;
    objectifs: string | null;
    _count: { achievements: number; bountyCompletions: number };
};

export type VisitorJob = { id: string; name: string; icon: string; level: number };

export type VisitorServer = { id: number; name: string; icon: string };

export type VisitorClass = { id: string; name: string; icon: string };

/**
 * Entrée de liste. **Aucun champ privé** : pas de mules, pas de Metamob, pas de `userId`.
 */
export type VisitorDirectoryEntry = {
    id: string;
    pseudo: string | null;
    classe: VisitorClass | null;
    server: VisitorServer | null;
    guildName: string | null;
    level: number | null;
    successPoints: number | null;
    jobs: VisitorJob[];
    achievements: number;
};

/** Fiche : l'entrée de liste + la présentation et **tous** les métiers déclarés. */
export type VisitorProfile = VisitorDirectoryEntry & {
    introduction: string | null;
    objectifs: string | null;
    /** Avis de recherche cochés, tous personnages confondus. */
    bountiesDone: number;
    updatedAt: Date;
};

function resolveServer(serverId: number): VisitorServer | null {
    const found = ALL_DOFUS_SERVER_ENTRIES.find((server) => server.id === serverId);
    return found ? { id: found.id, name: found.name, icon: found.icon } : null;
}

function resolveJobs(
    rows: ReadonlyArray<{ metierId: string; level: number }>,
    max: number
): VisitorJob[] {
    const out: VisitorJob[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        if (out.length >= max) break;
        if (seen.has(row.metierId)) continue;
        const job = getJob(row.metierId);
        if (!job) continue;
        seen.add(row.metierId);
        out.push({ id: job.id, name: job.name, icon: job.icon, level: row.level });
    }
    return out;
}

/** Ligne → entrée de liste. Un métier ou un serveur inconnu est **écarté**, jamais inventé. */
export function toVisitorDirectoryEntry(row: VisitorDirectoryRow): VisitorDirectoryEntry {
    const classe = row.classe ? getClass(row.classe) : undefined;
    return {
        id: row.id,
        pseudo: row.pseudoDofus,
        classe: classe ? { id: classe.id, name: classe.name, icon: classe.icon } : null,
        server: resolveServer(row.dofusServerId),
        guildName: row.declaredGuildName,
        level: toTotalDofusLevel(row.dofusLevel, row.totalXp),
        successPoints: row.successPoints,
        jobs: resolveJobs(row.professions, PUBLIC_DIRECTORY_JOBS_ON_CARD),
        achievements: row._count.achievements,
    };
}

/** Ligne → fiche. Même liste blanche, plus la présentation et **tous** les métiers (max 50). */
export function toVisitorProfile(row: VisitorProfileRow): VisitorProfile {
    return {
        ...toVisitorDirectoryEntry(row),
        jobs: resolveJobs(row.professions, 50),
        introduction: row.introduction,
        objectifs: row.objectifs,
        bountiesDone: row._count.bountyCompletions,
        updatedAt: row.updatedAt,
    };
}

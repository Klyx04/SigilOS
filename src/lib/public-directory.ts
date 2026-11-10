/**
 * Espace visiteur (rang 57) — **règles pures** de l'annuaire des visiteurs (aucune I/O).
 *
 * V2e : l'annuaire est **privé**. Il ne se lit que par un compte connecté qui possède un
 * profil public (donc un serveur), et il ne montre que les profils du **même serveur** qui
 * ont coché le consentement `showOnDirectory` (D-V4).
 *
 * Ce module ne connaît ni session ni base : il borne les filtres, construit le `where`, et
 * fabrique les deux DTO (liste et fiche). C'est lui que `tests/unit/visitor-directory.test.ts`
 * verrouille.
 *
 * Invariants :
 *  · **jamais** de mule (`altPseudos`), de clé Metamob, ni de `userId` dans un DTO : la fiche
 *    publique ne montre que ce que le visiteur a déclaré pour l'annuaire ;
 *  · un filtre inconnu est **ignoré** (jamais une exception, jamais une page blanche) ;
 *  · le **serveur n'est pas un filtre** : il vient du profil du lecteur, résolu côté serveur.
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
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
    cursor?: string;
};

const rawSearchSchema = z.string().max(PUBLIC_DIRECTORY_SEARCH_MAX * 10);
const rawLabelSchema = z.string().max(40);
const rawLevelSchema = z.string().max(4).regex(/^\d{1,3}$/);
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

    const cursor = rawCursorSchema.safeParse(first(raw?.cursor));
    if (cursor.success && isPublicProfileId(cursor.data)) out.cursor = cursor.data;

    return out;
}

/** Lien d'annuaire recalculé : les filtres vides disparaissent, `cursor` n'est jamais recopié. */
export function buildVisitorDirectoryHref(filters: VisitorDirectoryFilters): string {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.classe) params.set("classe", filters.classe);
    if (filters.metier) {
        params.set("metier", filters.metier);
        // Le niveau suit le métier : sans métier, il n'a plus de sens.
        if (filters.niveau) params.set("niveau", String(filters.niveau));
    }
    if (filters.cursor) params.set("cursor", filters.cursor);
    const query = params.toString();
    return query ? `/visiteurs?${query}` : "/visiteurs";
}

/**
 * `where` de l'annuaire. Le serveur est **imposé** par l'appelant (profil du lecteur) : aucun
 * chemin ne permet de lire un autre serveur, même en forgeant l'URL.
 */
export function buildVisitorDirectoryWhere(
    viewerServerId: number,
    filters: VisitorDirectoryFilters
): Prisma.PublicProfileWhereInput {
    return {
        showOnDirectory: true,
        dofusServerId: viewerServerId,
        ...(filters.classe ? { classe: filters.classe } : {}),
        ...(filters.metier
            ? {
                  professions: {
                      some: {
                          metierId: filters.metier,
                          // F17b — « qui a ce métier à ce niveau » = au moins ce niveau
                          // (`@@index([metierId, level])` porte la requête).
                          ...(filters.niveau ? { level: { gte: filters.niveau } } : {}),
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
    successPoints: number | null;
    updatedAt: Date;
    professions: ReadonlyArray<{ metierId: string; level: number }>;
    _count: { achievements: number };
};

/** Ligne de fiche : la liste + la présentation (jamais lue sur la liste — poids inutile). */
export type VisitorProfileRow = VisitorDirectoryRow & {
    introduction: string | null;
    objectifs: string | null;
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
        level: row.dofusLevel,
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
        updatedAt: row.updatedAt,
    };
}

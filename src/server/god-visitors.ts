/**
 * God — **visiteurs** (V3, rang 57) : lecture serveur.
 *
 * Une seule règle d'accès : **super-admin**, fail-closed. La brique `guilds` est
 * ouvrable à un sous-god ; la liste des visiteurs ne l'est pas (périmètre
 * plateforme, aucune donnée de guilde).
 *
 * Le `select` est une **liste blanche** : `metamobApiKey`, `altPseudos` et `userId`
 * n'y figurent pas. Un champ non lu ne peut pas fuir dans le payload RSC.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import {
    GOD_VISITORS_PAGE_SIZE,
    buildGodVisitorsWhere,
    godVisitorsTotalPages,
    parseGodVisitorsQuery,
    toGodVisitorRow,
    type GodVisitorsRawQuery,
    type GodVisitorRow,
} from "@/lib/god-visitors";

const GOD_VISITOR_SELECT = {
    id: true,
    dofusServerId: true,
    pseudoDofus: true,
    classe: true,
    dofusLevel: true,
    totalXp: true,
    successPoints: true,
    showOnDirectory: true,
    showPresence: true,
    showRushProgress: true,
    lastLadderSync: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            achievements: true,
            // Un métier à 0 n'est pas une déclaration valide (même règle que l'annuaire).
            professions: { where: { level: { gte: 1 } } },
        },
    },
} satisfies Prisma.PublicProfileSelect;

export type GodVisitorDetail = GodVisitorRow & {
    /** Compte Discord (identifiant réservé au God, jamais dans la liste). */
    discord: { id: string; name: string | null } | null;
    /** Guilde(s) où ce compte a un profil (nom + statut). */
    guilds: { name: string; status: string }[];
    /** Vrai si le compte possède une guilde : la suppression est refusée. */
    ownsGuild: boolean;
};

/**
 * Détail d'un visiteur (God uniquement) — chargé à la demande depuis `?visiteur=`.
 * Le `discordId` et les appartenances de guilde ne sortent **jamais** par la liste :
 * seule cette lecture nominative les expose, et elle est gardée super-admin.
 */
export async function getGodVisitorDetail(profileId: string): Promise<GodVisitorDetail | null> {
    if (!(await isSuperAdmin())) return null;

    const profile = await db.publicProfile.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            dofusServerId: true,
            pseudoDofus: true,
            classe: true,
            dofusLevel: true,
            totalXp: true,
            successPoints: true,
            showOnDirectory: true,
            showPresence: true,
            showRushProgress: true,
            lastLadderSync: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    achievements: true,
                    professions: { where: { level: { gte: 1 } } },
                },
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true },
                        take: 1,
                    },
                    profiles: {
                        select: {
                            status: true,
                            guild: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!profile) return null;

    const discordId = profile.user.accounts[0]?.providerAccountId ?? null;
    const ownsGuild = await db.guildConfig
        .findFirst({
            where: {
                OR: [
                    { ownerId: profile.user.id },
                    ...(discordId ? [{ ownerId: discordId }] : []),
                ],
            },
            select: { id: true },
        })
        .then((row) => !!row)
        .catch(() => true); // fail-closed : en cas d'erreur, on refuse la suppression.

    return {
        ...toGodVisitorRow(profile),
        discord: discordId ? { id: discordId, name: profile.user.name } : null,
        guilds: profile.user.profiles.map((p) => ({
            name: p.guild?.name ?? "Guilde inconnue",
            status: p.status,
        })),
        ownsGuild,
    };
}

export type GodVisitorsResult =
    | {
          ok: true;
          rows: GodVisitorRow[];
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
      }
    | { ok: false; error: "forbidden" };

export async function getGodVisitors(raw: GodVisitorsRawQuery = {}): Promise<GodVisitorsResult> {
    // Fail-closed : on refuse AVANT de lire quoi que ce soit.
    if (!(await isSuperAdmin())) return { ok: false, error: "forbidden" };

    const query = parseGodVisitorsQuery(raw);
    const where = buildGodVisitorsWhere(query);

    const [total, profiles] = await Promise.all([
        db.publicProfile.count({ where }),
        db.publicProfile.findMany({
            where,
            select: GOD_VISITOR_SELECT,
            // `id` départage les `updatedAt` identiques : pagination stable.
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            skip: (query.page - 1) * GOD_VISITORS_PAGE_SIZE,
            take: GOD_VISITORS_PAGE_SIZE,
        }),
    ]);

    return {
        ok: true,
        rows: profiles.map(toGodVisitorRow),
        total,
        page: query.page,
        pageSize: GOD_VISITORS_PAGE_SIZE,
        totalPages: godVisitorsTotalPages(total),
    };
}

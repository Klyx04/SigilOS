/**
 * Hub « Communauté SigilOS » — **succès en commun** (F16 / D-V9), couche serveur.
 *
 * Une seule question : « pour ce donjon, qui a déjà validé quel succès parmi les
 * visiteurs de **mon** serveur qui ont accepté d'apparaître ? »
 *
 * Invariants (les mêmes que l'annuaire, parce que c'est le même périmètre) :
 *  · le serveur vient du **profil du lecteur**, jamais de l'URL ;
 *  · `showOnDirectory: true` est dans **chaque** `where` — un profil non consentant est
 *    introuvable, pas « trouvé puis masqué » ;
 *  · **aucune** donnée de guilde, **aucun** champ privé (mules, Metamob, `userId`) ;
 *  · deux bornes : les lignes lues et les profils affichés. Au-delà, l'écran le dit.
 */

import { db } from "@/lib/prisma";
import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { SUCCES_DUNGEONS_TAKE } from "@/lib/succes-level-brackets";
import {
    SHARED_SUCCES_TAKE,
    SHARED_SUCCES_VISITORS_TAKE,
    buildSharedBountyBoard,
    buildSharedSuccesBoard,
    isSharedSuccesDungeonKey,
    type SharedBounty,
    type SharedBountyBoard,
    type SharedSuccesBoard,
    type SharedSuccesMember,
} from "@/lib/visitors-hub";
import type { DirectoryViewer } from "@/server/public-directory";

/** Entrée de la liste des donjons (bornée, triée par niveau). */
export type SharedSuccesDungeon = {
    id: string;
    name: string;
    bossName: string;
    level: number;
    slug: string | null;
    imageUrl: string | null;
    achievements: number;
};

export type SharedSuccesDungeonBoard = {
    dungeon: SharedSuccesDungeon;
    board: SharedSuccesBoard;
};

const DUNGEON_SELECT = {
    id: true,
    name: true,
    bossName: true,
    level: true,
    slug: true,
    imageUrl: true,
    _count: { select: { achievements: true } },
} as const;

function toDungeon(row: {
    id: string;
    name: string;
    bossName: string;
    level: number;
    slug: string | null;
    imageUrl: string | null;
    _count: { achievements: number };
}): SharedSuccesDungeon {
    return {
        id: row.id,
        name: row.name,
        bossName: row.bossName,
        level: row.level,
        slug: row.slug,
        imageUrl: row.imageUrl,
        achievements: row._count.achievements,
    };
}

/**
 * Donjons proposés à la sélection. On ne liste que ceux qui portent **au moins un
 * succès** : un donjon sans succès ouvrirait une colonne vide. La recherche est bornée
 * côté appelant (`SHARED_SUCCES_SEARCH_MAX`) et s'applique au nom ou au boss.
 */
export async function listSharedSuccesDungeons(query: string): Promise<SharedSuccesDungeon[]> {
    const rows = await db.dungeon.findMany({
        where: {
            achievements: { some: {} },
            ...(query
                ? {
                      OR: [
                          { name: { contains: query, mode: "insensitive" } },
                          { bossName: { contains: query, mode: "insensitive" } },
                      ],
                  }
                : {}),
        },
        select: DUNGEON_SELECT,
        orderBy: [{ level: "asc" }, { name: "asc" }],
        take: SUCCES_DUNGEONS_TAKE,
    });
    return rows.map(toDungeon);
}

/**
 * Tableau complet d'un donjon : succès, coches et profils consentants du serveur.
 * `null` si la clé est invalide ou si le donjon n'existe pas — la page décide du vide.
 */
export async function getSharedSuccesDungeonBoard(
    viewer: DirectoryViewer,
    dungeonKey: string
): Promise<SharedSuccesDungeonBoard | null> {
    if (!isSharedSuccesDungeonKey(dungeonKey)) return null;

    const dungeon = await db.dungeon.findFirst({
        where: { OR: [{ slug: dungeonKey }, { id: dungeonKey }] },
        select: DUNGEON_SELECT,
    });
    if (!dungeon) return null;

    const [achievements, doneRows, visitors] = await Promise.all([
        db.dungeonAchievement.findMany({
            where: { dungeonId: dungeon.id },
            select: {
                id: true,
                points: true,
                imageUrl: true,
                description: true,
                challenge: { select: { name: true, slug: true, iconUrl: true, description: true } },
            },
            orderBy: { points: "desc" },
            take: SHARED_SUCCES_TAKE,
        }),
        db.publicDungeonAchievement.findMany({
            where: {
                dungeonAchievement: { dungeonId: dungeon.id },
                profile: {
                    dofusServerId: viewer.serverId,
                    showOnDirectory: true,
                },
            },
            select: {
                dungeonAchievementId: true,
                profile: { select: { id: true, pseudoDofus: true, classe: true } },
            },
            take: SHARED_SUCCES_TAKE,
        }),
        db.publicProfile.findMany({
            where: {
                dofusServerId: viewer.serverId,
                showOnDirectory: true,
            },
            select: { id: true, pseudoDofus: true, classe: true },
            orderBy: { id: "desc" },
            take: SHARED_SUCCES_VISITORS_TAKE + 1,
        }),
    ]);

    const board = buildSharedSuccesBoard({
        achievements: achievements.map((achievement) => ({
            id: achievement.id,
            name: achievement.challenge.name,
            slug: achievement.challenge.slug ?? null,
            points: achievement.points,
            iconUrl: getDungeonAchievementIconUrl(achievement),
            description:
                achievement.description ?? achievement.challenge.description ?? null,
        })),
        doneRows: doneRows.map((row) => ({
            achievementId: row.dungeonAchievementId,
            member: {
                id: row.profile.id,
                pseudo: row.profile.pseudoDofus,
                classe: row.profile.classe,
            } satisfies SharedSuccesMember,
        })),
        visitors: visitors.map((visitor) => ({
            id: visitor.id,
            pseudo: visitor.pseudoDofus,
            classe: visitor.classe,
        })),
    });

    return { dungeon: toDungeon(dungeon), board };
}

/** Entrée de la liste des avis (bornée, triée par niveau). */
export type SharedSuccesBounty = SharedBounty;

export type SharedSuccesBountyBoard = {
    bounty: SharedSuccesBounty;
    board: SharedBountyBoard;
};

const BOUNTY_SELECT = {
    id: true,
    name: true,
    level: true,
    zoneName: true,
    slug: true,
    imageUrl: true,
} as const;

function toBounty(row: {
    id: string;
    name: string;
    level: number;
    zoneName: string | null;
    slug: string | null;
    imageUrl: string | null;
}): SharedSuccesBounty {
    return {
        id: row.id,
        name: row.name,
        level: row.level,
        zoneName: row.zoneName,
        slug: row.slug,
        imageUrl: row.imageUrl,
    };
}

/**
 * Avis proposés à la sélection — uniquement les lignes **siphonnées**
 * (`isBountyMonster: true`), même borne et même tri que les donjons.
 */
export async function listSharedSuccesBounties(query: string): Promise<SharedSuccesBounty[]> {
    const rows = await db.bounty.findMany({
        where: {
            isBountyMonster: true,
            ...(query
                ? {
                      OR: [
                          { name: { contains: query, mode: "insensitive" } },
                          { zoneName: { contains: query, mode: "insensitive" } },
                      ],
                  }
                : {}),
        },
        select: BOUNTY_SELECT,
        orderBy: [{ level: "asc" }, { name: "asc" }],
        take: SUCCES_DUNGEONS_TAKE,
    });
    return rows.map(toBounty);
}

/**
 * Tableau « qui a fait cet avis » : coches et profils consentants du **serveur du
 * lecteur**. Même périmètre que les succès de donjon ; une coche multi-personnages
 * ne crée qu'une entrée (dédoublonnage dans `buildSharedBountyBoard`).
 */
export async function getSharedBountyBoard(
    viewer: DirectoryViewer,
    bountyKey: string
): Promise<SharedSuccesBountyBoard | null> {
    if (!isSharedSuccesDungeonKey(bountyKey)) return null;

    const bounty = await db.bounty.findFirst({
        where: {
            isBountyMonster: true,
            OR: [{ slug: bountyKey }, { id: bountyKey }],
        },
        select: BOUNTY_SELECT,
    });
    if (!bounty) return null;

    const [doneRows, visitors] = await Promise.all([
        db.publicBountyCompletion.findMany({
            where: {
                bountyId: bounty.id,
                profile: {
                    dofusServerId: viewer.serverId,
                    showOnDirectory: true,
                },
            },
            select: {
                profile: { select: { id: true, pseudoDofus: true, classe: true } },
            },
            take: SHARED_SUCCES_TAKE,
        }),
        db.publicProfile.findMany({
            where: {
                dofusServerId: viewer.serverId,
                showOnDirectory: true,
            },
            select: { id: true, pseudoDofus: true, classe: true },
            orderBy: { id: "desc" },
            take: SHARED_SUCCES_VISITORS_TAKE + 1,
        }),
    ]);

    const board = buildSharedBountyBoard({
        bounty: toBounty(bounty),
        doneRows: doneRows.map((row) => ({
            member: {
                id: row.profile.id,
                pseudo: row.profile.pseudoDofus,
                classe: row.profile.classe,
            } satisfies SharedSuccesMember,
        })),
        visitors: visitors.map((visitor) => ({
            id: visitor.id,
            pseudo: visitor.pseudoDofus,
            classe: visitor.classe,
        })),
    });

    return { bounty: toBounty(bounty), board };
}

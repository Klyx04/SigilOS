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
    buildSharedSuccesBoard,
    isSharedSuccesDungeonKey,
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

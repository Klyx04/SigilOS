/**
 * Hub « Communauté SigilOS » — vue « Échanges Metamob » (chantier 2), couche serveur.
 *
 * Une seule question : « parmi les partenaires que Metamob me propose pour ma quête,
 * lesquels sont des visiteurs de **mon** serveur qui ont accepté d'apparaître ? »
 *
 * Invariants :
 *  · la clé Metamob vient du profil du lecteur, reste **serveur** et n'entre jamais dans
 *    le cache ni dans un DTO ;
 *  · le serveur vient du profil du lecteur, jamais de l'URL ;
 *  · `showOnDirectory: true` et `dofusServerId: viewer.serverId` sont dans **chaque**
 *    requête de profils ;
 *  · Metamob indisponible, clé refusée ou quête absente ⇒ un **état d'écran**, jamais une
 *    page cassée ni un accès accordé par défaut.
 */

import { withCache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import {
    buildTradeBoard,
    classifyTradeFailure,
    isSameTradeServer,
    publicTradesMatchesCacheKey,
    publicTradesQuestCacheKey,
    TRADE_MATCHES_CACHE_TTL,
    TRADE_MATCHES_LIMIT,
    TRADE_QUEST_CACHE_TTL,
    type TradeBoard,
    type TradeMatchInput,
} from "@/lib/public-trades";
import {
    getOwnQuests,
    getQuestMatches,
    type MatchPartner,
    type UserQuest,
} from "@/lib/metamob-client";
import type { DirectoryViewer } from "@/server/public-directory";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";
import { pickVisitorOcreQuest, readVisitorMetamob } from "@/server/public-metamob";

export type TradeQuest = {
    /** Nom du personnage — donnée **du lecteur**, jamais d'un partenaire. */
    characterName: string;
    currentStep: number;
    /** Serveur de la quête Metamob — sert au hint « autre serveur ». */
    serverName: string;
};

export type VisitorTrades =
    | { status: "no-metamob"; viewerMetamobPseudo: string | null }
    | { status: "unauthorized"; viewerMetamobPseudo: string | null }
    | { status: "unavailable"; viewerMetamobPseudo: string | null }
    | { status: "no-quest"; viewerMetamobPseudo: string | null }
    | {
          status: "ready";
          viewerMetamobPseudo: string | null;
          quest: TradeQuest;
          /** La quête n'est pas visible publiquement sur Metamob. */
          hidden: boolean;
          /** La quête Metamob est sur un autre serveur que le profil SigilOS. */
          serverMismatch: boolean;
          board: TradeBoard;
      };

function toQuest(quest: UserQuest): TradeQuest {
    return {
        characterName: quest.character_name.slice(0, 200),
        currentStep: Number.isFinite(quest.current_step)
            ? Math.max(0, Math.trunc(quest.current_step))
            : 0,
        serverName: quest.server?.name ?? "",
    };
}

/** Ne garde que ce que l'écran affiche : ni avatar, ni dernière activité, ni quête du partenaire. */
function toMatchInput(match: MatchPartner): TradeMatchInput {
    const monsters = (
        list: ReadonlyArray<{
            id: number;
            name?: { fr?: string } | null;
            covers_need?: boolean | null;
        }>
    ) =>
        list.map((monster) => ({
            id: monster.id,
            name: monster.name?.fr || `Monstre #${monster.id}`,
            coversNeed: !!monster.covers_need,
        }));

    return {
        username: match.user.username,
        matchScore: match.match_score,
        theyHaveYouWant: monsters(match.matches.they_have_you_want),
        youHaveTheyWant: monsters(match.matches.you_have_they_want),
    };
}

export async function getVisitorTrades(viewer: DirectoryViewer): Promise<VisitorTrades> {
    let metamob: { key: string | null; pseudo: string | null };
    try {
        metamob = await readVisitorMetamob(viewer.userId);
    } catch (error) {
        // Clé indéchiffrable / profil illisible : refus explicite, jamais un accès par défaut.
        logger.warn("[Échanges visiteurs] Lecture Metamob impossible", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { status: "unavailable", viewerMetamobPseudo: null };
    }

    if (!metamob.key) {
        return { status: "no-metamob", viewerMetamobPseudo: metamob.pseudo };
    }
    const key = metamob.key;
    const viewerMetamobPseudo = metamob.pseudo;

    let quest: UserQuest | null;
    try {
        quest = await withCache<UserQuest | null>(
            publicTradesQuestCacheKey(viewer.userId),
            TRADE_QUEST_CACHE_TTL,
            async () => pickVisitorOcreQuest(await getOwnQuests(key))
        );
    } catch (error) {
        const failure = classifyTradeFailure(error);
        logger.warn("[Échanges visiteurs] Quête Metamob illisible", { code: failure });
        if (failure === "not-found") return { status: "no-quest", viewerMetamobPseudo };
        return {
            status: failure === "unauthorized" ? "unauthorized" : "unavailable",
            viewerMetamobPseudo,
        };
    }
    if (!quest) return { status: "no-quest", viewerMetamobPseudo };

    let raw: { matches: MatchPartner[]; total: number };
    try {
        const slug = quest.slug;
        raw = await withCache(
            publicTradesMatchesCacheKey(viewer.userId),
            TRADE_MATCHES_CACHE_TTL,
            async () => {
                const result = await getQuestMatches(slug, {
                    guildApiKey: key,
                    limit: TRADE_MATCHES_LIMIT,
                    revalidate: 0,
                });
                return { matches: result.matches, total: result.pagination.total };
            }
        );
    } catch (error) {
        const failure = classifyTradeFailure(error);
        logger.warn("[Échanges visiteurs] Partenaires Metamob illisibles", { code: failure });
        if (failure === "not-found") return { status: "no-quest", viewerMetamobPseudo };
        return {
            status: failure === "unauthorized" ? "unauthorized" : "unavailable",
            viewerMetamobPseudo,
        };
    }

    const matches = raw.matches.map(toMatchInput);
    const usernames = Array.from(
        new Set(matches.map((match) => match.username.trim()).filter(Boolean))
    ).slice(0, TRADE_MATCHES_LIMIT);

    const visitors =
        usernames.length === 0
            ? []
            : await db.publicProfile.findMany({
                  where: {
                      dofusServerId: viewer.serverId,
                      showOnDirectory: true,
                      metamobPseudo: { in: usernames, mode: "insensitive" },
                  },
                  select: {
                      id: true,
                      pseudoDofus: true,
                      classe: true,
                      metamobPseudo: true,
                  },
                  take: TRADE_MATCHES_LIMIT,
              });

    const board = buildTradeBoard({
        matches,
        visitors: visitors.map((visitor) => ({
            id: visitor.id,
            pseudo: visitor.pseudoDofus,
            classe: visitor.classe,
            metamobPseudo: visitor.metamobPseudo,
        })),
        viewerProfileId: viewer.profileId,
        viewerMetamobPseudo,
        apiTotal: raw.total,
    });

    const viewerServerName =
        ALL_DOFUS_SERVER_ENTRIES.find((server) => server.id === viewer.serverId)?.name ?? "";

    return {
        status: "ready",
        viewerMetamobPseudo,
        quest: toQuest(quest),
        hidden: quest.show_trades === false,
        serverMismatch:
            !!quest.server?.name &&
            !!viewerServerName &&
            !isSameTradeServer(quest.server.name, viewerServerName),
        board,
    };
}

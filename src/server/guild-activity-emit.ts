/**
 * Chantier **N**, lot **N-2a** — **émetteur unique** des annonces d'activité de guilde.
 *
 * Un module qui veut nourrir le flux de vie de la guilde n'écrit **jamais** un `ServiceActivityLog`
 * à la main : il appelle cette fonction. Elle porte, en un seul endroit :
 *   · la résolution de l'**acteur** (profil à partir d'un `profileId` **ou** d'un `userId` — les
 *     modules ne manipulent pas toujours la même clé : DJ donne un profileId, Songes un userId) ;
 *   · la **copie** (`buildGuildActivityCopy`, texte borné, jamais de HTML) ;
 *   · le **module** écrit en base (`GUILD_ACTIVITY_MODULE_BY_KIND` — la même table que la lecture).
 *
 * Décisions de conception (15/10/2026) :
 *   · **une seule ligne** par événement, jamais une par participant (350 copies = spam de base) :
 *     la bulle affichée par membre est une **conséquence** du flux, filtrée par ses préférences au
 *     moment de la lecture (`getGuildActivityToasts`) ;
 *   · **fail-closed** : sans acteur identifiable, on n'écrit **rien** (pas d'acteur inventé), et une
 *     erreur d'écriture ne remonte **jamais** au module appelant — une annonce manquée ne doit pas
 *     casser une clôture de donjon ni une validation de Dofus.
 *
 * Pas de directive `"use server"` : module serveur appelé par les actions métier (même forme que
 * `ladder-milestones.ts`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { logServiceActivity } from "@/server/actions/activity-log-actions";
import {
    GUILD_ACTIVITY_MODULE_BY_KIND,
    buildGuildActivityCopy,
    type GuildActivityKind,
} from "@/lib/guild-activity";

export interface EmitGuildActivityInput {
    /** Id **interne** de la guilde (`GuildConfig.id`), jamais le snowflake Discord. */
    guildId: string;
    /** Le membre qui a fait l'action : au moins l'une des deux clés. */
    profileId?: string | null;
    userId?: string | null;
    kind: GuildActivityKind;
    /** Clé d'**idempotence** : un même événement n'écrit qu'une ligne (id du post, de la run…). */
    entityId: string;
    /** Le détail utile (nom du donjon, du Dofus, épreuve…) — borné par la copie. */
    detail?: string | null;
    /** Pour les paliers de points. */
    points?: unknown;
    /**
     * Asset de l'**objet** annoncé (illustration de donjon, icône de Dofus, picto de succès).
     * Rangé dans `ServiceActivityLog.metadata` — le flux le relit tel quel, donc **aucune
     * migration** : une ligne de flux porte déjà tout ce dont la bulle a besoin.
     */
    imageUrl?: string | null;
    /** Ce que l'asset représente (`NotificationImageKind`). Ignoré si `imageUrl` est absent. */
    imageKind?: string | null;
}

/** Colonnes de l'acteur d'une ligne de flux (jamais plus, jamais moins). */
const ACTOR_SELECT = { id: true, pseudoDofus: true, discordNickname: true } as const;

/**
 * Résout le profil de l'acteur. Les modules ne manipulent pas la même clé (`DJ` donne un
 * `profileId`, `Songes` un `userId`) — et un module qui passe un `User.id` sous le nom
 * `profileId` ne doit pas **perdre** son annonce en silence : on retente une fois en
 * `userId`. **Fail-closed** : aucun profil identifié ⇒ `null`, on n'écrit rien (l'acteur est
 * une FK, une ligne orpheline serait pire qu'une annonce manquée).
 */
async function resolveActor(input: EmitGuildActivityInput) {
    if (input.profileId) {
        const byId = await db.userProfile.findUnique({
            where: { id: input.profileId },
            select: ACTOR_SELECT,
        });
        if (byId) return byId;
        const asUser = await db.userProfile.findFirst({
            where: { userId: input.profileId, guildId: input.guildId },
            select: ACTOR_SELECT,
        });
        if (asUser) return asUser;
    }
    if (input.userId) {
        return db.userProfile.findFirst({
            where: { userId: input.userId, guildId: input.guildId },
            select: ACTOR_SELECT,
        });
    }
    return null;
}

/** Écrit **une** ligne d'activité de guilde. Ne lève jamais, ne renvoie rien d'exploitable. */
export async function emitGuildActivity(input: EmitGuildActivityInput): Promise<void> {
    try {
        const profile = await resolveActor(input);

        // Fail-closed : sans profil identifiable, la ligne serait orpheline (l'acteur est une FK).
        if (!profile) return;

        const copy = buildGuildActivityCopy({
            kind: input.kind,
            memberName: profile.pseudoDofus ?? profile.discordNickname,
            detail: input.detail ?? null,
            points: input.points,
        });

        await logServiceActivity({
            guildId: input.guildId,
            actorId: profile.id,
            module: GUILD_ACTIVITY_MODULE_BY_KIND[input.kind],
            action: "VALIDATED",
            entityId: input.entityId,
            summary: copy.message,
            metadata: JSON.stringify({
                kind: input.kind,
                ...(input.imageUrl ? { imageUrl: input.imageUrl, imageKind: input.imageKind ?? null } : {}),
            }),
        });
    } catch (error) {
        logger.warn("[emitGuildActivity] annonce non écrite", { error: String(error) });
    }
}

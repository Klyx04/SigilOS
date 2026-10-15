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
}

/** Écrit **une** ligne d'activité de guilde. Ne lève jamais, ne renvoie rien d'exploitable. */
export async function emitGuildActivity(input: EmitGuildActivityInput): Promise<void> {
    try {
        const profile = input.profileId
            ? await db.userProfile.findUnique({
                  where: { id: input.profileId },
                  select: { id: true, pseudoDofus: true, discordNickname: true },
              })
            : input.userId
              ? await db.userProfile.findFirst({
                    where: { userId: input.userId, guildId: input.guildId },
                    select: { id: true, pseudoDofus: true, discordNickname: true },
                })
              : null;

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
            metadata: JSON.stringify({ kind: input.kind }),
        });
    } catch (error) {
        logger.warn("[emitGuildActivity] annonce non écrite", { error: String(error) });
    }
}

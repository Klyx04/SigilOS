/**
 * Chantier **N**, lot **N-2** — **émission** des paliers de points de succès dans le flux.
 *
 * Pourquoi ici (et pas à la validation) : les points de succès ne sont **pas** écrits au moment
 * d'une validation — ils arrivent par la **passe ladder** (`/api/cron/ladder-sync`, worker BullMQ),
 * qui est le **seul** moment où l'on connaît l'ancien et le nouveau score. C'est donc là qu'on
 * détecte un franchissement, une fois, sans accrocher les 4 chemins d'écriture des points.
 *
 * L'annonce est **une seule ligne** dans `ServiceActivityLog` (décision du 15/10/2026 : pas de copie
 * par membre — 350 lignes par événement serait du spam de base) : le flux la porte, la bulle de
 * l'interface en découle.
 *
 * `logServiceActivity` avale ses erreurs : une annonce manquée ne casse **jamais** la passe ladder.
 */

import { logServiceActivity } from "@/server/actions/activity-log-actions";
import { logger } from "@/lib/logger";
import { NOTIFICATION_CATEGORY_ICONS } from "@/lib/notification-categories";
import {
    GUILD_ACTIVITY_MODULE_BY_KIND,
    buildGuildActivityCopy,
    resolveHighestSuccessPointsMilestone,
    resolveLadderTopEntry,
} from "@/lib/guild-activity";

/**
 * Écrit une ligne d'activité si un **palier** de points a été franchi entre `before` et `after`.
 * Retourne le palier annoncé, ou `null` quand il n'y a rien à fêter (baisse, aucun franchissement,
 * score inconnu — `successPoints` est nullable et vaut alors `0`).
 */
export async function emitSuccessPointsMilestone(input: {
    /** Id **interne** de la guilde (`GuildConfig.id`), pas le snowflake Discord. */
    guildId: string;
    profileId: string;
    displayName: string | null;
    before: unknown;
    after: unknown;
}): Promise<number | null> {
    const milestone = resolveHighestSuccessPointsMilestone(input.before, input.after);
    if (milestone === null) return null;

    try {
        const copy = buildGuildActivityCopy({
            kind: "paliers",
            memberName: input.displayName,
            points: milestone,
        });
        await logServiceActivity({
            guildId: input.guildId,
            actorId: input.profileId,
            module: GUILD_ACTIVITY_MODULE_BY_KIND.paliers,
            action: "MILESTONE",
            entityId: input.profileId,
            summary: copy.message,
            metadata: JSON.stringify({
                kind: "paliers",
                points: milestone,
                // Picto réel du succès : la bulle montre *quoi* on fête, pas un point générique.
                imageUrl: NOTIFICATION_CATEGORY_ICONS.SUCCESS,
                imageKind: "SUCCESS",
            }),
        });
        return milestone;
    } catch (error) {
        logger.warn("[emitSuccessPointsMilestone] annonce non écrite", { error: String(error) });
        return null;
    }
}

/**
 * Écrit une ligne d'activité si le membre **entre** dans le top du ladder succès de sa guilde.
 *
 * Pourquoi ici : le rang ne se lit qu'à la **passe ladder** — c'est le seul endroit qui connaît
 * le classement de la guilde **avant** et **après** le relevé du membre. La règle pure
 * `resolveLadderTopEntry` n'annonce que l'**entrée** : y rester, progresser dedans ou en sortir
 * ne dit rien de nouveau (une seule annonce par entrée, même exigence que les paliers).
 *
 * `rankBefore`/`rankAfter` sont fournis par l'appelant (deux comptages) : la fonction reste sans
 * requête de classement propre, donc testable et sans effet de bord.
 */
export async function emitLadderTopEntry(input: {
    /** Id **interne** de la guilde (`GuildConfig.id`). */
    guildId: string;
    profileId: string;
    displayName: string | null;
    rankBefore: number | null;
    rankAfter: number | null;
}): Promise<number | null> {
    const rank = resolveLadderTopEntry({
        previousRank: input.rankBefore,
        currentRank: input.rankAfter,
    });
    if (rank === null) return null;

    try {
        const copy = buildGuildActivityCopy({ kind: "ladder", memberName: input.displayName });
        await logServiceActivity({
            guildId: input.guildId,
            actorId: input.profileId,
            module: GUILD_ACTIVITY_MODULE_BY_KIND.ladder,
            action: "MILESTONE",
            entityId: `ladder-top:${input.profileId}`,
            summary: copy.message,
            metadata: JSON.stringify({
                kind: "ladder",
                rank,
                imageUrl: NOTIFICATION_CATEGORY_ICONS.SUCCESS,
                imageKind: "SUCCESS",
            }),
        });
        return rank;
    } catch (error) {
        logger.warn("[emitLadderTopEntry] annonce non écrite", { error: String(error) });
        return null;
    }
}

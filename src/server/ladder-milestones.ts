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
import {
    GUILD_ACTIVITY_MODULE_BY_KIND,
    buildGuildActivityCopy,
    resolveHighestSuccessPointsMilestone,
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
            metadata: JSON.stringify({ kind: "paliers", points: milestone }),
        });
        return milestone;
    } catch (error) {
        logger.warn("[emitSuccessPointsMilestone] annonce non écrite", { error: String(error) });
        return null;
    }
}

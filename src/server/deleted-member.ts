/**
 * **Compte technique « Ancien membre »** (décision user du 30/10/2026, option C).
 *
 * Problème mesuré : `purgeOrphanAccountsCore` **refusait** de supprimer un compte ayant créé
 * un `GuildEvent` (`if (user._count.guildEvents > 0) continue`, `account-retention-core.ts`),
 * parce que `GuildEvent.creator` est en `onDelete: Cascade` : supprimer le compte effaçait
 * les événements de la guilde. Conséquence : un partant qui avait créé un raid gardait son
 * compte **à vie** dans la base.
 *
 * Décision retenue : on **garde** l'événement pour la guilde, on **remplace son créateur**
 * par un compte technique nommé « Ancien membre », puis on supprime le vrai compte.
 *
 * Pourquoi un compte technique plutôt qu'une colonne nullable : `creatorId` reste
 * **non-nullable**, donc aucune relation ne devient optionnelle et **aucun écran** (calendrier,
 * fiche raid, rappels, transferts) n'a besoin d'être repris — le nom affiché vient de
 * `User.name`. Zéro migration, zéro chemin « créateur absent » à gérer.
 *
 * ⚠️ Ce compte ne doit **jamais** être purgé lui-même (sinon la cascade emporterait tous les
 * événements anonymisés) : `isDeletedMemberUser` est vérifié en tête de la purge.
 *
 * Module **interne** (pas `"use server"`) : il n'est pas exposable comme server action.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isAgendaMirror } from "@/lib/agenda-mirror";

/** Identifiant **fixe** du compte technique — jamais généré, jamais deviné. */
export const DELETED_MEMBER_USER_ID = "system-deleted-member";

/** Nom affiché partout où le créateur est montré (`User.name`). */
export const DELETED_MEMBER_NAME = "Ancien membre";

/** Le compte technique est-il celui-ci ? (fail-closed : comparaison stricte) */
export function isDeletedMemberUser(userId: string | null | undefined): boolean {
    return userId === DELETED_MEMBER_USER_ID;
}

/**
 * Crée (ou répare) le compte technique. Idempotent.
 * Il n'a **ni e-mail, ni compte OAuth, ni profil de guilde** : il n'est pas connectable.
 */
export async function ensureDeletedMemberUser(): Promise<string> {
    await db.user.upsert({
        where: { id: DELETED_MEMBER_USER_ID },
        create: { id: DELETED_MEMBER_USER_ID, name: DELETED_MEMBER_NAME },
        // Le nom est **réaffirmé** : un renommage manuel ne doit pas réafficher un pseudo.
        update: { name: DELETED_MEMBER_NAME },
    });
    return DELETED_MEMBER_USER_ID;
}

export type ReattributeOutcome = {
    /** Événements rattachés au compte technique. */
    moved: number;
    /** Événements encore ouverts passés en `CANCELLED`. */
    cancelled: number;
    /** Événements dont `metadata.raidCaptain` portait encore l'identité purgée. */
    captainScrubbed: number;
};

/**
 * Transfère les événements d'un compte vers « Ancien membre » — **avant** sa suppression.
 *
 * Trois gestes, dans cet ordre :
 *  1. un compte qui disparaît ne laisse pas d'événement **vivant** : les `DRAFT`/`PUBLISHED`
 *     sont annulés (les **miroirs** agenda sont écartés — leur état suit leur source, fermée
 *     par la cascade de contenu) ;
 *  2. le nom du capitaine vit **aussi** dans `metadata.raidCaptain` (fiche raid) : il est
 *     remplacé, sinon un écran réafficherait l'identité purgée ;
 *  3. tous les événements du compte sont rattachés au compte technique — ils restent dans
 *     l'historique de la guilde, signés « Ancien membre ».
 *
 * Best-effort : un échec est journalisé et l'appelant décide (la purge ne doit pas casser).
 */
export async function reattributeGuildEvents(userId: string): Promise<ReattributeOutcome> {
    const target = await ensureDeletedMemberUser();

    const events = await db.guildEvent.findMany({
        where: { creatorId: userId },
        select: { id: true, status: true, metadata: true },
    });

    // 1. Annulation des événements encore ouverts (miroirs exclus).
    const liveIds = events
        .filter((event) => (event.status === "DRAFT" || event.status === "PUBLISHED") && !isAgendaMirror(event.metadata))
        .map((event) => event.id);
    const cancelled = liveIds.length
        ? (await db.guildEvent.updateMany({
              where: { id: { in: liveIds }, status: { in: ["DRAFT", "PUBLISHED"] } },
              data: { status: "CANCELLED" },
          })).count
        : 0;

    // 2. Le capitaine est aussi un nom dans le JSON — on le remplace.
    let captainScrubbed = 0;
    for (const event of events) {
        const meta = event.metadata;
        if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
        const record = meta as Record<string, unknown>;
        if (!("raidCaptain" in record) && !("raidCaptainId" in record)) continue;
        await db.guildEvent.update({
            where: { id: event.id },
            data: {
                metadata: { ...record, raidCaptain: DELETED_MEMBER_NAME, raidCaptainId: null } as never,
            },
        });
        captainScrubbed++;
    }

    // 3. Les événements restent, signés « Ancien membre ».
    const moved = await db.guildEvent.updateMany({
        where: { creatorId: userId },
        data: { creatorId: target },
    });

    if (moved.count > 0 || cancelled > 0) {
        logger.info("[DeletedMember] événements rattachés au compte technique", {
            moved: moved.count,
            cancelled,
            captainScrubbed,
        });
    }

    return { moved: moved.count, cancelled, captainScrubbed };
}

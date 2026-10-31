/**
 * Règles pures du **cycle de vie d'un raid** — lot **R1-P0** (audit du 30/10/2026), **aucune I/O**.
 *
 * Trois décisions y vivent, une seule fois, pour que le serveur et ses tests parlent le même langage :
 *
 * 1. **Routage de clôture** — un raid ne se clôture **jamais** par la clôture générique
 *    (`completeEvent`) : celle-ci crédite **tous** les inscrits sans sélection des présents
 *    (mesure : `+50 XP` à tout le monde, `calendar-actions.ts:1341` avant ce lot).
 * 2. **Entrée de clôture bornée** — le score est **obligatoire** (Zod borné : 1..40 caractères,
 *    au plus 32 présents). Aucun `0` ni chaîne vide ne doit passer pour un score.
 * 3. **Republication après undo** — la clôture **supprime** l'embed Discord ; `deleteEventDiscordMessage`
 *    ne vide **pas** `discordMessageId` en base (mesuré). Un `PATCH` sur ce message mort échoue
 *    silencieusement et laisse un raid « fantôme » : on **republie**, jamais on ne patche.
 */

import { z } from "zod";

/** Type d'événement du raid officiel (miroir de l'enum Prisma). */
export const RAID_EVENT_TYPE = "RAID_OFFICIAL";

/**
 * Un raid doit passer par **sa** clôture (score + présents), pas par la clôture générique.
 * `ok: false` porte le message à afficher tel quel à l'utilisateur.
 */
export function assertRaidClosureRoute(
    eventType: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
    if (eventType === RAID_EVENT_TYPE) {
        return { ok: false, error: "Utilisez la clôture raid (score + présents)." };
    }
    return { ok: true };
}

/** Entrée de clôture raid — bornée : score 1..40, présents ≤ 32 identifiants de 64 caractères max. */
const RaidClosureSchema = z.object({
    score: z
        .string()
        .trim()
        .min(1, "Le score du raid est obligatoire.")
        .max(40, "Le score du raid est trop long (40 caractères maximum)."),
    presentUserIds: z.array(z.string().min(1).max(64)).max(32, "Trop de présents pour un raid (32 maximum)."),
});

/** Ce que l'écran peut envoyer (le champ `score` peut arriver vide ou absent). */
export interface RaidClosureInput {
    score?: unknown;
    presentUserIds?: unknown;
}

/**
 * Valide et **normalise** l'entrée de clôture (`score` nettoyé, présents dédoublonnés).
 * `ok: false` ⇒ on refuse la clôture, sans rien écrire.
 */
export function validateRaidClosureInput(
    input: RaidClosureInput,
): { ok: true; score: string; presentUserIds: string[] } | { ok: false; error: string } {
    const parsed = RaidClosureSchema.safeParse({
        score: typeof input?.score === "string" ? input.score : "",
        presentUserIds: Array.isArray(input?.presentUserIds) ? input.presentUserIds : [],
    });
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Clôture de raid invalide." };
    }
    return {
        ok: true,
        score: parsed.data.score,
        presentUserIds: [...new Set(parsed.data.presentUserIds)],
    };
}

/** Raccourci booléen (tests, désactivation d'un bouton d'écran). */
export function isValidRaidClosureInput(input: RaidClosureInput): boolean {
    return validateRaidClosureInput(input).ok;
}

/**
 * Après un undo : **republier** dès que le raid avait un embed.
 *
 * ⚠️ Ne pas remplacer par « patcher si `discordMessageId` existe » : il existe toujours (la purge
 * de clôture ne vide pas la colonne), alors que le message, lui, est **supprimé**.
 */
export function shouldRepublishAfterUndo(event: {
    discordChannelId?: string | null;
    discordMessageId?: string | null;
}): boolean {
    return Boolean(event?.discordChannelId && event?.discordMessageId);
}

/**
 * Marqueurs d'idempotence des rappels à effacer quand un raid est **rouvert**.
 *
 * Le cron `raid-reminders` s'appuie dessus pour ne pas poster deux fois (H-24, H-1, rappel de
 * clôture) : les garder bloquerait **à jamais** les rappels du raid rouvert.
 */
export const REMINDER_MARKERS_CLEARED_ON_UNDO = [
    "raidReminder24hSentAt",
    "raidReminderSentAt",
    "closureReminderSentAt",
    "eventReminderSentAt",
] as const;

/**
 * Métadonnées d'un raid **rouvert** : champs de clôture remis à zéro, rappels rejouables et
 * liste de messages vidée (la clôture les a supprimés). `now` est injectable pour les tests.
 */
export function buildRaidUndoMetadata(
    meta: Record<string, unknown> | null | undefined,
    actorUserId: string,
    now: Date = new Date(),
): Record<string, unknown> {
    const next: Record<string, unknown> = {
        ...(meta ?? {}),
        raidScore: null,
        raidPresentUserIds: [],
        completedAt: null,
        completedBy: null,
        closedBySystem: null,
        systemClosedAt: null,
        raidUndoneAt: now.toISOString(),
        raidUndoneBy: actorUserId,
        // Les messages de rappel ont été supprimés à la clôture : leurs refs sont mortes.
        reminderMessages: [],
    };
    for (const marker of REMINDER_MARKERS_CLEARED_ON_UNDO) delete next[marker];
    return next;
}

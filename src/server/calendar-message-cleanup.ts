/**
 * Nettoyage des messages Discord d'un événement calendrier — **module neutre**
 * (pas `"use server"` : il est partagé par les server actions et la passe de fond,
 * et ne doit jamais être exposé comme action appelable depuis le client).
 *
 * Deux familles de messages :
 *  - `metadata.reminderMessages` : rappels H-24, H-1, rappel de clôture et rappel
 *    manuel, tous postés dans le salon de l'événement (`storeMessageIdKey` côté outbox) ;
 *  - `GuildEvent.discordChannelId/discordMessageId` : l'embed de publication du raid.
 *
 * Un envoi passé par l'outbox ne stocke qu'un identifiant `outbox:<jobId>` : la
 * suppression le résout via la clé Redis (`messageKey`), d'où le `catch` par message
 * et le retour des refs **non** supprimées (un échec réseau reste rejouable).
 */

import { deleteChannelMessage } from "@/server/discord";

/** Entrée `metadata.reminderMessages` : le `messageKey` permet de résoudre le
 * vrai snowflake quand l'envoi est passé par l'outbox (`outbox:<jobId>`). */
export type ReminderMessageRef = {
    channelId: string;
    messageId: string;
    messageKey?: string | null;
};

/**
 * Supprime les messages de rappel d'un événement.
 * @returns les refs qui n'ont **pas** pu être supprimées (à conserver pour rejouer).
 */
export async function deleteReminderMessageRefs(refs: ReminderMessageRef[]): Promise<ReminderMessageRef[]> {
    if (!refs || refs.length === 0) return [];
    const failed: ReminderMessageRef[] = [];
    const tasks: Promise<void>[] = [];
    for (const rm of refs) {
        if (!rm?.channelId || !rm?.messageId) continue;
        tasks.push(
            deleteChannelMessage(rm.channelId, rm.messageId, rm.messageKey ?? null)
                .then((deleted) => {
                    if (!deleted) failed.push(rm);
                })
                .catch(() => {
                    failed.push(rm);
                })
        );
    }
    if (tasks.length > 0) await Promise.allSettled(tasks);
    return failed;
}

/**
 * Supprime l'embed de publication de l'événement (message de salon ou post de forum).
 * @returns `true` uniquement si une suppression a réellement eu lieu.
 */
export async function deleteEventDiscordMessage(event: {
    id: string;
    discordChannelId: string | null;
    discordMessageId: string | null;
}): Promise<boolean> {
    if (!event.discordChannelId || !event.discordMessageId) return false;
    const { eventMessageKey } = await import("@/server/calendar-service");
    return deleteChannelMessage(
        event.discordChannelId,
        event.discordMessageId,
        eventMessageKey(event.id)
    ).catch(() => false);
}

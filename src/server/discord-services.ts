import { logger } from "@/lib/logger";
import {
    isForumOnlyChannelType,
    resolveServiceMessageTarget,
    serviceThreadName,
    type ServiceMessageTarget,
} from "@/lib/service-discord";
import {
    createForumThread,
    deleteChannelMessage,
    fetchChannel,
    patchChannelMessage,
    postChannelMessage,
} from "@/server/discord";

/**
 * Publication et maintenance des messages du module **Services** dans le salon
 * configuré (`GuildConfig.servicesNotifyChannelId`), **quel que soit son type**.
 *
 * Mesure du 25/10/2026 : le sélecteur accepte un salon **forum** (`15`), mais un
 * forum n'accepte aucun message direct (`discord-api-types` : `GuildForum = 15`
 * « A channel that can only contain threads »). Publier avec un simple
 * `POST /channels/{id}/messages` répondait donc une erreur — avalée par le
 * `try/catch` de l'appelant : la demande client était enregistrée, rien
 * n'apparaissait sur Discord, et l'écran annonçait quand même un succès.
 *
 * Cette couche est la **seule** à savoir comment écrire dans le salon de service :
 * les appelants ne décident plus du type de salon.
 */

/** @returns la cible réelle (salon + message), ou `null` si Discord a refusé. */
export async function postServiceMessage(
    channelId: string,
    body: Record<string, unknown>,
    threadName: string
): Promise<ServiceMessageTarget | null> {
    let channelType: number | null = null;
    let channel: Awaited<ReturnType<typeof fetchChannel>> = null;
    try {
        channel = await fetchChannel(channelId);
        channelType = channel?.type ?? null;
    } catch (err) {
        // Fail-closed : sans le type du salon, on n'écrit pas au hasard
        // (un forum refuserait le message, un texte créerait un doublon).
        logger.warn("[services/discord] type de salon illisible, publication annulée", {
            err: String(err),
        });
        return null;
    }

    if (isForumOnlyChannelType(channelType)) {
        // Forum / média : le post EST un fil, et l'id du fil est celui du message d'amorçage.
        // Un forum qui `RequireTag` refuse un sujet sans étiquette : on applique la première
        // étiquette non modérée (même règle que les cartes d'annonce, historique du module).
        const appliedTags = (channel?.available_tags ?? [])
            .filter((tag) => !tag.moderated)
            .slice(0, 1)
            .map((tag) => tag.id);
        const threadBody: Record<string, unknown> = {
            name: serviceThreadName(threadName),
            message: body,
        };
        if (appliedTags.length > 0) threadBody.applied_tags = appliedTags;

        const thread = await createForumThread(channelId, threadBody);
        if (!thread) return null;
        return { channelId: thread.id, messageId: thread.id };
    }

    try {
        const messageId = await postChannelMessage(channelId, body);
        if (!messageId) return null;
        return { channelId, messageId };
    } catch (err) {
        logger.warn("[services/discord] envoi du message refusé par Discord", { err: String(err) });
        return null;
    }
}

/**
 * Poste un message de **dialogue** (réponse passeur ⇄ client).
 *
 * Dans un **forum**, la conversation doit rester dans le fil de la demande : on écrit donc
 * dans le fil existant (l'id du fil est celui du message d'amorçage) au lieu de créer un
 * nouveau sujet à chaque réponse. Dans un salon classique, le message va dans le salon.
 */
export async function postServiceThreadMessage(
    configuredChannelId: string,
    storedRequestMessageId: string | null,
    body: Record<string, unknown>,
    threadName: string
): Promise<ServiceMessageTarget | null> {
    if (!storedRequestMessageId) {
        return postServiceMessage(configuredChannelId, body, threadName);
    }

    let channel: Awaited<ReturnType<typeof fetchChannel>> = null;
    try {
        channel = await fetchChannel(configuredChannelId);
    } catch (err) {
        logger.warn("[services/discord] type de salon illisible, réponse non publiée", {
            err: String(err),
        });
        return null;
    }

    if (!isForumOnlyChannelType(channel?.type ?? null)) {
        return postServiceMessage(configuredChannelId, body, threadName);
    }

    try {
        const messageId = await postChannelMessage(storedRequestMessageId, body);
        return messageId ? { channelId: storedRequestMessageId, messageId } : null;
    } catch (err) {
        logger.warn("[services/discord] réponse refusée par Discord", { err: String(err) });
        return null;
    }
}

/**
 * Résout la cible d'un message déjà publié, puis la renvoie. `null` si le salon
 * est introuvable/illisible (le message sera alors laissé tel quel).
 */
async function resolveStoredTarget(
    configuredChannelId: string,
    storedMessageId: string
): Promise<ServiceMessageTarget | null> {
    try {
        const channel = await fetchChannel(configuredChannelId);
        if (!channel) return null;
        return resolveServiceMessageTarget({
            configuredChannelId,
            configuredChannelType: channel.type ?? null,
            storedMessageId,
        });
    } catch (err) {
        logger.warn("[services/discord] résolution de la cible impossible", { err: String(err) });
        return null;
    }
}

/** Met à jour un message de service déjà publié (embed clôturé, avis…). */
export async function patchServiceMessage(
    configuredChannelId: string,
    storedMessageId: string,
    body: Record<string, unknown>
): Promise<boolean> {
    const target = await resolveStoredTarget(configuredChannelId, storedMessageId);
    if (!target) return false;
    return patchChannelMessage(target.channelId, target.messageId, body);
}

/** Supprime un message de service déjà publié (annulation, purge, annonce supprimée). */
export async function deleteServiceMessage(
    configuredChannelId: string,
    storedMessageId: string
): Promise<boolean> {
    const target = await resolveStoredTarget(configuredChannelId, storedMessageId);
    if (!target) return false;
    return deleteChannelMessage(target.channelId, target.messageId);
}

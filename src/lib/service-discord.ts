/**
 * Cible Discord d'un message du module **Services** — règle pure (aucune I/O).
 *
 * Pourquoi cette règle existe (mesuré le 25/10/2026) : le salon configuré
 * (`GuildConfig.servicesNotifyChannelId`) peut être un **forum** depuis que le
 * sélecteur accepte `15` (`DISCORD_FORUM_CHANNEL_TYPES`). Or un forum n'accepte
 * **aucun message direct** — `discord-api-types` : `GuildForum = 15`
 * « A channel that can only contain threads ». Un post y est un **fil**
 * (`POST /channels/{id}/threads`), et l'id du fil **est** celui du message
 * d'amorçage (discord.js `ThreadChannel.fetchStarterMessage` →
 * `GET /channels/{thread.id}/messages/{thread.id}`).
 *
 * Conséquence : patcher/supprimer un message de service exige de savoir dans
 * **quel salon** il vit réellement. Cette fonction le dit, sans deviner.
 */

/** Types qui ne contiennent **que** des fils : 15 = GUILD_FORUM, 16 = GUILD_MEDIA. */
export const FORUM_ONLY_CHANNEL_TYPES = [15, 16] as const;

/** Nom de sujet borné par Discord : 1 à 100 caractères. */
export const SERVICE_THREAD_NAME_MAX = 100;

/**
 * Vrai si le type de salon n'accepte que des **fils** (forum / média).
 * Un type inconnu (`null`, `undefined`) répond `false` : on ne devine jamais un forum.
 */
export function isForumOnlyChannelType(type: number | null | undefined): boolean {
    if (typeof type !== "number") return false;
    return (FORUM_ONLY_CHANNEL_TYPES as readonly number[]).includes(type);
}

/**
 * Nom d'un sujet de forum : espaces compactés, jamais vide, **tronqué à 100**
 * (Discord refuse au-delà, et refuse un nom vide).
 */
export function serviceThreadName(raw: string | null | undefined, fallback = "Service"): string {
    const compact = (raw ?? "").replace(/\s+/g, " ").trim();
    const name = compact.length > 0 ? compact : fallback;
    return name.slice(0, SERVICE_THREAD_NAME_MAX);
}

/**
 * Salon qui reçoit les **demandes** des clients : le salon dédié s'il est configuré,
 * sinon le champ historique (`servicesNotifyChannelId`), conservé en repli pour ne
 * perdre aucune configuration existante.
 */
export function resolveServiceRequestsChannelId(config: {
    servicesRequestsChannelId?: string | null;
    legacyNotifyChannelId?: string | null;
}): string | null {
    const dedicated = config.servicesRequestsChannelId?.trim();
    if (dedicated) return dedicated;
    const legacy = config.legacyNotifyChannelId?.trim();
    return legacy || null;
}

export type ServiceMessageTarget = {
    /** Salon qui contient réellement le message (le fil, pour un forum). */
    channelId: string;
    /** Id du message à patcher ou supprimer. */
    messageId: string;
};

/**
 * Résout la cible réelle d'un message déjà publié par le module Services.
 *
 * - **forum / média** : le message d'amorçage vit dans le **fil**, dont l'id est
 *   celui du message → `{ channelId: idStocké, messageId: idStocké }` ;
 * - **salon classique** : `{ channelId: salonConfiguré, messageId: idStocké }`.
 */
export function resolveServiceMessageTarget(input: {
    configuredChannelId: string;
    /** `type` Discord du salon qui contient l'id stocké (forum parent, ou fil). */
    configuredChannelType: number | null;
    storedMessageId: string;
}): ServiceMessageTarget {
    const { configuredChannelId, configuredChannelType, storedMessageId } = input;

    if (isForumOnlyChannelType(configuredChannelType)) {
        return { channelId: storedMessageId, messageId: storedMessageId };
    }

    return { channelId: configuredChannelId, messageId: storedMessageId };
}

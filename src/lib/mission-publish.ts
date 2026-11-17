/**
 * Missions — **règle de publication Discord** (pure, client + serveur).
 *
 * 🐛 Mesure du 17/11/2026 (retour user « la mission ne se publie pas sur Discord ») :
 * `handleFirstPublish` court-circuitait tout Discord dès que `pingType === "NONE"`
 * (`skipDiscord = pingType === "NONE" || !isDiscordConfigured || !channelId`).
 * Or « Sans ping » veut dire « publier l'annonce **sans mentionner** @everyone/@rôle »,
 * pas « ne rien envoyer » : l'embed doit partir avec un message neutre (« Bonjour à tous ! »,
 * déjà géré par `publishMissionsToDiscord`).
 *
 * Seuls deux cas justifient l'enregistrement **silencieux** (aucun message Discord) :
 *   • le bot n'est pas configuré (`isDiscordConfigured === false`) ;
 *   • aucun salon d'annonce n'est configuré (`channelId` vide).
 *
 * Fail-closed conservé : sans salon, on n'invente pas de destination.
 */

export type MissionPingType = "EVERYONE" | "ROLE" | "NONE";

export interface MissionAnnouncementTarget {
    pingType: MissionPingType;
    isDiscordConfigured?: boolean;
    channelId?: string | null;
}

/**
 * `true` quand un message Discord doit être publié (avec ou sans mention).
 * Le `pingType` **ne décide pas** de l'envoi : il ne change que le contenu de la mention.
 */
export function shouldPublishMissionAnnouncement({
    isDiscordConfigured = true,
    channelId,
}: MissionAnnouncementTarget): boolean {
    if (!isDiscordConfigured) return false;
    return typeof channelId === "string" && channelId.trim().length > 0;
}

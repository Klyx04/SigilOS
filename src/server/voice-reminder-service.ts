/**
 * Statut vocal avant rappel manuel — couche I/O fine.
 *
 * Utilisé par les modales de rappel (calendrier, DJ, Songes) pour afficher :
 * « Salon détecté : X — N/M déjà en vocal — seuls les absents seront pingés ».
 *
 * Règle « suivre le capitaine » (`@/lib/voice-filter`) :
 *  - capitaine en vocal dans `V` → présents = assis avec lui dans `V` ;
 *  - sinon → présents = dans n'importe quel vocal du serveur.
 * Fail-open : état vocal inconnu → tout le monde à pinger.
 */

import { getGuildVoiceStates } from "@/server/discord";
import { splitVoiceAbsent } from "@/lib/voice-filter";

export type VoiceReminderStatus = {
    captainDiscordId: string | null;
    captainChannelId: string | null;
    presentDiscordIds: string[];
    absentDiscordIds: string[];
    presentCount: number;
    absentCount: number;
};

export async function splitByVoice(
    discordGuildId: string,
    participantDiscordIds: (string | null | undefined)[],
    captainDiscordId?: string | null
): Promise<VoiceReminderStatus> {
    const states = await getGuildVoiceStates(discordGuildId).catch(() => new Map<string, string>());
    const split = splitVoiceAbsent(participantDiscordIds, states, captainDiscordId ?? null);
    return {
        captainDiscordId: captainDiscordId ?? null,
        captainChannelId: split.captainChannelId,
        presentDiscordIds: split.present,
        absentDiscordIds: split.absent,
        presentCount: split.present.length,
        absentCount: split.absent.length,
    };
}

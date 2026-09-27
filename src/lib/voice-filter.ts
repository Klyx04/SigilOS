/**
 * Filtre vocal des rappels manuels — module **pur** (aucune I/O).
 *
 * Demande user (28/09/2026) : « pinger uniquement les gens pas dans le vocal
 * dans le rappel raid (rappel manuel uniquement) ».
 *
 * Règle unique, appliquée partout (calendrier/raids, DJ/quêtes, Songes) :
 *  - si le capitaine/leader est assis dans un salon vocal `V`, on ne pinge que
 *    les inscrits qui ne sont **pas avec lui dans `V`** ;
 *  - sinon (capitaine hors vocal), on ne pinge que les inscrits qui ne sont
 *    **dans aucun vocal** du serveur.
 *
 * Fail-open : si l'état vocal est inconnu (Set vide), tout le monde est
 * considéré absent — le rappel pinge tout le monde, jamais personne n'est
 * oublié par un filtre cassé.
 */

export type VoiceStateMap = Map<string, string> | Record<string, string>;

function channelOf(voiceStates: VoiceStateMap, discordId: string): string | null {
    if (voiceStates instanceof Map) return voiceStates.get(discordId) ?? null;
    const v = (voiceStates as Record<string, string>)[discordId];
    return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Découpe les inscrits entre présents (à ne pas pinger) et absents (à pinger).
 *
 * @param participantDiscordIds Discord IDs des inscrits (dédupliqués en sortie).
 * @param voiceStates map userId → channelId (état vocal Discord).
 * @param captainDiscordId Discord ID du capitaine/leader (optionnel).
 */
export function splitVoiceAbsent(
    participantDiscordIds: (string | null | undefined)[],
    voiceStates: VoiceStateMap,
    captainDiscordId?: string | null
): { present: string[]; absent: string[]; captainChannelId: string | null } {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of participantDiscordIds) {
        if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }

    const captainChannelId =
        captainDiscordId ? channelOf(voiceStates, captainDiscordId) : null;

    const present: string[] = [];
    const absent: string[] = [];
    for (const id of ids) {
        const ch = channelOf(voiceStates, id);
        if (captainChannelId) {
            // « Suivre le capitaine » : présent = assis avec lui dans V.
            if (ch === captainChannelId) present.push(id);
            else absent.push(id);
        } else {
            // Capitaine hors vocal : présent = dans n'importe quel vocal.
            if (ch) present.push(id);
            else absent.push(id);
        }
    }
    return { present, absent, captainChannelId };
}

/**
 * `/legendaire` — mise en forme **pure** de la liste d'artisans d'un embed.
 *
 * Discord rejette l'interaction entière si un champ dépasse 1024 caractères :
 * une liste de 25 pseudos mentionnés peut y arriver sur une grosse guilde. La
 * borne, la ligne de débordement et la note de pied sont donc calculées ici,
 * avant l'envoi, et testées sans Discord (`tests/unit/discord-legendaire-embed.test.ts`).
 */

import { DISCORD_FIELD_VALUE_MAX, truncate } from "@/lib/discord/embed-limits";

/**
 * Un artisan affiché : `discordId` est le **flocon Discord** (`providerAccountId`),
 * jamais l'identifiant interne — une mention `<@cuid>` ne mentionne personne.
 */
export type LegendaryCrafter = {
    name: string;
    discordId?: string;
};

export type CrafterListOptions = {
    /** Nombre de lignes affichées avant la ligne de débordement. */
    maxLines: number;
    /** Texte de la ligne de débordement (reçoit le nombre d'artisans masqués). */
    overflow: (remaining: number) => string;
    /** Note ajoutée en fin de champ (facultative). */
    footer?: string;
};

function formatCrafterLine(crafter: LegendaryCrafter): string {
    return crafter.discordId
        ? `• **${crafter.name}** (<@${crafter.discordId}>)`
        : `• **${crafter.name}**`;
}

/** Liste à puces d'artisans, bornée à la limite Discord d'un champ d'embed. */
export function formatCrafterList(
    crafters: readonly LegendaryCrafter[],
    options: CrafterListOptions
): string {
    const total = crafters.length;
    // On ne descend jamais sous une ligne : un artisan seul ne doit pas être
    // remplacé par « … et 1 autre ».
    let visibleCount = Math.min(Math.max(0, options.maxLines), total);

    const build = (count: number): string => {
        const lines = crafters.slice(0, count).map(formatCrafterLine);
        const hidden = total - count;
        if (hidden > 0) lines.push(`*${options.overflow(hidden)}*`);
        if (options.footer) lines.push(options.footer);
        return lines.join("\n");
    };

    let value = build(visibleCount);
    // La ligne de débordement et la note font partie de la borne : on retire des
    // artisans affichés tant que l'ensemble ne tient pas, pour qu'elles restent
    // lisibles (sinon la note disparaîtrait en silence).
    while (value.length > DISCORD_FIELD_VALUE_MAX && visibleCount > 1) {
        visibleCount -= 1;
        value = build(visibleCount);
    }

    return value.length > DISCORD_FIELD_VALUE_MAX
        ? truncate(value, DISCORD_FIELD_VALUE_MAX)
        : value;
}

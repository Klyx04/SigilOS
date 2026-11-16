/**
 * Télémétrie — **portée de guilde** d'une sélection God.
 *
 * Le sélecteur de l'écran envoie l'id **interne** (`GuildConfig.id`, CUID), mais
 * `TelemetryEvent.guildId` contient le segment d'URL, donc un **snowflake Discord**
 * (`/dashboard/<snowflake>/…`). Filtrer sur la valeur brute du client ne renvoie
 * donc aucune ligne. Cette règle pure résout la sélection dans les deux espaces.
 *
 * Fail-closed : une sélection inconnue devient `none` — l'action renvoie un résultat
 * vide **sans requête**, jamais un repli sur « toutes les guildes ».
 */

export type TelemetryGuildScope =
    | { kind: "all" }
    | { kind: "none"; ids: string[] }
    | { kind: "guild"; ids: string[] };

export function resolveTelemetryGuildScope(
    selectedId: string | null | undefined,
    guilds: ReadonlyArray<{ id: string; discordGuildId: string | null }>,
): TelemetryGuildScope {
    if (!selectedId || selectedId === "all") return { kind: "all" };

    const guild = guilds.find(
        (candidate) => candidate.id === selectedId || candidate.discordGuildId === selectedId,
    );
    if (!guild) return { kind: "none", ids: [] };

    // Les deux espaces sont filtrés ensemble : l'id interne et le snowflake.
    const ids = Array.from(
        new Set([guild.id, guild.discordGuildId].filter((id): id is string => Boolean(id))),
    );
    return { kind: "guild", ids };
}

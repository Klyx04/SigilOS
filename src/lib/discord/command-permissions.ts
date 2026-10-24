/**
 * ⚡ Commandes slash — **règles pures** de déploiement et de permissions Discord.
 *
 * Constat mesuré (24/10/2026) : le dashboard enregistrait les rôles et les salons
 * en base **sans jamais les pousser vers Discord**. Résultat : deux sources de
 * vérité (le dashboard et les cases cochées à la main dans Discord → Intégrations),
 * et une guilde neuve voyait **toutes** les commandes, y compris celles que le
 * dashboard interdit. Le code ci-dessous est la seule règle : il transforme une
 * ligne `GuildSlashCommandPermission` en dérogations Discord, testables sans réseau.
 *
 * Forme Discord (API v10, `discord-api-types`) :
 *   · `permissions: [{ id, type, permission }]`
 *   · `type` : 1 = rôle, 2 = membre, 3 = salon
 *   · « tous les salons » a un identifiant spécial : `idGuilde − 1`
 */

export interface DiscordCommandPermissionEntry {
    id: string;
    /** 1 = rôle, 2 = membre, 3 = salon. */
    type: 1 | 2 | 3;
    permission: boolean;
}

const SNOWFLAKE = /^\d{5,25}$/;

function uniqueSnowflakes(values: readonly unknown[] | null | undefined): string[] {
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const value of values) {
        if (typeof value !== "string") continue;
        const id = value.trim();
        if (!SNOWFLAKE.test(id) || seen.has(id)) continue;
        seen.add(id);
        clean.push(id);
    }
    return clean;
}

/** Identifiant Discord de « tous les salons » (`AllChannels`) : guilde − 1. */
export function allChannelsSentinel(discordGuildId: string): string {
    return (BigInt(discordGuildId) - 1n).toString();
}

/**
 * Dérogations à écrire pour **une** commande.
 *
 * · aucun rôle et aucun salon → `[]` : on **efface** une restriction périmée
 *   (sans ce `[]`, une ancienne dérogation restait collée à la commande) ;
 * · rôles → seuls ces rôles voient la commande (Discord refuse les autres par défaut) ;
 * · salons → « tous les salons » refusé, puis chaque salon autorisé (sinon la
 *   commande resterait visible partout).
 */
export function buildCommandPermissionEntries(input: {
    discordGuildId: string;
    roleIds: readonly unknown[] | null | undefined;
    channelIds: readonly unknown[] | null | undefined;
}): DiscordCommandPermissionEntry[] {
    const roleIds = uniqueSnowflakes(input.roleIds);
    const channelIds = uniqueSnowflakes(input.channelIds);

    const entries: DiscordCommandPermissionEntry[] = roleIds.map((id) => ({
        id,
        type: 1,
        permission: true,
    }));

    if (channelIds.length > 0) {
        entries.push({ id: allChannelsSentinel(input.discordGuildId), type: 3, permission: false });
        for (const id of channelIds) {
            entries.push({ id, type: 3, permission: true });
        }
    }

    return entries;
}

export interface CatalogCommandDeploymentInput {
    name: string;
    staffOnly?: boolean;
}

export interface GuildCommandPermissionRow {
    commandName: string;
    isEnabled: boolean;
}

/**
 * Une commande est-elle **déployée** sur cette guilde ?
 *
 * · commande `staffOnly` (ex. `/valider-recrue`) : **opt-in strict** — elle n'existe
 *   sur la guilde que si une ligne existe et qu'elle est activée. De base, aucune
 *   guilde ne la reçoit (demande user du 24/10/2026) ;
 * · commande publique : déployée sauf désactivation explicite (`isEnabled = false`).
 */
export function isCatalogCommandDeployed(
    command: CatalogCommandDeploymentInput,
    row: GuildCommandPermissionRow | null | undefined
): boolean {
    if (!row) return command.staffOnly !== true;
    return row.isEnabled;
}

/** Vue God : guildes SigilOS + commandes déployées, par guilde. */
export interface GodCommandScopeGuild {
    id: string;
    name: string;
    discordGuildId: string;
    isActive: boolean;
    /** Par nom de commande : déployée ou non sur cette guilde. */
    deployed: Record<string, boolean>;
}

export interface GodCommandScopesPayload {
    success: boolean;
    error?: string;
    guilds?: GodCommandScopeGuild[];
    commands?: Array<{ name: string; staffOnly: boolean }>;
}

export type TicketCommandPermissionMode = "STAFF_ONLY" | "CUSTOM_ROLES" | "ALL";

/**
 * Rôles Discord autorisés à voir une commande de ticket, dérivés de son mode :
 * · `STAFF_ONLY` → staff du module (global + motifs) ;
 * · `CUSTOM_ROLES` → rôles choisis (liste vide = tout le monde, comme le garde d'exécution) ;
 * · `ALL` → aucune restriction.
 */
export function resolveTicketCommandRoleIds(
    command: { permissionMode: TicketCommandPermissionMode; allowedRoleIds?: readonly string[] },
    ticketStaffRoleIds: readonly string[]
): string[] {
    if (command.permissionMode === "ALL") return [];
    if (command.permissionMode === "CUSTOM_ROLES") {
        const allowed = uniqueSnowflakes(command.allowedRoleIds);
        return allowed.length === 0 ? [] : allowed;
    }
    return uniqueSnowflakes(ticketStaffRoleIds);
}

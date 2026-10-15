/**
 * Calcul des permissions de visibilité des salons Discord (VIEW_CHANNEL)
 * Conforme à la spécification officielle Discord :
 * https://discord.com/developers/docs/topics/permissions#permission-overwrites
 *
 * Utilisé pour filtrer les salons proposés dans les listes déroulantes
 * afin qu'un utilisateur ne voie jamais les noms ou l'existence de salons privés
 * auxquels son compte Discord n'a pas accès.
 */

export const DISCORD_PERMS = {
    ADMINISTRATOR: 1n << 3n,
    VIEW_CHANNEL: 1n << 10n,
} as const;

export type ChannelPermissionOverwrite = {
    id: string;
    type: number; // 0 = role, 1 = member
    allow: string;
    deny: string;
};

export type ChannelWithPermissions = {
    id: string;
    name: string | null;
    type: number;
    parent_id?: string | null;
    permission_overwrites?: ChannelPermissionOverwrite[];
};

export type GuildRoleForPermissions = {
    id: string;
    permissions: string;
};

interface CanUserViewChannelParams {
    guildId: string;
    channel: ChannelWithPermissions;
    userRoleIds: string[];
    userId?: string | null;
    guildRoles: GuildRoleForPermissions[];
    parentChannel?: ChannelWithPermissions | null;
}

function applyOverwrites(
    currentPerms: bigint,
    overwrites: ChannelPermissionOverwrite[] = [],
    guildId: string,
    userRoleIds: string[],
    userId?: string | null
): bigint {
    let perms = currentPerms;

    // 1. Overwrite @everyone (id === guildId)
    const everyoneOw = overwrites.find((o) => o.id === guildId && o.type === 0);
    if (everyoneOw) {
        perms &= ~BigInt(everyoneOw.deny);
        perms |= BigInt(everyoneOw.allow);
    }

    // 2. Overwrites des rôles du membre
    let roleDeny = 0n;
    let roleAllow = 0n;
    for (const ow of overwrites) {
        if (ow.type === 0 && ow.id !== guildId && userRoleIds.includes(ow.id)) {
            roleDeny |= BigInt(ow.deny);
            roleAllow |= BigInt(ow.allow);
        }
    }
    perms &= ~roleDeny;
    perms |= roleAllow;

    // 3. Overwrite spécifique du membre
    if (userId) {
        const memberOw = overwrites.find((o) => o.id === userId && o.type === 1);
        if (memberOw) {
            perms &= ~BigInt(memberOw.deny);
            perms |= BigInt(memberOw.allow);
        }
    }

    return perms;
}

export function canUserViewChannel({
    guildId,
    channel,
    userRoleIds,
    userId,
    guildRoles,
    parentChannel,
}: CanUserViewChannelParams): boolean {
    // 1. Calcul des permissions de base du membre
    const everyoneRole = guildRoles.find((r) => r.id === guildId);
    let basePerm = everyoneRole ? BigInt(everyoneRole.permissions) : 0n;

    for (const roleId of userRoleIds) {
        const role = guildRoles.find((r) => r.id === roleId);
        if (role) {
            basePerm |= BigInt(role.permissions);
        }
    }

    // Si le membre a la permission ADMINISTRATOR globale, il voit TOUS les salons.
    if ((basePerm & DISCORD_PERMS.ADMINISTRATOR) === DISCORD_PERMS.ADMINISTRATOR) {
        return true;
    }

    // 2. Application des overwrites
    // Si le salon a une catégorie parente, les overwrites de la catégorie s'appliquent en premier
    let effectivePerms = basePerm;
    if (channel.parent_id && parentChannel && parentChannel.permission_overwrites) {
        effectivePerms = applyOverwrites(
            effectivePerms,
            parentChannel.permission_overwrites,
            guildId,
            userRoleIds,
            userId
        );
    }

    // Puis les overwrites propres au salon s'appliquent
    effectivePerms = applyOverwrites(
        effectivePerms,
        channel.permission_overwrites,
        guildId,
        userRoleIds,
        userId
    );

    return (effectivePerms & DISCORD_PERMS.VIEW_CHANNEL) === DISCORD_PERMS.VIEW_CHANNEL;
}

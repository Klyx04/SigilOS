import { describe, it, expect } from "vitest";
import {
    canUserViewChannel,
    DISCORD_PERMS,
    ChannelWithPermissions,
    GuildRoleForPermissions,
} from "@/lib/discord-channel-permissions";

describe("canUserViewChannel", () => {
    const GUILD_ID = "100000000000000001";
    const USER_ID = "200000000000000001";
    const ROLE_STAFF = "300000000000000001";
    const ROLE_MEMBER = "300000000000000002";

    const defaultRoles: GuildRoleForPermissions[] = [
        // @everyone : VIEW_CHANNEL actif
        { id: GUILD_ID, permissions: String(DISCORD_PERMS.VIEW_CHANNEL) },
        // Staff : VIEW_CHANNEL + autres
        { id: ROLE_STAFF, permissions: String(DISCORD_PERMS.VIEW_CHANNEL) },
        // Member : VIEW_CHANNEL
        { id: ROLE_MEMBER, permissions: String(DISCORD_PERMS.VIEW_CHANNEL) },
    ];

    it("accorde l'accès si l'utilisateur a la permission ADMINISTRATOR globale", () => {
        const adminRoles: GuildRoleForPermissions[] = [
            { id: GUILD_ID, permissions: "0" },
            { id: ROLE_STAFF, permissions: String(DISCORD_PERMS.ADMINISTRATOR) },
        ];
        const privateChannel: ChannelWithPermissions = {
            id: "901",
            name: "top-secret",
            type: 0,
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: String(DISCORD_PERMS.VIEW_CHANNEL) },
            ],
        };

        const canView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: privateChannel,
            userRoleIds: [ROLE_STAFF],
            userId: USER_ID,
            guildRoles: adminRoles,
        });

        expect(canView).toBe(true);
    });

    it("accorde l'accès sur un salon public standard sans overwrites", () => {
        const publicChannel: ChannelWithPermissions = {
            id: "902",
            name: "general",
            type: 0,
            permission_overwrites: [],
        };

        const canView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: publicChannel,
            userRoleIds: [ROLE_MEMBER],
            userId: USER_ID,
            guildRoles: defaultRoles,
        });

        expect(canView).toBe(true);
    });

    it("refuse l'accès à un membre normal sur un salon privé (everyone deny VIEW_CHANNEL)", () => {
        const privateChannel: ChannelWithPermissions = {
            id: "903",
            name: "staff-only",
            type: 0,
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: String(DISCORD_PERMS.VIEW_CHANNEL) },
                { id: ROLE_STAFF, type: 0, allow: String(DISCORD_PERMS.VIEW_CHANNEL), deny: "0" },
            ],
        };

        const canView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: privateChannel,
            userRoleIds: [ROLE_MEMBER],
            userId: USER_ID,
            guildRoles: defaultRoles,
        });

        expect(canView).toBe(false);
    });

    it("accorde l'accès à un membre ayant le rôle requis sur un salon privé", () => {
        const privateChannel: ChannelWithPermissions = {
            id: "903",
            name: "staff-only",
            type: 0,
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: String(DISCORD_PERMS.VIEW_CHANNEL) },
                { id: ROLE_STAFF, type: 0, allow: String(DISCORD_PERMS.VIEW_CHANNEL), deny: "0" },
            ],
        };

        const canView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: privateChannel,
            userRoleIds: [ROLE_MEMBER, ROLE_STAFF],
            userId: USER_ID,
            guildRoles: defaultRoles,
        });

        expect(canView).toBe(true);
    });

    it("hérite du refus d'une catégorie parente si le salon n'a pas d'overwrite", () => {
        const privateCategory: ChannelWithPermissions = {
            id: "800",
            name: "CATÉGORIE PRIVÉE",
            type: 4,
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: String(DISCORD_PERMS.VIEW_CHANNEL) },
                { id: ROLE_STAFF, type: 0, allow: String(DISCORD_PERMS.VIEW_CHANNEL), deny: "0" },
            ],
        };

        const childChannel: ChannelWithPermissions = {
            id: "904",
            name: "discussion-lead",
            type: 0,
            parent_id: "800",
            permission_overwrites: [],
        };

        const memberCanView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: childChannel,
            userRoleIds: [ROLE_MEMBER],
            userId: USER_ID,
            guildRoles: defaultRoles,
            parentChannel: privateCategory,
        });

        const staffCanView = canUserViewChannel({
            guildId: GUILD_ID,
            channel: childChannel,
            userRoleIds: [ROLE_STAFF],
            userId: USER_ID,
            guildRoles: defaultRoles,
            parentChannel: privateCategory,
        });

        expect(memberCanView).toBe(false);
        expect(staffCanView).toBe(true);
    });

    it("applique les overwrites spécifiques à l'utilisateur", () => {
        const personalChannel: ChannelWithPermissions = {
            id: "905",
            name: "ticket-1234",
            type: 0,
            permission_overwrites: [
                { id: GUILD_ID, type: 0, allow: "0", deny: String(DISCORD_PERMS.VIEW_CHANNEL) },
                { id: USER_ID, type: 1, allow: String(DISCORD_PERMS.VIEW_CHANNEL), deny: "0" },
            ],
        };

        const canViewUser = canUserViewChannel({
            guildId: GUILD_ID,
            channel: personalChannel,
            userRoleIds: [],
            userId: USER_ID,
            guildRoles: defaultRoles,
        });

        const canViewOther = canUserViewChannel({
            guildId: GUILD_ID,
            channel: personalChannel,
            userRoleIds: [],
            userId: "999999999999999999",
            guildRoles: defaultRoles,
        });

        expect(canViewUser).toBe(true);
        expect(canViewOther).toBe(false);
    });
});

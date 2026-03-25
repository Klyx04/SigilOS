"use server";


import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { MissionStatus } from "@prisma/client";

export type SearchResult = {
    id: string;
    title: string;
    subtitle?: string;
    type: "MEMBER" | "MISSION" | "PAGE";
    href: string;
    icon?: string;
};

export async function globalSearch(query: string, guildId: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    if (!guildId || !/^\d+$/.test(guildId)) return [];

    const ctx = await getUserContext(guildId);
    
    if (!ctx.isAuthenticated || !ctx.isMember) {
        return [];
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 1. Search Members (Profiles) — scoped strictly to the requested guild
    if (ctx.canViewRoster) {
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                OR: [
                    { discordNickname: { contains: query, mode: "insensitive" } },
                    { pseudoDofus: { contains: query, mode: "insensitive" } },
                    { ankamaId: { contains: query, mode: "insensitive" } },
                ],
            },
            take: 5,
        });

        members.forEach((m) => {
            results.push({
                id: m.id,
                title: m.discordNickname || m.pseudoDofus || "Membre",
                subtitle: m.pseudoDofus ? `Dofus: ${m.pseudoDofus}` : "Membre de guilde",
                type: "MEMBER",
                href: `/dashboard/${guildId}/profile/${m.userId === ctx.id ? "" : m.id}`,
            });
        });
    }

    // 2. Search Missions — scoped strictly to the requested guild
    if (ctx.canViewMissions) {
        const missions = await db.mission.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                title: { contains: query, mode: "insensitive" },
            },
            take: 5,
        });

        missions.forEach((m) => {
            results.push({
                id: m.id,
                title: m.title || "Mission",
                subtitle: `Mission Tier ${m.tier}`,
                type: "MISSION",
                href: `/dashboard/${guildId}/missions`,
            });
        });
    }

    // 3. Static Pages (Match query against titles)
    const pages = [
        { title: "Missions", href: `/dashboard/${guildId}/missions`, perm: ctx.canViewMissions },
        { title: "Ladder", href: `/dashboard/${guildId}/ladder`, perm: ctx.canViewLadder },
        { title: "Songes", href: `/dashboard/${guildId}/songes`, perm: ctx.canViewSonges },
        { title: "Ocre", href: `/dashboard/${guildId}/quete-ocre`, perm: ctx.canViewArchis },
        { title: "Profil", href: `/dashboard/${guildId}/profile`, perm: ctx.canViewProfile },
        { title: "Validation", href: `/dashboard/${guildId}/admin/validation`, perm: ctx.canValidateMissions },
        { title: "Paramètres Admin", href: `/dashboard/${guildId}/admin/settings`, perm: ctx.isAdmin },
    ];

    pages.forEach((p) => {
        if (p.perm && p.title.toLowerCase().includes(lowerQuery)) {
            results.push({
                id: p.href,
                title: p.title,
                type: "PAGE",
                href: p.href,
            });
        }
    });

    return results;
}

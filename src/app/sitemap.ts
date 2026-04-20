import { MetadataRoute } from "next";
import { db } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

    // 1. Static Routes
    const staticRoutes = [
        "",
        "/auth/signin",
        "/about",
        "/terms",
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: route === "" ? 1 : 0.8,
    }));

    // 2. Dynamic Guild Routes
    try {
        const activeGuilds = await db.guildConfig.findMany({
            where: { isActive: true },
            select: { discordGuildId: true, updatedAt: true },
        });

        const guildRoutes = activeGuilds.map((guild) => ({
            url: `${baseUrl}/dashboard/${guild.discordGuildId}`,
            lastModified: guild.updatedAt || new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.6,
        }));

        return [...staticRoutes, ...guildRoutes];
    } catch (error) {
        console.error("[Sitemap] Error fetching guilds:", error);
        return staticRoutes;
    }
}

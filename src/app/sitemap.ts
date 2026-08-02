import { MetadataRoute } from "next";
import { db } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const now = new Date();

    // 1. Static public routes (indexable, 200, pas de zone privée ni 404)
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${baseUrl}/guilds`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
        { url: `${baseUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
        { url: `${baseUrl}/status`, lastModified: now, changeFrequency: "daily", priority: 0.3 },
        { url: `${baseUrl}/legal/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
        { url: `${baseUrl}/legal/cgu`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
        { url: `${baseUrl}/legal/mentions`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
        { url: `${baseUrl}/legal/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    ];

    // 2. Guildes publiques : uniquement celles qui ont explicitement activé
    //    leur présentation publique (presentationEnabled = true).
    const routes: MetadataRoute.Sitemap = [...staticRoutes];

    try {
        const publicGuilds = await db.guildConfig.findMany({
            where: { isActive: true, presentationEnabled: true },
            select: { discordGuildId: true, updatedAt: true },
        });

        const guildRoutes = publicGuilds.map((guild) => ({
            url: `${baseUrl}/guilds/${guild.discordGuildId}`,
            lastModified: guild.updatedAt ?? new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.6,
        }));

        routes.push(...guildRoutes);
    } catch (error) {
        console.error("[Sitemap] Error fetching public guilds:", error);
    }

    return routes;
}
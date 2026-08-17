import { MetadataRoute } from "next";
import { db } from "@/lib/prisma";
import { publishedGuides } from "@/content/guides";
import { getAppBaseUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Base URL résolue selon l'environnement (beta.sigilos.fr sur dev, sigilos.fr en prod)
    // — cohérent avec robots.ts et toutes les métadonnées via getAppBaseUrl().
    const baseUrl = getAppBaseUrl();
    const now = new Date();

    // 1. Static public routes (indexable, 200, pas de zone privée ni 404)
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${baseUrl}/almanax`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: `${baseUrl}/guilds`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
        { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
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

    // Guides publiés : dérivés automatiquement du registre unique. Les drafts
    // sont exclus par publishedGuides, et lastModified utilise la date explicite
    // du guide plutôt qu'un `now` dynamique.
    for (const guide of publishedGuides) {
        routes.push({
            url: `${baseUrl}/guides/${guide.slug}`,
            lastModified: new Date(guide.updatedAt),
            changeFrequency: "monthly",
            priority: 0.5,
        });
    }

    return routes;
}

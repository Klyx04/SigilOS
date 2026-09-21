import { MetadataRoute } from "next";
import { db } from "@/lib/prisma";
import { publishedGuides } from "@/content/guides";
import { getAppBaseUrl } from "@/lib/utils";
import { getIndexableGuildSegment } from "@/lib/presentation-constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Base URL résolue selon l'environnement (beta.sigilos.fr sur dev, sigilos.fr en prod)
    // — cohérent avec robots.ts et toutes les métadonnées via getAppBaseUrl().
    const baseUrl = getAppBaseUrl();
    const now = new Date();

    // 1. Static public routes (indexable, 200, pas de zone privée ni 404)
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${baseUrl}/modules`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/carte-du-monde`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/guides/rush-sylvestre`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/boss`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
        { url: `${baseUrl}/almanax`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: `${baseUrl}/raids`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
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

    // Feuille de route : annoncée à Google **uniquement** quand elle est réellement
    // publique (toggle God `roadmapEnabled`). Désactivée, la page redirige vers `/`
    // et Search Console remonterait « Page avec redirection » (constat 19/09/2026).
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { roadmapEnabled: true },
        });
        if (config?.roadmapEnabled) {
            routes.push({
                url: `${baseUrl}/roadmap`,
                lastModified: now,
                changeFrequency: "monthly",
                priority: 0.4,
            });
        }
    } catch (error) {
        console.error("[Sitemap] Error fetching platform config:", error);
    }

    try {
        const publicGuilds = await db.guildConfig.findMany({
            where: { isActive: true, presentationEnabled: true },
            select: { discordGuildId: true, name: true, updatedAt: true },
        });

        const guildRoutes = publicGuilds.map((guild) => ({
            // Le segment publié est celui qui **résout réellement** la page : le snowflake
            // Discord déclenchait une redirection 307 vers le slug (motif « Page avec
            // redirection » dans Search Console, constat 21/09/2026).
            url: `${baseUrl}/guilds/${getIndexableGuildSegment(guild)}`,
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

    // #101 — Almanax : pages indexables par date (/almanax/YYYY-MM-DD). Best-effort :
    // si l'API est indisponible, on saute.
    // On n'en publie que **7 jours** (constat GSC du 21/09/2026) : les 30 jours du calendrier
    // produisaient 30 pages « Explorée, actuellement non indexée » (contenu quasi identique —
    // Google ne les indexe pas) et brouillaient le rapport. 7 jours = découverte utile sans bruit.
    const ALMANAX_SITEMAP_DAYS = 7;
    try {
        const { getUpcomingAlmanax } = await import("@/server/actions/resources-actions");
        const almanaxItems = await getUpcomingAlmanax();
        for (const item of almanaxItems.slice(0, ALMANAX_SITEMAP_DAYS)) {
            const day = item?.date ? item.date.slice(0, 10) : null;
            if (!day) continue;
            routes.push({
                url: `${baseUrl}/almanax/${day}`,
                lastModified: now,
                changeFrequency: "daily",
                priority: 0.5,
            });
        }
    } catch (error) {
        console.error("[Sitemap] Error fetching almanax dates:", error);
    }

    // Boss & Donjons publics : fiches tactiques Dofensive indexables.
    // URL en **slug** (nom du boss) et non en identifiant interne : l'ancienne URL
    // `/boss/<cuid>` reste servie en 308 par la page (liens Discord déjà publiés).
    try {
        const dungeons = await db.dungeon.findMany({
            select: { id: true, slug: true, updatedAt: true },
        });
        for (const d of dungeons) {
            routes.push({
                url: `${baseUrl}/boss/${d.slug}`,
                lastModified: d.updatedAt ?? now,
                changeFrequency: "monthly",
                priority: 0.6,
            });
        }
    } catch (error) {
        console.error("[Sitemap] Error fetching boss pages:", error);
    }

    return routes;
}

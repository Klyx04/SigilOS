import { MetadataRoute } from 'next'
import { getPublicGuilds } from '@/server/actions/presentation-actions'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr'

    // Static routes
    const routes = [
        '',
        '/guilds',
        '/docs',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }))

    // Dynamic guild routes
    const guilds = await getPublicGuilds()
    const guildRoutes = guilds.map((guild) => ({
        url: `${baseUrl}/guilds/${guild.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...routes, ...guildRoutes]
}

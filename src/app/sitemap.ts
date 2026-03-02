import { MetadataRoute } from 'next'
import { getPublicGuilds } from '@/server/actions/presentation-actions'

import { getAppBaseUrl } from '@/lib/utils'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = getAppBaseUrl()

    // Static routes with differentiated priorities
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/guilds`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/changelog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/status`,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.3,
        },
        // Legal pages (low priority but should be indexed)
        {
            url: `${baseUrl}/legal/cgu`,
            lastModified: new Date('2026-02-19'),
            changeFrequency: 'yearly',
            priority: 0.2,
        },
        {
            url: `${baseUrl}/legal/privacy`,
            lastModified: new Date('2026-02-19'),
            changeFrequency: 'yearly',
            priority: 0.2,
        },
        {
            url: `${baseUrl}/legal/mentions`,
            lastModified: new Date('2026-02-19'),
            changeFrequency: 'yearly',
            priority: 0.2,
        },
    ]

    // Dynamic guild routes
    const guilds = await getPublicGuilds()
    const guildRoutes: MetadataRoute.Sitemap = guilds.map((guild) => ({
        url: `${baseUrl}/guilds/${guild.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...staticRoutes, ...guildRoutes]
}

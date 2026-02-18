import { MetadataRoute } from 'next'

import { getAppBaseUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = getAppBaseUrl()
    const isProd = baseUrl === 'https://sigilos.fr'

    return {
        rules: {
            userAgent: '*',
            allow: isProd ? ['/', '/docs', '/changelog', '/guilds'] : [],
            disallow: isProd
                ? ['/dashboard/', '/api/', '/god/', '/_next/'] // Hide sensitive or internal routes
                : '/', // Full block for search engines on non-prod
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

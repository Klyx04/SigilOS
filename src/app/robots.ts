import { MetadataRoute } from 'next'

import { getAppBaseUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = getAppBaseUrl()
    const isProd = baseUrl === 'https://sigilos.fr'

    return {
        rules: {
            userAgent: '*',
            allow: isProd ? ['/', '/changelog', '/guilds', '/guides', '/legal/', '/status'] : [],
            disallow: isProd
                ? ['/dashboard/', '/api/', '/god/', '/docs/', '/_next/', '/onboarding/', '/test-route/'] // Hide sensitive, internal, or auth-gated routes
                : '/', // Full block for search engines on non-prod
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr'
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

import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr'
    const isProd = baseUrl === 'https://sigilos.fr'

    return {
        rules: {
            userAgent: '*',
            allow: isProd ? '/' : [],
            disallow: isProd ? '/dashboard/' : '/',
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

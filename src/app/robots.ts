import { MetadataRoute } from 'next'

import { getAppBaseUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = getAppBaseUrl()
    // La beta (https://beta.sigilos.fr) sert actuellement de prod réelle
    // (guide publié, sitemap soumis, objectif d'indexation).
    // Elle doit donc être indexable comme sigilos.fr, avec les mêmes zones privées
    // bloquées. Seuls les environnements locaux/staging non dédiés restent en full-block.
    const isIndexable = baseUrl === 'https://sigilos.fr' || baseUrl === 'https://beta.sigilos.fr'

    return {
        rules: {
            userAgent: '*',
            allow: isIndexable ? ['/', '/almanax', '/changelog', '/guilds', '/guides', '/boss', '/legal/', '/status', '/roadmap', '/llms.txt'] : [],
            disallow: isIndexable
                ? ['/dashboard/', '/api/', '/god/', '/mng-', '/docs/', '/_next/', '/onboarding/', '/test-route/', '/auth/', '/overlay/'] // Hide sensitive, internal, auth-gated, and overlay routes
                : '/', // Full block for search engines on non-prod
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

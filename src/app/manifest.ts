import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SigilOS — Le Hub Ultime pour Guildes Dofus',
        short_name: 'SigilOS',
        description: "L'OS complet de gestion, entraide, donjons, songes et quêtes Dofus pour votre guilde.",
        start_url: '/',
        id: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#09090b',
        theme_color: '#09090b',
        lang: 'fr',
        dir: 'ltr',
        categories: ['games', 'utilities', 'social'],
        icons: [
            {
                src: '/assets/ui/logo-v2.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/assets/ui/logo-v2.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/assets/ui/logo-v2.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            },
        ],
        shortcuts: [
            {
                name: 'Guides Quêtes Dofus & Rush',
                short_name: 'Guides',
                description: 'Guides interactifs des Dofus et suivi d\'étapes avec overlay in-game',
                url: '/guides',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            },
            {
                name: 'Almanax du Jour',
                short_name: 'Almanax',
                description: 'Offrande Méryde du jour, bonus et gains de kamas',
                url: '/almanax',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            },
            {
                name: 'Encyclopédie Boss & Stratégies',
                short_name: 'Boss',
                description: 'Stratégies, doubles boss et guides donjons Dofus',
                url: '/boss',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            }
        ]
    }
}


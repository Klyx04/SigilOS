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
                name: 'Quêtes Dofus & Guides',
                short_name: 'Quêtes',
                description: 'Guides interactifs des 26 Dofus et suivi d\'étapes',
                url: '/succes?view=quetes',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            },
            {
                name: 'Almanax du Jour',
                short_name: 'Almanax',
                description: 'Offrande Méryde du jour et kamas',
                url: '/almanax',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            },
            {
                name: 'Défis & Doubles Boss',
                short_name: 'Défis',
                description: 'Matchmaking et succès Double Boss de guilde',
                url: '/succes?view=defi',
                icons: [{ src: '/assets/ui/logo-v2.png', sizes: '192x192' }]
            }
        ]
    }
}


import { MetadataRoute } from 'next'

import { getAppBaseUrl } from '@/lib/utils'

export default function manifest(): MetadataRoute.Manifest {
    const baseUrl = getAppBaseUrl()

    return {
        name: 'SigilOS — Gestion de guilde Dofus',
        short_name: 'SigilOS',
        description: "Le système d'exploitation pour les guildes Dofus.",
        start_url: '/',
        display: 'standalone',
        background_color: '#020202',
        theme_color: '#14b8a6',
        icons: [
            {
                src: '/assets/ui/logo-v2.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    }
}

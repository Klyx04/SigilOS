import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr'

    return {
        name: 'SigilOS - Guild Management',
        short_name: 'SigilOS',
        description: "Le système d'exploitation pour les guildes Dofus.",
        start_url: '/',
        display: 'standalone',
        background_color: '#020202',
        theme_color: '#9333ea',
        icons: [
            {
                src: '/assets/ui/logo-v2.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    }
}

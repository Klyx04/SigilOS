import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Start seeding...')

    // --- 1. ZONES ---
    const zonesData = [
        { name: 'Ile de Moon', level: 200 },
        { name: 'Frigost 3', level: 190 },
        { name: 'Sufokia', level: 100 },
        { name: 'Bonta', level: 50 },
        { name: 'Tour des Rêves', level: 200 },
    ]

    const zones = []
    for (const z of zonesData) {
        const zone = await prisma.zone.upsert({
            where: { name: z.name },
            update: {},
            create: z,
        })
        zones.push(zone)
        console.log(`Created Zone: ${zone.name}`)
    }

    // --- 2. MONSTERS ---
    const monstersData = [
        { name: 'Tofu Maléfique', zoneName: 'Bonta' },
        { name: 'Gelée Royale Bleue', zoneName: 'Frigost 3' }, // Juste pour l'exemple
        { name: 'Kanigrou', zoneName: 'Ile de Moon' },
        { name: 'Rêveur', zoneName: 'Tour des Rêves' },
        { name: 'Kralamoure', zoneName: 'Sufokia' },
    ]

    for (const m of monstersData) {
        const zone = zones.find(z => z.name === m.zoneName)
        if (zone) {
            await prisma.monster.create({
                data: {
                    name: m.name,
                    zoneId: zone.id
                }
            })
            console.log(`Created Monster: ${m.name} in ${zone.name}`)
        }
    }

    // --- 3. DUNGEONS ---
    const dungeonsData = [
        { name: 'Le Chouque', bossName: 'Le Chouque', level: 100, dpnlUrl: 'https://dofusdb.fr/fr/database/dungeon/103' },
        { name: 'Ougah', bossName: 'Ougah', level: 180 },
        { name: 'Ilyzaelle', bossName: 'Ilyzaelle', level: 200, dpnlUrl: 'https://dofusdb.fr/fr/database/dungeon/112' },
        { name: 'Korriandre', bossName: 'Korriandre', level: 190 },
        { name: 'Comte Harebourg', bossName: 'Comte Harebourg', level: 200 },
    ]

    for (const d of dungeonsData) {
        await prisma.dungeon.upsert({
            where: { name: d.name },
            update: {},
            create: d,
        })
        console.log(`Created Dungeon: ${d.name}`)
    }

    console.log('✅ Seeding finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

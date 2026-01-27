import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Start seeding...')

    // --- 1. ZONES ---
    const zonesData = [
        { name: 'Incarnam', level: 10 },
        { name: 'Astrub', level: 20 },
        { name: 'Champs d\'Astrub', level: 30 },
        { name: 'Forêt d\'Abraknyde', level: 60 },
        { name: 'Bonta', level: 50 },
        { name: 'Brakmar', level: 50 },
        { name: 'Ile de Pandala', level: 120 },
        { name: 'Cité d\'Otomaï', level: 100 },
        { name: 'Arbre de Hakam', level: 180 },
        { name: 'Frigost 1', level: 120 },
        { name: 'Frigost 2', level: 150 },
        { name: 'Frigost 3', level: 190 },
        { name: 'Saharach', level: 160 },
        { name: 'Sufokia', level: 100 },
        { name: 'Abysses de Sufokia', level: 200 },
        { name: 'Enutrosor', level: 200 },
        { name: 'Tour des Rêves', level: 200 },
    ]

    const zones = []
    for (const z of zonesData) {
        const zone = await prisma.zone.upsert({
            where: { name: z.name },
            update: { level: z.level },
            create: z,
        })
        zones.push(zone)
        console.log(`Created/Updated Zone: ${zone.name}`)
    }

    // --- 2. MONSTERS ---
    const monstersData = [
        { name: 'Bouftou d\'Incarnam', zoneName: 'Incarnam' },
        { name: 'Pichon Bleu', zoneName: 'Astrub' },
        { name: 'Abraknyde', zoneName: 'Forêt d\'Abraknyde' },
        { name: 'Tofu Maléfique', zoneName: 'Bonta' },
        { name: 'Crocodaïlle', zoneName: 'Sufokia' },
        { name: 'Bwork Arc', zoneName: 'Brakmar' },
        { name: 'Pandule', zoneName: 'Ile de Pandala' },
        { name: 'Mansot Royal', zoneName: 'Frigost 1' },
        { name: 'Blops', zoneName: 'Cité d\'Otomaï' },
        { name: 'Cactobas', zoneName: 'Saharach' },
        { name: 'Trithon', zoneName: 'Abysses de Sufokia' },
        { name: 'Phorror', zoneName: 'Enutrosor' },
    ]

    for (const m of monstersData) {
        const zone = zones.find(z => z.name === m.zoneName)
        if (zone) {
            // Check if monster exists to avoid double creation in this simplified seed
            const existing = await prisma.monster.findFirst({
                where: { name: m.name, zoneId: zone.id }
            })
            if (!existing) {
                await prisma.monster.create({
                    data: {
                        name: m.name,
                        zoneId: zone.id
                    }
                })
                console.log(`Created Monster: ${m.name} in ${zone.name}`)
            }
        }
    }

    // --- 3. DUNGEONS ---
    const dungeonsData = [
        // Level 1-50
        { name: 'Donjon d\'Incarnam', bossName: 'Milimilou', level: 10 },
        { name: 'Donjon Ensablé', bossName: 'Mob l\'Éponge', level: 20 },
        { name: 'Donjon des Bouftous', bossName: 'Bouftou Royal', level: 30 },
        { name: 'Donjon des Squelettes', bossName: 'Chafer Royal', level: 40 },
        // Level 51-100
        { name: 'Donjon des Blops', bossName: 'Blop Multicolore Royal', level: 90 },
        { name: 'Donjon de Nowel', bossName: 'Sapik', level: 60 },
        { name: 'Donjon des Crapeaux', bossName: 'Kwakwa', level: 50 },
        { name: 'Donjon de Moon', bossName: 'Moon', level: 100 },
        // Level 101-150
        { name: 'Donjon du Dragon Cochon', bossName: 'Dragon Cochon', level: 120 },
        { name: 'Donjon du Chêne Mou', bossName: 'Chêne Mou', level: 140 },
        { name: 'Donjon des Mansots', bossName: 'Mansot Royal', level: 130 },
        { name: 'Donjon du Royalmouth', bossName: 'Royalmouth', level: 120 },
        // Level 151-190
        { name: 'Donjon de l\'Obsidiantre', bossName: 'Obsidiantre', level: 160 },
        { name: 'Donjon du Korriandre', bossName: 'Korriandre', level: 180 },
        { name: 'Donjon du Kolosso', bossName: 'Kolosso', level: 190 },
        { name: 'Donjon du Tengu Givrefoux', bossName: 'Tengu Givrefoux', level: 170 },
        // Level 191-200
        { name: 'Donjon de Merkator', bossName: 'Merkator', level: 200 },
        { name: 'Donjon de la Reine des Voleurs', bossName: 'Reine des Voleurs', level: 200 },
        { name: 'Donjon de Captain Amakna', bossName: 'Captain Amakna', level: 200 },
        { name: 'Donjon du Comte Harebourg', bossName: 'Comte Harebourg', level: 200 },
        { name: 'Donjon du Nileza', bossName: 'Nileza', level: 200 },
        { name: 'Donjon de Sylargh', bossName: 'Sylargh', level: 200 },
        { name: 'Donjon de Missiz Frizz', bossName: 'Missiz Frizz', level: 200 },
        { name: 'Donjon de Klime', bossName: 'Klime', level: 200 },
    ]

    for (const d of dungeonsData) {
        await prisma.dungeon.upsert({
            where: { name: d.name },
            update: { bossName: d.bossName, level: d.level },
            create: d,
        })
        console.log(`Created/Updated Dungeon: ${d.name}`)
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

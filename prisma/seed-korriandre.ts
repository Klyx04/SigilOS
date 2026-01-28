import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    // @ts-ignore
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
})

async function main() {
    const dungeonName = "Antre du Korriandre"

    const existing = await prisma.dungeon.findUnique({
        where: { name: dungeonName }
    })

    if (existing) {
        console.log(`Dungeon '${dungeonName}' already exists.`)
        return
    }

    const dungeon = await prisma.dungeon.create({
        data: {
            name: dungeonName,
            bossName: "Korriandre",
            level: 180,
            imageUrl: "/images/boss/korriandre.png", // Placeholder
            dpnlUrl: "https://www.dofuspourlesnoobs.com/antre-du-korriandre.html"
        }
    })
    console.log(`Created dungeon: ${dungeon.name}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

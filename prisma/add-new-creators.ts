import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const guilds = await prisma.guildConfig.findMany()
    console.log(`Checking ${guilds.length} guilds...`)

    for (const guild of guilds) {
        console.log(`Guild: ${guild.id}`)

        // Volcasaurus
        const v = await prisma.contentCreator.findFirst({
            where: { guildId: guild.id, name: 'Volcasaurus' }
        })
        if (!v) {
            await prisma.contentCreator.create({
                data: {
                    guildId: guild.id,
                    name: "Volcasaurus",
                    role: "Défis & Solotages",
                    youtube: "https://www.youtube.com/@volcasaurus4500",
                    twitch: "https://www.twitch.tv/volcatwitch",
                    handle: "volcatwitch",
                    color: "#22d3ee",
                    order: 6
                }
            })
            console.log(`  + Added Volcasaurus`)
        }

        // Humility
        const h = await prisma.contentCreator.findFirst({
            where: { guildId: guild.id, name: 'Humility' }
        })
        if (!h) {
            await prisma.contentCreator.create({
                data: {
                    guildId: guild.id,
                    name: "Humility",
                    role: "Guides & Actualités",
                    youtube: "https://www.youtube.com/@humilityfr",
                    twitch: "https://www.twitch.tv/humility",
                    handle: "humility",
                    color: "#f59e0b",
                    order: 7
                }
            })
            console.log(`  + Added Humility`)
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

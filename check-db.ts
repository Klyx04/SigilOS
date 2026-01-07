
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const guilds = await prisma.guildConfig.findMany({
        include: {
            profiles: true
        }
    })
    console.log("Guilds found:", guilds.map(g => ({ name: g.name, id: g.id, profileCount: g.profiles.length })))

    const accounts = await prisma.account.findMany()
    console.log("Accounts found (Provider IDs):", accounts.map(a => ({ userId: a.userId, providerId: a.providerAccountId })))

    const profiles = await prisma.userProfile.findMany()
    console.log("All UserProfiles:", profiles)
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

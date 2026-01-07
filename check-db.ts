
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const guilds = await prisma.guildConfig.findMany()
    console.log("Guilds found:", guilds)

    const accounts = await prisma.account.findMany()
    console.log("Accounts found (Provider IDs):", accounts.map(a => ({ userId: a.userId, providerId: a.providerAccountId })))
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

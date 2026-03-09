
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cache = await prisma.contentCache.findMany({
        where: { creatorId: 'Ankama' },
        take: 5
    });
    console.log(JSON.stringify(cache, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

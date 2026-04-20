const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBounties() {
    const bounties = await prisma.bounty.findMany({
        take: 10,
        select: { name: true, dpnlUrl: true, mapUrl: true }
    });
    console.log(JSON.stringify(bounties, null, 2));
    await prisma.$disconnect();
}

checkBounties();

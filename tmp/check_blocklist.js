const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const b = await prisma.globalBlocklist.findUnique({ where: { id: 'GLOBAL' } });
    console.log(JSON.stringify(b, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());

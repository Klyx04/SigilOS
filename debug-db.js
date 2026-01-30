
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.user.count();
        console.log('User count:', count);
        process.exit(0);
    } catch (e) {
        console.error('DB Error:', e);
        process.exit(1);
    }
}

main();

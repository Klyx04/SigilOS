
const { db } = require('./src/lib/prisma');

async function main() {
    try {
        const userCount = await db.user.count();
        console.log('User count:', userCount);
        process.exit(0);
    } catch (e) {
        console.error('Prisma Error:', e);
        process.exit(1);
    }
}

main();

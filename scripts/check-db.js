require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const user = process.env.POSTGRES_USER || 'sigiluser';
const pwd = process.env.POSTGRES_PASSWORD;
const dbName = process.env.POSTGRES_DB || 'sigilos';

// Force localhost for this test script since we are running on host
const url = `postgresql://${user}:${pwd}@localhost:5432/${dbName}?schema=public`;

console.log(`Connecting to: postgresql://${user}:***@localhost:5432/${dbName}`);

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: url
        }
    },
    log: ['error', 'warn'],
});

async function main() {
    const start = Date.now();
    try {
        console.log('Connecting...');
        await prisma.$connect();
        console.log(`✅ Connected in ${Date.now() - start}ms`);

        console.log('Running query...');
        const count = await prisma.user.count();
        console.log(`✅ User count: ${count}`);

    } catch (e) {
        console.error('❌ Connection FAILED:', e);
    } finally {
        await prisma.$disconnect();
        console.log('Disconnected');
    }
}

main();

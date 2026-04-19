import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log("Models in Prisma Client:");
Object.keys(prisma).forEach(key => {
    if (!key.startsWith('_') && !key.startsWith('$')) {
        console.log(`- ${key}`);
    }
});

process.exit(0);

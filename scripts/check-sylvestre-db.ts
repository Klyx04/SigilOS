import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function check() {
    const d = await db.dofusItem.findUnique({
        where: { slug: 'sylvestre' },
        include: { questChains: { include: { entries: true } } }
    });
    console.log('Chains in DB:', d?.questChains.map(c => c.sectionName));
    console.log('Quests in first chain:', d?.questChains[0]?.entries.map(e => e.name));
}

check().catch(console.error).finally(() => db.$disconnect());

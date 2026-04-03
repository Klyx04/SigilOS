import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Cleaning Dofus Quest data for Tacheté and Argenté Scintillant...");
        // Get the DofusItems
        const items = await prisma.dofusItem.findMany({
            where: {
                slug: { in: ['tachete', 'argente-scint', 'argent-scint', 'argente-scintillant'] }
            }
        });
        
        console.log(`Found ${items.length} items to clean.`);
        
        for (const item of items) {
            console.log(`Deleting chains for dofusId: ${item.id} (${item.slug})`);
            const chains = await prisma.dofusQuestChain.findMany({
                where: { dofusId: item.id }
            });
            for(const chain of chains) {
                await prisma.dofusQuestEntry.deleteMany({
                    where: { chainId: chain.id }
                });
            }
            await prisma.dofusQuestChain.deleteMany({
                where: { dofusId: item.id }
            });
        }
        
        console.log("Cleanup complete. Please click SEED in the dashboard to insert the pristine data.");
    } catch (e) {
        console.error("Error during cleanup:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

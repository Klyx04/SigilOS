import { PrismaClient } from '@prisma/client';
import itemsData from './prisma/seed-data/dofus-quests/dofus-items.json';

const prisma = new PrismaClient();

async function cleanGhosts() {
    try {
        console.log("Cleaning ghost DofusItems from database...");
        
        const validSlugs = itemsData.map(i => i.slug);
        
        // Find all items in DB that are not in validSlugs
        const ghosts = await prisma.dofusItem.findMany({
            where: {
                slug: { notIn: validSlugs }
            }
        });
        
        if (ghosts.length === 0) {
            console.log("No ghosts found.");
            return;
        }
        
        for (const ghost of ghosts) {
            console.log(`Deleting ghost item: ${ghost.name} (slug: ${ghost.slug})`);
            
            // Delete chains
            const chains = await prisma.dofusQuestChain.findMany({ where: { dofusId: ghost.id } });
            for (const chain of chains) {
                await prisma.dofusQuestEntry.deleteMany({ where: { chainId: chain.id } });
            }
            await prisma.dofusQuestChain.deleteMany({ where: { dofusId: ghost.id } });
            
            // Delete player progresses for this item
            await prisma.playerDofusProgress.deleteMany({ where: { dofusId: ghost.id } });
            
            // Delete requirements involving this ghost
            await prisma.dofusRequirement.deleteMany({
                where: { OR: [ { fromId: ghost.id }, { toId: ghost.id } ] }
            });
            
            // Finally delete the ghost item
            await prisma.dofusItem.delete({ where: { id: ghost.id } });
        }
        
        console.log("Cleanup complete!");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanGhosts();

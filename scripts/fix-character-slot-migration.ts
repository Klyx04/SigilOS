import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  // Find all records with malformed profileIds (containing '::')
  const records = await prisma.playerGuideProgress.findMany({
    where: { profileId: { contains: '::' } }
  });
  
  console.log(`Found ${records.length} records with malformed profileIds`);
  
  for (const record of records) {
    const parts = record.profileId.split('::');
    const realProfileId = parts[0];
    const characterSlot = parts.slice(1).join('::');
    
    await prisma.playerGuideProgress.delete({ where: { id: record.id } });
    
    await prisma.playerGuideProgress.create({
      data: {
        profileId: realProfileId,
        milestoneId: record.milestoneId,
        characterSlot: characterSlot,
        isCompleted: record.isCompleted,
        completedAt: record.completedAt,
        completedSteps: record.completedSteps as any,
        currentStep: record.currentStep,
        notes: record.notes,
        createdAt: record.createdAt,
        updatedAt: new Date(),
      }
    });
    
    console.log(`  Fixed: ${record.id} -> profileId=${realProfileId}, slot=${characterSlot}`);
  }
  
  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
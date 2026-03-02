
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const guildId = "1290442961380835451"; // Celle de ton screenshot

    // On cherche les profils qui ont des mules pour vérifier si l'écriture fonctionne
    const profiles = await prisma.userProfile.findMany({
        where: {
            guild: { discordGuildId: guildId },
            altPseudos: { not: null }
        },
        select: { id: true, userId: true, altPseudos: true }
    });

    console.log(`Diagnostic pour la guilde ${guildId}:`);
    console.log(`Nombre de profils avec mules : ${profiles.length}`);
    profiles.forEach(p => {
        console.log(`User ${p.userId} -> Mules:`, p.altPseudos);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());

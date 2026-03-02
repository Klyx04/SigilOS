
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const profile = await prisma.userProfile.findFirst({
        where: { altPseudos: { not: null } }
    });
    console.log("Profile with altPseudos:", profile);

    // Check fields of UserProfile
    const fields = Object.keys(profile || {});
    console.log("Available fields:", fields);
}

main().catch(console.error).finally(() => prisma.$disconnect());

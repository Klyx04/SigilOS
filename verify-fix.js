const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verify() {
    try {
        const profile = await prisma.userProfile.findFirst({
            include: { guild: true }
        });
        console.log('Verification Success!');
        console.log('Found Profile:', profile ? profile.id : 'None');
        console.log('Linked Guild:', profile?.guild ? profile.guild.name : 'None');
    } catch (e) {
        console.error('Verification FAILED:', e.message);
        console.error(e.stack);
    } finally {
        await prisma.$disconnect()
    }
}
verify()

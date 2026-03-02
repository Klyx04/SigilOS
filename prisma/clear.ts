import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.djSearchPost.deleteMany({});
    console.log("Deleted all DjSearchPost records.");
}
main().catch(console.error).finally(() => prisma.$disconnect());

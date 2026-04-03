import "dotenv/config";
import { db } from "../src/lib/prisma";

async function run() {
    const slugs = ["kaliptus", "dokille", "dofawa"];
    for (const slug of slugs) {
        const item = await db.dofusItem.findUnique({ where: { slug } });
        if (item) {
            await db.dofusQuestChain.deleteMany({ where: { dofusId: item.id } });
            await db.dofusItem.delete({ where: { id: item.id } });
            console.log(`✅ Deleted: ${slug}`);
        } else {
            console.log(`ℹ️  Not found in DB: ${slug}`);
        }
    }
    await db.$disconnect();
    console.log("Done.");
}

run().catch((e) => { console.error(e); process.exit(1); });

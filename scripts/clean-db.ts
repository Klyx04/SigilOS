import { db } from "../src/lib/prisma";

async function clean() {
    const slugsToDelete = ["tacheté", "argenté"];
    const deleted = await db.dofusItem.deleteMany({
        where: {
            slug: { in: slugsToDelete }
        }
    });

    console.log(`Deleted ${deleted.count} obsolete DofusItems with accented slugs.`);
    await db.$disconnect();
}
clean();

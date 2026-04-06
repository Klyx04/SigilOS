import "dotenv/config";
import { db } from "../src/lib/prisma";

async function main() {
    console.log("--- DOFUS ITEM AUDIT ---");
    const items = await (db as any).dofusItem.findMany({
        orderBy: { displayOrder: "asc" }
    });

    console.table(items.map((i: any) => ({
        slug: i.slug,
        name: i.name,
        imageUrl: i.imageUrl?.substring(0, 40) + "...",
        dofusDbId: i.dofusDbItemId
    })));

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

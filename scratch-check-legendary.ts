import "dotenv/config";
import { db } from "./src/lib/prisma";

async function main() {
  console.log("Analyzing Legendary Items...");
  const items = await db.legendaryItem.findMany({
    select: {
      id: true,
      name: true,
      imageUrl: true
    }
  });

  console.log(JSON.stringify(items, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await db.$disconnect();
  });


import "dotenv/config";
import { db } from "../lib/prisma";

async function main() {
    console.log("Wiping Missions...");
    // Using deleteMany to clear table.
    // Assuming Prisma Client works enough to delete.
    try {
        await db.mission.deleteMany({});
        console.log("Missions wiped.");
    } catch (e) {
        console.error("Prisma Client failed. Trying raw query if possible or diagnosing.");
        console.error(e);
        // Fallback: If deleteMany fails due to schema mismatch, we might need a more aggressive approach
        // but typically deleteMany is safe.
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => process.exit());

import "dotenv/config";
import { db } from "../lib/prisma";

async function main() {
    console.log("Fetching all missions...");
    const missions = await db.mission.findMany({
        include: {
            guild: true
        }
    });

    console.log(`Found ${missions.length} missions.`);

    missions.forEach(m => {
        console.log(`[Slot ${m.slotIndex}] Guild: ${m.guildId} | Week: ${m.weekNumber}/${m.year}`);
        console.log(`   - ${m.category} (Tier ${m.tier}) - Title: ${m.title}`);
        console.log(`   - Payload:`, JSON.stringify(m.payload));
        console.log(`   - XP: ${m.xpReward}, Coins: ${m.guildatonsReward}`);
        console.log("------------------------------------------------");
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => process.exit());

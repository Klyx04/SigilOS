import { seedDofusData } from "../src/server/actions/dofus-quest-actions";
import 'dotenv/config';

async function main() {
    process.env.IS_SUPER_ADMIN = "true"; // Bypass auth for CLI
    console.log("🚀 Starting global seed...");
    const res = await seedDofusData("GOD");
    if (res.success) {
        console.log(res.message);
    } else {
        console.error("❌ Error:", res.error);
    }
}

main().catch(console.error);

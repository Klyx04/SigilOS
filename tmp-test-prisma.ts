
import { db } from './src/lib/prisma';

async function test() {
    try {
        console.log("Checking UserProfile...");
        const profile = await db.userProfile.findFirst({
            select: {
                id: true,
                ocreProgressSnapshot: true
            } as any
        }) as any;
        console.log("Found profile:", profile?.id);
        console.log("Snapshot exists:", !!profile?.ocreProgressSnapshot);
        
        console.log("Checking OcreMonsterTemplate...");
        const count = await (db as any).ocreMonsterTemplate.count();
        console.log("Template count:", count);
    } catch (e) {
        console.error("TEST FAILED:", e);
    } finally {
        process.exit();
    }
}

test();

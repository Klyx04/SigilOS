
import { db } from '../src/lib/prisma';

async function run() {
    try {
        console.log("Listing tables...");
        const tables: any[] = await db.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
        console.log("Tables found:", tables.map(t => t.tablename).sort().join(", "));
        
        console.log("\nChecking UserProfile columns...");
        const columns: any[] = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'UserProfile'`;
        console.log("UserProfile columns:", columns.map(c => c.column_name).sort().join(", "));
    } catch (e) {
        console.error("INSPECTION FAILED:", e);
    } finally {
        process.exit();
    }
}

run();

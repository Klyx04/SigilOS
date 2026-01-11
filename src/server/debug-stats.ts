
import { db } from "@/lib/prisma";

async function debugStats() {
    const guildId = "1327001962309226577"; // Assuming this is the guild ID from context or logs, if not I need to find it.
    // Actually let's just find the first guild
    const guild = await db.guildConfig.findFirst();
    if (!guild) {
        console.log("No guild found");
        return;
    }

    console.log(`DEBUGGING GUILD: ${guild.discordGuildId} (${guild.id})`);

    const profiles = await db.userProfile.findMany({
        where: { guildId: guild.id },
        include: { user: true }
    });

    console.log(`Found ${profiles.length} profiles.`);

    for (const p of profiles) {
        console.log(`\n--- Profile: ${p.pseudoDofus || p.user.name} (${p.id}) ---`);
        console.log(`Current XP: ${p.xp}`);

        const submissions = await db.submission.findMany({
            where: { profileId: p.id },
            include: { mission: true }
        });

        console.log(`Total Submissions: ${submissions.length}`);

        const validated = submissions.filter(s => s.status === 'VALIDATED');
        console.log(`Validated Submissions: ${validated.length}`);

        // Week Calculation Logic
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        console.log(`Start of Week: ${startOfWeek.toISOString()}`);

        const weekly = validated.filter(s => {
            console.log(`Sub ${s.id} updated at: ${s.updatedAt.toISOString()} >= ${startOfWeek.toISOString()} ? ${s.updatedAt >= startOfWeek}`);
            return s.updatedAt >= startOfWeek;
        });

        console.log(`Weekly Validated: ${weekly.length}`);
        const weeklyXp = weekly.reduce((acc, curr) => acc + (curr.mission.xpReward || 0), 0);
        console.log(`Weekly Activity Points (XP): ${weeklyXp}`);
    }
}

debugStats();

import fs from 'fs';
import path from 'path';

async function fixGameData() {
    const seedDataPath = path.join(process.cwd(), 'prisma', 'seed-data', 'game-data.json');
    const backupPath = path.join(process.cwd(), 'prisma', 'seeds', 'game-data.json');

    if (!fs.existsSync(seedDataPath) || !fs.existsSync(backupPath)) {
        console.error('Missing files');
        return;
    }

    const current = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    console.log(`Current: ${current.data.zones.length} zones, ${current.data.families.length} families, ${current.data.challenges.length} challenges, ${current.data.dungeons.length} dungeons`);
    console.log(`Backup: ${backup.zones.length} zones, ${backup.monsterFamilies.length} families, ${backup.challenges.length} challenges, ${backup.dungeons.length} dungeons`);

    // 1. Restore Challenges if empty
    if (current.data.challenges.length === 0) {
        current.data.challenges = backup.challenges.map((c: any) => ({
            id: `seed-challenge-${c.slug}`,
            slug: c.slug,
            name: c.name,
            description: c.description,
            iconUrl: c.iconUrl,
            conditions: null
        }));
        console.log(`✅ Restored ${current.data.challenges.length} challenges`);
    }

    // 2. Restore Dungeons if empty
    if (current.data.dungeons.length === 0) {
        current.data.dungeons = backup.dungeons.map((d: any) => ({
            id: `seed-dungeon-${d.slug || d.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: d.name,
            bossName: d.bossName,
            level: d.level,
            dpnlUrl: d.dpnlUrl,
            imageUrl: d.imageUrl,
            isExpedition: d.isExpedition || false,
            expeditionModes: d.expeditionModes || null,
            expeditionMechanics: d.expeditionMechanics || null,
            achievements: (d.challengeSlugs || []).map((slug: string) => ({
                id: `seed-ach-${d.slug || d.name.toLowerCase().replace(/\s+/g, '-')}-${slug}`,
                challengeId: `seed-challenge-${slug}`,
                points: 10
            }))
        }));
        console.log(`✅ Restored ${current.data.dungeons.length} dungeons`);
    }

    // 3. Ensure zones from backup are present if missing
    for (const bz of backup.zones) {
        if (!current.data.zones.find((z: any) => z.name === bz.name)) {
            current.data.zones.push({
                id: `seed-zone-${bz.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: bz.name,
                level: 200, // Default level
                dpnlUrl: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                eventZoneKey: null,
                isEventZone: false
            });
        }
    }

    fs.writeFileSync(seedDataPath, JSON.stringify(current, null, 2));
    console.log('🎉 game-data.json updated successfully!');
}

fixGameData().catch(console.error);

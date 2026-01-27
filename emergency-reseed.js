const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function seed() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        console.log('--- RAW PG RE-SEED START ---');

        const guildId = '1290442961380835451';
        const guildUuid = 'cmkvpig0900006sogmrrzj6vm'; // Restoring the same UUID to maintain links

        // 1. Restore GuildConfig
        await client.query(`
            INSERT INTO "GuildConfig" (id, "discordGuildId", name, "isActive", "presentationEnabled", "rolesMapping", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT ("discordGuildId") DO UPDATE SET name = $3, "presentationEnabled" = $5
        `, [guildUuid, guildId, 'SigilOS Restored', true, true, '{}']);
        console.log('Guild restored:', guildUuid);

        // 2. Restore Users & Accounts & Profiles
        const users = [
            { id: 'cmkvp9ukv000q10og0a7mzucu', discordId: '1328128903449149615', name: 'User 1' },
            { id: 'cmkvpltuj000u10ogjw64nvtf', discordId: '1130064714001563718', name: 'User 2' }
        ];

        for (const u of users) {
            // User
            await client.query(`
                INSERT INTO "User" (id, name, "emailVerified") VALUES ($1, $2, NOW())
                ON CONFLICT (id) DO UPDATE SET name = $2
            `, [u.id, u.name]);

            // Account
            await client.query(`
                INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (provider, "providerAccountId") DO UPDATE SET "userId" = $2
            `, [u.id + '_acc', u.id, 'oauth', 'discord', u.discordId]);

            // Profile
            await client.query(`
                INSERT INTO "UserProfile" (id, "userId", "guildId", status, "pseudoDofus", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT ("userId", "guildId") DO UPDATE SET status = $4
            `, [u.id + '_prof', u.id, guildUuid, 'ACTIVE', u.name]);

            console.log(`User ${u.id} restored.`);
        }

        console.log('--- RAW PG RE-SEED SUCCESS ---');
    } catch (e) {
        console.error('SEED FAILED:', e);
    } finally {
        await client.end();
    }
}
seed();

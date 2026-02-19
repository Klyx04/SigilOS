import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const getEnv = (key: string, fallback: string) => {
    const val = process.env[key];
    if (!val) return fallback;
    return val.replace(/^['"]|['"]$/g, "").trim();
};

const user = getEnv("POSTGRES_USER", "sigiluser");
const pwd = getEnv("POSTGRES_PASSWORD", "");
const dbName = getEnv("POSTGRES_DB", "sigilos");
const host = process.env.DB_HOST || "localhost";
const connStr = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${dbName}`;

const pool = new Pool({ connectionString: connStr });

async function fix() {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) throw new Error("DISCORD_GUILD_ID manquant dans .env");

    console.log(`🔍 Vérification de la guilde ${guildId} sur Discord...`);

    // Fetch real guild name
    let guildName = 'Ma Guilde (BETA)';
    try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });
        if (res.ok) {
            const data = await res.json() as any;
            guildName = data.name;
            console.log(`✅ Nom récupéré: ${guildName}`);
        } else {
            console.warn(`⚠️  Discord API error: ${res.status}. Utilisation du fallback.`);
        }
    } catch (e) {
        console.error("❌ Erreur Discord API:", e);
    }

    const client = await pool.connect();
    try {
        // AllowedGuild
        await client.query(`
            INSERT INTO "AllowedGuild" ("id", "discordGuildId", "name", "tier", "isActive", "addedBy", "addedAt")
            VALUES (gen_random_uuid()::text, $1, $2, 'BETA', true, 'local-setup', NOW())
            ON CONFLICT ("discordGuildId") DO UPDATE SET "isActive" = true, "name" = $2
        `, [guildId, guildName]);

        // GuildConfig
        await client.query(`
            INSERT INTO "GuildConfig" ("id", "discordGuildId", "name", "isActive", "rolesMapping", "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, $1, $2, true, '{}', NOW(), NOW())
            ON CONFLICT ("discordGuildId") DO UPDATE SET "isActive" = true, "name" = $2, "updatedAt" = NOW()
        `, [guildId, guildName]);

        console.log(`✅ Guilde réactivée en local avec son vrai nom: ${guildName} (${guildId})`);
    } finally {
        client.release();
        await pool.end();
    }
}

fix().catch((e) => { console.error(e); process.exit(1); });

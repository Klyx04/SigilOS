const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();

        const tables = ['User', 'GuildConfig', 'UserProfile', 'DreamRun'];
        for (const table of tables) {
            console.log(`\n--- COLUMNS FOR ${table} ---`);
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            console.log(res.rows.map(r => r.column_name).join(', '));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
check();

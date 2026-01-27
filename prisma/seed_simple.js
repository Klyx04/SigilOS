const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
    console.log('🌱 Start seeding (Direct SQL)...');
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await client.connect();

        // --- ZONES ---
        const zonesData = [
            { name: 'Incarnam', level: 10 },
            { name: 'Astrub', level: 20 },
            { name: 'Champs d\'Astrub', level: 30 },
            { name: 'Forêt d\'Abraknyde', level: 60 },
            { name: 'Bonta', level: 50 },
            { name: 'Brakmar', level: 50 },
            { name: 'Ile de Pandala', level: 120 },
            { name: 'Cité d\'Otomaï', level: 100 },
            { name: 'Arbre de Hakam', level: 180 },
            { name: 'Frigost 1', level: 120 },
            { name: 'Frigost 2', level: 150 },
            { name: 'Frigost 3', level: 190 },
            { name: 'Saharach', level: 160 },
            { name: 'Sufokia', level: 100 },
            { name: 'Abysses de Sufokia', level: 200 },
            { name: 'Enutrosor', level: 200 },
            { name: 'Tour des Rêves', level: 200 },
        ];

        for (const z of zonesData) {
            const id = `zone_${z.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
            await client.query(`
                INSERT INTO "Zone" (id, name, level, "createdAt")
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (name) DO UPDATE SET level = $3
            `, [id, z.name, z.level]);
            console.log(`Created/Updated Zone: ${z.name}`);
        }

        // --- DUNGEONS ---
        const dungeonsData = [
            { name: 'Donjon d\'Incarnam', bossName: 'Milimilou', level: 10 },
            { name: 'Donjon Ensablé', bossName: 'Mob l\'Éponge', level: 20 },
            { name: 'Donjon des Bouftous', bossName: 'Bouftou Royal', level: 30 },
            { name: 'Donjon des Squelettes', bossName: 'Chafer Royal', level: 40 },
            { name: 'Donjon des Blops', bossName: 'Blop Multicolore Royal', level: 90 },
            { name: 'Donjon de Nowel', bossName: 'Sapik', level: 60 },
            { name: 'Donjon des Crapeaux', bossName: 'Kwakwa', level: 50 },
            { name: 'Donjon de Moon', bossName: 'Moon', level: 100 },
            { name: 'Donjon du Dragon Cochon', bossName: 'Dragon Cochon', level: 120 },
            { name: 'Donjon du Chêne Mou', bossName: 'Chêne Mou', level: 140 },
            { name: 'Donjon des Mansots', bossName: 'Mansot Royal', level: 130 },
            { name: 'Donjon du Royalmouth', bossName: 'Royalmouth', level: 120 },
            { name: 'Donjon de l\'Obsidiantre', bossName: 'Obsidiantre', level: 160 },
            { name: 'Donjon du Korriandre', bossName: 'Korriandre', level: 180 },
            { name: 'Donjon du Kolosso', bossName: 'Kolosso', level: 190 },
            { name: 'Donjon du Tengu Givrefoux', bossName: 'Tengu Givrefoux', level: 170 },
            { name: 'Donjon de Merkator', bossName: 'Merkator', level: 200 },
            { name: 'Donjon de la Reine des Voleurs', bossName: 'Reine des Voleurs', level: 200 },
            { name: 'Donjon de Captain Amakna', bossName: 'Captain Amakna', level: 200 },
            { name: 'Donjon du Comte Harebourg', bossName: 'Comte Harebourg', level: 200 },
            { name: 'Donjon du Nileza', bossName: 'Nileza', level: 200 },
            { name: 'Donjon de Sylargh', bossName: 'Sylargh', level: 200 },
            { name: 'Donjon de Missiz Frizz', bossName: 'Missiz Frizz', level: 200 },
            { name: 'Donjon de Klime', bossName: 'Klime', level: 200 },
        ];

        for (const d of dungeonsData) {
            const id = `dj_${d.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
            await client.query(`
                INSERT INTO "Dungeon" (id, name, "bossName", level, "createdAt")
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (name) DO UPDATE SET "bossName" = $3, level = $4
            `, [id, d.name, d.bossName, d.level]);
            console.log(`Created/Updated Dungeon: ${d.name}`);
        }

        // --- MONSTERS ---
        const monstersData = [
            { name: 'Bouftou d\'Incarnam', zoneName: 'Incarnam' },
            { name: 'Pichon Bleu', zoneName: 'Astrub' },
            { name: 'Abraknyde', zoneName: 'Forêt d\'Abraknyde' },
            { name: 'Tofu Maléfique', zoneName: 'Bonta' },
            { name: 'Crocodaïlle', zoneName: 'Sufokia' },
            { name: 'Bwork Arc', zoneName: 'Brakmar' },
            { name: 'Pandule', zoneName: 'Ile de Pandala' },
            { name: 'Mansot Royal', zoneName: 'Frigost 1' },
        ];

        for (const m of monstersData) {
            const zoneRes = await client.query('SELECT id FROM "Zone" WHERE name = $1', [m.zoneName]);
            if (zoneRes.rows.length > 0) {
                const zoneId = zoneRes.rows[0].id;
                const id = `mon_${m.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
                await client.query(`
                    INSERT INTO "Monster" (id, name, "zoneId", "createdAt")
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT DO NOTHING
                `, [id, m.name, zoneId]);
                console.log(`Created Monster: ${m.name}`);
            }
        }

        console.log('✅ Seeding finished.');
    } catch (e) {
        console.error('SEED FAILED:', e);
    } finally {
        await client.end();
    }
}

main();

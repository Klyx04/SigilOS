
import fs from 'fs';

const API_KEY = "1181c3-c4d0f4-574355-b18b51-daf361";
const USERNAME = "Wylan";

async function run() {
    console.log("--- TEST API KEY ---");
    // 1. Check Version (Auth Check)
    try {
        const res = await fetch("https://www.metamob.fr/api/v1/game-versions", {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });
        if (res.status === 401) {
            console.error("❌ API Key is INVALID (401).");
            return;
        }
        console.log("✅ API Key is VALID.");

        // 2. Fetch User Quests to get slug
        const qRes = await fetch(`https://www.metamob.fr/api/v1/users/${USERNAME}/quests`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });
        const qJson = await qRes.json();
        const quests = qJson.data;
        if (!quests || quests.length === 0) {
            console.error("❌ No quests found for user.");
            return;
        }

        // Find Brial quest
        const brialQuest = quests.find(q => q.server.name === "Brial") || quests[0];
        console.log(`Using Quest: ${brialQuest.slug} (${brialQuest.server.name})`);

        // 3. Fetch Quest Details (First 5 monsters)
        const dRes = await fetch(`https://www.metamob.fr/api/v1/users/${USERNAME}/quests/${brialQuest.slug}?limit=100`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });
        const dJson = await dRes.json();
        // Find an owned monster to inspect
        const ownedMonster = dJson.data.monsters.find(m => {
            const val = m.owned ?? 0;
            const stat = m.status ?? -99;
            // Logic: owned > 0 OR status > -1
            return val > 0 || stat > -1;
        });

        if (ownedMonster) {
            console.log("--- USER MONSTER SAMPLE (OWNED) ---");
            console.log(JSON.stringify(ownedMonster, null, 2));

            // 4. Check Template Match
            // We need to fetch the template monster with this ID to compare
            // But we don't know the template ID easily without scanning. 
            // Let's just fetch the first few template monsters to see their structure.
            const tRes = await fetch(`https://www.metamob.fr/api/v1/quest-templates/1?limit=5`, {
                headers: { "Authorization": `Bearer ${API_KEY}` }
            });
            const tJson = await tRes.json();
            console.log("--- TEMPLATE MONSTER SAMPLE ---");
            console.log(JSON.stringify(tJson.data.monsters[0], null, 2));

        } else {
            console.log("❌ No owned monsters found in first 100.");
            console.log("Sample missing monster:", JSON.stringify(dJson.data.monsters[0], null, 2));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();

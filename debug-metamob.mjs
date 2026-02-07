
import fs from 'fs';

async function checkTemplate() {
    console.log("Fetching Template 1...");
    try {
        const res = await fetch("https://www.metamob.fr/api/v1/quest-templates/1?limit=3");
        if (!res.ok) console.error("Error:", res.status);
        const json = await res.json();
        console.log("Template 1 Sample:", JSON.stringify(json.data[0], null, 2));
        // Check if monster_id exists vs id
    } catch (e) {
        console.error(e);
    }
}

async function checkUserQuests(username) {
    console.log(`Fetching Quests for ${username}...`);
    try {
        const res = await fetch(`https://www.metamob.fr/api/v1/users/${username}/quests?limit=10`, {
            headers: { "Authorization": "Bearer 1181c3-c4d0f4-574355-b18b51-daf361" }
        });
        if (!res.ok) console.error("Error:", res.status);
        const json = await res.json();
        console.log("User Quests:", JSON.stringify(json.data, null, 2));

        if (json.data && json.data.length > 0) {
            const slug = json.data.find(q => q.server.name === "Brial")?.slug || json.data[0].slug;
            console.log(`Checking details for quest: ${slug}`);
            await checkUserQuest(username, slug);
        }
    } catch (e) {
        console.error(e);
    }
}

async function checkUserQuest(username, slug) {
    console.log(`Fetching User Quest ${username}/${slug}...`);
    try {
        const res = await fetch(`https://www.metamob.fr/api/v1/users/${username}/quests/${slug}?limit=10`, {
            headers: { "Authorization": "Bearer 1181c3-c4d0f4-574355-b18b51-daf361" }
        }); // Limit 10 to see a few
        if (!res.ok) console.error("Error:", res.status);
        const json = await res.json();
        console.log("User Quest Sample (First 5):", JSON.stringify(json.data.monsters.slice(0, 5), null, 2));

        // Find a monster that is owned if possible
        const owned = json.data.monsters.find(m => (m.status !== undefined && m.status > -1) || m.quantity > 0 || m.amount > 0 || m.owned > 0);
        if (owned) {
            console.log("Sample OWNED Monster:", JSON.stringify(owned, null, 2));
        } else {
            console.log("No owned monsters found in first page.");
        }

    } catch (e) {
        console.error(e);
    }
}

checkUserQuests('Wylan');

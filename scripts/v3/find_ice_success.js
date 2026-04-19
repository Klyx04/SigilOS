const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const itemId = 7043; // Ice Dofus
    console.log(`Searching for success rewarding Item ID: ${itemId}...`);
    try {
        // Broad search for successes that might reward the item
        // or just scan some successes
        const res = await fetch(`${API_BASE}/successes?lang=fr&$limit=100`);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            for (const s of data) {
                // Successes usually have rewards in an array
                const rewards = s.rewards || [];
                for (const r of rewards) {
                    if (r.itemIds && r.itemIds.includes(itemId)) {
                        console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                        console.log(` Quest IDs: ${JSON.stringify(s.questIds)}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const itemIds = [23238, 23237, 23232];
    console.log(`Searching for successes rewarding items: ${itemIds.join(", ")}...`);
    
    // We'll search in rewards?
    // DofusDB sometimes has rewards in the 'rewards' array
    // Let's try searching successes with limit 1000 and scan manually
    for (let i = 0; i < 20; i++) {
        process.stdout.write(`Scanning page ${i+1}/20...\r`);
        const url = `${API_BASE}/successes?lang=fr&$limit=100&$skip=${i * 100}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            for (const s of data) {
                const rewards = s.rewards || [];
                for (const r of rewards) {
                    if (r.itemIds && r.itemIds.some(id => itemIds.includes(id))) {
                        console.log(`\n✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                        console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                    }
                }
            }
        }
    }
    console.log("\nScan complete.");
}

run();

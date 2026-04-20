const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const ids = [
        2149, 2150, 2151, 2152, 2153, 2154, 2155, 2197, // Domakuro 3034
        2200, 2201, 2202 // Spotted 3082
    ];
    
    console.log(`Resolving ${ids.length} Pandala quest IDs...`);
    const results = [];
    for (const id of ids) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            if (q.name) {
                console.log(`✅ FOUND: ${q.name.fr} (ID: ${q.id})`);
                results.push({ name: q.name.fr, id: q.id });
            }
        } catch (e) {}
    }
    
    // Also try fetching the meta success directly via /successes?id=3034
    try {
        const res2 = await fetch(`${API_BASE}/successes?id=3034&lang=fr`);
        const json2 = await res2.json();
        console.log("\nSuccess 3034 raw data:");
        console.log(JSON.stringify(json2.data?.[0], null, 2));
    } catch (e) {}
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const items = [23237, 23238, 23232]; // Domakuro, Tacheté, Dorigami
    console.log(`Searching for successes rewarding Items: ${items.join(", ")}...`);
    
    try {
        const res = await fetch(`${API_BASE}/successes?lang=fr&$limit=100`);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            for (const s of data) {
                const rewards = s.rewards || [];
                for (const r of rewards) {
                    if (r.itemIds && r.itemIds.some(id => items.includes(id))) {
                        console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                        console.log(` Quest IDs: ${JSON.stringify(s.questIds)}`);
                    }
                }
            }
        }
        
        // Also search specifically by name for some known ones
        const names = ["Le destin de deux dragons", "Un pelerinage pimpant", "Pandala : L'éveil"];
        for (const name of names) {
            const res2 = await fetch(`${API_BASE}/successes?lang=fr&name.fr=${encodeURIComponent(name)}`);
            const json2 = await res2.json();
            const data2 = json2.data || json2;
            if (data2 && data2.length > 0) {
                const s = data2[0];
                 console.log(`✅ FOUND SUCCESS BY NAME: ${s.name.fr} (ID: ${s.id})`);
                 console.log(` Quest IDs: ${JSON.stringify(s.questIds)}`);
            }
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const ids = [1770, 1773, 1774, 1775]; // Likely Pandala/Dom/Dor success IDs
    console.log(`Inspecting successes IDs: ${ids.join(", ")}...`);
    
    for (const id of ids) {
        try {
            const res = await fetch(`${API_BASE}/successes?id=${id}&lang=fr`);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                const s = data[0];
                console.log(`✅ SUCCESS found: ${s.name.fr} (ID: ${s.id})`);
                console.log(`Quests: ${JSON.stringify(s.questIds)}`);
                for (const qid of s.questIds || []) {
                    const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
                    const q = await qr.json();
                    console.log(`  - ${q.name.fr} (ID: ${q.id})`);
                }
            } else {
                console.log(`❌ Success ID ${id} not found.`);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const successName = "Le destin de deux dragons";
    console.log(`Searching for success: ${successName}...`);
    try {
        const p = new URLSearchParams({ lang: "fr", "name.fr": successName });
        const res = await fetch(`${API_BASE}/successes?${p}`);
        const json = await res.json();
        const data = json.data || json;
        
        if (data && data.length > 0) {
            const s = data[0];
            console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
            console.log(`Quests: ${JSON.stringify(s.questIds)}`);
            
            for (const qid of s.questIds || []) {
                const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
                const q = await qr.json();
                console.log(`  - ${q.name.fr} (ID: ${q.id})`);
            }
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

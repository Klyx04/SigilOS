const API_BASE = "https://api.dofusdb.fr";

async function findSuccess(name) {
    const p = new URLSearchParams({ lang: "fr", "name.fr": name, "$limit": "5" });
    const res = await fetch(`${API_BASE}/successes?${p}`);
    return await res.json();
}

async function run() {
    const names = ["L'œuf à la neige", "L'oeuf à la neige", "L'Oeuf à la neige"];
    for (const name of names) {
        console.log(`Searching success [${name}] ...`);
        const json = await findSuccess(name);
        if (json.data && json.data.length > 0) {
            const s = json.data[0];
            console.log(`✅ FOUND Success: ${s.name.fr} (ID: ${s.id})`);
            console.log(`Quest IDs: ${JSON.stringify(s.questIds)}`);
            
            // Resolve names
            for (const qid of s.questIds || []) {
                const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
                const q = await qr.json();
                console.log(`  - ${q.name.fr} (ID: ${q.id})`);
            }
        }
    }
}

run();

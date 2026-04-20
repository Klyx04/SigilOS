const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Dumping names for IDs 2149-2250...");
    for (let id = 2149; id <= 2250; id++) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            if (q.name) {
                console.log(`${id}: ${q.name.fr}`);
            }
        } catch (e) {}
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Deep scanning quests 2100-2500 for Pandala details...");
    const matches = [];
    const keywords = ["Tanukoui", "dragons", "Eliocalypse", "Résonance", "Prélude", "Papier", "Bambou"];
    
    for (let id = 2100; id <= 2500; id++) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            if (q.name) {
                const name = q.name.fr;
                if (keywords.some(k => name.includes(k))) {
                     console.log(`✅ MATCH: ${name} (ID: ${q.id})`);
                     matches.push({ name, id: q.id });
                }
            }
        } catch (e) {}
    }
    console.log(`Scan complete. Found ${matches.length} matches.`);
}

run();

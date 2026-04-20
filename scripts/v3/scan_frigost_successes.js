const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Fetching successes from page 1 to 5 to find Frigost blocks...");
    for (let page = 0; page < 5; page++) {
        const url = `${API_BASE}/successes?lang=fr&$limit=50&$skip=${page * 50}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        if (Array.isArray(data)) {
            data.forEach(s => {
                if (s.name.fr.includes("Frigost") || s.name.fr.includes("Bourgade") || s.name.fr.includes("Lac Gelé")) {
                    console.log(`✅ Success: ${s.name.fr} (ID: ${s.id}) [${s.questIds?.length || 0} quests]`);
                    if (s.questIds) console.log(`   - IDs: ${s.questIds.join(", ")}`);
                }
            });
        }
    }
}

run();

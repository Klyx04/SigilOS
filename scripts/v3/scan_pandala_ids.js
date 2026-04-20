const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Scanning success IDs 1700-1850 for Pandala/Domakuro...");
    const candidates = [];
    
    for (let id = 1700; id <= 1850; id++) {
        try {
            const res = await fetch(`${API_BASE}/successes?id=${id}&lang=fr`);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                const s = data[0];
                const name = s.name?.fr || "";
                if (name.includes("dragons") || name.includes("clair-obscur") || name.includes("Pandala") || name.includes("Dorigami")) {
                    console.log(`✅ MATCH: ${name} (ID: ${s.id})`);
                    console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                    candidates.push(s);
                }
            }
        } catch (e) {}
    }
    
    console.log(`Scan complete. Found ${candidates.length} candidates.`);
}

run();

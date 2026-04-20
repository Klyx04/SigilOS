const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Scanning quests to find Frigost matches...");
    const matches = [];
    const keywords = ["Frigost", "Bourgade", "Glace", "Glace", "Pichon", "Boufmouth", "Maire", "Comte", "Snow"];
    
    // We'll scan in chunks of 50
    for (let i = 0; i < 20; i++) {
        const url = `${API_BASE}/quests?lang=fr&$limit=50&$skip=${i * 50}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            data.forEach(q => {
                const name = q.name?.fr || "";
                if (keywords.some(k => name.includes(k))) {
                    matches.push({ id: q.id, name });
                }
            });
        }
    }
    
    console.log(`Found ${matches.length} keyword matches:`);
    matches.sort((a, b) => a.id - b.id).forEach(m => {
        console.log(`- ${m.name} (ID: ${m.id})`);
    });
}

run();

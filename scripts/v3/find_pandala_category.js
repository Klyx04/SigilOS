const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Fetching achievement categories...");
    try {
        const res = await fetch(`${API_BASE}/achievement-categories?lang=fr`);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            data.forEach(c => {
                if (c.name?.fr.includes("Pandala")) {
                    console.log(`✅ FOUND CATEGORY: ${c.name.fr} (ID: ${c.id})`);
                }
            });
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function findSuccess(name) {
    const p = new URLSearchParams({ lang: "fr", "name.fr": name });
    const res = await fetch(`${API_BASE}/successes?${p}`);
    const json = await res.json();
    return json.data || json;
}

async function run() {
    const successes = ["Agricole", "La maire dénie", "L'œuf à la neige", "Larmes d'Ouronigride", "Crevasses Perverses", "Forêt pétrifiée", "Remparts du vent féroce"];
    
    for (const name of successes) {
        console.log(`Searching for success: ${name}...`);
        try {
            const results = await findSuccess(name);
            if (results && results.length > 0) {
                const s = results[0];
                console.log(`✅ FOUND: ${s.name.fr} (ID: ${s.id})`);
                if (s.questIds) {
                    console.log(`   Quest IDs: ${s.questIds.join(", ")}`);
                }
            } else {
                console.log(`❌ NOT FOUND: ${name}`);
            }
        } catch (e) {
            console.error(`Error searching ${name}: ${e.message}`);
        }
    }
}

run();

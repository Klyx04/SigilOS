const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const keywords = ["Tanukoui", "dragons", "Eliocalypse", "Résonance"];
    console.log(`Searching for keyword matches: ${keywords.join(", ")}...`);
    
    for (const k of keywords) {
        try {
            const res = await fetch(`${API_BASE}/quests?lang=fr&name.fr[$like]=${encodeURIComponent(k)}`);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                console.log(`\nMatches for ${k}:`);
                data.forEach(q => console.log(` - ${q.name.fr} (ID: ${q.id})`));
            } else {
                console.log(`\n❌ No matches for ${k}`);
            }
        } catch (e) {
            console.error(`Error on ${k}: ${e.message}`);
        }
    }
}

run();

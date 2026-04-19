const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const qid = 2370; // Le réveil de Pandala
    console.log(`Searching for successes requiring Quest ID: ${qid}...`);
    try {
        const res = await fetch(`${API_BASE}/successes?lang=fr&questIds=${qid}`);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            data.forEach(s => {
                console.log(`\n✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                console.log(` Quests: ${JSON.stringify(s.questIds)}`);
            });
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

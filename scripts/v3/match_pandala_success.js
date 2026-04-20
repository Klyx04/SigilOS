const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const idsToMatch = [2202, 2194]; 
    console.log(`Scanning success IDs 1000 to 2000 for quest IDs ${idsToMatch.join(", ")}...`);
    
    for (let id = 1000; id <= 2000; id++) {
        try {
            const res = await fetch(`${API_BASE}/successes?id=${id}&lang=fr`);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                const s = data[0];
                if (s.questIds && s.questIds.some(qid => idsToMatch.includes(qid))) {
                    console.log(`\n✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                    console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                }
            }
        } catch (e) {}
    }
}

run();

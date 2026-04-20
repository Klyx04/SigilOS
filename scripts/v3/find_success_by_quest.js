const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const qid = 2200; // Main dans la main
    console.log(`Searching for successes containing Quest ID: ${qid}...`);
    try {
        const res = await fetch(`${API_BASE}/successes?lang=fr&questIds=${qid}`);
        const json = await res.json();
        const data = json.data || json;
        
        if (data && data.length > 0) {
            for (const s of data) {
                console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                console.log(` Quest IDs: ${JSON.stringify(s.questIds)}`);
            }
        } else {
            // Broad scan if direct filter fails
            console.log("No direct match, scanning first 500 successes...");
            const res2 = await fetch(`${API_BASE}/successes?lang=fr&$limit=500`);
            const json2 = await res2.json();
            const data2 = json2.data || json2;
            for (const s of data2) {
                if (s.questIds && s.questIds.includes(qid)) {
                     console.log(`✅ FOUND SUCCESS IN SCAN: ${s.name.fr} (ID: ${s.id})`);
                     console.log(` Quest IDs: ${JSON.stringify(s.questIds)}`);
                }
            }
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

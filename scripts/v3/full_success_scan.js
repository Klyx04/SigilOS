const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const qid = 2200; // Main dans la main
    console.log("Scanning successes for quest 2200...");
    
    // We'll scan 10 pages of 100 successes
    for (let i = 0; i < 10; i++) {
        process.stdout.write(`Scanning page ${i+1}/10...\r`);
        const url = `${API_BASE}/successes?lang=fr&$limit=100&$skip=${i * 100}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        
        if (Array.isArray(data)) {
            for (const s of data) {
                if (s.questIds && s.questIds.includes(qid)) {
                    console.log(`\n✅ FOUND SPOTTED SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                    console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                }
                const name = s.name?.fr || "";
                if (name.includes("deux dragons")) {
                     console.log(`\n✅ FOUND DOMAKURO SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                     console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                }
            }
        }
    }
    console.log("\nScan complete.");
}

run();

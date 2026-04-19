const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Deep scanning successes (skip 1000 to 4000)...");
    
    for (let i = 10; i < 40; i++) {
        process.stdout.write(`Scanning page ${i+1}...\r`);
        try {
            const url = `${API_BASE}/successes?lang=fr&$limit=100&$skip=${i * 100}`;
            const res = await fetch(url);
            const json = await res.json();
            const data = json.data || json;
            
            if (Array.isArray(data)) {
                for (const s of data) {
                    const name = s.name?.fr || "";
                    if (name.includes("deux dragons") || name.includes("clair-obscur") || name.includes("pèlerinage pimpant")) {
                        console.log(`\n✅ FOUND: ${name} (ID: ${s.id})`);
                        console.log(` Quests: ${JSON.stringify(s.questIds)}`);
                    }
                }
            }
        } catch (e) {}
    }
    console.log("\nDeep scan complete.");
}

run();

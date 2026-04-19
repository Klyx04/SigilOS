const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const successName = "Un rêve en clair-obscur";
    console.log(`Searching for success: ${successName}...`);
    try {
        const p = new URLSearchParams({ lang: "fr", "name.fr": successName });
        const res = await fetch(`${API_BASE}/successes?${p}`);
        const json = await res.json();
        const data = json.data || json;
        
        if (data && data.length > 0) {
            const s = data[0];
            console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
            console.log(`Quests: ${JSON.stringify(s.questIds)}`);
            
            for (const qid of s.questIds || []) {
                const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
                const q = await qr.json();
                console.log(`  - ${q.name.fr} (ID: ${q.id})`);
            }
        } else {
             console.log("❌ Success not found by name.");
             // Try searching quests that are in it
             const knownQuests = ["Main dans la main", "Deux souffles, une inspiration"];
             for (const kname of knownQuests) {
                 const res2 = await fetch(`${API_BASE}/quests?lang=fr&name.fr=${encodeURIComponent(kname)}`);
                 const qr2 = await res2.json();
                 if (qr2.data && qr2.data.length > 0) {
                     console.log(`Found quest ID for ${kname}: ${qr2.data[0].id}`);
                 }
             }
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

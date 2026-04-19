const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const successIds = [551, 552, 553, 554, 920, 921];
    
    console.log("Fetching definitive quest lists for Ice Dofus successes...");
    for (const id of successIds) {
        console.log(`\n📦 Success ID: ${id}`);
        try {
            const res = await fetch(`${API_BASE}/successes/${id}?lang=fr`);
            const s = await res.json();
            
            if (s.name) {
                console.log(`✅ Success: ${s.name.fr}`);
                const qids = s.questIds || [];
                console.log(`   Quests (${qids.length}):`);
                for (const qid of qids) {
                    const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
                    const q = await qr.json();
                    console.log(`   - ${q.name.fr} (ID: ${q.id})`);
                }
            } else {
                console.log("❌ Not found as direct object. Checking if it's a wrapper...");
            }
        } catch (e) {
            console.error(`   Error: ${e.message}`);
        }
    }
}

run();

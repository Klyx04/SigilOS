const API_BASE = "https://api.dofusdb.fr";

async function run() {
    // Success ID for "L'œuf à la neige" is likely 1297 based on search patterns
    const sId = 1297;
    console.log(`Checking Success ID: ${sId} ...`);
    const res = await fetch(`${API_BASE}/successes/${sId}?lang=fr`);
    const s = await res.json();
    
    if (s.name) {
        console.log(`✅ Success: ${s.name.fr}`);
        const questIds = s.questIds || [];
        console.log(`Quest Count: ${questIds.length}`);
        
        for (const qid of questIds) {
            const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
            const q = await qr.json();
            console.log(`  - ${q.name.fr} (ID: ${q.id})`);
        }
    } else {
        console.log(`❌ Not found or wrong format`);
    }
}

run();

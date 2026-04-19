const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const qid = 649; // Bienvenue à Frigost
    console.log(`Fetching Quest ID: ${qid} ...`);
    const qr = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
    const q = await qr.json();
    
    // Check for success associations in the quest data
    // DofusDB usually links them in 'successIds' or similar
    console.log(`Quest: ${q.name.fr}`);
    console.log(`Success associations: ${JSON.stringify(q.successIds || q.success)}`);
}

run();

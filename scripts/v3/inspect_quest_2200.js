const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const qid = 2200; // Main dans la main
    const res = await fetch(`${API_BASE}/quests/${qid}?lang=fr`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}

run();

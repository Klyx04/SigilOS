const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Searching for all Frigost-related successes...");
    // Search for successes with "Frigost" in the name
    const p = new URLSearchParams({ lang: "fr", "name.fr[$like]": "%Frigost%", "$limit": "50" });
    const res = await fetch(`${API_BASE}/successes?${p}`);
    const json = await res.json();
    
    if (json.data) {
        for (const s of json.data) {
            console.log(`- ${s.name.fr} (ID: ${s.id}) [${s.questIds?.length || 0} quests]`);
        }
    }
}

run();

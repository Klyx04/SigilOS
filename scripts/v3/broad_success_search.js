const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Searching for ALL successes to find meta-successes...");
    // The meta success for Frigost might be named "Frigost, l'île pas comme les autres"
    // or something containing "l'île pas comme les autres"
    const terms = ["L'œuf à la neige", "Frigost, l'île pas comme les autres", "l'île pas comme les autres"];
    
    for (const term of terms) {
        console.log(`\n🔍 Searching [${term}] ...`);
        const p = new URLSearchParams({ lang: "fr", "name.fr[$like]": `%${term}%` });
        const res = await fetch(`${API_BASE}/successes?${p}`);
        const json = await res.json();
        const data = json.data || json;
        if (Array.isArray(data)) {
            data.forEach(s => {
                console.log(`✅ Success Found: ${s.name.fr} (ID: ${s.id}) [${s.questIds?.length || 0} quests]`);
                if (s.questIds && s.questIds.length > 0) {
                    console.log(`   Quest IDs: ${JSON.stringify(s.questIds)}`);
                }
            });
        }
    }
}

run();

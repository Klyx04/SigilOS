const API_BASE = "https://api.dofusdb.fr";

async function run() {
    // Search for the success by name
    const name = "Œuf à la neige";
    console.log(`Searching for success name: ${name}...`);
    try {
        const p = new URLSearchParams({ lang: "fr", "name.fr": name });
        const res = await fetch(`${API_BASE}/successes?${p}`);
        const json = await res.json();
        
        console.log("Raw Response Data length:", json.data?.length || 0);
        if (json.data && json.data.length > 0) {
            const s = json.data[0];
            console.log(`✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
            console.log(`Quest IDs: ${JSON.stringify(s.questIds)}`);
            
            // If it has children successes (meta-success)
            console.log(`Child Successes: ${JSON.stringify(s.successIds || s.successes)}`);
        } else {
            console.log("❌ Success not found by exact name. Trying 'oe'...");
            const res2 = await fetch(`${API_BASE}/successes?lang=fr&name.fr=Oeuf à la neige`);
            const json2 = await res2.json();
            console.log("Raw Response Data length (oe):", json2.data?.length || 0);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

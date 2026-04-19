const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const endpoints = ["successes", "achievements"];
    const id = 922;
    
    for (const ep of endpoints) {
        console.log(`Trying endpoint: ${ep}...`);
        try {
            const res = await fetch(`${API_BASE}/${ep}?lang=fr&id=${id}`);
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                console.log(`✅ SUCCESS with ${ep}!`);
                console.log(JSON.stringify(json.data[0], null, 2));
            } else {
                console.log(`❌ No data on ${ep}`);
            }
        } catch (e) {
            console.error(`Error on ${ep}: ${e.message}`);
        }
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function run() {
    console.log("Searching for quest 'Le réveil de Pandala'...");
    try {
        const res = await fetch(`${API_BASE}/quests?lang=fr&name.fr=Le%20r%C3%A9veil%20de%20Pandala`);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response length: ${text.length}`);
        if (text.length > 0) {
            const json = JSON.parse(text);
            console.log(JSON.stringify(json, null, 2));
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

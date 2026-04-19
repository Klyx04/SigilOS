const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const term = "clair";
    console.log(`Searching for success LIKE '${term}'...`);
    try {
        const url = `${API_BASE}/successes?lang=fr&name.fr[$like]=${encodeURIComponent('%' + term + '%')}`;
        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

run();

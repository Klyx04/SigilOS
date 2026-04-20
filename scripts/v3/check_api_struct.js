const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const res = await fetch(`${API_BASE}/successes?lang=fr&$limit=1`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}

run();

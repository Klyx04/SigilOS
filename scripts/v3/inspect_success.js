const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const id = 551; // La maire dénie
    const res = await fetch(`${API_BASE}/successes/${id}?lang=fr`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}

run();

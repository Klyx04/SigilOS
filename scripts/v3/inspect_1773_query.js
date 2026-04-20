const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const id = 1773; // Potential Spotted success
    const res = await fetch(`${API_BASE}/successes?id=${id}&lang=fr`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}

run();

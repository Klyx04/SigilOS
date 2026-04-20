const API_BASE = "https://api.dofusdb.fr";

async function checkId(id) {
    const url = `${API_BASE}/quests/${id}?lang=fr`;
    try {
        const res = await fetch(url);
        const json = await res.json();
        return json.name ? json.name.fr : "Unknown";
    } catch(e) { return "Error"; }
}

async function run() {
    const ids = [649, 650, 651, 652, 653, 655, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666];
    for (const id of ids) {
        const name = await checkId(id);
        console.log(`ID ${id} -> ${name}`);
    }
}

run();

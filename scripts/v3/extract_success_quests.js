const API_BASE = "https://api.dofusdb.fr";

async function getSuccessQuests(successName) {
    const p = new URLSearchParams({ lang: "fr", "name.fr": successName, "$limit": "5" });
    const res = await fetch(`${API_BASE}/successes?${p}`);
    const json = await res.json();
    if (!json.data || json.data.length === 0) return null;
    
    const success = json.data[0];
    const questIds = success.questIds || [];
    const quests = [];
    for (const id of questIds) {
        const qr = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
        const q = await qr.json();
        quests.push({ id: q.id, name: q.name.fr });
    }
    return { name: success.name.fr, quests };
}

async function run() {
    const successes = [
        "Introduction à Frigost",
        "La maire dénie",
        "Agricole",
        "L'essentiel est dans le Lac Gelé",
        "La forêt des pins perdus",
        "Frigostine",
        "Larmes d'Ouronigride",
        "Crevasses Perverses", 
        "Forêt pétrifiée",
        "Remparts du vent féroce",
        "L'hiver arrive",
        "L'âme de glace",
        "Fraîchement pondu"
    ];

    for (const name of successes) {
        console.log(`\n📦 Success [${name}] ...`);
        const data = await getSuccessQuests(name);
        if (data) {
            console.log(`  Found: ${data.name}`);
            data.quests.forEach(q => console.log(`    - ${q.name} (ID: ${q.id})`));
        } else {
            console.log(`  ❌ NOT FOUND`);
        }
    }
}

run();

const API_BASE = "https://api.dofusdb.fr";

async function searchQuest(name) {
    // Try simple direct search first, then variations
    const names = [name, name.charAt(0).toUpperCase() + name.slice(1)];
    for (const n of names) {
        const p = new URLSearchParams({ lang: "fr", "name.fr": n, "$limit": "5" });
        const res = await fetch(`${API_BASE}/quests?${p}`);
        const json = await res.json();
        if (json.data && json.data.length > 0) return json.data[0];
    }
    return null;
}

async function run() {
    const list = [
        "La Terre promise",
        "Maudite soit la Glace",
        "Semer la terreur",
        "Semer la Terreur",
        "Mise en boîte",
        "Un froid de canard",
        "Les joyeux de la couronne",
        "Petites graines",
        "La chasse aux voleurs",
        "L'eau à la bouche",
        "Un pichon de riz",
        "La vie est une fleur",
        "Au fion du trou"
    ];

    for (const name of list) {
        const q = await searchQuest(name);
        if (q) {
            console.log(`✅ FOUND: [${name}] -> ${q.name.fr} (ID: ${q.id})`);
        } else {
            console.log(`❌ NOT FOUND: [${name}]`);
        }
    }
}

run();

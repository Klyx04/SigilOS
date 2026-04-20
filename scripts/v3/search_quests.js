const API_BASE = "https://api.dofusdb.fr";

async function searchQuest(name) {
    const p = new URLSearchParams({ lang: "fr", "name.fr": name, "$limit": "5" });
    const url = `${API_BASE}/quests?${p}`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || json;
}

async function run() {
    const list = [
        "La terre promise",
        "La Terre promise",
        "Maudite soit la glace",
        "Maudite soit la Glace",
        "L'essentiel est dans le Lac Gelé",
        "Semer la terreur",
        "Semer la Terreur",
        "Mise en boîte",
        "Mise en Boîte",
        "Un froid de canard",
        "Un Froid de canard",
        "Petites graines",
        "Petites Graines",
        "La chasse aux voleurs",
        "La Chasse aux voleurs",
        "L'eau à la bouche",
        "L'Eau à la bouche",
        "Un pichon de riz",
        "Un Pichon de riz"
    ];

    for (const name of list) {
        const results = await searchQuest(name);
        console.log(`Searching [${name}] ... found ${results.length} results`);
        if (results.length > 0) {
            console.log(`  - ${results[0].name.fr} (ID: ${results[0].id})`);
        }
    }
}

run();

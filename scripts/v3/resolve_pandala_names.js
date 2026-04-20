const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const names = [
        "Le réveil de Pandala",
        "Dites-le avec des fleurs",
        "Protection divine",
        "L'équilibre des forces",
        "L'héritage de Tanukoui-San",
        "Le destin de deux dragons",
        "Main dans la main",
        "Deux souffles, une inspiration",
        "En ce jardin qui nous unit",
        "Eliocalypse : Résonance",
        "Eliocalypse : Prélude"
    ];
    
    console.log(`Resolving ${names.length} Pandala quest names...`);
    const results = [];
    for (const name of names) {
        try {
            const url = `${API_BASE}/quests?lang=fr&name.fr=${encodeURIComponent(name)}`;
            const res = await fetch(url);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                console.log(`✅ FOUND: ${name} (ID: ${data[0].id})`);
                results.push({ name, id: data[0].id });
            } else {
                console.log(`❌ NOT FOUND: ${name}`);
            }
        } catch (e) {
            console.error(`Error on ${name}: ${e.message}`);
        }
    }
    console.log(JSON.stringify(results, null, 2));
}

run();

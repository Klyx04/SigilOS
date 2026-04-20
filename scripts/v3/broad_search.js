const API_BASE = "https://api.dofusdb.fr";

async function searchQuests(namePart) {
    const p = new URLSearchParams({ lang: "fr", "name.fr[$search]": namePart, "$limit": "5" });
    const res = await fetch(`${API_BASE}/quests?${p}`);
    const json = await res.json();
    return json.data || json;
}

async function run() {
    const searchTerms = ["promise", "glace", "Agricole", "canard", "pichon", "rescapés", "trouffions", "fion"];
    
    for (const term of searchTerms) {
        console.log(`Searching for: ${term}...`);
        try {
            const results = await searchQuests(term);
            if (results && results.length > 0) {
                results.forEach(q => console.log(`  - ${q.name.fr} (ID: ${q.id})`));
            } else {
                console.log(`  ❌ No results`);
            }
        } catch (e) {
            console.error(`Error searching ${term}: ${e.message}`);
        }
    }
}

run();

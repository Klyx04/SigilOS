const axios = require('axios');
const fs = require('fs');

async function findQuestIds() {
    console.log('--- Finding DofusDB IDs for Argenté Quests ---');
    const argentQuests = [
        "L'anneau de tous les dangers",
        "Sous le regard des dieux",
        "L'oeuf ou la plume",
        "Champs de bataille",
        "Vu du ciel",
        "Coups d'épée dans l'eau",
        "Décime-moi des bouftous",
        "Chasse aux chapardams",
        "Un peu de pigment",
        "Leçon d'humilité",
        "Cryptologie",
        "La galette secrète",
        "Des chafers qui marchent"
    ];

    const results = [];
    for (const q of argentQuests) {
        try {
            // Fuzzy search on DofusDB (using our proxy if needed, or direct API for discovery)
            const response = await axios.get(`https://api.dofusdb.fr/quests?name.fr=${encodeURIComponent(q)}&lang=fr`);
            const data = response.data.data;
            if (data && data.length > 0) {
                // Find the best match
                const best = data.find(d => d.name.fr === q) || data[0];
                results.push({ name: q, id: best.id, steps: best.stepsCount });
                console.log(`- ${q}: ID ${best.id}`);
            } else {
                console.log(`x ${q}: Not found on DofusDB`);
            }
        } catch (e) {
            console.log(`Error for ${q}: ${e.message}`);
        }
    }
    
    fs.writeFileSync('A:/SigilOS/scripts/argent-ids.json', JSON.stringify(results, null, 2));
    console.log('\nSaved as scripts/argent-ids.json');
}

findQuestIds();

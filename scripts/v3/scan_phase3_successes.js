const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const successNames = ["L'ébène est une perle", "Le poids qui fait la résistance", "Un œuf pour le Crocabulia"];
    console.log(`Searching for successes: ${successNames.join(", ")}...`);
    
    for (const name of successNames) {
        try {
            const res = await fetch(`${API_BASE}/successes?lang=fr&name.fr=${encodeURIComponent(name)}`);
            const json = await res.json();
            const data = json.data || json;
            if (data && data.length > 0) {
                const s = data[0];
                console.log(`\n✅ FOUND SUCCESS: ${s.name.fr} (ID: ${s.id})`);
                console.log(` Quests: ${JSON.stringify(s.questIds)}`);
            } else {
                 // Try LIKE search
                 const res2 = await fetch(`${API_BASE}/successes?lang=fr&name.fr[$like]=${encodeURIComponent('%' + name.split(' ')[0] + '%')}`);
                 const json2 = await res2.json();
                 const data2 = json2.data || json2;
                 if (data2 && data2.length > 0) {
                      console.log(`\n✅ FOUND BY LIKE: ${data2[0].name.fr} (ID: ${data2[0].id})`);
                 }
            }
        } catch (e) {}
    }
}

run();

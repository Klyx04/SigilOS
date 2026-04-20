const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const mainIds = [
        611, 612, 613, 614, 615, 616, 617, 618, 619, 620, 621, 622, 623, 624, 631, 632, 633, 634, 635, 636, 
        656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 
        649, 650, 651, 655, 652, 653, 919, 
        1330, 1325, 1334, 1333, 1309, 1310, 
        710, 711, 1316, 1317, 1318, 1326, 1327, 
        1329
    ];
    
    console.log(`Deep crawling ${mainIds.length} quêtes for full chain...`);
    const allIds = new Set(mainIds);
    
    for (const id of mainIds) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            // DofusDB schema for prerequisites is usually in 'startCriterion' or 'conditions'
            // But Unity API has a 'prerequisiteIds' or similar sometimes? 
            // Let's check 'need' or 'required'
            if (q.prerequisiteIds) {
                q.prerequisiteIds.forEach(pid => allIds.add(pid));
            }
        } catch (e) {}
    }
    
    console.log(`Total unique quêtes found including prereqs: ${allIds.size}`);
    const results = [];
    for (const id of allIds) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            if (q.name) results.push({ id: q.id, name: q.name.fr });
        } catch (e) {}
    }
    console.log(JSON.stringify(results, null, 2));
}

run();

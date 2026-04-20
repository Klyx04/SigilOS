const API_BASE = "https://api.dofusdb.fr";

async function run() {
    const ids = [
        611, 612, 613, 614, 615, 616, 617, 618, 619, 620, 621, 622, 623, 624, 631, 632, 633, 634, 635, 636, // Fri carré
        656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, // Halte au péage
        649, 650, 651, 655, 652, 653, 919, // La maire dénie
        1330, 1325, 1334, 1333, 1309, 1310, // L'hiver arrive
        710, 711, 1316, 1317, 1318, 1326, 1327, // L'âme de glace
        1329 // Fraîchement pondu
    ];
    
    console.log(`Resolving ${ids.length} quest IDs for Ice Dofus...`);
    const results = [];
    for (const id of ids) {
        try {
            const res = await fetch(`${API_BASE}/quests/${id}?lang=fr`);
            const q = await res.json();
            if (q.name) {
                results.push({ id: q.id, name: q.name.fr });
            } else {
                console.log(`❌ ID ${id} not found`);
            }
        } catch (e) {
            console.error(`Error on ${id}: ${e.message}`);
        }
    }
    
    console.log(JSON.stringify(results, null, 2));
}

run();

import axios from "axios";

async function searchQuest(name: string) {
    try {
        const res = await axios.get(`https://api.dofusdb.fr/quests?name.fr=${encodeURIComponent(name)}`);
        if (res.data && res.data.data && res.data.data.length > 0) {
            const q = res.data.data[0];
            console.log(`Quest [${name}] -> ID: ${q.id}, Level: ${q.level}`);
            
            // Also fetch the required items
            let items: any[] = [];
            for (const stepId of q.stepIds) {
                const stepRes = await axios.get(`https://api.dofusdb.fr/quest-steps/${stepId}`);
                if (stepRes.data && stepRes.data.objectiveIds) {
                    for (const objId of stepRes.data.objectiveIds) {
                        const objRes = await axios.get(`https://api.dofusdb.fr/quest-objectives/${objId}`);
                        const obj = objRes.data;
                        if(obj.needItem) {
                            console.log(`    - Item ID: ${obj.needItem.id}`);
                        }
                    }
                }
            }
        } else {
            console.log(`Quest [${name}] NOT FOUND`);
        }
    } catch (e: any) {
         console.log(`Error searching ${name}: ${e.message}`);
    }
}

async function search() {
    await searchQuest("Main dans la main");
    await searchQuest("Deux souffles, une inspiration");
    await searchQuest("En ce jardin qui nous unit");
}

search();

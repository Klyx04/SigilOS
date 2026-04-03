import fs from "fs";

async function run() {
    for (let skip = 0; skip <= 4000; skip += 50) {
        try {
            const res = await fetch(`https://api.dofusdb.fr/achievements?lang=fr&$limit=50&$skip=${skip}`);
            const data = await res.json();
            if (!data.data || data.data.length === 0) break;
            
            const found = data.data.filter((a: any) => a.name?.fr?.toLowerCase().includes("flovoraison") || a.description?.fr?.toLowerCase().includes("flovoraison"));
            if (found.length > 0) {
                 console.log(JSON.stringify(found, null, 2));
                 break; // Got it!
            }
        } catch (e) {
            console.error("Error at skip", skip);
            break;
        }
    }
}
run();

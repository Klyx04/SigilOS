import axios from "axios";

async function query() {
    for (const id of [2199, 2200, 2201, 2202]) {
        try {
            const res = await axios.get(`https://api.dofusdb.fr/quests/${id}`);
            console.log(`ID ${id} -> ${res.data.name.fr}`);
        } catch(e: any) {
            console.log(`ID ${id} -> Not found (${e.message})`);
        }
    }
}
query();

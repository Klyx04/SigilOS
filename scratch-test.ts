import { getMonsterStats } from "./src/server/actions/game-data-actions";
async function run() {
    try {
        const res = await getMonsterStats("Protozorreur");
        console.log("Response success:", res.success);
        if (!res.success) console.log("Error:", res.error);
        else console.log("Grades:", res.data?.grades?.length);
    } catch (e) {
        console.error("Exception:", e);
    }
}
run();

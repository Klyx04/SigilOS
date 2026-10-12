/**
 * Siphon **souverain** des sous-zones ↔ monstres (carte du monde).
 *
 * 🎯 Demande user (12/10/2026) : « il faut proposer précisément par sous-zone les bonnes
 * familles de monstres … il y a des tas de sous-zones où il manque des familles, ou alors
 * les familles sont des faux positifs dû au nom ressemblant ». Puis : « tout doit être
 * souverain : les sites DofusDB/Dofensive servent juste de siphon ».
 *
 * Cause racine mesurée : `Monster` (Prisma) n'a **pas** de zone et `unity-bestiary.json`
 * (dump du client) n'a **pas** de champ `subareas` ⇒ aucune donnée locale ne reliait un
 * monstre à une sous-zone. Le seul référentiel **réel** est DofusDB : `monsters[].subareas`
 * (mesuré : sous-zone 471 « Touribère nauséabonde » → 11 monstres exacts).
 *
 * Ce script n'est donc PAS exécuté au rendu (fichier versionné, comme
 * `dungeon-monsters.json` / `unity-bestiary.json`) : il inverse `subareas` sur les 5 129
 * monstres et produit `public/game-data/subarea-monsters.json` — **minimal** (id de monstre
 * uniquement) : les noms, races et sprites sont déjà souverains dans
 * `unity-bestiary.json` + `monster-races.json` (aucun doublon, règle de la maison §4.3).
 *
 * Usage :
 *     node scripts/siphon-subarea-monsters.mjs
 *
 * Convention de pagination : identique à `scripts/siphon-dungeon-monsters.mjs`
 * (`$limit` / `$skip` — `$select` casse la pagination côté DofusDB, mesuré).
 */
import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(process.cwd(), "public", "game-data", "subarea-monsters.json");
const API = "https://api.dofusdb.fr/monsters";
const LIMIT = 50;

async function fetchAllMonsters() {
    const items = [];
    let skip = 0;
    for (;;) {
        const url = `${API}?$limit=${LIMIT}&$skip=${skip}&lang=fr`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`⚠️  Fetch KO (${res.status}) sur ${url}`);
            break;
        }
        const payload = await res.json();
        const batch = Array.isArray(payload?.data) ? payload.data : [];
        if (batch.length === 0) break;
        items.push(...batch);
        if (items.length >= Number(payload?.total || 0)) break;
        skip += LIMIT;
        // Politesse : un appel toutes les 60 ms.
        await new Promise((resolve) => setTimeout(resolve, 60));
    }
    return items;
}

async function main() {
    console.log("🛰️  Siphon des sous-zones ↔ monstres (DofusDB, champ `subareas`)…");

    const monsters = await fetchAllMonsters();
    console.log(`✅ ${monsters.length} monstres récupérés.`);

    /** @type {Record<string, number[]>} */
    const subareas = {};
    for (const monster of monsters) {
        const id = Math.floor(Number(monster?.id) || 0);
        if (id <= 0) continue;
        const list = Array.isArray(monster?.subareas) ? monster.subareas : [];
        for (const raw of list) {
            const subAreaId = Math.floor(Number(raw) || 0);
            if (subAreaId <= 0) continue;
            const bucket = subareas[String(subAreaId)];
            if (bucket) bucket.push(id);
            else subareas[String(subAreaId)] = [id];
        }
    }

    for (const key of Object.keys(subareas)) {
        subareas[key] = [...new Set(subareas[key])].sort((a, b) => a - b);
    }

    const output = {
        updatedAt: new Date().toISOString(),
        source: "https://api.dofusdb.fr/monsters ($limit=50, champ subareas)",
        totalMonsters: monsters.length,
        totalSubareas: Object.keys(subareas).length,
        subareas,
    };

    // Compact (pas d'indentation) : ~100 Ko pour 500+ sous-zones — le fichier est lu
    // côté serveur, jamais servi au navigateur.
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), "utf-8");

    console.log(`\n🎉 Écrit dans : ${OUTPUT_PATH}`);
    console.log(`📊 ${Object.keys(subareas).length} sous-zone(s) couvertes · ${monsters.length} monstre(s).`);
}

main().catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});

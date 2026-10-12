import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(process.cwd(), "public", "game-data", "dungeon-monsters.json");

function norm(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function fetchPaged(baseUrl, limit = 50) {
  const items = [];
  let skip = 0;
  while (true) {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}$limit=${limit}&$skip=${skip}&lang=fr`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Fetch failed for ${url}: status ${res.status}`);
      break;
    }
    const data = await res.json();
    const batch = data.data || [];
    if (!batch.length) break;
    items.push(...batch);
    if (items.length >= data.total) break;
    skip += limit;
  }
  return items;
}

async function main() {
  console.log("🚀 Siphonnage complet des Donjons, Monstres et Familles...");

  // 1. Récupération de tous les Donjons DofusDB
  console.log("📥 Récupération des donjons DofusDB...");
  const dungeons = await fetchPaged("https://api.dofusdb.fr/dungeons");
  console.log(`✅ ${dungeons.length} donjons récupérés.`);

  // 2. Récupération de toutes les Races / Familles DofusDB
  console.log("📥 Récupération des familles (races) DofusDB...");
  const races = await fetchPaged("https://api.dofusdb.fr/monster-races");
  console.log(`✅ ${races.length} races récupérées.`);

  const raceMap = new Map();
  races.forEach(r => {
    raceMap.set(r.id, {
      id: r.id,
      name: r.name?.fr || "Famille inconnue",
      monsterIds: r.monsters || []
    });
  });

  // 3. Identifier tous les IDs de monstres nécessaires (donjons + familles de boss)
  const allNeededMobIds = new Set();
  const bossRaceIds = new Set();

  dungeons.forEach(d => {
    (d.monsters || []).forEach(id => allNeededMobIds.add(id));
    (d.bosses || []).forEach(bId => {
      allNeededMobIds.add(bId);
      for (const r of races) {
        if ((r.monsters || []).includes(bId) && r.id > 0) {
          bossRaceIds.add(r.id);
        }
      }
    });
  });

  bossRaceIds.forEach(rId => {
    const r = raceMap.get(rId);
    if (r) {
      r.monsterIds.forEach(id => allNeededMobIds.add(id));
    }
  });

  console.log(`🎯 ${allNeededMobIds.size} monstres uniques à siphonner (${bossRaceIds.size} familles de boss).`);

  // 4. Télécharger par batch de 50 tous les monstres nécessaires
  console.log("📥 Récupération des informations monstres...");
  const mobMap = new Map();
  const mobIdArray = Array.from(allNeededMobIds);
  const CHUNK_SIZE = 40;

  for (let i = 0; i < mobIdArray.length; i += CHUNK_SIZE) {
    const chunk = mobIdArray.slice(i, i + CHUNK_SIZE);
    const query = chunk.map(id => `id[$in][]=${id}`).join("&");
    const url = `https://api.dofusdb.fr/monsters?${query}&$limit=50&lang=fr`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        (data.data || []).forEach(m => {
          const r = raceMap.get(m.race);
          const grades = m.grades || [];
          const topGrade = grades[grades.length - 1] || grades[0] || {};
          mobMap.set(m.id, {
            id: m.id,
            name: m.name?.fr || "Monstre",
            imageUrl: m.img || `https://static.ankama.com/dofus/www/game/monsters/${m.id}.png`,
            isBoss: !!m.isBoss,
            raceId: m.race ?? null,
            raceName: r ? r.name : (m.subtype?.name?.fr || "Monstre"),
            level: topGrade.level || 0,
            gradesCount: grades.length
          });
        });
      }
    } catch (e) {
      console.warn(`Erreur chunk ${i}: ${e.message}`);
    }
    if ((i + CHUNK_SIZE) % 200 === 0 || i + CHUNK_SIZE >= mobIdArray.length) {
      console.log(`  Progression : ${Math.min(i + CHUNK_SIZE, mobIdArray.length)} / ${mobIdArray.length} monstres`);
    }
  }

  console.log(`✅ ${mobMap.size} monstres archivés.`);

  // 5. Construire la structure unifiée des Donjons
  const compiledDungeons = dungeons.map(d => {
    const dungeonName = d.name?.fr || "Donjon inconnu";
    const dMonsters = (d.monsters || [])
      .map(id => mobMap.get(id))
      .filter(Boolean);

    const dBosses = (d.bosses || [])
      .map(id => mobMap.get(id))
      .filter(Boolean);

    // Trouver la race principale du boss
    let primaryRace = null;
    for (const b of dBosses) {
      if (b.raceId && raceMap.has(b.raceId)) {
        primaryRace = raceMap.get(b.raceId);
        break;
      }
    }

    const familyMonsters = primaryRace
      ? primaryRace.monsterIds.map(id => mobMap.get(id)).filter(Boolean)
      : [];

    return {
      id: d.id,
      name: dungeonName,
      cleanName: norm(dungeonName),
      bosses: dBosses,
      monsters: dMonsters,
      raceId: primaryRace ? primaryRace.id : null,
      raceName: primaryRace ? primaryRace.name : null,
      familyMonsters
    };
  });

  // 6. Construire la liste de tous les monstres des familles de boss (pour l'onglet Monstres)
  const allMonstersList = Array.from(mobMap.values()).sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.name.localeCompare(b.name, "fr");
  });

  // 7. Sauvegarde du fichier JSON local
  const outputData = {
    updatedAt: new Date().toISOString(),
    totalDungeons: compiledDungeons.length,
    totalMonsters: allMonstersList.length,
    dungeons: compiledDungeons,
    monsters: allMonstersList
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`\n🎉 Fichier généré avec succès dans : ${OUTPUT_PATH}`);
  console.log(`📊 Statistiques : ${compiledDungeons.length} donjons, ${allMonstersList.length} monstres au total.`);
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

const fetch = require('node-fetch');
async function run() {
  const questNames = [
    "Le livre des Taures",
    "Taures et détours",
    "Le trésor de Totankama",
    "Il faut battre le lait quand il est chaud",
    "Regrets d'éternailes",
    "L'anneau de Tot",
    "Une âme en peine",
    "Le pouvoir derrière le trône"
  ];
  const results = {};
  for (const n of questNames) {
    const encoded = encodeURIComponent(n).replace(/'/g, "%27");
    const q = await fetch(`https://api.dofusdb.fr/quests?lang=fr&name.fr=${encoded}`).then(r=>r.json());
    if (q.data?.[0]) results[n] = q.data[0].id;
    else results[n] = "MISSING";
  }
  console.log("QUESTS:", JSON.stringify(results, null, 2));

  const dungeons = [
    "Bibliothèque du Maître Corbac",
    "Labyrinthe du Minotoror",
    "Serre du Royalmouth",
    "Ring du Capitaine Ekarlatte",
    "Antre du Blop Multicolore Royal"
  ];
  const dungResults = {};
  for (const d of dungeons) {
    const encoded = encodeURIComponent(d).replace(/'/g, "%27");
    const resp = await fetch(`https://api.dofusdb.fr/dungeons?lang=fr&name.fr=${encoded}`).then(r=>r.json());
    if (resp.data?.[0]) {
      dungResults[d] = { id: resp.data[0].id, bossId: resp.data[0].monsterId };
    }
  }
  console.log("DUNGEONS:", JSON.stringify(dungResults, null, 2));

  const items = ["Tige de Bambouto", "Tête de mort", "Rose des sables"];
  const itemResults = {};
  for (const it of items) {
    const encoded = encodeURIComponent(it).replace(/'/g, "%27");
    const resp = await fetch(`https://api.dofusdb.fr/items?lang=fr&name.fr=${encoded}`).then(r=>r.json());
    if (resp.data?.[0]) itemResults[it] = resp.data[0].id;
  }
  console.log("ITEMS:", JSON.stringify(itemResults, null, 2));
}
run();

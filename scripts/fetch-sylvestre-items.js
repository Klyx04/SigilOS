const fetch = require('node-fetch');
const fs = require('fs');

const resourceNames = [
  // Cereals (Paysan)
  "Blé", "Orge", "Avoine", "Houblon", "Lin", "Seigle", "Riz", "Malt", "Chanvre", "Maïs", "Millet", "Froment", "Maïs Doré",
  // Plants (Alchimiste)
  "Ortie", "Sauge", "Trèfle à 5 feuilles", "Menthe Sauvage", "Orchidée Freyesque", "Edelweiss", "Pandouille", "Ginseng", "Belladone", "Mandragore", "Perce-neige", "Salicorne",
  // Ores (Mineur)
  "Fer", "Cuivre", "Bronze", "Kobalte", "Manganèse", "Étain", "Argent", "Bauxite", "Or", "Dolomite", "Obsidienne", "Écume de mer",
  // Woods (Bûcheron)
  "Frêne", "Châtaignier", "Noyer", "Chêne", "Bombu", "Érable", "Oliviolet", "If", "Bambou", "Merisier", "Noisetier", "Ébène", "Charme", "Bambou Sombre", "Orme", "Bambou Sacré", "Tremble", "Aquajou",
  // Fish (Pêcheur)
  "Goujon", "Truite", "Poisson-chat", "Brochet", "Crabe", "Carpe d'Ié", "Sardine Brillante", "Greu-vette", "Perche", "Raie Bleue", "Lotte", "Requin Marteau Faucille", "Bar Rikain", "Morue", "Tanche", "Espadon", "Poisskaille"
];

async function run() {
  console.log("Searching for resources...");
  const results = [];
  for (const name of resourceNames) {
    const encoded = encodeURIComponent(name).replace(/'/g, "%27");
    const url = `https://api.dofusdb.fr/items?lang=fr&name.fr=${encoded}`;
    const resp = await fetch(url).then(r => r.json());
    if (resp.data && resp.data.length > 0) {
      // Filter to get the basic resource (typeId 33 or similar, or level consistent)
      // Usually the first one is the best match
      const item = resp.data[0];
      results.push({ id: item.id, name: item.name.fr, amount: 100 });
      console.log(`✅ Found: ${item.name.fr} (${item.id})`);
    } else {
      console.log(`❌ Not found: ${name}`);
    }
  }
  fs.writeFileSync('sylvestre-items.json', JSON.stringify(results, null, 2));
  console.log("Done. Saved to sylvestre-items.json");
}

run();

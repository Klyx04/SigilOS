const fetch = require('node-fetch');
async function run() {
  const quests = [
    "Le dragon blanc", "Examen de passage", "Le pays gris", "Casse en Enutrosor", 
    "Nordalie", "Le bonheur est dans le spray", "Une voix de crystal", 
    "Le mort dans l'âme", "Le guerrier noir", "Il est temps de mourir"
  ];
  console.log("=== QUESTS ===");
  for (const q of quests) {
    const res = await fetch(`https://api.dofusdb.fr/quests?$skip=0&$limit=10&name.fr=${encodeURIComponent(q)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Quest:', res.data[0].name.fr, 'ID:', res.data[0].id);
    }
  }

  const items = [
    "Graisse Gélatineuse", "Frostiz", "Obsidienne", "Perce-Neige", "Blague de Soufre", 
    "Moustache de Rilur", "Pic du Nocturlabe", "Peau de Crocabulia", "Corde du Fancrôme"
  ];
  console.log("=== ITEMS ===");
  for (const item of items) {
    const res = await fetch(`https://api.dofusdb.fr/items?$skip=0&$limit=10&name.fr=${encodeURIComponent(item)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Item:', item, 'ID:', res.data[0].id);
    }
  }

  const dungeons = [
    "Défis d'Ecaflip", "Ventre de la Baleine", "Palais du roi Nidas", 
    "Chambre de Tal Kasha", "Laboratoire de Nileza", "Vaisseau du Capitaine Meno", 
    "Manoir des Katrepat", "Transporteur de Sylargh"
  ];
  console.log("=== DUNGEONS ===");
  for (const dj of dungeons) {
    const res = await fetch(`https://api.dofusdb.fr/dungeons?$skip=0&$limit=10&name.fr=${encodeURIComponent(dj)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('DJ:', res.data[0].name.fr, 'ID:', res.data[0].id);
    } else {
        const res2 = await fetch(`https://api.dofusdb.fr/dungeons?$skip=0&$limit=10&name.fr[$like]=%25${encodeURIComponent(dj)}%25&lang=fr`).then(r=>r.json());
        if (res2.data && res2.data.length > 0) {
          console.log('DJ (like):', res2.data[0].name.fr, 'ID:', res2.data[0].id);
        }
    }
  }
}
run();

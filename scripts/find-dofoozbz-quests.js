const fetch = require('node-fetch');
async function run() {
  const quests = [
    "Ça barde là-haut",
    "Un problème de taille",
    "Le vol des bourdons",
    "Des petites bêtes qui font bzzzbz",
    "Têtes de ponte",
    "Dérive insectaire",
    "La proie des vérités",
    "Quand on la cherche, on finit par tomber dessus",
    "Devoir de réserve",
    "Trois cœurs, un roi",
    "Un hôte de marque",
    "L'union sacrée",
    "Destructeur de mondes"
  ];
  for (const q of quests) {
    const res = await fetch(`https://api.dofusdb.fr/quests?name.fr=${encodeURIComponent(q)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Quest:', q, 'ID:', res.data[0].id);
    } else {
      const res2 = await fetch(`https://api.dofusdb.fr/quests?name.fr[$like]=%25${encodeURIComponent(q)}%25&lang=fr`).then(r=>r.json());
      if (res2.data && res2.data.length > 0) {
        console.log('Quest (like):', q, 'ID:', res2.data[0].id);
      } else {
        console.log('NOT FOUND:', q);
      }
    }
  }
}
run();

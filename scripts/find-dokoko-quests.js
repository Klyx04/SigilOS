const fetch = require('node-fetch');
async function run() {
  const quests = [
    "Un autre moyen de transport",
    "Partir un jour sans retour",
    "Un parfum de vacances",
    "Un indigeste chez les indigènes",
    "Squelettes et amulette",
    "Squelettes et amulettes",
    "Rendez-vous avec la lune"
  ];
  for (const q of quests) {
    const res = await fetch(`https://api.dofusdb.fr/quests?name.fr=${encodeURIComponent(q)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Quest:', q, 'ID:', res.data[0].id);
    } else {
      console.log('NOT FOUND:', q);
    }
  }
}
run();

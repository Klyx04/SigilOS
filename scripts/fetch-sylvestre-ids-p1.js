const fetch = require('node-fetch');
const names = [
  "C'est tout Simple",
  "Arak-haï en pagaille",
  "Munster lève le mystère",
  "L'art de la langue de bois",
  "Les derniers d'entre nous",
  "Cultures et turpitudes",
  "Qui nous protège du Protecteur ?"
];

async function run() {
  for (const n of names) {
    const encoded = encodeURIComponent(n).replace(/'/g, "%27");
    const q = await fetch('https://api.dofusdb.fr/quests?lang=fr&name.fr=' + encoded).then(r=>r.json());
    if (q.data?.[0]) console.log(`${n} : ${q.data[0].id}`);
    else console.log(`MISSING: ${n}`);
  }
}
run();

const fetch = require('node-fetch');
const itemNames = [
  'Essence de Moon',
  'Essence du Dragon Cochon',
  'Essence du Chêne Mou',
  'Essence du Sphincter Cell',
  'Essence de Kanigroula',
  'Essence du Phossile',
  'Essence du Korriandre',
  'Essence du Kimbo',
  "Essence de l'Obsidiantre",
  'Essence du Mansot Royal',
  'Essence du Tynril',
  'Essence de Fraktale',
  'Essence du Mantiscore'
];

async function run() {
  const res = [];
  for (const n of itemNames) {
    const encoded = encodeURIComponent(n).replace(/'/g, "%27");
    const i = await fetch(`https://api.dofusdb.fr/items?lang=fr&name.fr=${encoded}`).then(r=>r.json());
    if (i.data?.[0]) {
      res.push({ id: i.data[0].id, name: i.data[0].name.fr, amount: 1 });
    } else {
      console.log('NOT FOUND:', n);
    }
  }
  require('fs').writeFileSync('essences.json', JSON.stringify(res, null, 2));
}
run();

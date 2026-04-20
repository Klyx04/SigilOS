const fetch = require('node-fetch');
async function run() {
  const bosses = ['Orukam', 'Imagiro'];
  for (const b of bosses) {
    const res = await fetch(`https://api.dofusdb.fr/monsters?$skip=0&$limit=10&name.fr=${encodeURIComponent(b)}&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Boss:', res.data[0].name.fr, 'ID:', res.data[0].id);
    }
  }
}
run();

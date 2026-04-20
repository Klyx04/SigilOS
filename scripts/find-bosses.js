const fetch = require('node-fetch');
async function run() {
  for (const monster of ['Orukam', 'Imagiro']) {
    const res = await fetch(`https://api.dofusdb.fr/monsters?$skip=0&$limit=10&name.fr[$like]=%25${monster}%25&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('Monster:', res.data[0].name.fr, 'ID:', res.data[0].id);
    }
  }
}
run();

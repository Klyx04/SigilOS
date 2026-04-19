const fetch = require('node-fetch');
async function run() {
  for (const dj of ['Orukam', 'Imagiro']) {
    const res = await fetch(`https://api.dofusdb.fr/dungeons?$skip=0&$limit=10&name.fr[$like]=%25${dj}%25&lang=fr`).then(r=>r.json());
    if (res.data && res.data.length > 0) {
      console.log('DJ:', res.data[0].name.fr, 'ID:', res.data[0].id, 'BossIDs:', res.data[0].bossIds);
    }
  }
}
run();

const fetch = require('node-fetch');
async function run() {
  for (let id = 60; id <= 120; id++) {
    try {
        const res = await fetch(`https://api.dofusdb.fr/dungeons/${id}?lang=fr`).then(r=>r.json());
        if (res && res.name?.fr && res.name.fr.includes('Chal')) {
            console.log('FOUND:', res.name.fr, id);
        }
    } catch(e) {}
  }
}
run();

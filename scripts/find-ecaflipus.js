const fetch = require('node-fetch');
async function run() {
  const res = await fetch('https://api.dofusdb.fr/dungeons?name.fr[$like]=%25Chal%25&lang=fr').then(r=>r.json());
  if (res.data) console.log('DJ (Chal):', res.data.map(d=>[d.name.fr, d.id]));
  const res2 = await fetch('https://api.dofusdb.fr/dungeons?name.fr[$like]=%25Ecaflip%25&lang=fr').then(r=>r.json());
  if (res2.data) console.log('DJ (Ecaflip):', res2.data.map(d=>[d.name.fr, d.id]));
}
run();

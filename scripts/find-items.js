const fetch = require('node-fetch');
async function run() {
  const items = ['Riz', 'Bois de Bambou Sacré', 'Pwimen', 'Artefact Pandawushu Bois', 'Artefact Pandawushu Feu', 'Artefact Pandawushu Eau', 'Artefact Pandawushu Vent', 'Artefact Pandawushu Roc', 'Bière Tsingtawo', 'Pizwa', "Limo d'Grobe", 'Pandneken', 'Pandazahi', 'Épices', 'Pétale de Papier', "Pétale d'encre", 'Umeshushu', 'Gnôle de Grobe', 'Bière forte légère'];
  for (const item of items) {
    try {
      // DofusDB REST API has an issue with $search sometimes, let's use name.fr
      const res = await fetch(`https://api.dofusdb.fr/items?$skip=0&$limit=10&name.fr=${encodeURIComponent(item)}&lang=fr`).then(r=>r.json());
      if (res.data && res.data.length > 0) {
        console.log('Item:', item, 'ID:', res.data[0].id);
      } else {
        const res2 = await fetch(`https://api.dofusdb.fr/items?$skip=0&$limit=10&name.fr[$like]=%25${encodeURIComponent(item)}%25&lang=fr`).then(r=>r.json());
        if (res2.data && res2.data.length > 0) {
          console.log('Item (like):', item, 'ID:', res2.data[0].id);
        } else {
           console.log('Not found:', item);
        }
      }
    } catch(e) {
      console.log('Error:', e);
    }
  }
}
run();

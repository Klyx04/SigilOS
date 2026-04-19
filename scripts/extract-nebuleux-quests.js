const fetch = require('node-fetch');
const fs = require('fs');

const SUCCESS_IDS = {
  VEILLEURS: 1187,
  ENUTROSOR: 1077,
  SRAMBAD: 1107,
  XELORIUM: 1147,
  NEBULEUX: 1188
};

async function getQuestsFromSuccess(id) {
  const url = `https://api.dofusdb.fr/achievements/${id}?lang=fr`;
  const resp = await fetch(url).then(r => r.json());
  const quests = [];
  
  if (resp.objectiveQuests) {
    for (const qId of resp.objectiveQuests) {
      const q = await fetch(`https://api.dofusdb.fr/quests/${qId}?lang=fr`).then(r => r.json());
      quests.push({ id: q.id, name: q.name.fr });
    }
  }
  
  // Also check sub-achievements (children)
  if (resp.childrenIds) {
    for (const subId of resp.childrenIds) {
      const subQuests = await getQuestsFromSuccess(subId);
      quests.push(...subQuests);
    }
  }
  
  return quests;
}

async function run() {
  const allData = {};
  for (const [key, id] of Object.entries(SUCCESS_IDS)) {
    console.log(`Extracting quests for ${key} (Success ${id})...`);
    const quests = await getQuestsFromSuccess(id);
    // Remove duplicates
    const uniqueQuests = Array.from(new Map(quests.map(item => [item.id, item])).values());
    allData[key] = uniqueQuests;
  }
  
  fs.writeFileSync('nebuleux-extracted-data.json', JSON.stringify(allData, null, 2));
  console.log("Done. Saved to nebuleux-extracted-data.json");
}

run();


import fs from "fs";
import path from "path";

/**
 * Script pour générer des mots Dofus pour Skribbl
 * Focus: Monstres, Dofus, Ressources, Items (stuff de panoplie)
 * Exclut: Panoplies complètes, Archimonstres, Donjons, Quêtes, Succès
 * Inclut: URLs d'icônes pour les indices visuels
 */

async function fetchFromDofusDB(endpoint: string, maxEntries: number = 2000) {
  let allData: any[] = [];
  const limit = 50;
  
  console.log(`📡 Récupération de ${endpoint} (jusqu'à ${maxEntries})...`);

  for (let skip = 0; skip < maxEntries; skip += limit) {
    const url = `https://api.dofusdb.fr/${endpoint}?lang=fr&$limit=${limit}&$skip=${skip}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const json = await res.json() as { data: any[] };
      const batchSize = json.data?.length || 0;
      if (!json.data || batchSize === 0) break;
      allData = [...allData, ...json.data];
      
      if (skip % 1000 === 0 && skip > 0) {
        console.log(`  > ${skip} éléments récupérés...`);
      }
      
      if (batchSize < limit) break;
    } catch (error) {
      break;
    }
  }
  return allData;
}

function classifyWord(name: string, level: number = 1): "facile" | "moyen" | "difficile" {
  const length = name.length;
  // Facile: Niveaux < 60, noms courts (< 12)
  if (level < 60 && length < 12) return "facile";
  // Moyen: Niveaux < 180, noms moyens (< 20)
  if (level < 180 && length < 20) return "moyen";
  // Difficile: Le reste
  return "difficile";
}

async function generateWords() {
  console.log("🚀 Lancement de la génération massive (DofusDB Explorer)...");
  
  // Les monstres sont moins nombreux que les items (environ 3000-4000 réels)
  const monsters = await fetchFromDofusDB("monsters", 5000);
  // Les items sont extrêmement nombreux (plus de 25000)
  const items = await fetchFromDofusDB("items", 25000);

  const words = {
    facile: new Map<string, any>(),
    moyen: new Map<string, any>(),
    difficile: new Map<string, any>()
  };

  // 1. Monstres
  monsters.forEach(m => {
    const name = m.name?.fr;
    // On ignore les noms trop courts (<2), trop longs (>25) ou techniques
    if (!name || name.includes("Archimonstre") || name.length < 2 || name.length > 25) return;
    const lowerName = name.toLowerCase();
    
    // Filtres d'exclusion
    if (lowerName.includes("donjon") || lowerName.includes("quête") || lowerName.includes("succès") || lowerName.includes("pnj") || lowerName.includes("test")) return;
    if (name.startsWith("Panoplie")) return;

    const iconUrl = m.img || (m.ankamaId ? `https://api.dofusdb.fr/img/monsters/${m.ankamaId}.png` : null);
    if (!iconUrl || iconUrl.includes("undefined")) return;

    const difficulty = classifyWord(name, m.level);
    words[difficulty].set(name, { word: name, iconUrl });
  });

  // 2. Items & Dofus & Ressources
  items.forEach(i => {
    const name = i.name?.fr;
    if (!name || name.length < 3 || name.length > 25) return;
    
    // Filtrage thématique strict
    const lowerName = name.toLowerCase();
    if (name.startsWith("(") || name.includes("Test") || lowerName.includes("quête") || lowerName.includes("succès") || lowerName.includes("pnj") || lowerName.includes("[")) return;
    if (name.startsWith("Panoplie")) return;

    const iconUrl = i.img || (i.ankamaId ? `https://api.dofusdb.fr/img/items/${i.ankamaId}.png` : null);
    if (!iconUrl || iconUrl.includes("/0.png") || iconUrl.includes("undefined")) return;

    // Priorité Dofus (toujours en difficile ou moyen si petit)
    if (lowerName.includes("dofus")) {
        words.difficile.set(name, { word: name, iconUrl });
        return;
    }

    const difficulty = classifyWord(name, i.level);
    words[difficulty].set(name, { word: name, iconUrl });
  });

  // Export & Stats
  const result = {
    facile: Array.from(words.facile.values()).sort((a, b) => a.word.localeCompare(b.word)),
    moyen: Array.from(words.moyen.values()).sort((a, b) => a.word.localeCompare(b.word)),
    difficile: Array.from(words.difficile.values()).sort((a, b) => a.word.localeCompare(b.word))
  };

  const total = result.facile.length + result.moyen.length + result.difficile.length;
  console.log(`✅ Génération GÉANTE terminée !`);
  console.log(`📊 Statistiques finales :`);
  console.log(`  - Facile    : ${result.facile.length}`);
  console.log(`  - Moyen     : ${result.moyen.length}`);
  console.log(`  - Difficile : ${result.difficile.length}`);
  console.log(`  - TOTAL     : ${total} mots avec icônes.`);

  const outputPath = path.resolve(process.cwd(), "src/server/games/SigilSkribbl/generated-words.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

generateWords().catch(console.error);

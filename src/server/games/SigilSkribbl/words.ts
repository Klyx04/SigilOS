
import generatedWords from "./generated-words.json";

export interface SkribblWord {
    word: string;
    iconUrl?: string;
    category?: string;
}

export const SEED_WORDS: Record<string, SkribblWord[]> = {
  facile: [
    { word: "Iop", iconUrl: "https://api.dofusdb.fr/img/items/4349.png", category: "Classe" },
    { word: "Cra", iconUrl: "https://api.dofusdb.fr/img/items/4352.png", category: "Classe" }, 
    { word: "Eniripsa", iconUrl: "https://api.dofusdb.fr/img/items/4354.png", category: "Classe" },
    { word: "Xelor", iconUrl: "https://api.dofusdb.fr/img/items/4355.png", category: "Classe" },
    { word: "Osamodas", iconUrl: "https://api.dofusdb.fr/img/items/4350.png", category: "Classe" },
    { word: "Sacrieur", iconUrl: "https://api.dofusdb.fr/img/items/4359.png", category: "Classe" },
    { word: "Sadida", iconUrl: "https://api.dofusdb.fr/img/items/4358.png", category: "Classe" },
    { word: "Enutrof", iconUrl: "https://api.dofusdb.fr/img/items/4353.png", category: "Classe" },
    { word: "Feca", iconUrl: "https://api.dofusdb.fr/img/items/4348.png", category: "Classe" },
    { word: "Ecaflip", iconUrl: "https://api.dofusdb.fr/img/items/4351.png", category: "Classe" },
    { word: "Sram", iconUrl: "https://api.dofusdb.fr/img/items/4356.png", category: "Classe" },
    { word: "Pandawa", iconUrl: "https://api.dofusdb.fr/img/items/4357.png", category: "Classe" },
    { word: "Roublard", iconUrl: "https://api.dofusdb.fr/img/items/8645.png", category: "Classe" },
    { word: "Zobal", iconUrl: "https://api.dofusdb.fr/img/items/11211.png", category: "Classe" },
    { word: "Steamer", iconUrl: "https://api.dofusdb.fr/img/items/14144.png", category: "Classe" },
    { word: "Eliotrope", iconUrl: "https://api.dofusdb.fr/img/items/17462.png", category: "Classe" },
    { word: "Huppermage", iconUrl: "https://api.dofusdb.fr/img/items/18239.png", category: "Classe" },
    { word: "Ouginak", iconUrl: "https://api.dofusdb.fr/img/items/19131.png", category: "Classe" },
    { word: "Tofu", iconUrl: "https://api.dofusdb.fr/img/monsters/8.png", category: "Monstre" },
    { word: "Bouftou", iconUrl: "https://api.dofusdb.fr/img/monsters/34.png", category: "Monstre" },
    { word: "Kamas", iconUrl: "https://api.dofusdb.fr/img/items/1484.png", category: "Monnaie" },
    { word: "Pain", iconUrl: "https://api.dofusdb.fr/img/items/1973.png", category: "Consommable" },
    { word: "Blé", iconUrl: "https://api.dofusdb.fr/img/items/289.png", category: "Ressource" },
    { word: "Fer", iconUrl: "https://api.dofusdb.fr/img/items/312.png", category: "Ressource" },
    { word: "Potion", iconUrl: "https://api.dofusdb.fr/img/items/518.png", category: "Consommable" },
    { word: "Zaap", iconUrl: "https://api.dofusdb.fr/img/items/17336.png", category: "Départ" },
    { word: "Chacha", iconUrl: "https://api.dofusdb.fr/img/monsters/3.png", category: "Monstre" }
  ].map(w => ({ ...w, word: w.word.trim() })),

  moyen: [
    { word: "Kimbo", iconUrl: "https://api.dofusdb.fr/img/monsters/1018.png" },
    { word: "Tynril", iconUrl: "https://api.dofusdb.fr/img/monsters/952.png" },
    { word: "Crocabulia", iconUrl: "https://api.dofusdb.fr/img/monsters/466.png" },
    { word: "Meulou", iconUrl: "https://api.dofusdb.fr/img/monsters/357.png" },
    { word: "Abraknyde", iconUrl: "https://api.dofusdb.fr/img/monsters/13.png" },
    { word: "Craqueleur", iconUrl: "https://api.dofusdb.fr/img/monsters/28.png" },
    { word: "Vampire", iconUrl: "https://api.dofusdb.fr/img/monsters/148.png" },
    { word: "Muldo", iconUrl: "https://api.dofusdb.fr/img/items/17234.png" },
    { word: "Dofus Cawotte", iconUrl: "https://api.dofusdb.fr/img/items/11020.png" },
    { word: "Dofus Émeraude", iconUrl: "https://api.dofusdb.fr/img/items/4049.png" },
    { word: "Dofus Pourpre", iconUrl: "https://api.dofusdb.fr/img/items/4050.png" },
    { word: "Dofus Kaliptus", iconUrl: "https://api.dofusdb.fr/img/items/7041.png" },
    { word: "Cape", iconUrl: "https://api.dofusdb.fr/img/items/16538.png" },
    { word: "Coiffe", iconUrl: "https://api.dofusdb.fr/img/items/16541.png" },
    { word: "Épée", iconUrl: "https://api.dofusdb.fr/img/items/16543.png" }
  ].map(w => ({ ...w, word: w.word.trim() })),

  difficile: [
    { word: "Comte Harebourg", iconUrl: "https://api.dofusdb.fr/img/monsters/2874.png" },
    { word: "Glourséleste", iconUrl: "https://api.dofusdb.fr/img/monsters/2733.png" },
    { word: "Korriandre", iconUrl: "https://api.dofusdb.fr/img/monsters/2730.png" },
    { word: "Missiz Frizz", iconUrl: "https://api.dofusdb.fr/img/monsters/2916.png" },
    { word: "Nileza", iconUrl: "https://api.dofusdb.fr/img/monsters/2915.png" },
    { word: "Merkator", iconUrl: "https://api.dofusdb.fr/img/monsters/3268.png" },
    { word: "Bworker", iconUrl: "https://api.dofusdb.fr/img/monsters/478.png" },
    { word: "Dofus Ocre", iconUrl: "https://api.dofusdb.fr/img/items/7114.png" },
    { word: "Dofus Vulbis", iconUrl: "https://api.dofusdb.fr/img/items/7349.png" },
    { word: "Dofus Turquoise", iconUrl: "https://api.dofusdb.fr/img/items/4048.png" },
    { word: "Dofus des Glaces", iconUrl: "https://api.dofusdb.fr/img/items/11756.png" },
    { word: "Dofus Ebène", iconUrl: "https://api.dofusdb.fr/img/items/20111.png" },
    { word: "Dofus Ivoire", iconUrl: "https://api.dofusdb.fr/img/items/20112.png" },
    { word: "Wa Wabbit", iconUrl: "https://api.dofusdb.fr/img/monsters/285.png" },
    { word: "Dragon Cochon", iconUrl: "https://api.dofusdb.fr/img/monsters/353.png" }
  ].map(w => ({ ...w, word: w.word.trim() }))
};

const getCategoryFromUrl = (url?: string, existingCategory?: string): string => {
  if (existingCategory && existingCategory !== "Dofus" && existingCategory !== "Inconnu") return existingCategory;
  if (!url) return "Inconnu";
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("/items/")) return "Objet / Équipement";
  if (lowerUrl.includes("/monsters/")) return "Monstre";
  if (lowerUrl.includes("/spells/")) return "Sort / Action";
  if (lowerUrl.includes("/mounts/")) return "Monture";
  if (lowerUrl.includes("/npcs/")) return "Personnage";
  return "Dofus";
};

const isValidWord = (w: any): boolean => {
    if (!w || typeof w !== 'object') return false;
    if (!w.iconUrl || typeof w.iconUrl !== 'string') return false;
    if (w.iconUrl.endsWith('/0.png')) return false;
    if (/^archi\s+\d+$/i.test(w.word ?? '')) return false;
    if (!w.word || /^[\s.]+$/.test(w.word)) return false;
    
    // On refuse les mots composés de plus de 3 parties
    if (w.word.trim().split(/\s+/).length > 3) return false;

    const letters = (w.word as string).replace(/\s/g, '');
    if (letters.length < 3) return false;
    return true;
};

export const DOFUS_WORDS: Record<string, SkribblWord[]> = {
  facile: [...SEED_WORDS.facile, ...(generatedWords.facile || []).filter(isValidWord)].map(w => ({ ...w, category: getCategoryFromUrl(w.iconUrl || "", (w as SkribblWord).category) })),
  moyen: [...SEED_WORDS.moyen, ...(generatedWords.moyen || []).filter(isValidWord)].map(w => ({ ...w, category: getCategoryFromUrl(w.iconUrl || "", (w as SkribblWord).category) })),
  difficile: [...SEED_WORDS.difficile, ...(generatedWords.difficile || []).filter(isValidWord)].map(w => ({ ...w, category: getCategoryFromUrl(w.iconUrl || "", (w as SkribblWord).category) }))
};

const fisherYatesShuffle = (array: SkribblWord[]) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const getDofusWords = (
  count: number = 3, 
  difficulty: "facile" | "moyen" | "difficile" = "moyen", 
  exclude: Set<string> = new Set(),
  allowedCategories?: string[]
): SkribblWord[] => {
  let selected: SkribblWord[] = [];

  const filterPool = (pool: SkribblWord[]) => {
    return pool.filter(w => {
      if (exclude.has(w.word)) return false;
      if (allowedCategories && allowedCategories.length > 0) {
        return allowedCategories.includes(w.category || "Inconnu");
      }
      return true;
    });
  };

  const poolFacile = filterPool(DOFUS_WORDS.facile);
  const poolMoyen = filterPool(DOFUS_WORDS.moyen);
  const poolDifficile = filterPool(DOFUS_WORDS.difficile);

  console.log(`[getDofusWords] Pool sizes - Facile: ${poolFacile.length}, Moyen: ${poolMoyen.length}, Difficile: ${poolDifficile.length} (Filter category: ${allowedCategories?.join(', ') || 'all'})`);

  if (difficulty === "facile") {
    selected = [
      ...fisherYatesShuffle(poolFacile).slice(0, Math.ceil(count * 0.7)),
      ...fisherYatesShuffle(poolMoyen).slice(0, Math.floor(count * 0.3))
    ];
  } else if (difficulty === "difficile") {
    selected = [
      ...fisherYatesShuffle(poolDifficile).slice(0, Math.ceil(count * 0.7)),
      ...fisherYatesShuffle(poolMoyen).slice(0, Math.floor(count * 0.3))
    ];
  } else {
    selected = [
      ...fisherYatesShuffle(poolFacile).slice(0, 1),
      ...fisherYatesShuffle(poolMoyen).slice(0, count - 1)
    ];
    if (selected.length >= count) {
      const diffWords = fisherYatesShuffle(poolDifficile);
      if (diffWords.length > 0) {
        selected[selected.length - 1] = diffWords[0];
      }
    }
  }

  if (selected.length < count) {
    const extra = fisherYatesShuffle(poolMoyen).filter(w => !selected.some(s => s.word === w.word));
    selected = [...selected, ...extra.slice(0, count - selected.length)];
  }

  return fisherYatesShuffle(selected).slice(0, count);
};

export const PROMPT_RULES = {
  minLength: 3,
  maxLength: 100,
  forbiddenPatterns: [
    /[<>{}]/,           // XSS
    / (https?:\/\/)/,  // URLs
  ],
};

export function validatePrompt(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length < PROMPT_RULES.minLength)
    return { valid: false, error: "Prompt trop court" };
  if (trimmed.length > PROMPT_RULES.maxLength)
    return { valid: false, error: "Prompt trop long" };
  for (const pattern of PROMPT_RULES.forbiddenPatterns)
    if (pattern.test(trimmed))
      return { valid: false, error: "Contenu invalide" };
  return { valid: true };
}

export const DOFUS_DRAWABLE_PROMPTS = {
  // Facilement dessinable (silhouette distinctive)
  easy: [
    "Tofu",           "Bouftou",         "Crobak",
    "Blop",           "Larve bleue",     "Prespic",
    "Chafer",         "Bwork",           "Koalak",
    "Iop (classe)",   "Cra (classe)",    "Sadida",
    "Tour Bonta",     "Percepteur",      "Kama",
    "Dofus Pourpre",  "Zaap",            "Moulin Amakna",
  ],

  // Moyennement difficile
  medium: [
    "Sylvestre",      "Reine Nyée",      "Bolgrot",
    "Djaul",          "Magik Riktus",    "Korriandre",
    "Osamodas",       "Pandawa avec bouteille", "Ecaflip avec cartes",
    "Xelor avec horloge", "Sram en embuscade",  "Enutrof avec pelle",
    "Donjon des Larves",  "Marché d'Astrub",   "Frigost enneigé",
  ],

  // Difficile (abstrait ou très détaillé)
  hard: [
    "Sort Epée Céleste",     "Glyphe Feca",
    "Sacrieur des Chairs",   "Roublard posant une bombe",
    "Eliotrope avec portail","Huppermage avec runes",
    "Alliance de guilde",    "Perception de percepteur",
    "Combat de Kolizéum",    "Maison de joueur",
  ],
};

// Mélange et sélection avec pondération
export function getDofusPrompt(difficulty?: "easy" | "medium" | "hard"): string {
  const pool = difficulty
    ? DOFUS_DRAWABLE_PROMPTS[difficulty]
    : [
        ...DOFUS_DRAWABLE_PROMPTS.easy,
        ...DOFUS_DRAWABLE_PROMPTS.easy,    // x2 pour favoriser les faciles
        ...DOFUS_DRAWABLE_PROMPTS.medium,
        ...DOFUS_DRAWABLE_PROMPTS.hard,
      ];
  return pool[Math.floor(Math.random() * pool.length)];
}

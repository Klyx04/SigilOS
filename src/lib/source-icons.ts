/**
 * Icônes des sources tierces citées par SigilOS — servies **en local**.
 *
 * Règle : une page SigilOS ne déclenche jamais de requête vers un tiers pour
 * afficher une favicon. Avant le 16/09/2026 les surfaces de guide utilisaient
 * `https://www.google.com/s2/favicons?domain=…` : une requête sortante vers
 * Google **par icône et par affichage** (l'IP du joueur partait chez Google sans
 * action de sa part), une dépendance réseau de plus dans le chemin critique, et
 * un rendu flou (favicons 16 px étirés sur écran Retina).
 *
 * Les fichiers de `public/assets/brands/` sont les **originaux** publiés par
 * chaque site (192 px pour DofusDB, 180 px pour DofusPourLesNoobs, 96 px pour
 * Metamob, 48 px pour Dofensive), réduits par le navigateur : nets à 16 px comme
 * à 32 px. Provenance relevée le 16/09/2026 :
 *   - DofusDB            `https://dofusdb.fr/icons/android-icon-192x192.png`
 *   - DofusPourLesNoobs  `…/files/icones/apple-touch-icon.png`
 *   - Metamob            `https://www.metamob.fr/img/favicon-96.png`
 *   - Dofensive          `https://www.dofensive.com/favicon.ico` (entrée 48×48)
 *
 * Les marques restent la propriété de leurs éditeurs : elles sont citées comme
 * source de la donnée de jeu, jamais comme habillage.
 */

export interface BrandIcon {
  /** Chemin local, servi par Next depuis `public/`. */
  src: string;
  /** Nom affichable de la source. */
  label: string;
}

export const BRAND_ICONS = {
  dofuspourlesnoobs: { src: "/assets/brands/dofuspourlesnoobs.png", label: "DofusPourLesNoobs" },
  dofusdb: { src: "/assets/brands/dofusdb.png", label: "DofusDB" },
  dofensive: { src: "/assets/brands/dofensive.png", label: "Dofensive" },
  metamob: { src: "/assets/brands/metamob.png", label: "Metamob" },
} as const satisfies Record<string, BrandIcon>;

export type BrandIconKey = keyof typeof BRAND_ICONS;

/**
 * Icône d'une URL externe, par hôte. Retourne `null` si l'hôte n'est pas une
 * source référencée (les appelants retombent alors sur une icône Lucide).
 */
export function brandIconForUrl(url?: string | null): BrandIcon | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.includes("dofuspourlesnoobs")) return BRAND_ICONS.dofuspourlesnoobs;
  if (host.includes("dofusdb")) return BRAND_ICONS.dofusdb;
  if (host.includes("dofensive")) return BRAND_ICONS.dofensive;
  if (host.includes("metamob")) return BRAND_ICONS.metamob;
  return null;
}

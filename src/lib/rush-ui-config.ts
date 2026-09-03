import {
  RUSH_PENSE_BETE,
  type RushPenseBeteSection,
} from "@/data/rush-sylvestre-pense-bete";

/**
 * Config UI/UX du Rush Sylvestre, éditée côté GOD (pense-bête + options de la
 * modale de lancement). Persistée dans `OptimizedGuide.rushUIConfig` (JsonB).
 * Optionnel : `resolveRushUIConfig` retombe sur les valeurs par défaut si vide.
 */
export type RushUIConfig = {
  penseBete: RushPenseBeteSection[];
  launch: {
    showMetamob: boolean;
    showResetAlignment: boolean;
    showMetiers: boolean;
  };
};

export const DEFAULT_RUSH_UI_CONFIG: RushUIConfig = {
  penseBete: RUSH_PENSE_BETE,
  launch: { showMetamob: true, showResetAlignment: true, showMetiers: true },
};

/** Résout une config brute (venant de la BDD) vers une config cohérente. */
export function resolveRushUIConfig(raw: unknown): RushUIConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_RUSH_UI_CONFIG;
  const c = raw as Partial<RushUIConfig>;
  return {
    penseBete:
      Array.isArray(c.penseBete) && c.penseBete.length > 0
        ? c.penseBete
        : DEFAULT_RUSH_UI_CONFIG.penseBete,
    launch: {
      showMetamob: c.launch?.showMetamob !== false,
      showResetAlignment: c.launch?.showResetAlignment !== false,
      showMetiers: c.launch?.showMetiers !== false,
    },
  };
}

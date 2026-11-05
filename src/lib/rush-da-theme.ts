/**
 * Thème de bloc de la DA « Gouache Wakfu » — **une seule règle**.
 *
 * Elle vivait inline dans `GuideOverlayClient` (E1b). Le guide plein écran a la
 * même besoin (brief E2 : « le bloc courant, même règle que l'overlay »), et la
 * parité public ↔ interne interdit d'en écrire une deuxième : elle est donc
 * extraite ici, pure, et les deux surfaces l'appellent.
 *
 * Ordre de résolution (mesuré le 05/11/2026) :
 *   1. **bloc NOMMÉ d'abord** — Émeraude, Cauchemar, Ocre, reconnu par
 *      `dofusId` (`emeraude`, `du_emeraude`) ou par le titre (« Dofus Émeraude »).
 *      Un bloc nommé le reste même si le God lui a posé un `accentColor` : sans
 *      ça l'en-tête annonçait « BLOC » sur un bloc Émeraude ;
 *   2. **n'importe quel autre Dofus** — la teinte vient de `accentColor`, HEX
 *      strict (`#rrggbb`), jamais une valeur injectable en CSS ;
 *   3. les deux recherches remontent la liste depuis le bloc courant : un
 *      chapitre qui n'est pas un Dofus (« Quêtes Incarnam, Astrub… ») hérite du
 *      bloc précédent au lieu de retomber sur le gris de repli ;
 *   4. repli : Émeraude.
 */
export type RushDaBlock = "emeraude" | "cauchemar" | "ocre" | "custom";

export interface RushDaTheme {
  block: RushDaBlock;
  /** Accent libre du God, uniquement pour `block === "custom"`. */
  accent: string | null;
}

/** Vue structurelle : l'overlay et les deux guides n'ont pas le même type exact. */
export interface RushDaMilestoneLike {
  id: string;
  title?: string | null;
  dofusId?: string | null;
  accentColor?: string | null;
}

const NAMED_BLOCKS = ["emeraude", "cauchemar", "ocre"] as const;

/** `Dofus Émeraude` → `dofus emeraude` : l'accent ne doit pas casser la lecture. */
const normalize = (value?: string | null): string =>
  (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function resolveRushDaTheme(
  milestones: ReadonlyArray<RushDaMilestoneLike>,
  currentMsId?: string | null
): RushDaTheme {
  const index = milestones.findIndex((m) => m.id === currentMsId);
  const from = index >= 0 ? index : 0;

  // 1. Bloc nommé, en remontant depuis le bloc courant.
  for (let i = from; i >= 0; i -= 1) {
    const id = normalize(milestones[i]?.dofusId);
    const title = normalize(milestones[i]?.title);
    for (const key of NAMED_BLOCKS) {
      if (id === key || id === `du_${key}` || title.includes(`dofus ${key}`)) {
        return { block: key, accent: null };
      }
    }
  }

  // 2. Accent libre d'un autre Dofus — HEX strict, sinon ignoré.
  for (let i = from; i >= 0; i -= 1) {
    const accent = milestones[i]?.accentColor;
    if (accent && /^#[0-9a-f]{6}$/i.test(accent)) return { block: "custom", accent };
  }

  // 3. Repli de la DA.
  return { block: "emeraude", accent: null };
}

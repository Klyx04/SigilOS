/**
 * V-H — état « capturé / à capturer » d'un donjon de la Quête Ocre (règle pure, aucune I/O).
 *
 * **Mesure préalable** : le schéma n'a **aucune relation `Dungeon → Monster`** ; la seule
 * donnée disponible est la progression Metamob du membre (`OcrePanelData.monsters`, noms
 * français). On rapproche donc le **nom du boss** du donjon (repli : le nom du donjon) des
 * captures — la même intention que l'ancien `nameMatch` du dashboard, mais **normalisée** et
 * partagée par toutes les surfaces.
 *
 * Invariants :
 *  · liste de captures **vide** ⇒ `unknown` (compte non lié, données indisponibles) : on
 *    n'affiche jamais « à capturer » sans preuve ;
 *  · un donjon sans identité (ni boss ni nom) ⇒ `unknown` ;
 *  · comparaison **exacte** après normalisation (accents, casse, ponctuation, préfixe
 *    « Donjon du / de la / des / d' ») : pas de `includes`, qui ferait dire « capturé » à un
 *    « Bouftou » pour un « Bouftou Royal ».
 */

export type OcreDungeonCaptureState = "captured" | "to-capture" | "unknown";

/** Ce dont la règle a besoin : le nom du donjon et, si la donnée le porte, celui du boss. */
export type OcreDungeonRef = {
  name?: string | null;
  bossName?: string | null;
};

/**
 * Normalise un nom de donjon ou de monstre pour une comparaison sûre.
 * « Donjon du Bouftou Royal » → `bouftou royal` · « Donjon d'Écaflip » → `ecaflip`.
 */
export function normalizeOcreDungeonName(value: string): string {
  let out = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  // Article du donjon : « donjon du », « donjon de la », « donjon des », « donjon d' »…
  out = out.replace(/^donjons?\s+(?:du|de la|de l|des|de|d|le|la|les|l)\s+/, "");
  // « Donjon Bouftou » (sans article) : le mot « donjon » seul ne sert pas au rapprochement.
  out = out.replace(/^donjons?\s+/, "");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Le donjon est-il déjà couvert par les captures Metamob du membre ?
 * `unknown` quand on ne peut pas répondre (aucune capture, aucune identité).
 */
export function ocreDungeonCapture(
  dungeon: OcreDungeonRef,
  capturedNames: readonly string[] | null | undefined
): OcreDungeonCaptureState {
  const captured = (capturedNames ?? [])
    .map(normalizeOcreDungeonName)
    .filter((name) => name.length > 0);
  if (captured.length === 0) return "unknown";

  const candidates = [dungeon.bossName, dungeon.name]
    .map((name) => (name ? normalizeOcreDungeonName(name) : ""))
    .filter((name) => name.length > 0);
  if (candidates.length === 0) return "unknown";

  return candidates.some((candidate) => captured.includes(candidate))
    ? "captured"
    : "to-capture";
}

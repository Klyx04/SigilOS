/**
 * Références de quête `&n` dans les conseils du guide Rush — règle pure, une seule source.
 *
 * Mesure du 03/11/2026 : **37 séquences** du guide (15 textes distincts) affichent « &1 »,
 * « &2 »… au lieu du nom de la quête, dans les trois surfaces (dashboard, overlay, public) —
 * `RushRichText` ne les remplace pas. La source (Tougli) porte pourtant la correspondance :
 * `payload.text.fr` contient la référence, et `payload.quests[n-1]` donne l'id DofusDB de la
 * quête désignée par `&n` (preuve croisée : `&1` de « Faites &1 jusqu'à parler a Mage Ax »
 * → quête **1989 « Restauration rapide »**, exactement ce que Tougli affiche).
 *
 * Décision de rendu, verrouillée ici : une référence connue devient le **nom** de la quête ;
 * une référence inconnue disparaît (jamais un `&n` à l'écran, jamais un nom inventé).
 */

/** Table `&n` → nom de quête. Une `Map` est préférée ; un objet indexé reste accepté. */
export type RushQuestNames = ReadonlyMap<number, string> | Readonly<Record<number, string>>;

/** Toute référence `&n` — `\d+` pour ne pas confondre `&1` et `&10`. */
const QUEST_REF = /&(\d+)/g;

function questNameOf(names: RushQuestNames | null | undefined, index: number): string {
  if (!names) return "";
  // Duck typing plutôt que `instanceof Map` : un test ou un autre contexte peut fournir une
  // Map d'un realm différent, et `instanceof` échouerait silencieusement (mesuré le 03/11/2026).
  const asMap = names as ReadonlyMap<number, string>;
  if (typeof asMap.get === "function") return String(asMap.get(index) ?? "").trim();
  return String((names as Readonly<Record<number, string>>)[index] ?? "").trim();
}

/**
 * Vrai si le texte porte encore une référence non résolue — utilisé par la garde d'écriture
 * (`upsertRushSequence`) pour refuser un `&n` saisi ou importé.
 */
export function hasUnresolvedQuestRef(text: string | null | undefined): boolean {
  if (typeof text !== "string" || !text) return false;
  return /&\d+/.test(text);
}

/**
 * Résout les `&n` d'un conseil. PUR : ne touche ni aux liens `[Nom](url)`, ni aux positions
 * `[-55,15]`, ni aux sauts de ligne. Nettrie seulement les espaces laissés par un placeholder
 * retiré (« Prenez  la quête » → « Prenez la quête », « Voir . » → « Voir. »).
 */
export function resolveQuestRefs(
  text: string | null | undefined,
  names: RushQuestNames | null | undefined,
): string {
  if (typeof text !== "string" || text.length === 0) return typeof text === "string" ? text : "";

  const replaced = text.replace(QUEST_REF, (_match, digits: string) =>
    questNameOf(names, Number(digits)),
  );

  return replaced
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+([,.;:!?])/g, "$1")
        .replace(/[ \t]+$/g, ""),
    )
    .join("\n")
    .trim();
}

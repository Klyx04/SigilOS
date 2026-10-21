/**
 * **Pagination d'un guide** — fusion des pages qui décrivent le même chapitre.
 *
 * 🎯 Correction user (21/10/2026) : « le bouton suivant ne fait rien » et « le sommaire ne
 * sert à rien ». Cause mesurée : une bannière (ou un encart) qui traverse un chapitre coupe
 * ce chapitre en plusieurs pages **portant le même numéro et le même libellé**, alors que
 * le paginateur s'indexait par NUMÉRO de chapitre — il retombait donc toujours sur la
 * première page de ce numéro (bouton mort) et le sommaire affichait 23 lignes en double
 * pour 6 chapitres réels.
 *
 * La clé d'une page est donc le couple **(chapterNum, label)** : deux morceaux du même
 * chapitre fusionnent ; deux libellés différents d'un même numéro (le chapitre 0 porte
 * « Obtention : Dofus X », un par Dofus) restent **deux pages distinctes**.
 *
 * Pur : ne modifie jamais l'entrée, ne réordonne rien.
 */

export type GuidePage<T> = {
  chapterNum: number | null;
  label: string;
  items: T[];
};

/** Fusionne les pages **adjacentes** qui portent le même chapitre ET le même libellé. */
export function mergeChapterPages<T>(pages: GuidePage<T>[]): GuidePage<T>[] {
  const out: GuidePage<T>[] = [];
  for (const page of pages) {
    const last = out[out.length - 1];
    if (
      last &&
      page.chapterNum !== null &&
      last.chapterNum === page.chapterNum &&
      last.label === page.label
    ) {
      // Même page logique : les bannières intercalées gardent leur position.
      last.items.push(...page.items);
      continue;
    }
    out.push({ chapterNum: page.chapterNum, label: page.label, items: [...page.items] });
  }
  return out;
}

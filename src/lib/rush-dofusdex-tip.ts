/**
 * Découpe du **pavé DofusDex** posé dans les `tips` d'un bloc du Rush.
 *
 * Mesure du 19/11/2026 : **13 blocs** portent un tips qui commence par
 * `**DofusDex officiel** — <Dofus> (<min>–<max>)` suivi de **13 à 51 lignes** de puces
 * (« - Quête (Niv. N) »), puis des sections `**Prérequis**` / `**Donjons (étape N)**`.
 * Rendu tel quel, c'est un mur de texte dans le guide (retour user : « je ne comprends pas
 * tous ces pavés »).
 *
 * Règle pure : on isole l'en-tête + ses **puces d'objectifs** (le pavé de référence), le
 * reste du tips (prérequis, donjons) reste visible. Aucun texte n'est inventé ni supprimé :
 * sans section officielle reconnaissable, le tips est rendu tel quel.
 */

export type RushDofusDexOfficial = {
  /** Ligne d'en-tête d'origine (`**DofusDex officiel** — …`). */
  header: string;
  /** En-tête lisible pour le dépliable (« DofusDex officiel — Dofus X (a–b) »). */
  summary: string;
  /** Nombre de puces d'objectifs repliées. */
  count: number;
  /** Puces d'objectifs seules (le résumé porte déjà l'en-tête). */
  body: string;
  /** En-tête + puces, tels quels. */
  text: string;
};

export type RushDofusDexTipSplit = {
  /** Section officielle à replier ; `null` quand le tips n'en porte pas. */
  official: RushDofusDexOfficial | null;
  /** Le reste du tips (Prérequis, Donjons…), sans les puces repliées. */
  rest: string;
};

const HEADER_MARK = "**DofusDex officiel**";

/** Découpe un tips de bloc en section officielle (repliable) + reste visible. */
export function splitDofusDexTip(text: string | null | undefined): RushDofusDexTipSplit {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return { official: null, rest: raw };

  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes(HEADER_MARK));
  if (start < 0) return { official: null, rest: raw };

  // Les puces d'objectifs suivent IMMÉDIATEMENT l'en-tête ; la première autre ligne
  // (Prérequis, Donjons, paragraphe) ferme la section.
  let end = start + 1;
  let count = 0;
  while (end < lines.length && /^\s*-\s+/.test(lines[end])) {
    count += 1;
    end += 1;
  }
  if (count === 0) return { official: null, rest: raw };

  const header = lines[start].trim();
  const body = lines.slice(start + 1, end).join("\n");
  const official: RushDofusDexOfficial = {
    header,
    summary: header.replace(/\*\*/g, "").trim(),
    count,
    body,
    text: [header, ...lines.slice(start + 1, end)].join("\n"),
  };
  const rest = [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim();
  return { official, rest };
}

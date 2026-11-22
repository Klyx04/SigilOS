/**
 * Description d un bloc Rush : le nombre de quetes annonce doit etre le VRAI.
 *
 * Mesure du 22/11/2026 : des descriptions calculées avant l enrichissement annoncent
 * « 8 quetes » alors que le bloc en porte 12. Le texte reste editorial ; seul le
 * nombre est recale (premiere occurrence), et uniquement s il est present.
 */
export function syncQuestCountInDescription(
  description: string | null | undefined,
  questCount: number
): string | null {
  if (description == null) return null;
  const text = String(description);
  if (!text.trim()) return null;
  if (!Number.isSafeInteger(questCount) || questCount < 0) return text;
  return text.replace(/(\d+)(\s*qu[êe]tes?\b)/i, (_match, _n, rest: string) => `${questCount}${rest}`);
}

/** Nombre de QUETES d un bloc : les encarts `info_sequence` ne sont pas des quetes. */
export function countQuestsInBlock(
  sequences: ReadonlyArray<{ activityTags?: unknown }> | null | undefined
): number {
  return (sequences ?? []).filter((s) => {
    const tags = s?.activityTags;
    return !Array.isArray(tags) || !tags.some((t) => (t as { type?: string })?.type === "info_sequence");
  }).length;
}
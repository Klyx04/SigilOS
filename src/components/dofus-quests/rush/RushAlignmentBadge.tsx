/**
 * Pastille de **série d'alignement** : « Ali 12 » (quête de cité) ou « Rang 2 »
 * (quête d'Ordre). Le libellé vient de `buildAlignmentSeries` — jamais du nom de la
 * quête : préfixer `subGuideName` casserait la résolution des prérequis par nom.
 *
 * `tone="da"` prend l'habillage de la DA Wakfu (overlay) ; sinon, jetons du site.
 */
export function RushAlignmentBadge({
  label,
  tone = "default",
}: {
  label?: string | null;
  tone?: "default" | "da";
}) {
  if (!label) return null;
  return (
    <span
      className={
        tone === "da"
          ? "da-badge shrink-0"
          : "shrink-0 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] tabular-nums text-muted-foreground"
      }
      title={`Série d'alignement : ${label}`}
    >
      {label}
    </span>
  );
}

import type { RushPrereqChoiceGroup } from "@/lib/rush-prereq-expr";

/**
 * Ligne **« Au choix »** d'un prérequis OU (`prereq_expr`) : une seule de ces quêtes
 * suffit. Les alternatives présentes dans le guide sont nommées ; celles qui en sont
 * absentes sont **comptées** (elles ne peuvent pas être vérifiées, donc ne bloquent pas).
 *
 * `tone="da"` prend les jetons de texte de la DA Wakfu (overlay) ; sinon, jetons du site.
 */
export function RushPrereqChoiceHint({
  groups,
  tone = "default",
  className,
}: {
  groups?: readonly RushPrereqChoiceGroup[] | null;
  tone?: "default" | "da";
  className?: string;
}) {
  if (!groups || groups.length === 0) return null;

  const base =
    tone === "da" ? "text-[11px] text-[var(--da-muted)]" : "text-[11px] text-muted-foreground";
  const strong = tone === "da" ? "text-[var(--da-ink)]" : "text-foreground";

  return (
    <div className={className ?? "space-y-0.5"}>
      {groups.map((group, index) => {
        const parts = group.known.map((known) => known.name);
        if (group.unknown > 0) parts.push(`${group.unknown} hors guide`);
        if (parts.length === 0) return null;
        return (
          <p key={`${index}:${parts.join("|")}`} className={base}>
            <span className={`font-semibold ${strong}`}>Au choix :</span> {parts.join(" / ")}
          </p>
        );
      })}
    </div>
  );
}

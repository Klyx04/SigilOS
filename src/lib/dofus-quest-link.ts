/**
 * Lien vers la page **quêtes Dofus** d'une guilde — une seule règle, testée.
 *
 * 🐛 Défaut mesuré le 30/10/2026 : la fiche boss interne construisait
 * `/dashboard/<guild>/quetes-dofus/guide/<slug>` — la page `/quetes-dofus/<slug>` existe, le
 * segment `/guide/` **non** ⇒ **404** sur chaque Dofus lié (constat user : « du-cauchemar »).
 * La cause racine : `du-cauchemar` est un **DofusItem**, pas un `OptimizedGuide` (seuls
 * `progression-complete` et `rush-sylvestre` existent sous `/guide/`). On ne fabrique donc plus
 * de chemin : on vise la page Dofus, qui existe par construction.
 *
 * Module **pur** (aucune IO) : importable par les composants client et les tests.
 */
export function dofusQuestHref(guildId: string, dofusSlug: string | null | undefined): string {
    const base = `/dashboard/${guildId}/quetes-dofus`;
    const slug = String(dofusSlug ?? "").trim();
    return slug ? `${base}/${encodeURIComponent(slug)}` : base;
}

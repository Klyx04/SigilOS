import { internalDofusDbImageUrl } from "@/lib/dofus-image-url";

/**
 * Résout l'icône d'un succès / challenge DofusDB.
 *
 * 🐛 Mesure du 11/10/2026 (succès « Spécial » d'un boss : **case noire**, page DofusDB montrant
 * l'icône réelle) : la règle renvoyait **en premier** `/game-data/achievements/{slug}.png`
 * **sans vérifier l'existence** — le dossier n'en contient que 28 (les challenges classiques) —
 * ⇒ 404, `<img>` masqué par `onError`, case noire. Et l'URL DofusDB disponible n'était jamais
 * utilisée (le proxy ne connaissait que `monsters|items|spells`).
 *
 * Nouvel ordre : **proxy interne d'abord** (auto-réparateur : sert le WebP siphonné ou le
 * télécharge une fois, `img/challenges|achievements/{iconId}.png`), asset local **en repli**.
 * Aucune vérification `fs` ici : la fonction est utilisée côté client ET serveur.
 */
export function getAchievementIconUrl(slug: string | null | undefined, apiIconUrl?: string | null): string | null {
    // ① Icône DofusDB réelle (URL absolue ou déjà interne) → proxy interne, jamais un hotlink.
    const proxied = internalDofusDbImageUrl(apiIconUrl);
    if (proxied) return proxied;
    // ② Repli : asset local nommé d'après le slug (les 28 challenges historiques du dépôt).
    if (slug) return `/game-data/achievements/${slug}.png`;
    return null;
}

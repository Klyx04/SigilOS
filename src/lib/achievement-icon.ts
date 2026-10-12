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
    // ② Chemin d'asset LOCAL **déjà stocké** (`/game-data/...`) : c'est la valeur d'AUTORITÉ,
    // écrite par le seed ou le siphon — elle connaît le vrai nom de fichier. 🐛 Mesure du
    // 12/10/2026 : le challenge « Spécial » est seedé `slug: "sp-cial"` (le slugifier a
    // transformé le « é » en « - ») avec `iconUrl: "/game-data/achievements/spécial.png"`
    // (fichier **présent** au dépôt) ⇒ reconstruire le chemin depuis le slug demandait
    // `sp-cial.png` = **404** et une case noire (constat user : « le bug succès spécial
    // persiste »). `encodeURI` : certains noms portent un accent.
    if (apiIconUrl && apiIconUrl.startsWith("/game-data/")) return encodeURI(apiIconUrl);
    // ③ Dernier repli : asset local nommé d'après le slug (les 28 challenges historiques).
    if (slug) return `/game-data/achievements/${slug}.png`;
    return null;
}

/**
 * Résout l'icône d'un **succès de donjon** (`DungeonAchievement`), en source unique pour
 * l'onglet public ET l'onglet interne (mesure du 12/10/2026 : le tracker interne lisait
 * `challenge.iconUrl` **brut** — sans proxy — d'où des icônes sans la couleur orange dès que la
 * valeur en base était un chemin local, alors que la fiche publique passait par la résolution).
 *
 * Ordre : ① icône du **succès** lui-même (`DungeonAchievement.imageUrl`, spécifique au donjon —
 * la vraie icône quand elle a été siphonnée) → proxy ; ② icône du **challenge** (partagée) via
 * la même résolution que le reste du site. Jamais de chemin disque rendu brut.
 */
export function getDungeonAchievementIconUrl(achievement: {
    imageUrl?: string | null;
    challenge?: { slug?: string | null; iconUrl?: string | null } | null;
} | null | undefined): string | null {
    if (!achievement) return null;
    const own = internalDofusDbImageUrl(achievement.imageUrl);
    if (own) return own;
    return getAchievementIconUrl(achievement.challenge?.slug ?? null, achievement.challenge?.iconUrl ?? null);
}

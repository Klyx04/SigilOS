import { internalDofusDbImageUrl } from "@/lib/dofus-image-url";

/**
 * Candidats d'icône, **dans l'ordre d'essai** — un succès n'est jamais laissé vide :
 *   ① la valeur **stockée** (chemin local `/game-data/…` ou URL DofusDB → proxy interne) ;
 *   ② l'asset **local** déduit du slug (`/game-data/achievements/<slug>.png`) ;
 *   ③ (rien : l'appelant rend le glyphe de repli).
 *
 * 🐛 Mesure du 23/10/2026 (captures user : « Nomade », « Trio », « En ligne de mire » en
 * trophée gris dans la création DJ, le détail ET la clôture, alors que les trois PNG
 * répondaient **200** et que la base portait le bon chemin) : un seul candidat était tenté.
 * Un 404 mis en cache par le navigateur — ou une valeur pré-résolue par un loader — suffisait
 * à figer le repli pour la session. Deux essais, deux sources : le rendu se répare seul.
 *
 * Dédupliqué : deux fois la même URL ne sert à rien et provoquerait deux `onError`.
 */
export function achievementIconCandidates(
    iconUrl: string | null | undefined,
    slug: string | null | undefined
): string[] {
    const out: string[] = [];
    const push = (value: string | null) => {
        if (value && !out.includes(value)) out.push(value);
    };
    push(getAchievementIconUrl(slug, iconUrl ?? null));
    push(getAchievementIconUrl(slug, null));
    return out;
}

/**
 * Ramène un chemin d'asset à sa forme **ASCII** : « spécial » → `special.png`.
 *
 * 🐛 Mesure du 16/10/2026 : le succès « Spécial » restait **noir** dans les fiches interne
 * et externe alors que le fichier `spécial.png` existe, que la base stocke bien le chemin
 * NFC et que l'URL encodée répond **200** — un accent dans un chemin est une bombe à
 * retardement : encodage de l'URL, cache d'un ancien 404, mojibake d'un attribut HTML,
 * normalisation différente selon le système de fichiers. Les 27 autres assets du dépôt
 * sont **tous** en ASCII (`conquerant.png`, `liberte.png`, `special.png`).
 *
 * Le repli ne fabrique rien : il vise le nom **ASCII jumeau**, présent au dépôt (et utilisé
 * par le seed des autres succès). Un chemin déjà ASCII est rendu inchangé.
 */
function asciiAssetPath(path: string): string {
    return path.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
    // persiste »). On sert donc sa forme ASCII (`special.png`), jamais un accent.
    if (apiIconUrl && apiIconUrl.startsWith("/game-data/")) return encodeURI(asciiAssetPath(apiIconUrl));
    // ③ Dernier repli : asset local nommé d'après le slug (les 28 challenges historiques).
    if (slug) return `/game-data/achievements/${asciiAssetPath(slug)}.png`;
    return null;
}

/**
 * Résout l'icône d'un **succès de donjon** (`DungeonAchievement`), en source unique pour
 * l'onglet public ET l'onglet interne (mesure du 12/10/2026 : le tracker interne lisait
 * `challenge.iconUrl` **brut** — sans proxy — d'où des icônes sans la couleur orange dès que la
 * valeur en base était un chemin local, alors que la fiche publique passait par la résolution).
 *
 * ⚠️ La règle accepte les **deux formes** de payload, parce que les deux existent en production :
 *   • **imbriquée** (`{ imageUrl, challenge: { slug, iconUrl } }`) — requêtes internes (Prisma) ;
 *   • **plate** (`{ imageUrl, slug, iconUrl }`) — `PublicDungeonAchievement` de
 *     `src/server/actions/public-boss-tabs-actions.ts`.
 * 🐛 Régression mesurée le 12/10/2026 : l'onglet public passait la forme **plate**, la règle ne
 * lisait que `imageUrl` (nul tant que le succès n'est pas siphonné) ⇒ **placeholder Trophy sur
 * TOUS les succès** (« les icônes ne s'affichent même plus ») alors que l'icône du challenge
 * était disponible dans le même objet.
 *
 * Ordre : ① icône du **succès** lui-même (`imageUrl`, spécifique au donjon — la vraie icône quand
 * elle a été siphonnée) → proxy ; ② icône du **challenge** (partagée) via la même résolution que
 * le reste du site. Jamais de chemin disque rendu brut.
 */
export function getDungeonAchievementIconUrl(achievement: {
    imageUrl?: string | null;
    /** Forme **plate** (payload des actions publiques). */
    slug?: string | null;
    iconUrl?: string | null;
    /** Forme **imbriquée** (lignes Prisma `DungeonAchievement → challenge`). */
    challenge?: { slug?: string | null; iconUrl?: string | null } | null;
} | null | undefined): string | null {
    if (!achievement) return null;
    const own = internalDofusDbImageUrl(achievement.imageUrl);
    if (own) return own;
    const challengeIconUrl = achievement.challenge?.iconUrl ?? achievement.iconUrl ?? null;
    const challengeSlug = achievement.challenge?.slug ?? achievement.slug ?? null;
    return getAchievementIconUrl(challengeSlug, challengeIconUrl);
}

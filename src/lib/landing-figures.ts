/**
 * Source unique des captures affichées sur la landing (`src/app/page.tsx`).
 *
 * Les visuels vivent dans `public/assets/screenshots/` et sont **statiques** :
 * changer un visuel = **déposer un nouveau fichier** et pointer `imageUrl`
 * dessus ; réécrire une légende = la rédiger ici. Aucun pilotage en base :
 * l'interface God `/god/landing` (feature #140, table `LandingScreen`) a été
 * **retirée le 17/09/2026** — elle servait en clair des libellés techniques
 * (UUID de ligne, « test1 », nom de fichier) jusque dans les `alt`.
 *
 * ⚠️ **Ne jamais écraser un visuel existant sous le même nom.** `next/image`
 * passe par `/_next/image?url=…&w=…&q=…`, une URL qui ne dépend pas du contenu :
 * le navigateur garde l'ancienne image en cache, **même après un rechargement
 * forcé et alors que le serveur sert bien la nouvelle** (constaté le 17/09/2026
 * sur `screenshot1.png`). Un visuel dont le contenu change change donc de
 * **nom** → nouvelle URL, donc nouveau cache. Le nom précédent est laissé en
 * place tant qu'il sert ailleurs : `screenshot1.png` reste le visuel du guide
 * dans l'application (`src/lib/docs-catalog.ts`).
 *
 * ⚠️ **Un visuel se cadre sur un composant, pas sur un écran entier.** Les
 * figures s'affichent sur **619-718 px CSS** (`hero.tsx` : `sizes="… 640px"` ;
 * `guide.tsx` : `680px` — largeurs réelles relevées par
 * `src/temp/refonte_landing/probe-figure-slots.mjs`). Une capture d'écran 4K
 * (3280 px) y subit une réduction **×5** : un texte d'interface de 13 px tombe à
 * 2,5 px à l'écran (constaté le 17/09/2026 sur les quatre figures).
 *
 * ⚠️ **Et recadrer après coup ne répare rien** — ça *zoome* sur un fragment :
 * texte coupé en plein mot, bouton amputé, curseur figé dans l'image (mesuré le
 * 17/09/2026 : `guide-sylvestre.png` coupait la modale en haut et en bas,
 * `calendrier-sorties.png` s'arrêtait à « MER »). La règle est donc double :
 *
 *   1. **le fichier fait au moins 2× la largeur du slot** — soit 1240-1440 px.
 *      Ce n'est pas un confort : `next/image` **ne remonte jamais** une image
 *      (une demande `w=1920` sur un fichier de 1080 px renvoie du 1080 px), donc
 *      un fichier trop court est agrandi **par le navigateur** → flou côté
 *      client (mesuré : hero ×1,15, guide ×1,39 sur écran 2×). À l'inverse un
 *      fichier de 2× est réduit par le navigateur : net **et** léger.
 *   2. **le sujet est capturé, jamais rogné** : viewport ≈ largeur du slot +
 *      `deviceScaleFactor: 2`, cadrage sur une ancre `data-tour` — c'est le
 *      layout compact de l'app qui fait le cadre, le texte garde donc sa taille
 *      réelle. Producteur : `scripts/capture-landing-visuels.mjs` (profil
 *      `.playwright-profile/`, connexion Discord une fois via `--login`).
 *      `src/temp/refonte_landing/crop-landing-visuels.mjs` (recadrage) est
 *      **remplacé** : il n'existe plus que pour tracer l'origine des visuels
 *      `dashboard-guilde.png` / `calendrier-sorties.png` / `missions-guilde.png`
 *      / `guide-sylvestre.png` du 17/09, tous sous-dotés pour un écran 2×.
 *
 * - `label` : légende de la barre de titre de la figure (courte, en `reg-mono`).
 * - `alt` : phrase rédigée pour les lecteurs d'écran et les moteurs — jamais un
 *   libellé d'interface ni un nom de fichier.
 * - `width` / `height` : dimensions **réelles** du fichier (à une réduction
 *   homothétique près). Elles réservent la place exacte avant le chargement :
 *   annoncer un ratio qui n'est pas celui du fichier fait sauter la mise en page
 *   au premier paint. Les dimensions se mettent à jour ici à chaque nouveau
 *   visuel (même gabarit : recopier les valeurs lues dans le fichier) — le
 *   garde-fou `tests/unit/landing-figures.test.ts` le réclame.
 *
 * Les textes reprennent mot pour mot ceux déjà validés côté produit (les libellés
 * et descriptions d'origine portés par la page d'accueil) : rien n'est inventé ici.
 */

export interface LandingFigure {
    /** Légende du visuel (barre de titre de la figure). */
    label: string;
    /** Texte alternatif rédigé (accessibilité + référencement). */
    alt: string;
    /** Chemin public du visuel, relatif à `public/`. */
    imageUrl: string;
    /** Largeur intrinsèque déclarée (réservation de place — cf. en-tête). */
    width: number;
    /** Hauteur intrinsèque déclarée (réservation de place — cf. en-tête). */
    height: number;
}

/** Figure du guide en jeu : un titre et un contexte en plus de la légende. */
export interface LandingGuideFigure extends LandingFigure {
    title: string;
    description: string;
}

/** Hero (`hero.tsx`) — le tableau de bord d'une guilde. */
export const LANDING_HERO_FIGURE: LandingFigure = {
    label: "Tableau de bord",
    alt: "Tableau de bord SigilOS : sorties, progression et membres d'une guilde Dofus",
    imageUrl: "/assets/screenshots/dashboard-guilde.png",
    // 1080×540 — recadré le 17/09/2026 sur les blocs Aujourd'hui / Événement / Agenda.
    width: 1080,
    height: 540,
};

/** Scénario de sortie (`workflow.tsx`) — le calendrier qui porte la soirée. */
export const LANDING_WORKFLOW_FIGURE: LandingFigure = {
    label: "Calendrier des sorties",
    alt: "Calendrier des sorties SigilOS : événements de la semaine, types de sortie et filtres",
    imageUrl: "/assets/screenshots/calendrier-sorties.png",
    // 1280×690 — recadré le 17/09/2026 sur la semaine et une sortie planifiée.
    width: 1280,
    height: 690,
};

/** Guide en jeu (`guide.tsx`) — la figure principale. */
export const LANDING_GUIDE_FIGURE: LandingFigure = {
    label: "Guide Sylvestre",
    alt: "Guide Sylvestre dans SigilOS : étape courante, coordonnées copiables et reprise de la quête",
    imageUrl: "/assets/screenshots/guide-sylvestre.png",
    // 1030×500 — retour de quête recadré le 17/09/2026 : la capture d'origine
    // (guide-complet.png) empile deux modales sur un écran presque noir, et
    // affichée entière elle était réduite ×4,8 (texte de 13 px → 2,7 px).
    width: 1030,
    height: 500,
};

/** Guide en jeu (`guide.tsx`) — les figures secondaires, sous la principale. */
export const LANDING_GUIDE_SECONDARY_FIGURES: LandingGuideFigure[] = [
    {
        label: "Missions de guilde",
        title: "Voyez ce que votre guilde accomplit vraiment.",
        description:
            "Missions, Dofus, Songes et services : des signaux clairs pour décider quoi faire ce soir.",
        alt: "Missions de guilde SigilOS : paliers d'XP de guilde, objectifs en attente et coordonnées du hall",
        imageUrl: "/assets/screenshots/missions-guilde.png",
        // 1180×700 — recadré le 17/09/2026 sur les coordonnées du hall.
        width: 1180,
        height: 700,
    },
];

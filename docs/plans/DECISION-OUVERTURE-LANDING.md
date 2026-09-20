# Décision — Ouverture prod & landing immersive

> Date : 2026-08-23. Décision produit validée avec le fondateur (Wylan).

## 1. Ce qui sera servi sur sigilos.fr à l'ouverture

**À l'ouverture de la prod, `sigilos.fr` servira la landing React actuelle de la beta
(`src/app/page.tsx`), qui doit être refondue complètement une dernière fois pour
l'immersion** (y porter le design immersif Dofus aujourd'hui dans `public/maintenance.html`).

- `public/maintenance.html` = **vitrine de lancement** (page d'attente « Ouverture prochaine »),
  servie par Caddy via `rewrite * /maintenance.html` sur le bloc `sigilos.fr`.
- À l'ouverture : **retirer ce rewrite** du Caddyfile → `sigilos.fr/` sert `src/app/page.tsx`.
- `maintenance.html` reste alors le fallback/maintenance (comme `maintenance-beta.html` pour la beta).

## 2. Captures de la landing — visuels statiques (décision du 17/09/2026)

- Les captures affichées sur `/` sont **statiques**, source unique
  `src/lib/landing-figures.ts` → fichiers `public/assets/screenshots/` :
  `dashboard-guilde.png` (hero), `calendrier-sorties.png` (calendrier des sorties),
  `guide-sylvestre.png` (guide Sylvestre), `missions-guilde.png` (missions de guilde).
  Changer un visuel = **déposer un nouveau fichier sous un nom neuf** puis mettre à
  jour `imageUrl` (+ `width`/`height` réels) dans ce module ; réécrire une légende =
  la rédiger dans ce module. ⚠️ **Jamais en écrasant le fichier existant** :
  `next/image` sert une URL qui ne dépend pas du contenu, donc le navigateur garde
  l'ancienne image même après un rechargement forcé (piège mesuré le 17/09/2026 :
  `screenshot1.png` remplacé, landing inchangée — cf. `docs/MAINTENANCE.md` §3e).
  Aucune migration ni ligne à créer en base.
- **Cadrage des visuels (17/09/2026)** : les figures s'affichent sur **~640-707 px** de large, donc une
  capture 3280 px y subit une réduction **×5** — un texte de 13 px dans l'interface tombe à 2,5 px à
  l'écran, et la vignette est perçue comme floue (« ça fait amateur »), sans que la qualité du fichier
  soit en cause. Les 4 visuels sont donc **recadrés sur un seul sujet** (un panneau, une semaine, une
  carte) à **≈ 2× la largeur d'affichage** (1080-1280 px) :
  `node scripts/crop-landing-visuels.mjs` (script borné : il refuse de rogner hors
  cadre). Les captures d'origine (`screenshot3.png`, `screenshot6.png`, `guide-complet.png`,
  `tableau-de-bord.png`) restent en place : elles servent `src/lib/docs-catalog.ts`.
- L'interface God `/god/landing` (feature #140, modèle `LandingScreen`, actions
  `src/server/actions/landing-screen-actions.ts`, stockage `private_uploads/landing/`
  servi via `/uploads/*`) **n'alimentait plus** `src/app/page.tsx` — et a été
  **retirée complètement le 17/09/2026** (décision fondateur : « on ne s'en sert
  plus »). Motifs du découplage : ses libellés techniques s'affichaient en clair
  sur la page publique (UUID de ligne, « test1 », nom de fichier) jusque dans les
  `alt`, et une capture en base **masquait** le visuel livré avec le code (une
  image de test « gagnait » à l'ouverture prod). Le retrait couvre la page God et
  son entrée de menu, les actions serveur, la table `LandingScreen` (migration
  `20261217000000_drop_landing_screen`), le scope d'upload `landing`
  (`image-downloader.ts`, `api/storage`, `api/god/upload-image`) et les fichiers
  `private_uploads/landing/`.
- `maintenance.html` est statique et ne lit pas la DB : il ne faut donc **pas**
  le relier au God (inutile).
- Chaque figure déclare aussi `width` / `height`, **réels** (à une réduction
  homothétique près) : ils réservent la place exacte avant le chargement. Le test
  lit l'en-tête PNG et refuse un ratio qui ne colle pas au fichier — un visuel
  remplacé par un autre gabarit est donc signalé au lieu de faire sauter la mise
  en page en silence. Seul le visuel du hero est préchargé (`priority`) : la
  figure du guide, plusieurs écrans plus bas, ne dispute plus la bande passante
  du premier écran.

## 3. Data SEO & liens « pointer la prod »

- Sur la landing React (`src/app/layout.tsx` + `page.tsx` + pages métier), canonical/OG/JSON-LD
  sont construits via `getAppBaseUrl()` (`src/lib/utils.ts`) :
  - `NEXT_PUBLIC_APP_URL` (env) prioritaire → `https://sigilos.fr` en prod, `https://beta.sigilos.fr` en beta ;
  - fallback `NEXTAUTH_URL`, puis défaut `https://sigilos.fr`.
- Donc ces data se remplissent **automatiquement** au runtime selon l'environnement. Il est
  préférable de les **finaliser/valider à l'ouverture prod** (les liens doivent pointer `sigilos.fr`).
- `maintenance.html` (vitrine) a déjà son canonical/OG/JSON-LD en dur vers `https://sigilos.fr/` — OK en attendant.

## 4. Checklist à l'ouverture prod (rappel)

1. Merger `main` (commits dev + tests + migrations) puis `deploy.sh prod`.
2. Caddy : retirer le bloc `rewrite * /maintenance.html` du domaine `sigilos.fr`.
3. Noindexer la beta (`robots.ts`) pour ne pas cannibaliser `sigilos.fr`.
4. Resoumettre le sitemap à Google Search Console.
5. Vérifier `/legal/*` (mentions, privacy, cgu, faq) et refaire la vérification Discord si besoin.

## 5. Statut actuel

- ✅ Bouton « Rejoindre » de la vitrine corrigé (contraste 1.02 → 6.67) : la règle
  `.header-nav a` (spécificité 0,1,1) écrasait la couleur de `.header-cta` (0,1,0) ;
  sélecteur monté en `.header-nav a.header-cta` (0,2,1). Concerne `public/maintenance.html`.
- ✅ **Vitrine prod `sigilos.fr` déployée & saine (23/08)** : `/assets/*` servi en statique par Caddy
  (`handle /assets/*` + mount `./public:/srv/static:ro`) → images en `200 image/png` (screenshot,
  `logo-v2.png` = favicon + og:image). Cause racine = Caddyfile/compose VPS périmés, restaurés depuis
  `origin/main` (fix chirurgical) + Caddy (`sigilos-gateway`) recréé. Détail : `docs/MAINTENANCE.md` §3e.

- ⏳ À faire plus tard : refonte immersive de la landing React (`page.tsx`) en y portant
  le design Dofus (hero `bg-guild.jpg`, frame navigateur, galerie, grille 6 modules, 3 étapes).
- ✅ **Refonte « registre » de la landing livrée (16/09, 24 fixes — PR #683 mergée)** : direction
  retenue « **montrer davantage SigilOS, montrer moins la landing** » (page d'accueil en 6 blocs,
  couche `.reg-*`). La direction immersive Dofus ci-dessus a été **écartée** ; `maintenance.html`
  reste la vitrine d'attente.
- ✅ **Captures de la landing passées en statique (17/09)** : `src/lib/landing-figures.ts` =
  source unique (hero, calendrier des sorties, guide Sylvestre, missions de guilde) + garde-fou
  `tests/unit/landing-figures.test.ts` (visuel réellement présent, légende et `alt` rédactionnels,
  aucun visuel affiché deux fois). Les 3 × « Capture de l'interface » et les libellés techniques
  (UUID de ligne, « test1 », nom de fichier) ont disparu des figures, y compris des `alt`.
  `src/lib/landing-utils.ts` (filtrage des libellés God) est **supprimé** : sans pilotage God sur
  `/`, il n'avait plus d'objet.
- ✅ **Pilotage God de la landing retiré (17/09)** : `/god/landing`, ses actions serveur, le modèle
  `LandingScreen` (migration `20261217000000_drop_landing_screen`), son entrée de menu, le scope
  d'upload `landing` et `private_uploads/landing/` sont supprimés — la page publique ne s'en servait
  plus depuis le passage des captures en statique (§2). La landing reste **100 % statique** : ses
  4 visuels vivent dans `public/assets/screenshots/` et sont déclarés dans `landing-figures.ts`.
  Relecture des captures de rendu (17/09) : les figures annonçaient un ratio `1440×900` (1,600)
  alors que les fichiers sont en 3280×1740 (1,885) et 3280×1842 (1,781) — la place réservée était
  fausse jusqu'à 18 % et le cadre se rétractait au premier paint → dimensions réelles déclarées
  dans `landing-figures.ts` et vérifiées par le test (écart mesuré ≤ 0,41 %), et `priority` retiré
  de la figure du guide. **Les 4 visuels ont été recadrés le 17/09/2026** (§2) après constat d'illisibilité :
  ils montraient des écrans 4K réduits ×5 ; `screenshot6.png` portait en plus une bande basse coupée en
  plein milieu de cartes et `guide-complet.png` empile **deux modales** sur un écran presque noir
  (`guide-sylvestre.png` n'en garde que le bandeau d'étape). Une capture **neuve** du guide — fenêtre
  étroite, zoom navigateur ~150 %, une seule modale ouverte — reste souhaitable ; à déposer **sous un nom
  neuf** (jamais en écrasant le fichier : le navigateur resservirait l'ancien visuel, même après un
  rechargement forcé — mesuré le 17/09/2026, cf. `docs/MAINTENANCE.md` §3e), puis `landing-figures.ts`
  met à jour `imageUrl` et les `width`/`height` **réels** du fichier (le test
  `tests/unit/landing-figures.test.ts` le réclame).

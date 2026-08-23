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

## 2. Liaison upload God ↔ landing

- L'interface God `/god/landing` (feature #140, modèle `LandingScreen`, actions
  `src/server/actions/landing-screen-actions.ts`, stockage `private_uploads/landing/`
  servi via `/uploads/*`) alimente **uniquement** `src/app/page.tsx` :
  - `getPublicLandingScreens("product-story")` → `<ProductStory>` (galerie/carrousel onglets),
  - `getPublicLandingScreens("hero")` → `<HeroSection>` (image du hero).
- Comme c'est **`page.tsx` qui sera servi en prod**, la liaison God → landing sera
  **automatique à l'ouverture**. `maintenance.html` est statique et ne lit pas la DB :
  il ne faut donc **pas** le relier au God (inutile).

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
  `origin/main` (fix chirurgical) + Caddy (`sigilos-gateway`) recréé. Détail : `MAINTENANCE.md` §3e.

- ⏳ À faire plus tard : refonte immersive de la landing React (`page.tsx`) en y portant
  le design Dofus (hero `bg-guild.jpg`, frame navigateur, galerie, grille 6 modules, 3 étapes).

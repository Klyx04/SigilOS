# 🔁 REPRISE SESSION SEO — SigilOS (Session 17/08/2026)

> **Fichier de contexte dédié hors audits** — à copier-coller en début de prompt pour retrouver
> instantanément l'état de la session SEO/Growth et reprendre là où on s'est arrêté.
> Complète `docs/CONTEXT.md` (global) et ne remplace pas les audits détaillés (`docs/audits/`).

---

## 🧭 ÉTAT RÉEL DU SEO (Session 17/08/2026 — État de l'Art Militaire)

### 1. Diagnostic Google Search Console (Beta)
- **Sitemap XML** : Lu avec succès le 16/08/2026 (`Opération effectuée`).
- **Pages** : 3 indexées + 7 détectées en file d'attente normale (aucun blocage technique ni 404).
- **Impressions** : Premières positions acquises sur `sigilos` et `guides dofus`.
- **Actions opérées** : Demande d'indexation prioritaire sur les guides + validation de correction lancée.

### 2. Nouvelles Fondations SEO Déployées (17/08)
- **3 Nouveaux Guides Piliers à Fort Volume** (`src/content/guides/`) :
  - `poids-runes-forgemagie-dofus` : Tableau PWR complet, puits, reliquat, exo/over.
  - `guide-elevage-enclos-guilde-dofus` : Élevage Dofus Unity, sérénité, enclos de guilde.
  - `guide-brisage-rentabilite-runes` : Coefficients de concassage, focus stats, rentabilité.
  - Tous enregistrés dans le registre de guides, sitemap.xml et balisés Schema.org `Article` + `BreadcrumbList`.
- **Page Publique `/almanax`** (`src/app/almanax/page.tsx`) :
  - Offrande du jour, bonus Méryde, prévisions 30 jours, ISR 1h.
  - Balisage Schema.org `FAQPage` + `BreadcrumbList`.
  - Route ouverte dans `robots.ts` et priorisée (0.9) dans `sitemap.ts`.
- **OpenGraph Dynamique HD** : Cartes réseaux sociaux `/api/og` générées à la volée par guide.
- **Enrichissement Annuaire & Liens Utiles** : Dofocus, DofusElevage, Doflinks intégrés par défaut.

DÉJÀ FAIT le 02/08 SOIR (session en cours — à committer via PR vers dev) :
- GUIDE PUBLIÉ : creer-gerer-guilde-dofus-2026 passe draft:true → false
  → désormais indexable, alimente le sitemap automatiquement, visible sur /guides
  → plus de noindex (avant, ce guide écrit était invisible pour Google !)
- robots.ts : ajout de '/guides' à la liste allow en prod (avant absent → guides bloqués)
- public-header.tsx : ajout de "Guides" dans NAV_ITEMS (header desktop + drawer mobile)
- Vitrine v2 enrichie (public/maintenance.html) :
  · 8 piliers couvrant les ~20 modules (au lieu de 4)
  · JSON-LD enrichi : ItemList (8 fonctionnalités) + FAQPage (5 questions) + Organization/WebSite
  · Meta Open Graph + Twitter Card (partage Discord/réseaux)
  · Bandeau + footer vers le guide
  · Stats légères : 8+ familles · 20+ outils · Gratuit en bêta
  · Retrait de "open-source" (le code est FERMÉ)
  · "guide complet" reformulé en "grandes lignes" (le guide n'est pas exhaustif)
  · Icône Discord SVG sur le bouton "Activer SigilOS"
  · Reformulation accès bêta : "Vous faites déjà partie d'une guilde sur SigilOS ?"
    + "Connexion Discord requise. Accès réservé aux membres d'une guilde déjà activée sur SigilOS."
- Typecheck OK (tsc --noEmit)

DÉJÀ FAIT le 03/08 (fix technique sitemap beta) — branche fix/sitemap-base-url (1d88d4a8) :
- Cause GSC "Impossible de récupérer le sitemap" sur beta : sitemap.ts utilisait
  NEXT_PUBLIC_APP_URL || "https://sigilos.fr" → si l'env manquait, URLs vers sigilos.fr
- Fix : sitemap.ts utilise getAppBaseUrl() (cohérent avec robots.ts + metadata)
  → la base est résolue selon l'environnement (beta.sigilos.fr sur dev)
- NB : le .env.beta a déjà NEXT_PUBLIC_APP_URL=https://beta.sigilos.fr (correct).
  Le fix reste utile en robustesse. La vraie cause GSC était probablement la beta
  en maintenance (réponse HTML au lieu de XML) ou une DB indispo au crawl.
- À vérifier au prochain déploiement : curl -sI https://beta.sigilos.fr/sitemap.xml
  (doit renvoyer 200 + text/xml) AVANT de resoumettre dans GSC.

DÉJÀ FAIT le 03/08 (fix robots.txt beta — cause racine de l'erreur GSC) :
- RACINE du problème GSC "Impossible de lire le sitemap" : robots.ts servait
  Disallow:/ sur la beta (isProd ne matchait QUE sigilos.fr)
- Fix : isIndexable = sigilos.fr || beta.sigilos.fr → beta.indexable (Allow:/)
  + mêmes zones privées bloquées (dashboard/api/god/docs/_next/onboarding)
- Commit 3601e96e (branche fix/robots-beta-indexable) + doc checklist prod 7eeea94c
- DÉPLOYÉ + VÉRIFIÉ : robots.txt beta = Allow:/ (plus de Disallow:/),
  sitemap.xml = 200 + application/xml + accessible en Googlebot,
  guide present dans le sitemap
- PROCHAINE ÉTAPE côté GSC : resoumettre /sitemap.xml sur la propriete
  https://beta.sigilos.fr (une seule fois, attendre 24-72h)
- Branches obsolètes nettoyees sur GitHub (7 fusionnees supprimees)
- Note mineure : le sitemap envoie des cookies Auth.js (set-cookie) — benin,
  mais propre d'exclure /sitemap.xml des routes middleware un jour (non urgent)

PENDING DÉCISION (le vrai levier Google, en attente) :
- Recommandation IA browsante attendue : guide unique vs hub de ~20 sujets
  (brief soumis à l'IA le 02/08 soir — voir conversation Cline)
- NE PAS créer les 20 guides tant que cette décision n'est pas prise
  (la landing sert de point d'entrée, le guide publié accumule ses premières impressions sur la beta)

NON URGENT (laissé en attente) :
- P0.8 analytics auto-hébergé gratuit (UMami / Plausible CE via docker-compose sur VPS) — 0€, RGPD-friendly
- Pages légales (audit L1-L7) : privacy incomplet vs FAQ (clé Metamob, pseudo, serveurs Discord, jetons),
  contact RGPD flou, CGU à compléter (Songes/raids/ladder/bot Discord), 5 mentions "équipe"
  → reformuler en "le développeur"/"le support" (projet solo, éditeur Wylan)
- À l'ouverture prod sigilos.fr : préparer fusion main (681 commits + tests + migrations),
  deploy.sh prod, resoumission sitemap GSC, retirer le rewrite maintenance.html du Caddyfile

QUESTION : quel est le plan précis pour cette session ? (attente retour IA → analytics → légal, ou autre)
```

---

## 🧭 État global (rappel rapide)

| Domaine | Rôle | SEO |
|---|---|---|
| `beta.sigilos.fr` | La vraie app (annuaire, guildes, contenu) — branch `dev` | ✅ soumis à Google, indexation en cours → **vrai levier** |
| `sigilos.fr` | Page d'attente vitrine (maintenance.html) — Caddy | ✅ page optimisée + indexable, pas de sitemap (pas encore la vraie app) |

- Le **socle SEO est dans `dev`** → restera **actif sur la beta** à chaque reprise.
- `main` (prod) est très en retard ; **ne pas fusionner tant que sigilos.fr n'est pas prêt** à ouvrir.

---

## 🧭 STRATÉGIE DES 2 DOMAINES (à relire si perte de repères)

> **Règle d'or : ne jamais indexer les DEUX domaines avec le même contenu** → risque de
> duplicate content et de dilution du ranking. Un seul domaine porte le SEO à la fois.

| Domaine | Rôle réel | Indexation |
|---|---|---|
| **beta.sigilos.fr** | La **vraie app** (dev) — guide, annuaire, guildes | ✅ **Domaine SEO ACTIF actuellement** (c'est lui qui travaille) |
| **sigilos.fr** | Page vitrine statique (attente prod) | ⚠️ Indexable mais **vide de contenu** → ne rapporte rien en organique |

- Le **guide vit sur `beta.sigilos.fr/guides/creer-gerer-guilde-dofus-2026`**, PAS sur sigilos.fr.
- Il est publié (draft:false), indexable, dans le sitemap de la beta → il SERA indexé une fois
  le sitemap réparé + resoumis (voir fix sitemap ci-dessus + checklist GSC).
- **sigilos.fr ne "sert à rien" en SEO tant que c'est une page statique** — son rôle est
  stratégique : c'est le domaine de marque, prêt à recevoir la vraie app le jour de la prod.

### 🔄 Plan de bascule quand la prod est prête (fusion main)
1. Fusionner `main` (les ~800 commits en retard + tests + migrations)
2. Déployer la vraie app sur `sigilos.fr` → il devient LE domaine principal
3. Le SEO (guide, guildes, sitemap, JSON-LD) migre automatiquement sur sigilos.fr
   (même code, donc quasi automatique — juste resoumettre le sitemap GSC sur sigilos.fr)
4. **Noindexer la beta** (robots.ts / noindex) pour ne PAS cannibaliser sigilos.fr
5. Retirer le rewrite `maintenance.html` du Caddyfile (bloc sigilos.fr)

### ⚠️ À ne PAS faire
- Ouvrir la prod "à la va-vite" (800 commits = risque de casse majeure).
- Garder les 2 domaines indexés en même temps (dilution / duplicate content).
- Supprimer sigilos.fr (c'est le domaine de marque final).

### 📋 CHECKLIST COMPLÈTE — À EXÉCUTER LE JOUR DE L'OUVERTURE PROD
> Quand `main` est prêt à fusionner et que l'app tourne sur sigilos.fr :
>
> **1. Préparation code (AVANT le déploiement)**
> - [ ] `Caddyfile` (bloc `sigilos.fr`) : **retirer** `header X-Robots-Tag "noindex, nofollow"` et
>   décommenter/reposer l'en-tête d'indexation — sinon `sigilos.fr` **restera hors index à vie**
>   (posé le 24/09/2026 pour la phase bêta, garde de non-régression `tests/unit/seo-vitrine-prod.test.ts`).
> - [ ] `Caddyfile` : rétablir un vrai `handle /sitemap.xml` (aujourd'hui `respond 404`, volontaire
>   pendant la bêta — la vitrine n'expose aucune URL indexable).
> - [ ] `public/maintenance.html` : remettre `<meta name="robots" content="index, follow…">`
>   (aujourd'hui `noindex, nofollow`).
> - [ ] `src/app/robots.ts` : remettre la beta en `Disallow: /` (staging) et sigilos.fr indexable.
>   (Aujourd'hui `isIndexable` couvre les 2 ; on revient à `isIndexable = baseUrl === 'https://sigilos.fr'`)
> - [ ] Vérifier que le `sitemap.ts` de sigilos.fr utilise `getAppBaseUrl()` (déjà fait) → URLs sigilos.fr correctes.
> - [ ] Revoir le fallback `getAppBaseUrl` : en prod, `NEXT_PUBLIC_APP_URL=https://sigilos.fr` dans `.env.prod`.
> - [ ] Les zones privées sont déjà bloquées par robots (dashboard/api/god/docs) — à confirmer sur sigilos.fr.
>
> **2. Déploiement**
> - [ ] ⚠️ **Après le merge `dev` → `main` : relire le `Caddyfile` de `main` AVANT de déployer.**
>   Le merge apporte la version de `dev` — donc **les 3 verrous d'indexation** du point 1 — et
>   `main` était en retard (`handle /robots.txt` absent depuis le 04/09). Vérifier que les blocs
>   attendus sont bien présents : `handle /robots.txt`, `handle /sitemap.xml`, `handle /assets/*`,
>   `handle /game-data/*` (`grep -c` sur chacun, ou `docker exec sigilos-gateway caddy validate`).
> - [ ] Fusionner `main` (les ~800 commits de dev + tests + migrations)
> - [ ] `deploy.sh prod` (build + démarrage de sigilos.fr avec la vraie app)
> - [ ] Caddy : retirer le bloc `rewrite * /maintenance.html` du bloc `sigilos.fr` + rediriger proprement
> - [ ] `sync-assets.sh prod` pour pousser `public/game-data/` sur la prod
>
> **3. Post-déploiement**
> - [ ] `curl -sS https://sigilos.fr/robots.txt` → doit montrer `Allow: /` + pas de `Disallow: /` sur sigilos.fr
> - [ ] `curl -sI https://sigilos.fr/sitemap.xml` → 200 + `application/xml`
> - [ ] Google Search Console **sigilos.fr** : (re)soumettre `/sitemap.xml` (sitemap retiré depuis la page vitrine)
> - [ ] GSC beta : **retirer** le sitemap beta (ou le laisser, mais la beta sera noindexée donc sans valeur)
> - [ ] Rediriger la beta vers sigilos.fr ? (optionnel) OU la garder en staging noindexée
>
> **4. Anti-duplicate-content**
> - [ ] La **beta re-noindexée** (robots.ts `Disallow: /`) → Google ne l'explore plus
> - [ ] Assurer les canonical sur sigilos.fr (déjà via metadata alternates)
> - [ ] Si besoin : 301 de beta → sigilos.fr pour conserver les liens accumulés sur la beta
>
> **5. Vérifs SEO finales**
> - [ ] Le guide `/guides/creer-gerer-guilde-dofus-2026` indexé sur sigilos.fr (pas seulement beta)
> - [ ] L'indexation Google de la beta se désindexe progressivement (noindex + suppression éventuelle en GSC)

---

## 🗓️ Sources / fichiers clés

| Fichier | Rôle |
|---|---|
| `docs/audits/SEO_GROWTH_2026-08-02.md` | Audit SEO détaillé (local, NON versionné) — backlog, 20 sujets, netlinking, KPIs |
| `docs/CONTEXT.md` | Contexte global projet (à référencer aussi) |
| `docs/RULES.md` | Conventions de dev + sécurité non-négociables |
| `public/maintenance.html` | Vitrine sigilos.fr (page d'attente SEO) — version v2 enrichie |

---

*— Fichier de reprise SEO maintenu à jour (02/08/2026). —*
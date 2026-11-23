---
description: Performance web — mesure de charge, diagnostic de rendu public/interne, lots P0→P3 (l'ordre vit dans ROADMAP)
---

# ⚡ Performance web — rendu public, dashboard, compression

> **Rôle unique.** Ce fichier porte la **mesure** et le **diagnostic** de performance web.
> L'**ordre** global vit dans `docs/ROADMAP.md` (chantier `perf-web`) ; ce document ne le duplique pas.
> Les sujets Rush restent dans `ROUTE-RUSH-ISO-TOUGLI.md` et `MODULE-RUSH-SYLVESTRE.md`.

## 0. Mesure du 20/11/2026 (bêta `8d7528ff`)

Outil : `autocannon` v9, `Accept-Encoding: gzip`, User-Agent `SigilOS-loadtest/1.0`,
10 s par palier, arrêt à 100 connexions. Cible : bêta uniquement.

| Cible | Concurrence | Débit | p50 | p97,5 | Erreurs |
|---|---:|---:|---:|---:|---:|
| `/guides/rush-sylvestre` | 10 | **2,5 req/s** | 3 406 ms | — | 0 |
| `/guides/rush-sylvestre` | 25 | **2,5 req/s** | 7 381 ms | — | 0 |
| `/guides/rush-sylvestre` | 50 | **2,1 req/s** | 7 924 ms | 9 901 ms | 0 |
| `/guides/rush-sylvestre` | 100 | **1,6 req/s** | 7 442 ms | 10 021 ms | 0 |
| `/` (accueil) | 25 | **19,6 req/s** | 986 ms | 3 674 ms | 0 |
| CSS `/_next/static` (cache froid) | 50 | **34,5 req/s** | 1 202 ms | 2 385 ms | 0 |
| Guide, requête seule après test | 1 | — | — | 453 ms (TTFB 413 ms) | 0 |

Transfert réel : guide **143 Ko** (gzip depuis 1,13 Mo), bestiaire **351 Ko** (gzip depuis 4,0 Mo),
CSS **72 Ko** (gzip depuis 614 Ko). Aucun `5xx`, aucun timeout ; la bêta est restée `healthy`.

**Lectures.**
- Le guide **sature vers 2,5 req/s** : augmenter la concurrence ne fait que gonfler la latence.
  C'est un coût de **rendu/sérialisation** (536 quêtes, 1,13 Mo de HTML), pas un manque de bande passante.
- L'accueil tient 8× mieux (146 Ko) : le poids de la page est le facteur dominant.
- Le CSS en cache froid plafonne à 34,5 req/s : Node **compresse chaque réponse** ; des assets
  précompressés/Caddy amélioreraient ce point.
- Le serveur dégrade proprement (file d'attente), mais l'utilisateur attend 8–10 s.

**Sentry (7 jours, transactions dashboard).**

| Page | p95 | Moyenne | Volume |
|---|---:|---:|---:|
| `/dashboard/:guildId/quetes-dofus` | 2 029 ms | 330 ms | 160 |
| `/dashboard/:guildId/profile` | 1 531 ms | 304 ms | 110 |
| `/dashboard/:guildId/services` | 1 029 ms | 181 ms | 120 |
| `/dashboard/:guildId` | 836 ms | 243 ms | 1 980 |
| `/dashboard/:guildId/admin` | 596 ms | 200 ms | 630 |
| `/dashboard/:guildId/calendar` | 382 ms | 160 ms | 2 940 |

## 0 bis. Après P0 (bêta `02070473`, 20/11/2026)

Même protocole, `Accept-Encoding: gzip`, après déploiement de la PR #1476.

| Cible | Concurrence | Avant | Après | Gain |
|---|---:|---:|---:|---:|
| Guide Rush | 10 | 2,5 req/s | **3,2 req/s** | +28 % |
| Guide Rush | 25 | 2,5 req/s | **3,1–3,3 req/s** | +24–32 % |
| Guide Rush | 50 | 2,1 req/s | **2,4 req/s** | +14 % |
| Guide Rush | 100 | 1,6 req/s | **1,9 req/s** | +19 % |
| Accueil | 25 | 19,6 req/s | **21,9 req/s** | +12 % |
| CSS statique | 50 | 34,5 req/s | **69 req/s** | ×2 |

- Compression : `Content-Encoding: zstd` (**145 Ko**) ou gzip (**151 Ko**) ; avant, Node gzip faisait **143 Ko**.
  La taille est quasi identique : le gain P0 est **CPU** (compression sortie de Node), pas réseau.
- Un client qui n'envoie **que** `br` reçoit **1,13 Mo non compressé** (Caddy standard n'a pas Brotli) ;
  les navigateurs réels envoient `gzip`/`zstd`, donc le cas est théorique.
- L'accueil mesuré à **0,4 req/s** au premier passage était un artefact : la file du test 100 se vidait
  encore. Isolé, il est à **21,9 req/s**.
- Le guide reste **limité par le rendu** (2,4–3,3 req/s) : le seul vrai saut reste **P2** (statique/PPR + CDN).

## 1. Diagnostic

### 1.1 Public — tout est dynamique

- `src/proxy.ts:318-319` pose `Content-Security-Policy` **et** `x-nonce` dans les en-têtes de requête
  sur toutes les routes de page (matcher `:365`). Next **16.4.6** lit ce nonce
  (`get-script-nonce-from-header.js` : `content-security-policy` **ou** `-report-only`) et ne peut
  donc pas pré-rendre la page.
- `src/app/layout.tsx:150-165` : `auth()`, `db.platformConfig.findFirst`, `headers()`, `getServerLocale()`
  en **séquence** ; 8 polices Google déclarées globalement (dont 2 publiques scopées `.registre`).
- `src/app/layout.tsx:171` : `ThemeProvider nonce` (script inline `next-themes`) ;
  `:173` : `AuthProvider session` (session passée au client).
- `src/app/guides/rush-sylvestre/page.tsx:72-74` : `auth()`, `getUserContext()`, `getServerI18n()` ;
  `:107` : `headers()` ; `:152` : `<JsonLd nonce>` (script inline).
- Conséquence : les **12** pages qui déclarent `export const revalidate` sont rendues dynamiquement
  (`Cache-Control: private, no-store`) ; aucun cache HTML partagé, aucun CDN.

### 1.2 Dashboard — dynamique normal, mais gaspillages

- `dashboard/[guildId]/layout.tsx:61-67` : 5 appels en parallèle à chaque navigation
  (`getUserContext`, `getGuildHeaderData`, `getUserGuilds`, `getGuildModules`, `getPlatformConfig`).
- `getPlatformConfig()` (`platform-config-actions.ts:21-30`) refait une lecture DB non cachée, alors que
  le layout racine lit déjà `platformConfig` : **deux lectures par page**.
- `getUserGuilds()` (`user-actions.ts:1518`) fait `auth()` + une requête profils/guildes, sans `cache()`.
- `donationsEnabled` (`layout.tsx:69`) est calculé mais **jamais utilisé**.
- `loading.tsx` du dashboard est un **spinner** (`backdrop-blur`, `font-bold`) et non un squelette.
- Illustration calendrier `calendar_dungeon_farm.png` : **913 Ko** (Sentry : 1,3 s p95 sur l'accueil).
- `getGuildModules` est déjà mémoïsé en mémoire (`module-actions.ts:96-113`) ; la requête `modules`
  supplémentaire (`layout.tsx:302-305`) sert le **brut** à l'onboarding — ne pas exposer `readGuildModules`
  (pas d'auth) comme action serveur.

### 1.3 Ce qui n'est pas le problème

- gzip est **actif** (Next, `compress` par défaut) ; les assets ont `max-age=31536000, immutable` ;
  HTTP/3 est actif ; le `no-store` du dashboard est **correct** (isolation RBAC/multi-guilde).

## 2. Décisions actées

1. **`platformConfig`** : cache **par requête** (`cache()` React) uniquement. Pas de Redis/TTL :
   le mode maintenance doit couper immédiatement les sessions déjà ouvertes.
2. **Données utilisateur** : jamais de cache partagé. `cache()` par requête, ou clé `userId` explicite.
   L'ancien `revalidate: 30` du portail fuyait la liste de guildes entre comptes (commentaire du code).
3. **Public statique** : ce n'est pas un patch. Il faut traiter **4 couches** (proxy, layout, page,
   session) **et 2 scripts inline** (thème `next-themes`, JSON-LD) avant d'espérer un ISR/PPR.
4. **Compression** : `compress: false` dans Next **et** `encode zstd gzip` dans Caddy, livrés ensemble.
   Sinon on sert des réponses non compressées.
5. **CSP en production** (#1485) : seule l'origine **exacte** du relais Dofusbook est autorisée
   (`relayOrigin`, déduite de `DOFUSBOOK_CF_WORKER_URL`). `https://*.workers.dev` est **réservé au
   dev/test** : en prod, le wildcard ouvrirait une exfiltration vers n'importe quel Worker tiers.
   Corollaire ops : en production, `DOFUSBOOK_CF_WORKER_URL` doit être posée, sinon le navigateur est
   bloqué dès `CSP_ENFORCE=true`.

## 3. Lots

| Lot | Contenu | État |
|---|---|---|
| **P0** (ce lot) | Caddy `encode zstd gzip` + Next `compress: false` ; `cache()` sur `getPlatformConfig` et `getUserGuilds` ; retrait de `donationsEnabled` mort ; squelette de chargement ; verrou de config | livré (PR #1476) |
| **P1** | **P1-1** spans serveur (livrée, #1479/#1480) ; **P1-2** images (livrée, #1482) ; **P1-3** cache public guide/bestiaire avec tags ; **P1-4** cache cross-request dashboard **si la mesure le justifie** (`getUserContext`/`getUserGuilds`) ; **B-1/B-2** dashboard : id + calendrier en une lecture (livrée, #1483/#1484) ; **B-3** profil allégé + TTL stats 3 min + `proxy-image` `fs.promises` (livrée, ce lot) | en cours |
| **P2** | Public statique/PPR : proxy sans nonce public, layout public/privé, page sans `auth`/`headers`, hash pour thème + JSON-LD, session côté client ; puis ISR | **cadré (§6)**, à exécuter |
| **P3** | CDN/WAF (Cloudflare ou EU), cache HTML anonyme, DPA/RGPD, RUM/k6 | **cadré (§6.3)**, décision CDN à prendre |

### 3.1 P1-1 — spans serveur du dashboard (20/11/2026)

But : **nommer** les secondes du dashboard avant de cacher quoi que ce soit. Sentry instrumente
la requête HTTP et le `proxy`, mais **pas** les appels d'un layout RSC ; sans span explicite,
« Traces » ne dit pas lequel des six appels porte le temps.

| Span (`dashboard/[guildId]/layout.tsx`) | Couvre |
|---|---|
| `dashboard.layout.getUserContext` | Redis → config guilde → bannissements → 3 appels Discord |
| `dashboard.layout.getGuildHeaderData` | en-tête : config + 2 `count` — cache mémoire 60 s |
| `dashboard.layout.getUserGuilds` | liste des guildes du compte — **BDD à chaque requête** |
| `dashboard.layout.getGuildModules` | modules — cache mémoire 30 s |
| `dashboard.layout.getPlatformConfig` | singleton plateforme — **BDD à chaque requête** |
| `dashboard.layout.getUpcomingGuildEvents` | promesse **streamée** vers `TopNav` |

Sous-spans : `userContext.redis.get`, `userContext.guildConfig.read`, `userContext.discord.fetch`,
`userGuilds.query`, `guildHeader.guildConfig.read`, `guildHeader.counts`,
`guildModules.guildConfig.read`, `platformConfig.read`.

- **Prisma est déjà tracé automatiquement** : une trace bêta du 20/11 montre
  `prisma:client:operation`, le SQL et `pg-pool.connect` — Prisma 7 émet ses spans OTel,
  `@prisma/instrumentation` est inutile. Sur 1 h, `pg-pool.connect` = p50 **1,1 ms**,
  p95 **82 ms** (max 981 ms) : l'attente de pool n'explique pas les 2 s en général.
- **Piège RSC corrigé** : dans le rendu d'un layout, le SDK Next isole la requête dans un
  scope **sans client** (`commonObjectToIsolationScope` → `new Scope()`) ; `Sentry.startSpan`
  rendait donc un span **non enregistré** (zéro donnée en bêta le 20/11). Le client rendu par
  `Sentry.init` est **enregistré au démarrage** (`src/lib/perf-client.ts`) et `ensureSentryClient()`
  le rattache au scope courant avant de démarrer le span.
- **Première lecture d'une trace (bêta, 20/11)** : la transaction `GET /dashboard/[guildId]`
  fait **1 964 ms** ; `getUserContext` touche Redis (`user:ctx…`, **3,9 ms**) et **n'appelle
  pas Discord** (aucun `http.client` vers discord.com) ⇒ le layout n'est pas le coût principal.
  Le `render route` porte ~20 opérations Prisma, dont plusieurs à **600–1 000 ms** — c'est là
  que la suite devra regarder.
- **Aucun `guildId` dans un nom de span** (cardinalité bornée, aucune donnée de guilde côté
  Sentry) ; verrouillé par `tests/unit/perf-span.test.ts`.
- **POST > 1 s (Sentry 7 j, sous-ensemble `span.duration:>1000`)** : `POST /dashboard/[guildId]/quetes-dofus/guide/[slug]`
  (**100** événements), `…/profile` (**80**), `…/galerie-stuff` (20), `…/missions` (10) — ce sont des
  **server actions** (POST sur l'URL de la page). Le layout est re-rendu à chaque action : les six
  spans couvrent donc la part « re-rendu » du POST ; le temps du handler lui-même reste hors de ce lot.
- **Lecture après déploiement bêta** (correctif #1480 : client Sentry rattaché au scope RSC) :
  filtrer `GET /dashboard/[guildId]`, comparer le p95 de
  chaque span. `tracesSampleRate` serveur = **5 %** ; la route dashboard a reçu **1 980**
  transactions sur 7 jours (§0), soit ≈ **280/jour** — de quoi trancher sans changer le taux.
- **Correction de diagnostic** : `getGuildHeaderData` (60 s, `guild-actions.ts:21-22`) et
  `getGuildModules` (30 s, `module-actions.ts:97-100`) ont déjà un cache mémoire, et
  `getUserGuilds`/`getPlatformConfig` un `cache()` par requête (P0). Le cache cross-request
  restant à trancher est donc **`getUserContext`** (déjà Redis 60 s) et la requête `getUserGuilds`
  — la mesure P1-1 décide, pas la théorie.

### 3.2 P1-2 — images servies à la taille d'affichage (21/11/2026)

Objectif : ne plus envoyer au navigateur les PNG source pleine résolution. Les **mêmes fichiers**
restent la source des embeds Discord (`calendar-event-images.ts`), seul le rendu change.

| Source | Taille | Rendu | WebP (q75) |
|---|---:|---|---:|
| `calendar_kralamour.png` | 8,2 Mo | 512 px | **31 Ko** |
| `calendar_dungeon_farm.png` | 892 Ko | 512 px | **47 Ko** |
| `calendar_autres.png` | 2,0 Mo | 512 px | **23 Ko** |
| `missions/songes.png` | 1,3 Mo | 32 px | **< 1 Ko** |
| `dofus-missions-thumb.png` | 1,08 Mo | 144 px | **7 Ko** |
| `Roublard.png` | 1,6 Mo | 800 px | **84 Ko** |

- `event-card` et `raid-hero-banner` : `<img>` → `next/image` (`fill` / 56 px) ;
  `SongesPicto` : 16–32 px ; `mission-settings` : 144 px ; `BombGame` : 800 px.
- Le poids réel dépend du viewport (`sizes`), mais l'ordre de grandeur est **÷20 à ÷100**.
- Reste : `logo-v2.png` (**170 Ko**) sert de favicon/manifest — à remplacer par des icônes
  32/192 px ; ce n'est pas un poste LCP, donc hors de ce lot.

### 3.3 Dashboard — id de guilde résolu une fois (21/11/2026)

La page d'accueil lisait `GuildConfig` **5 à 6 fois** pour le même `id` (calendrier, raid,
activité, présence, sondages). `src/server/guild-id.ts` le résout désormais **une fois par
requête** (`cache()` React) et le mémorise **5 min** (id seul, `null` non mémorisé).
`getUpcomingEvents`, `getActiveRaid`, `getUnifiedGuildActivity`, `getPolls` et la présence
utilisent cette source unique — **4 lectures en moins** par rendu à froid, sans changer les
gardes ni les filtres.

Reste identifié pour un prochain lot : `GuildEvent` est encore lu **3 fois** (événements de la
semaine, raid actif, focus) — **traité en B-2 (§3.4)**.

### 3.4 Dashboard — calendrier lu une fois (B-2, 21/11/2026)

La page lisait `GuildEvent` **3 fois** (événements de la semaine, raid actif, focus 24 h).
`getDashboardCalendar` fait **une** requête (publiés non terminés : semaine ∪ prochaines 24 h ∪
raids commencés avant), puis la règle pure `src/lib/dashboard-calendar.ts` dérive les trois
résultats. Le focus est **préchargé** dans `getDashboardFocus` (`prefetchedEvent`), qui ne requête
plus. **2 requêtes `GuildEvent` en moins** par rendu, et la carte Focus n'est plus une étape
séparée après le `Promise.all`.

### 3.5 Dashboard — profil allégé et TTL des statistiques (B-3, 21/11/2026)

La page d'accueil appelait `getUserProfile` : `user`, `skins`, `roleGrants` (+ `role`),
`serviceListing` actifs et `achievementSubmission` en attente — **4 lectures** pour un rendu qui ne
lit que `hasSeenWelcome`, `availability` et `pseudoDofus`. `getUserProfileSummary` fait désormais
**une** lecture `UserProfile` avec un `select` borné (`DASHBOARD_PROFILE_SUMMARY_SELECT`, verrouillé
par `tests/unit/dashboard-profile-summary.test.ts`). Les autres écrans (profil, planning, missions)
gardent `getUserProfile`.

`getGuildStats` passe d'un TTL Redis de **60 s à 180 s** (`GUILD_STATS_CACHE_TTL_SECONDS`) : ce sont
des agrégats de **guilde**, jamais personnels ; la clé reste `guild:stats:<guildId>`
(`tests/unit/guild-stats-cache.test.ts`). Aucune invalidation ciblée n'existait auparavant : le TTL
est la seule borne.

`proxy-image` : `readdirSync`/`statSync`/`readFileSync`/`writeFileSync` remplacés par
`fs.promises` dans un handler déjà asynchrone (plus de blocage de l'event loop sur le cache disque).

Reste B-3 : `EXPLAIN ANALYZE` sur les requêtes à **600–1 000 ms** de la trace, **à chaud** (le p95
`pg-pool.connect` est 82 ms ; la trace à 1,96 s était peut-être un démarrage à froid), puis index
composites si la mesure le confirme.

### 3.6 P3 — pré-requis avant un CDN (décision **D8**, rien n'est déployé)

1. **Origine réelle des clients** : Caddy `trusted_proxies` + `CF-Connecting-IP`, puis `{client_ip}`
   pour `X-Real-IP`, `X-Forwarded-For` et la clé du rate-limit. Sans ça, tous les visiteurs
   partagent l'IP de l'edge → **429 global**.
2. **WAF — exemptions explicites** : `/api/discord/interactions` (Discord < 3 s), `/api/cron/*`
   (les crontabs appellent `beta.sigilos.fr`), `/api/webhooks/kofi|sentry`. Bot Fight Mode **off**
   sur le plan gratuit, ou exceptions.
3. **Cache rules** : public anonyme seulement ; **bypass** `/dashboard/*`, `/api/*`, `/god/*`,
   cookie de session, POST. Le code envoie déjà `private, no-store` sur le privé.
4. **CSP** : conserver l'origine **exacte** du relais (décision 5 du §2) ; `*.workers.dev` en
   dev/test uniquement.
5. **Purge** : appel API CDN depuis les actions de contenu (ou TTL court) pour que le guide se mette
   à jour.
6. **CORS Workers** : remplacer `Access-Control-Allow-Origin: *` par `https://sigilos.fr` /
   `https://beta.sigilos.fr` (`wrangler deploy`, côté mainteneur).
7. **Bascule bêta d'abord**, nuage orange ; rollback = nuage gris. Puis RUM/k6 (budgets CWV).

## 4. Protocole de test de charge

```bash
# Guide, 10 s, palier unique (remplacer 10 par 25/50/100)
npx autocannon -c 10 -d 10 -H "Accept-Encoding: gzip" \
  -H "User-Agent: SigilOS-loadtest/1.0" \
  https://beta.sigilos.fr/guides/rush-sylvestre

# Accueil et asset statique (cache froid)
npx autocannon -c 25 -d 10 -H "Accept-Encoding: gzip" https://beta.sigilos.fr/
npx autocannon -c 50 -d 10 -H "Accept-Encoding: gzip" \
  https://beta.sigilos.fr/_next/static/chunks/<hash>.css
```

- **Légitime** : cible possédée, **bêta** uniquement, rampe courte, User-Agent identifiable,
  arrêt si erreurs, heure creuse. Jamais de service « stresser/booter ».
- Le rate-limit Caddy est **3000 req/min par IP** (50/s) : à 2,5 req/s on reste dessous ; au-delà,
  désactiver temporairement le rate-limit ou multiplier les IP, sinon les `429` faussent la mesure.
- **Objectif P2** : guide à 100 connexions, p97,5 < 1 s, servi par le cache ; origine quasi inactive.

## 5. Non-goals

- Aucune migration Prisma.
- Aucun changement de CSP/`proxy.ts` en P0.
- Aucun cache partagé de données utilisateur.
- Aucun CDN en P0.

## 6. P2/P3 ÔÇö plan d'ex├®cution (public cacheable + CDN)

> **But** : servir les pages **publiques anonymes** depuis un HTML pr├®par├® (ISR/PPR), puis depuis un
> CDN. Le dashboard reste dynamique (donn├®es personnelles). **Crit├¿re d'acceptation** : guide ├á
> 100 connexions, p97,5 < 1 s, origine quasi inactive ; z├®ro r├®gression th├¿me/SEO/connexion/s├®curit├®.

### 6.1 Les trois verrous (mesur├®s)

| ├ëtage | Fichier | Ce qui force le dynamique |
|---|---|---|
| Proxy | `src/proxy.ts:314-319` | `Content-Security-Policy` + `x-nonce` sur **toutes** les routes ; Next 16 lit le nonce (`getScriptNonceFromHeader`) ÔåÆ rendu dynamique m├¬me si le layout est propre |
| Coque | `src/app/layout.tsx:154-167` | `auth()` + `getPlatformConfig()` (parall├¿les), puis `headers()` + `getServerLocale()` (s├®quentiels) ; `ThemeProvider nonce` et `AuthProvider session` |
| Page | `src/app/guides/rush-sylvestre/page.tsx` | `auth()`, `getUserContext()`, `getServerI18n()`, `headers()`, `<JsonLd nonce>` |

Un seul de ces verrous suffit ├á interdire l'ISR : les trois doivent tomber dans le m├¬me lot.

> ÔÜá´©Å **Maintenance** : `getPlatformConfig` reste en cache **par requ├¬te** (pas de TTL/Redis) ÔÇö le mode
> maintenance doit couper imm├®diatement une session ouverte. Si un cache partag├® est ajout├® un jour,
> il faudra l'invalider dans l'action God qui bascule `maintenanceMode`.

### 6.2 Ordre d'ex├®cution

| ├ëtape | Travail | Fichiers | Preuve |
|---|---|---|---|
| **2.1 Cadrage CSP** | Choisir hash fixe vs `strict-dynamic` ; inventorier les scripts inline (th├¿me, JSON-LD) ; ├®crire la d├®cision | doc | d├®cision + liste des scripts |
| **2.2 Proxy** | Routes publiques **sans nonce** (CSP hash/strict-dynamic) ; dashboard inchang├® | `src/proxy.ts` | test en-t├¬tes : public sans `x-nonce`, dashboard avec ; CSP valide |
| **2.3 Coque** | Sortir `auth/headers/locale/platformConfig` de la coque publique ; session/th├¿me c├┤t├® client ; dashboard garde son layout | `src/app/layout.tsx`, route group public (spike 1ÔÇô2 h avant) | test : page publique sans API dynamique ; dashboard inchang├® |
| **2.4 Page publique** | Retirer `auth/getUserContext/getServerI18n/headers/JsonLd nonce` ; ├®tat connect├® en composant client ; JSON-LD statique/hash | `guides/rush-sylvestre/page.tsx` | `Cache-Control: public, s-maxage=ÔÇª` ; th├¿me + bouton connexion OK |
| **2.5 Scripts inline** | Th├¿me `next-themes` et JSON-LD en hash (ou externalis├®s) | layout + `JsonLd` | clair/sombre sans flash ; JSON-LD valide (Rich Results) |
| **2.6 ISR/PPR + charge** | `revalidate`/`use cache` sur les pages publiques ; v├®rifier `revalidateRushContent` ; autocannon 10/50/100 | pages + tests | 100 conn., p97,5 < 1 s ; contenu ├á jour apr├¿s action |

**Rollback** : chaque ├®tape est une PR ind├®pendante ; un `git revert` suffit. Aucune migration.

### 6.3 P3 ÔÇö CDN (duo toi + moi)

| Qui | Action | Quand |
|---|---|---|
| **Toi** | Choisir Cloudflare **ou** un acteur EU ; compte/zone ; DPA, politique de confidentialit├®, cookies | avant 3.2 |
| **Toi** | Passer le DNS en proxy (nuage orange) sur **beta** d'abord ; rollback = nuage gris | 3.2 |
| **Moi** | R├¿gles de cache (public anonyme seulement), bypass `/dashboard/*`, `/api/*`, cookie de session ; IP r├®elle (`CF-Connecting-IP`), origine verrouill├®e, WAF ; doc + tests | 3.2 |
| **Moi** | Purge ├á la publication (API CDN depuis les actions de contenu) + doc d'ops | 3.2 |
| **Toi** | Valider sur b├¬ta : OAuth Discord, WebSocket, webhooks, th├¿me, connexion | 3.2 |

**Garde-fou** : le CDN ne doit **jamais** cacher une r├®ponse portant un cookie de session ou une
route `/dashboard|/api|/god`. Le code envoie `private, no-store` sur ces routes ; la r├¿gle CDN le
double (d├®fense en profondeur).

### 6.3 bis ÔÇö Effets de bord v├®rifi├®s (Workers, IP r├®elle, WAF)

- **Workers Cloudflare** (`dofusbook-proxy`, `dofus-ladder-proxy`, `sigil-ladder-ankama`) :
  **aucune route sur `sigilos.fr`** (pas de `routes` dans les `wrangler.toml`) ; ils vivent sur
  `*.workers.dev`. Les appels VPS ÔåÆ Worker (sortants), navigateur ÔåÆ Worker (`/s/:id`, CORS `*`) et
  le cache interne du Worker (`caches.default`) sont **ind├®pendants** du CDN du site. Les pages
  ladder/stuff lisent la base/Redis, pas les Workers en direct : le cache HTML ne change que la
  fra├«cheur (TTL).
- **CSP** : `connect-src` doit conserver `https://*.workers.dev` + l'origine du relais
  (`DOFUSBOOK_CF_WORKER_URL`) quand on passe au hash/strict-dynamic ÔÇö sinon l'aper├ºu Dofusbook casse.
- **IP r├®elle** : Caddy pose `X-Real-IP {remote_host}` et **├®crase** `X-Forwarded-For` avec
  `{remote_host}`. Derri├¿re Cloudflare, c'est l'IP de l'edge : le `rate_limit` Caddy
  (`key {remote_host}`) et le limiteur de `src/proxy.ts` (`x-real-ip`) mettraient **tous les
  visiteurs dans le m├¬me seau** ÔåÆ 429 global. Pr├®requis : `servers { trusted_proxies ÔÇª client_ip_headers CF-Connecting-IP }`
  (Caddy ÔëÑ 2.7), puis `{client_ip}` pour `X-Real-IP`/XFF et la cl├® du rate-limit.
- **Serveur ÔåÆ serveur** : `/api/discord/interactions` (Discord), `/api/cron/*` (les crontabs
  appellent `https://beta.sigilos.fr/...`), `/api/webhooks/kofi|sentry` traversent le WAF. Le Bot
  Fight Mode / un challenge casserait Discord (< 3 s) et les crons : r├¿gles de **skip WAF** par
  chemin, ou crons en localhost/Tunnel. ├Ç tester sur la b├¬ta.
- **Aper├ºu Dofusbook** : le navigateur renvoie le JSON via `storeClientDofusbookPreview` (server
  action POST) ÔåÆ bypass cache POST/API/cookie, WAF standard ; tester un import sur la b├¬ta.
- **WebSocket / OAuth** : `/socket.io/*` et `/api/auth/*` sans cache ; valider sur la b├¬ta.

### 6.4 Checklist avant merge (2.2 ÔåÆ 2.6)

- [ ] Th├¿me clair/sombre sans flash, sur guide + accueil.
- [ ] JSON-LD valide (Rich Results) et pr├®sent dans le HTML pr├®par├®.
- [ ] Bouton ┬½ Se connecter / Mon compte ┬╗ juste (anonyme et connect├®).
- [ ] Aucune r├®ponse publique ne contient de donn├®e personnelle.
- [ ] CSP : aucun script bloqu├® (console propre), nonce absent du public, pr├®sent sur le dashboard.
- [ ] `connect-src` garde `https://*.workers.dev` + l'origine du relais Dofusbook.
- [ ] Deux IP clientes distinctes ÔåÆ rate-limit par IP r├®elle (pas par IP d'edge Cloudflare).
- [ ] Discord interactions + un cron + un webhook passent sans challenge WAF.
- [ ] Import Dofusbook sur la b├¬ta OK ; WebSocket et OAuth Discord OK derri├¿re le CDN.
- [ ] `npm run test:run`, `tsc`, `lint`, verrou `caddy-compression`.
- [ ] Charge guide 10/50/100, 0 `5xx`, p97,5 < 1 s ├á 100.

### 6.5 D├®cisions ├á prendre (toi)

1. **CDN** : Cloudflare ou EU ? (DPA/RGPD)
2. **Fra├«cheur** : combien de secondes/minutes un contenu public peut rester en cache apr├¿s une
   modification ? (les actions revalident d├®j├á ; le CDN ajoute son TTL)
3. **Fen├¬tre** : passage DNS/CDN sur **b├¬ta**, heure creuse, rollback en 1 clic (nuage gris).

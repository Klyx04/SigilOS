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

## 3. Lots

| Lot | Contenu | État |
|---|---|---|
| **P0** (ce lot) | Caddy `encode zstd gzip` + Next `compress: false` ; `cache()` sur `getPlatformConfig` et `getUserGuilds` ; retrait de `donationsEnabled` mort ; squelette de chargement ; verrou de config | livré (PR #1476) |
| **P1** | Cache cross-request des données **publiques** (guide, bestiaire) avec tags ; header/modules de guilde en Redis 30–60 s + invalidation ; image calendrier en WebP/`next/image` | à cadrer |
| **P2** | Public statique/PPR : proxy sans nonce public, layout public/privé, page sans `auth`/`headers`, hash pour thème + JSON-LD, session côté client ; puis ISR | à cadrer |
| **P3** | CDN/WAF (Cloudflare ou EU), cache HTML anonyme, DPA/RGPD, RUM/k6 | à décider |

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



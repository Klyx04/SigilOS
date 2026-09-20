# Galerie de stuff Dofusbook — relais signé, bake navigateur & assets internes

> **État au 18/09/2026.** Concerne : `/dashboard/[guildId]/galerie-stuff`, le profil
> (`builds-card`, `add-build-modal`), la modale `DofusbookPreview`, les routes
> `/api/dofusbook/proxy/[id]` et `/api/og/build/[id]`, le worker
> [`cloudflare-workers/dofusbook-proxy`](../cloudflare-workers/dofusbook-proxy/README.md)
> et tous les assets Dofus (items / sorts / monstres).

---

## 1. Le problème : le WAF de Dofusbook

`dofusbook.net` est derrière **Cloudflare bot-management**. Diagnostic complet du
18/09/2026 (tous les clients possibles testés) :

| Client testé | Résultat |
|---|---|
| Node / undici (le VPS) | ❌ 403 « Sorry, you have been blocked » |
| Playwright headless / headful / Chrome réel piloté | ❌ 403 (même page de blocage, 4 554 o) |
| **Égress d'un Worker Cloudflare** (`test-dofusbook.*.workers.dev`, déjà déployé) | ⚠️ 403 **intermittent** — challenge par requête : les MISS tombent, les HIT passent (mesuré le 18/09, §5) |
| `robots.txt` | ✅ (seul chemin qui passe) |
| **Vrai navigateur (Chrome) depuis une IP résidentielle** | ✅ 200 |
| `wrangler dev` (workerd) sur une machine résidentielle | ✅ 200 |

➡️ **Conséquence** : un serveur (VPS) est bloqué **à tous les coups**, et l'égress
Cloudflare l'est **par intermittence** (le challenge dépend de la requête). Trois parades
sont donc implémentées : le **cache 24 h des succès côté worker** (un `HIT` ne retouche
jamais Dofusbook), le **bake par le navigateur du membre**, et le **relais sur machine
résidentielle** en secours.

---

## 2. Architecture

```
        ┌────────────────── le NAVIGATEUR du membre ──────────────────┐
        │ 1. server action getDofusbookClientFetchUrl() → URL SIGNÉE  │
        │ 2. fetch(URL signée) ──────────────────────────────┐        │
        └────────────────────────────────────────────────────┼────────┘
                                                             ▼
   ┌──────────────┐  3. GET /{id}  (X-SigilOS-Key)  ┌──────────────────────────────┐
   │  VPS SigilOS │ ───────────────────────────────▶│  worker Dofusbook (edge CF    │
   │  (Next.js)   │                                 │  OU `wrangler dev` résidentiel│
   │              │ ◀──── JSON brut ─────────────── │  GET /s/{id}?e&t (HMAC 5 min) │
   └──────────────┘                                 └───────────────┬──────────────┘
          ▲                                                          │ 4. seul émetteur
          │ 5. processDofusbookRawData + persist / cache Redis        ▼
          └───────────────────────────────────────────  www.dofusbook.net/api/stuffs/…
```

**Le VPS ne parle jamais à `dofusbook.net`.** Il signe, il traite, il persiste.

### Routes du worker

| Route | Auth | Appelée par | Cache |
|---|---|---|---|
| `GET /:id` | header `X-SigilOS-Key` | `getDofusbookPreview()` (serveur) | Cache API, clé stable, **succès uniquement** |
| `GET /s/:id?e=<exp>&t=<hmac>` | jeton HMAC en query | **navigateur** (bake galerie/modale) | idem (clé indépendante du jeton) |
| `OPTIONS` | — | CORS preflight | — |

Jeton : `HMAC_SHA256(secret, "<id>.<exp>")` en hex, **TTL 300 s**, généré par
`src/lib/dofusbook-sign.ts`. L'origine n'entre **pas** dans la signature ⇒ changer
l'hébergement du relais ne casse aucun jeton.

### Les deux flux de récupération

**1. Bake navigateur** (nominal depuis le 18/09) — `src/lib/dofusbook-client-bake.ts`,
`bakeDofusbookFromBrowser(url, guildId)` : `getDofusbookClientFetchUrl()` (server action,
signature seule) → `fetch()` du navigateur sur `/s/{id}` → `storeClientDofusbookPreview()`
(server action) qui **valide** (`isUsableDofusbookRawPayload`), traite et **enregistre
dans le profil du propriétaire** (`persisted`), ou renvoie les données sans persister pour
un non-propriétaire. Utilisé par la galerie (`gallery-client.tsx`) et la modale
(`dofusbook-preview.tsx`).

**2. Flux serveur** — `getDofusbookPreview(url, force)` (`src/server/actions/dofusbook-actions.ts`) :
cache Redis 24 h (`sigilos:dofusbook:v12:<id>`, invalidé si la donnée n'a pas d'items) →
worker `/{id}` → traitement. Le **fallback VPS direct est désactivé** par défaut
(`DOFUSBOOK_ALLOW_VPS_FALLBACK=false`). Utilisé par l'ajout/édition d'un lien de build
(`profile-actions.ts`).

---

## 3. Configuration

| Variable (app SigilOS) | Rôle | Défaut |
|---|---|---|
| `DOFUSBOOK_CF_WORKER_URL` | base du relais (`https://<worker>` ou `https://<tunnel>`) | — (obligatoire pour tout refresh) |
| `DOFUSBOOK_WORKER_SECRET` | **doit être identique** au `WORKER_SECRET` du worker (route serveur) | — |
| `DOFUSBOOK_WORKER_SIGN_SECRET` | secret du jeton `/s/{id}` | repli sur `DOFUSBOOK_WORKER_SECRET` |
| `DOFUSBOOK_ALLOW_VPS_FALLBACK` | autorise l'appel direct VPS → dofusbook.net | `false` |

| Variable (worker Cloudflare) | Rôle |
|---|---|
| `WORKER_SECRET` | secret de la route serveur `/:id` (fail-closed si absent) |
| `WORKER_SIGN_SECRET` | secret du jeton `/s/:id` (défaut : `WORKER_SECRET`) |

**CSP** : `connect-src` suit automatiquement `DOFUSBOOK_CF_WORKER_URL`
(`dofusbookRelayOrigin()` dans `src/lib/csp.ts`) — aucun réglage en prod, et
`http://127.0.0.1:*` / `http://localhost:*` restent autorisés en dev.

---

## 4. Comportement selon l'état du relais

| Situation | Afficher la galerie | Icônes (items/sorts) | Ajouter / actualiser |
|---|---|---|---|
| Relais joignable | ✅ | ✅ (proxy interne, indépendant) | ✅ données fraîches |
| Relais éteint / injoignable | ✅ (previews en base + Redis) | ✅ | ⚠️ le lien est enregistré **sans preview** ; message clair, rien ne casse |
| Dofusbook bloque le relais (WAF) | ✅ | ✅ | ❌ `DOFUSBOOK_BLOCKED_MESSAGE` + disjoncteur (bail 15 min) |

Le disjoncteur (`src/lib/dofusbook-guard.ts`) est **partagé** entre la route proxy, la
modale et les server actions : un blocage détecté gèle les tentatives au lieu de marteler
Dofusbook.

Le **cache du worker** rend la mesure indolore : un succès est conservé **24 h**
(`Cache-Control: public, max-age=86400`) sous une clé **stable**
(`…/api/stuffs/dofus/public/<id>`), **partagée par les deux routes**. Un `HIT` ne
retouche pas Dofusbook : c'est instantané et immunisé au WAF. Seuls les `MISS` (premier
accès à un build, ou après 24 h) risquent le challenge.

Et le **bake navigateur n'est pas concerné par le disjoncteur** (il ne fait que
s'authentifier et limiter à 30 bakes/min) : même pendant les 15 min de gel, le bouton
« Actualiser » de la modale continue de fonctionner.

---

## 5. Exploitation

### Mode nominal — worker déployé (**aucune machine à laisser allumée**)

```bash
cd cloudflare-workers/dofusbook-proxy
npx wrangler deploy        # puis RÉGLER WORKER_SECRET : Cloudflare → Worker → Settings → Variables
```
Côté VPS : `DOFUSBOOK_CF_WORKER_URL=https://test-dofusbook.<compte>.workers.dev` +
`DOFUSBOOK_WORKER_SECRET`.

> **Relevé du 18/09/2026 (00:00 → 00:07 locales, bêta) — le WAF challenge par
> intermittence, et le cache fait le reste :**
> · `00:00:13` → `/{id}` sur un **MISS** : **403** (page de blocage Cloudflare) ⇒
>   disjoncteur 15 min + notif God (comportement attendu, aucune donnée perdue) ;
> · ~1 min plus tard → bake **navigateur** `/s/{id}` sur un MISS : **200** ✅ ⇒ le
>   payload part en cache worker **24 h** ;
> · ensuite → `/{id}` **et** `/s/{id}` : `200` · `X-Dofusbook-Status: 200` ·
>   `X-SigilOS-Cache: HIT`.
>
> Conclusion opérationnelle : **ce mode fonctionne seul, aucune machine à allumer**. Les
> rechutes sont ponctuelles et n'impactent que le **premier** accès à un build non encore
> caché (l'affichage, lui, reste servi depuis la base/Redis).

### Mode dépannage — relais local (`wrangler dev` + tunnel)

**Exige une machine allumée** (PC / boîtier à IP résidentielle) : pratique pour débloquer
la galerie immédiatement, **à ne pas considérer comme une architecture de prod**.

```powershell
# 1) le worker en local
cd cloudflare-workers/dofusbook-proxy; npx wrangler dev --port 8787

# 2) l'exposition HTTPS (URL aléatoire qui CHANGE à chaque redémarrage)
cloudflared tunnel --url http://127.0.0.1:8787

# 3) pointer l'app dessus dans .env.local (prioritaire, gitignoré)
#    DOFUSBOOK_CF_WORKER_URL=https://<...>.trycloudflare.com
```

### Diagnostic

```bash
# les 2 routes du relais + fail-closed + CORS en une commande
node --env-file=.env --env-file=.env.local scripts/check-dofusbook-relay.mjs 16582901

# logs live du worker
cd cloudflare-workers/dofusbook-proxy && npx wrangler tail
```

Pré-chauffe des icônes de sorts (évite les rafales au 1ᵉʳ affichage) : God → *Siphon
Données de Jeu* → « Pré-chauffer sorts de classes » / « Siphonner les grimoires »
(`public/uploads/assets-dofus/spells/*.webp`).

---

## 6. Limites connues

1. **WAF (intermittent)** — mesuré le 18/09/2026 : l'égress Cloudflare passe sur la très
   grande majorité des requêtes ; un `MISS` peut tomber sur la page de blocage (voir §5).
   Cache 24 h + bake navigateur + disjoncteur rendent le module exploitable **sans
   machine allumée**. Si le blocage devenait **permanent**, trois sorties : (a) machine à
   IP résidentielle (boîtier maison + tunnel stable), (b) **proxy résidentiel payant**
   côté VPS, (c) **accès/allowlist officiel Dofusbook** (seule solution durable).
2. **Liens courts `d-bk.net`** — `getDofusbookId()` résout la redirection `302` **depuis
   le serveur** ⇒ challenge Cloudflare ⇒ « Identifiant Dofusbook introuvable ». Les liens
   **complets** (`…/equipement/<id>`) fonctionnent (regex, zéro réseau). Correctif
   possible : route `/resolve` sur le worker (résolution depuis l'IP du relais).
3. **Images hors proxy** (`/api/assets-dofus/{monsters|items|spells}`) — cartes de donjons
   et icônes de métiers (`dofus-resolvers.tsx`, `OptimizedGuideAdminClient.tsx`) ;
   `dofus-resolvers.tsx` appelle en outre **l'API DofusDB depuis le navigateur**.

---

## 7. Changements livrés (batch du 18/09/2026)

### Relais & WAF
| Fichier | Changement |
|---|---|
| `cloudflare-workers/dofusbook-proxy/worker.js` + `README.md` | route serveur `/:id` (`X-SigilOS-Key`, fail-closed) et route navigateur `/s/:id?e&t` (HMAC 5 min) ; cache **succès uniquement** sur clé stable ; CORS `*` ; README d'exploitation |
| `src/lib/dofusbook-sign.ts` **(nouveau)** | `signDofusbookClientToken` / `verifyDofusbookClientToken` / `buildDofusbookClientFetchUrl` (TTL 300 s) |
| `src/lib/dofusbook-guard.ts` **(nouveau)** | disjoncteur Dofusbook partagé (ouverture sur 403/429/5xx, bail 15 min) |
| `src/lib/dofusbook-client-bake.ts` **(nouveau)** | bake navigateur : URL signée → fetch → validation → persistance propriétaire |
| `src/server/actions/dofusbook-actions.ts` | `getDofusbookClientFetchUrl()` (signature seule) ; `DOFUSBOOK_ALLOW_VPS_FALLBACK` (défaut `false`) ; surveillance #41bis (5 échecs ⇒ notif God) |
| `src/app/api/dofusbook/proxy/[id]/route.ts` | détection de blocage anti-bot (`describeFailure`), gating du fallback VPS, statuts 401/403/503 explicites |
| `src/lib/csp.ts` + `tests/security/csp.test.ts` | `connect-src` suit `DOFUSBOOK_CF_WORKER_URL` (relais tunnel/inclus en dev) |

### Galerie, profil, image OG
| Fichier | Changement |
|---|---|
| `galerie-stuff/gallery-client.tsx`, `_components/recent-stuff-gallery.tsx`, `profile/builds-card.tsx`, `profile/add-build-modal.tsx` | rafraîchissement via le **bake navigateur** (plus `refreshBuildMetadata` côté serveur) ; `guildId` transmis à `DofusbookPreview` (nécessaire à la persistance) |
| `src/server/actions/gallery-actions.ts` | `storeClientDofusbookPreview()` : validation (`isUsableDofusbookRawPayload`) + enregistrement dans le profil du propriétaire |
| `src/app/api/og/build/[id]/route.ts` | fin du hotlink `dofusbook.net/static/dist/items/{picture}-70.webp` (403) : icônes depuis les WebP internes siphonnés (`dofusbookItemIconId` + `ASSET_DIRS.items`) |

### Assets réels & détails de build
| Fichier | Changement |
|---|---|
| `src/lib/dofusbook-utils.ts` | `DOFUSBOOK_STAT_LABELS` (+ `rc`/`dc`/`dp` ancrés référentiel), `DOFUSBOOK_ITEM_ICON_URL_VERSION = 2` (contourne un placeholder figé 24 h), `levelHp` + `characteristics` (Total / Équipement / Base / Parcho) et `dofusbookCharacteristicRows()` |
| `src/lib/dofus-stats-theme.ts` | `THEME_BY_CODE` complété (`rc` = Ré Crit., `dc` = Dommages Critiques, `dp` = Dommages Poussée) |
| `src/components/dofus/dofusbook-preview.tsx` | icônes de stats officielles dans les bonus de **panoplie** ; tableau **Total / ⚡(+Puissance) / Base / Parcho** par caractéristique (infobulles détaillées) |
| `src/lib/dofus-image-url.ts` | `resolveDofusAssetImageUrl()` / `internalDofusDbImageUrl()` : toute URL DofusDB est réécrite vers `/api/assets-dofus/{type}/{id}` |
| `dofus-spells-tab.tsx`, `succes/SuccesTitanTab.tsx`, `dofus-quests/QuestChecklist.tsx` | fin des hotlinks navigateur → `api.dofusdb.fr` (57 requêtes vers DofusDB en moins sur l'onglet Sorts) |
| `src/lib/dofus-asset-siphon.ts`, `scripts/import-dofus-assets.cjs`, `scripts/purge-dofusbook-icon-cache.cjs` | siphon/pré-chauffe des assets + purge du cache d'icônes d'items |
| `.env.example`, `.gitignore` | section DOFUSBOOK documentée (réalité WAF, variables, fallback) ; `.dev.vars*` et `.wrangler/` ignorés |
| Tests | `tests/unit/dofusbook-sign.test.ts` (nouveau) + `dofusbook-utils`, `dofus-stats-theme`, `dofus-image-url`, `csp` |

---

## 8. Vérifications du batch

```
tsc --noEmit ......................................... 0 erreur
vitest run ........................................... 1645 tests / 153 fichiers ✅
eslint (fichiers modifiés) ........................... 0 erreur
relais (serveur /{id}, X-SigilOS-Key) ................ 200 · 42 619 o · items=16 · 295 ms
relais (navigateur /s/{id}, HMAC) .................... 200 · 42 619 o · 66 ms
fail-closed .......................................... 401 sans clé · 403 HMAC invalide
CORS ................................................. Access-Control-Allow-Origin: *
proxy assets (spells/12160?url=…) .................... 200 image/webp · 2 484 o · Cache 1 an · écrit sur disque
```



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
| `GET /:id?force=true` | header `X-SigilOS-Key` | `fetchBuildData(force)` (route proxy) | **contourné** : appel Dofusbook + remplacement de l'entrée (TTL 60 s) |
| `GET /s/:id?e=<exp>&t=<hmac>` | jeton HMAC en query | **navigateur** (bake galerie/modale) | idem (clé indépendante du jeton) |
| `GET /s/:id?e=…&t=…&force=1` | jeton HMAC en query | navigateur, bouton **Actualiser** | **contourné** (idem ci-dessus) |
| `OPTIONS` | — | CORS preflight | — |

Jeton : `HMAC_SHA256(secret, "<id>.<exp>")` en hex, **TTL 300 s**, généré par
`src/lib/dofusbook-sign.ts`. L'origine n'entre **pas** dans la signature ⇒ changer
l'hébergement du relais ne casse aucun jeton.

### Rafraîchissement explicite (`force`)

🐞 **Mesure du 25/10/2026** : le worker mettait **toute** réponse 2xx en cache 24 h sous une clé
**stable** et **ignorait** `force` — un build modifié sur Dofusbook (item retiré, jet changé)
restait donc figé jusqu'à 24 h, et la fiche continua de l'afficher après « Actualiser ». Le
serveur, lui, redatait `updatedAt` à chaque synchro (l'air « à jour » sans l'être).

- `force` est propagé de bout en bout : `DofusbookPreview` / galerie →
  `bakeDofusbookFromBrowser(url, guildId, { force })` → `buildDofusbookClientFetchUrl(id, { force })`
  (`&force=1`) → worker (pas de lecture du cache, `cf.cacheTtl: 0`, entrée remplacée avec une TTL
  de **60 s** pour ne pas marteler Dofusbook sur deux clics rapprochés).
- `storeClientDofusbookPreview()` renvoie `changed` : **`updatedAt` n'est écrit que si le payload
  produit a réellement changé**. L'UI affiche « Aucun changement côté Dofusbook » sinon.
- ⚠️ **Ops** : le worker doit être redéployé (`wrangler deploy` dans
  `cloudflare-workers/dofusbook-proxy`) — sinon le cache 24 h reste en place.

### Stats : ce que Dofusbook calcule (mesuré, pas deviné)

Vérité terrain = page Dofusbook **rendue** (Chromium) comparée au payload, sur le build
`22329554` (25/10/2026) :

| Stat | Règle mesurée | Exemple |
|---|---|---|
| Initiative | **Force + Agilité + Chance + Intelligence** (+ `ii`/`ini`) | 190+185+185+1323 = **1883** |
| Esquive PA/PM, Retrait PA/PM | `floor(Sagesse / 10)` + items + panoplies | 405 → **40** |
| Tacle, Fuite | `floor(Agilité / 10)` + items + panoplies | 185 → **18** |
| PV | `50 + niveau × 5` + Vitalité (items/base/parcho) | 1050 + 3353 = **4403** |
| Prospection | 100 + `floor(Chance / 10)` + items | **118** |

⚠️ L'ancien socle d'initiative `level × 5` (1000) était **inventé** : tout build affichait
1000. Codes Dofusbook : `ii` = initiative, `ic` = invocation (items **et** `cloths`), `rv` =
**Renvoi Dmg**, `rm`/`rd` = % Ré Mêlée/Dist, `deg` = **% Do Finaux**.

**Pas encore agrégé/affiché** : **Pods** (1950 sur ce build) — le payload ne porte aucun poids,
il faut joindre `GameItem.realWeight` (DofusDB) ; lot séparé.

**Ajouté le 25/10/2026** : `rc/rp/rm/rd/rv` sont désormais **agrégés**
(`resists.critique/poussee/melee/distance/renvoi`) et affichés sous les résistances élémentaires ;
`deg` = **% Do Finaux** ; la **fiche d'item** utilise les icônes réelles (`rm`/`rd`/`rv` mappées dans
`dofus-stats-theme.ts`) et **colore les malus en rouge** ; les **exo/over** affichent une **pastille
de rune** sur le slot (miniature + onglet Équipement).

### Règles de jeu (Dofus 3.7) — appliquées ou non

Sources : **MàJ 3.7 du 06/10/2026** (note officielle Ankama) + note de travail « Comprendre les
interactions d'équipement dans DOFUS » (25/10/2026), croisées avec les payloads réels.

| Règle | État |
|---|---|
| Panoplie **active dès 2 pièces** | ✅ appliqué (`equippedCount > 1`) |
| Le **palier courant remplace** le précédent (jamais d'addition) | ✅ appliqué (seul le plus haut palier atteint compte) |
| **Pièces distinctes** : le même objet porté 2× ne compte qu'une fois | ✅ appliqué (`Set` d'ids Ankama) |
| **Une seule Prysmaradite** (1ᵉʳ emplacement Dofus/Trophée) | ✅ appliqué côté serveur (`saveBuildVariant`, type résolu dans `GameItem`) |
| Trophée à condition « **< 2 panoplies** actives » | ✅ **appliqué** : arbre `Bonus de panoplies < 2` (DofusDude) évalué sur les panoplies actives (≥ 2 pièces distinctes) |
| Arme à deux mains vs bouclier (`twoHanded`) | ✅ **appliqué** côté serveur (colonne `GameItem.twoHanded`) |
| Conditions d'objet (`criterions` / `conditions`) | ✅ **appliqué** : arbre structuré (`GameItem.conditions`), évaluateur générique fail-closed, affichage + refus (client) et revalidation (serveur) |
| Bonus de panoplie **recalculés** quand une variante change une pièce | ⏳ le payload Dofusbook ne contient que le **palier actif** ⇒ impossible sans `GameItemSet` |

⚠️ Les guides antérieurs à la 3.7 comptent les **paliers** (« 3 pièces = 2 bonus ») : c'est
**périmé**. Le code applique la règle 3.7.

### Conditions d'équipement : source **structurée** (pas une liste de codes)

Mesures du 25/10/2026 : le DSL DofusDB (`criterions`) utilise des codes courts non documentés
(`CP<12|CM<6`, `pk<2`). **DofusDude** expose le même contenu en **arbre** avec des noms français :

```json
{ "relation": "or", "children": [
  { "condition": { "operator": "<", "int_value": 12, "element": { "name": "PA" } } },
  { "condition": { "operator": "<", "int_value": 6,  "element": { "name": "PM" } } } ] }
```

Sur les **4 095** équipements (264 portent une condition) : éléments `PA, PM, Vitalité, Sagesse,
Force, Intelligence, Chance, Agilité, Bonus de panoplies, Être abonné, Être niveau {0} ou plus,
Kamas, Niveau d'alignement` ; opérateurs `< = >` ; relations `and` / `or`.

- Évaluateur générique : `src/lib/dofus-conditions.ts` (rendu FR + évaluation contre un **build
  effectif** : PA, PM, PV, Sagesse/Force/Int/Chance/Agilité, **panoplies actives**, niveau).
- **Fail-closed** : un élément hors contexte d'un stuff (kamas, abonnement, alignement) ou un
  opérateur inconnu ⇒ `ok:false` (jamais deviné).
- Siphon : `scripts/siphon-item-conditions.mjs` (`--apply`) → `GameItem.conditions` (JSONB).
  Le DSL brut reste stocké dans `GameItem.criterions` (audit).
- Application : le sélecteur **affiche** la condition et **refuse** la sélection ; le serveur
  (`saveBuildVariant`) **revalide** (conditions, arme à deux mains vs bouclier, Prysmaradite).
  Le candidat ne se compte pas lui-même dans PA/PM (Heaume Oplate : +1 PA mais exige PA < 12).

### Icônes de stats : assets réels (siphonnés)

Dofusbook sert ses icônes de statistiques sous `/assets/img/elements/<code>.png` (mesuré au DOM le
25/10/2026 : la ligne « Ré Critique » utilise `<img src="/assets/img/elements/rc.png">`). Les six
icônes qui manquaient (ou qui tombaient sur le bouclier générique) ont été **siphonnées** dans
`public/assets/dofus/stats/` :

| Code Dofusbook | Fichier local | Thème |
|---|---|---|
| `rc` | `resCritique.png` | `criticalResistance` |
| `rp` | `resPoussee.png` | `pushResistance` |
| `rm` | `resMelee.png` | `meleeResistance` |
| `rd` | `resDistance.png` | `distanceResistance` |
| `rv` | `renvoi.png` | `damageReturn` |
| `deg` | `doFinaux.png` | `finalDamage` |

`node scripts/check-media-metadata.mjs` → **0 métadonnée** (règle « zéro empreinte »).

### Stats : deux codes Dofusbook par statistique

Les payloads actuels portent **`ii`** (initiative) et **`ic`** (invocation) — y compris dans
`cloths[].effects` (panoplies : `Panoplie de Danathor` = `ii+500@2`, `Panoplie de la Fosse` =
`ic+1@3`). `processDofusbookRawData` ne connaissait que `ini`/`invo` : l'initiative restait au socle
`level × 5` (1000 au lieu de 1788) et l'invocation à 1. Les deux codes sont désormais mappés
(verrou `dofusbook-sync-force`). Les codes `sp` (sort) et `at` (atout) **ne sont pas des stats** et
sont ignorés.


### Les deux flux de récupération

**1. Bake navigateur** (nominal depuis le 18/09) — `src/lib/dofusbook-client-bake.ts`,
`bakeDofusbookFromBrowser(url, guildId, { force })` : `getDofusbookClientFetchUrl()` (server action,
signature seule) → `fetch()` du navigateur sur `/s/{id}` → `storeClientDofusbookPreview()`
(server action) qui **valide** (`isUsableDofusbookRawPayload`), traite et **enregistre
dans le profil du propriétaire** (`persisted`), ou renvoie les données sans persister pour
un non-propriétaire. Utilisé par la galerie (`gallery-client.tsx`) et la modale
(`dofusbook-preview.tsx`) ; le bouton **Actualiser** passe `{ force: true }` (cf. § « Rafraîchissement
explicite »).

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



---

## 9. Bonus de panoplie recalculés dans une variante (26/10/2026)

Le payload Dofusbook ne contient que le **palier actif** d'une panoplie (`cloths[].effects[]`
avec `count`) : il ne permet donc **pas** de recalculer les bonus quand une variante remplace
une pièce. La source des paliers complets est **DofusDB** (`/item-sets`), siphonnée en base.

| Élément | Où |
|---|---|
| Référentiel (`id` = id DofusDB, `tiers`, `itemsIds`) | `GameItemSet` — migration additive `20270120000000_item_sets` |
| Siphon (940 panoplies, strip immédiat des objets imbriqués) | `src/lib/item-sets-siphon.ts` · `npm run siphon:item-sets` (`--apply` pour écrire) |
| Règle unique (≥ 2 pièces distinctes, palier le plus haut, jamais d'addition) | `src/lib/dofus-set-bonuses.ts` |
| Résolution serveur (2 requêtes bornées, par page de galerie) | `src/server/build-item-sets.ts` |
| Recalcul + refus | `applyVariantsToBuild(base, variants, itemSets)` |

**Mesures du 26/10/2026.** `GET /item-sets/242` (Danathor) : `effects` est un **tableau indexé
par palier** (`index = pièces − 1`), ligne = `{ from, characteristic, effectId }` ; `56 ko` par
panoplie (elle embarque ses objets complets) ⇒ **53 Mo** pour les 940 ; `$select` **n'est pas
supporté**. `GET /characteristics` (123 entrées) a permis de normaliser `characteristic` en code
court — dont `85` = « Poussée (fixe) » qui était mappé sur les **dommages** de poussée (corrigé).
Siphon appliqué : **938 panoplies** écrites, **2 refus** explicites (`38` absent du référentiel,
`121` = multiplicateur de dommages reçus, hors modèle) ; **2ᵉ passage : 0 écriture** (idempotent).

**Fail-closed.** Une panoplie portée mais absente du référentiel, ou un build dont les `cloths`
ne sont pas expliqués par le contexte, rendent `applyVariantsToBuild` **`null`** : la variante
n'est pas calculée et la miniature l'annonce (« Panoplie indisponible »), la fiche affiche le
stuff d'origine. `saveBuildVariant` refuse la même situation côté serveur, et évalue désormais
les conditions d'objet sur les stats **effectives** (bonus recalculés), plus sur celles du stuff
d'origine.


---

## 10. Pods et veille des conditions (26/10/2026)

### Pods — une **capacité**, pas une charge

Le payload Dofusbook ne porte **aucun poids**. Les deux builds de référence tombent exactement
sur `1000 + 5 × Force` : **1950** pour 190 de Force (`22329554`) et **1250** pour 50 (`23582119`).
C'est donc une **capacité d'inventaire** : `GameItem.realWeight` (les kilos) n'entre pas dans le
calcul, seuls les **pods d'équipement** (caractéristique DofusDB `40`, code `pod`) s'ajoutent.

| Élément | Où |
|---|---|
| Règle pure (`—` si Force inconnue, bornes d'affichage) | `src/lib/dofus-pods.ts` |
| Apport de l'équipement (items **et** panoplies) | `DofusbookPreviewData.stats.pod` (parseur) |
| Affichage (ligne « Pods » de la fiche, recalculée avec la variante) | `dofusbook-preview.tsx` |

⚠️ La page Dofusbook reste **inaccessible aux robots** (WAF 403) : la formule est prouvée sur **deux**
builds exacts et verrouillée par test, pas sur un échantillon large.

### Veille des conditions — alerter sur la **nouveauté**, jamais sur l'état

| Élément | Où |
|---|---|
| Atomes de condition (élément + opérateur + évaluabilité) | `listConditionAtoms()` — `src/lib/dofus-conditions.ts` |
| Agrégation par élément/opérateur + types hors slots | `src/lib/item-conditions-watch.ts` |
| Instantané (Redis, fail-open) | `game-data:watch:item-conditions` — `game-data-sync-state-store.ts` |
| Recalcul + diff | `src/server/item-conditions-watch.ts` |
| Planification + alerte God | cron `data-watch` (hebdo, dry-run) |

Mesure du 26/10/2026 en base : **264** objets conditionnés · **403** atomes · **12** non évaluables
(`Être abonné` 8, `Niveau d'alignement` 2, `Être niveau {0} ou plus` 1, `Kamas` 1) · **13** types
d'objet hors `VARIANT_SLOTS`. **2ᵉ passe : `changed=false`, 0 nouveauté** — le bruit connu (caution,
certificat, bannière de percepteur…) ne réveille pas le cron ; seule une **nouveauté** (atome ou type
jamais vu) part dans l'alerte.

⚠️ Deux pièges corrigés le même jour, tous deux invisibles sans test : une `relation` inconnue était
traitée comme un **ET** (elle est maintenant refusée), et `Number(null) === 0` faisait satisfaire
« PA > -1 » **et** affichait `1000` de pods sur une Force absente.



### Plafonds du jeu — 12 PA / 6 PM / 6 PO / 6 invocations (26/10/2026)

Un build **ne peut pas** dépasser ces valeurs : au-delà, le bonus d'équipement n'est pas compté
(Dofus Wiki, `Characteristic` : § Action Point « maximum of **12 AP** », § Movement Point
« maximum of **6 MP** », § Range « maximum of **6 Range** », § Summons « maximum of **6 Summons** » —
tous avec « the bonus will not be included »).

| Élément | Où |
|---|---|
| Règle pure (`capActionPoints`, `capMovementPoints`, `capRange`, `capSummons`) | `src/lib/dofus-caps.ts` |
| Affichage plafonné (badge de carte, pastilles, fiche) | `dofusbook-preview.tsx` |
| Point excédentaire **dit** à l'écran (`+1 ignoré (plafond 12)`) | lignes PA/PM/PO/Invocations de la fiche |

⚠️ Le total brut reste dans les données (`stats.pa`), seul l'**affichage** plafonne : on ne
réécrit pas un calcul, on explique ce que le jeu ignore. Les conditions d'objet (`PA < 12`) sont
évaluées sur la valeur **plafonnée**, comme en jeu.

### Refus de variante — la cause est dite, et rattrapée (26/10/2026)

Le refus fail-closed était muet (« Panoplie indisponible »). Il distingue maintenant **trois
causes** (`explainVariantRefusal`, `src/lib/dofus-variant-utils.ts`), affichées dans le badge et
détaillées dans l'infobulle :

| Code | Message | Ce qui est dit à l'utilisateur |
|---|---|---|
| `no-set-context` | « Panoplies non chargées — stuff d'origine affiché » | le build porte N panoplies, leurs paliers ne sont pas chargés → recharger la page |
| `unknown-sets` | « Panoplie non reconnue — stuff d'origine affiché » | l'id de panoplie manquant → demander une synchronisation |
| `incoherent-context` | « Panoplies incohérentes — stuff d'origine affiché » | N déclarées / M retrouvées, avec les noms non expliqués |

**Rattrapage** : si la page a été rendue **avant** la synchronisation, la miniature demande
elle-même le contexte (`getVariantItemSets`, lecture seule bornée à 64 ids) et la variante
redevient calculable **sans rechargement**.

⚠️ Le même refus reste **serveur** : `saveBuildVariant` refuse une variante non calculable

### Conditions d'équipement — ce qui est évalué, ce qui est refusé (26/10/2026)

Mesure en base sur les **264** objets conditionnés : **252 évalués**, **12 refusés** — et les 12 sont
tous des propriétés **hors d'un build** (impossible à déduire d'un stuff) :

| Condition | Objets | Traitement |
|---|---|---|
| « Être abonné = 1 » | 8 (compagnons, armes basses) | non évaluable ⇒ sélection **refusée**, condition **affichée** |
| « Niveau d'alignement > N » | 2 (Cape de Mori Arty, Cape du Justicier) | idem |
| « Kamas > 49 999 » | 1 (Bouclier Fi'Squale) | idem |
| « Être niveau {0} ou plus » | 1 (Bâton de l'apprenti pèlerin) | placeholder non documenté ⇒ refus, jamais deviné |

**Trophées « Bonus de panoplies < 2 » : évalués.** Mesuré sur le *Dévastateur Feu majeur* :
accepté à **0** et **1** panoplie active, **refusé dès 2** — c'est la règle du jeu, pas un blocage
de l'outil (le serveur revalide, `saveBuildVariant`).

⚠️ Ces refus sont **visibles** : la condition est rendue en français dans la fiche de l'objet et la
sélection est bloquée avec le motif. Aucune n'est « silencieusement acceptée ».

### Siphon du référentiel — en local et **en production** (26/10/2026)

| Où | Commande |
|---|---|
| Poste de dev | `npm run siphon:item-sets -- --apply` (script `scripts/siphon-item-sets.ts`, `tsx` + alias `@/`) |
| **Bêta / prod (conteneur)** | `curl -sS -H "x-cron-secret: $CRON_SECRET" "https://beta.sigilos.fr/api/cron/siphon-item-sets?apply=1"` |

Pourquoi deux chemins : l'image de production est un **build standalone** — elle ne porte **ni `tsx`
ni les alias `@/`**, donc le script TypeScript ne peut pas tourner dans le conteneur. La route
`GET /api/cron/siphon-item-sets` exécute le **même cœur** (`siphonItemSetsCore`, une seule source)
avec le bon `DATABASE_URL` : aucun SSH, aucun outil à installer.

- `apply` = **0 par défaut** ⇒ **dry-run** (mesure seule) ;
- `pages` borne la passe (19 pages au total) pour rester sous les timeouts de proxy ;
- `startSkip` reprend au `nextSkip` rendu par l'appel précédent — on enchaîne jusqu'à `nextSkip: null`.

Exemple borné (4 appels) :

```bash
for skip in 0 250 500 750; do
  curl -sS -H "x-cron-secret: $CRON_SECRET" \
    "https://beta.sigilos.fr/api/cron/siphon-item-sets?apply=1&pages=5&startSkip=$skip"
done
```


« Actualiser » ne changeait rien après une modification sur Dofusbook. Mesure avant correctif : l'URL
signée appelée avec `force=1` renvoyait **`X-SigilOS-Cache: HIT`** (au lieu de `BYPASS`) et **le même
payload** que sans le drapeau ⇒ la version **déployée** du worker était antérieure au correctif du
25/10 (le code du dépôt, lui, était bon).

| Étape | Preuve |
|---|---|
| Logique du dépôt vérifiée **en local** (`wrangler dev --local`) | `MISS` → `HIT` → **`BYPASS`** sur `force=1` |
| **Déploiement** (`wrangler deploy`, même nom `test-dofusbook`) | Upload 6,13 KiB · **version `175b2e54`** |
| Contrôle **en production** | `force=1` → **`X-SigilOS-Cache: BYPASS`** ✔ · `X-Proxied-By: SigilOS-CF-Worker` |

⚠️ **En-tête à lire : `X-SigilOS-Cache`** (`HIT`/`MISS`/`BYPASS`/`STALE`), pas `X-Cache` — un diagnostic
précédent a conclu à tort « ce n'est pas notre worker » en cherchant le mauvais nom.

⚠️ **Blocage source (mesuré juste après le déploiement)** : sur `BYPASS`, Dofusbook répond **403**
(page de blocage 4 554 o) — y compris depuis une **IP résidentielle** et même sur la page d'accueil du
site. C'est un **blocage temporaire côté Dofusbook** (bot-management / limiteur, vraisemblablement
aggravé par nos sondes répétées), pas un défaut du relais. Le produit dégrade proprement : la fiche
garde les dernières données connues et affiche un avertissement ; il suffit de réessayer plus tard.

Ce que le produit dit maintenant (au lieu d'un faux « aucun changement ») :

- **UI** : à l'issue d'un `force`, si le payload est identique → avertissement « **Rien de neuf reçu
  du relais Dofusbook** — s'il sert encore son cache, réessaie plus tard (ou fais redéployer le relais). »
- **Serveur** : `logger.warn` « rafraîchissement forcé sans changement — relais probablement en cache »
  (avec le `buildId`), pour que l'ops le voie sans capture d'écran.



⚠️ Le même refus reste **serveur** : `saveBuildVariant` refuse une variante non calculable
(« Bonus de panoplie indisponibles pour ce build — variante refusée »).

### Variante partagée — image OG et embed Discord (26/10/2026)

`resolveVariantPreview` (`src/server/build-item-sets.ts`) est **la** règle : elle rend l'aperçu
effectif (variante appliquée) **ou** le stuff d'origine, avec la raison du refus. Trois usages :

| Surface | Comportement |
|---|---|
| Image OG (`/api/og/build/[id]`) | icônes de la **variante** + badge « VARIANTE » — posé **seulement** si le calcul a réussi |
| Embed Discord (`shareGalleryItemOnDiscord`) | titre `… · 🟡 Variante`, stats **effectives**, champ « 🟡 Variante proposée » (objets remplacés, 6 max + « … et N autre(s) ») |
| Fiche / galerie | déjà couvertes (bascule Stuff ⇄ Variante) |

⚠️ **Fail-closed** : variante non calculable ⇒ **aucun tag**, l'aperçu reste celui du stuff d'origine.
Un tag qui mentirait sur les stats serait pire que pas de tag.

### Veille des conditions visible côté God (26/10/2026)

`getItemConditionsWatch()` (`src/server/actions/game-data-sync-actions.ts`, réservé à
`canAccessGameData`) lit l'instantané Redis ; le **Tableau God** (`GameDataSyncStatePanel`) affiche
un bandeau : objets conditionnés, **atomes non évaluables** (détail élément + opérateur, 4 premiers),
types d'objet hors variantes, date du calcul. **Lecture seule** : la source reste le cron
`data-watch` (aucun bouton d'écriture ici).


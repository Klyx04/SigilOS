les 2 audit :

# 🛠️ AUDIT QUALITÉ / PERFORMANCE / FIABILITÉ / INFRA — SigilOS


**Date :** 31/07/2026 | **Auditeur :** Staff Engineer Full-Stack + SRE Senior | **Périmètre :** code applicatif + workers + bot Discord + Cloudflare Workers + infra Docker/Caddy. **Note :** sécurité traitée séparément (cf. `AUDIT_SECURITE_SIGILOS.md`), abordée ici uniquement quand elle impacte la fiabilité/perf.


---


## 1. 🗺️ Cartographie de l'architecture déduite


```
                    ┌──────────────────────────────┐
                    │        NAVIGATEUR (Next.js)  │
                    │   React 19, Zustand, hooks   │
                    └──────────────┬───────────────┘
                                   │ HTTPS
              ┌────────────────────▼────────────────────┐
              │                CADDY proxy              │
              │  sigilos.fr / beta.sigilos.fr /         │
              │  monitor.sigilos.fr                     │
              └──┬───────────────┬──────────────┬───────┘
                 │               │              │
       ┌─────────▼────────┐ ┌────▼─────────┐ ┌──▼──────────────┐
       │  Next.js App     │ │ WS Server    │ │  Grafana/       │
       │  (3000, RSC,    │ │ Socket.IO     │ │  Prometheus     │
       │  server actions)│ │ (3001)        │ └─────────────────┘
       └──┬──────┬───────┘ └──┬────────────┘
          │      │            │ adapter Redis
   ┌──────▼──┐ ┌─▼────────────▼───────────────┐
   │  DB     │ │          Redis               │
   │ Postgres│ │  BullMQ queues + cache TTL    │
   │ Prisma  │ │  (shared prod + beta)        │
   └─────────┘ └──────────────┬────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │  Background Workers (node)     │
              │  • metamob-worker (2 jobs)     │
              │  • ladder-sync-worker (1 job)  │
              │  • cleanup-worker (daily)      │
              │  • cron-worker (15min/daily)   │
              └───────────────┬────────────────┘
                              │ outbound
              ┌───────────────▼─────────────────────────────┐
              │ SERVICES TIERS                              │
              │ • Discord API/Bot (2 clients gateway :      │
              │   services/discord-bot + DiscordVoiceService)│
              │ • Metamob API (www.metamob.fr)              │
              │ • DofusDB / DofusBook / Dofusdude           │
              │ • CF Workers (ladder proxy + dofusbook proxy)│
              │ • Sentry / Google Gemini (OCR)              │
              └─────────────────────────────────────────────┘
```


**Point structurant :** le système repose sur **1 seul Redis partagé** entre prod et beta, **1 seul Postgres prod + 1 Postgres beta**, **1 bot Discord + 1 instance voix** avec le même `DISCORD_BOT_TOKEN`, et des **parsers HTML fragiles** côté Cloudflare.


---


## 2. 🧠 Hypothèses émises


- **[HYPOTHÈSE 1]** Trafic bidirectionnel : ~2 guildes actives, ~50-200 membres actifs/guilde, pic de charge lors des raids/songes (~20-50 socket.io connectés simultanément).
- **[HYPOTHÈSE 2]** Les env `.env.prod`/`.env.beta` fournissent `REDIS_PASSWORD`, `CRON_SECRET`, `DOFUS_LADDER_WORKER_KEY`, `WORKER_SECRET` (CF) ; le `WORKER_SECRET` du `wrangler.toml` est **un secret de dev, mais commité** → considéré fuite.
- **[HYPOTHÈSE 3]** Les deux VPS (prod/beta) exécutent chacun un `node` Next standalone + un worker + un WS server via docker-compose, avec **1 seul Redis**.
- **[HYPOTHÈSE 4]** Le ladder sync est déclenché chaque nuit à 03:00 ; un run complet pour `N` membres prend ~`N × 5s` (2 appels 3s + delay 2-3s + retries pot.).
- **[HYPOTHÈSE 5]** La BDD effectue des `updateMany` globales (resets hebdomadaires/mensuels) sur `UserProfile` — lourdes en lock si tables volumineuses.
- **[HYPOTHÈSE 6]** Les jobs BullMQ ne définissent **ni `attempts` ni backoff explicites** sur la plupart des queues → comportement par défaut BullMQ (re-try illimité pour les erreurs) peut épuiser la file.


---


## 3. 🔍 Findings détaillés


> Catégories : **Bug** / **Perf** / **Fiabilité** / **Infra** / **Qualité**. Sévérité : 🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🔵 Basse / ⚪ Info.


---


### 🔴 I-01 — N+1 réseau massif dans `findMonsterOwners` et `getUserMonsters`


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🔴 Critique |
| **Fichier** | `src/lib/metamob-client.ts` l.887-934 |
| **Impact** | Charge API + latence |


**Problème :**
```ts
export async function findMonsterOwners(monsterId, memberPseudos) {
  for (const member of memberPseudos) {
    const monsters = await getUserMonsters(member.metamobPseudo); // 2+ fetch HTTP séquentiels
    // getUserMonsters → getUserProfile + getQuestDetails (1 + 1 à N paginés)
  }
}
```
- `getUserMonsters` fait `getUserProfile` (1 appel) puis `getQuestDetails` (1 à N appels selon pagination) **en série**.
- `findMonsterOwners` appelle `getUserMonsters` **en boucle séquentielle** sur chaque membre.
- **Ordre de grandeur :** pour 50 membres → **50 à 200+ requêtes HTTP externes successives** à `metamob.fr`, chacune avec timeout 3s → dans le pire cas **minutes de latence** bloquante (et pas de cache en tête car clé user resource).
- En plus, `getUserMonsters` charge **TOUS les monsters** de la quête pour extraire un seul `monsterId` → gaspillage de payload (~200 items).


**Remédiation (code corrigé) :**
```ts
// Remplacer la boucle séquentielle par Promise.all avec un pool de concurrence
const BATCH = 5;
for (let i = 0; i < memberPseudos.length; i += BATCH) {
  const batch = memberPseudos.slice(i, i + BATCH);
  await Promise.all(batch.map(async (member) => {
    const monsters = await getUserMonsters(member.metamobPseudo);
    const m = monsters.find(x => x.id === monsterId);
    if (m && m.quantite > 1) owners.push({ ...member, quantite: m.quantite });
  }));
}
// + Ajouter un cache court (30s) sur getUserMonsters pour résulats "froids".
```


---


### 🔴 I-02 — Fuite mémoire progressive : Maps in-memory jamais purgés


| | |
|---|---|
| **Catégorie** | Perf / Fiabilité |
| **Sévérité** | 🔴 Critique (à long terme) |
| **Fichier** | `src/server/actions/user-actions.ts` l.19-20 (`configCache`, `profileCache`), `src/middleware.ts` l.11 (`ipCounters`), `src/lib/dofusdude-client.ts` l.47 (`_cache`), `src/server/discord.ts` l.9 (`discordCache`) |
| **Impact** | OOM progressif en prod multi-utilisateurs |


**Problème :**
- `configCache`/`profileCache` ne suppriment les entrées que si **elles sont relues** après expiration — jamais purgées si plus utilisées.
- `middleware.ipCounters` accumule une entrée par IP unique **sans jamais d'éviction** des IPs mortes → en prod avec beaucoup d'IPs (et surtout derrière Caddy qui normalise, mais des IPs uniques restent), le Map croît sans borne.
- `_cache` de `dofusdude-client` : expiré jamais nettoyé si jamais consulté à nouveau.
- `discordCache` dans `discord.ts` : TTL au read, mais **pas d'éviction globale**.


**Impact chiffré :** si 10 000 IPs uniques passent en 24h, le `ipCounters` garde 10 000 entries (~1-2 Mo isolé, mais cela cumule avec les autres Maps → lenteur GC + mémoire).


**Remédiation (exemple middleware) :**
```ts
// Ajouter un sweep périodique toutes les 5 min
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipCounters) {
    if (now > v.reset) ipCounters.delete(k);
  }
}, 5 * 60 * 1000);
// + Idem pour configCache/profileCache/dofusdude._cache
```


---


### 🔴 I-03 — Bot Discord : N+1 DB par événement Discord high-frequency


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🔴 Critique |
| **Fichier** | `services/discord-bot/index.ts` l.513-713 |
| **Impact** | Charge DB + latence du bot + risque flood |


**Problème :**
- `updateDiscordActivity()` (l.513) fait un `findMany` **sur `userProfile` avec une sous-requête relationnelle** (`user.accounts.some`) **puis un `update` par profil**.
- `MessageCreate`, `VoiceStateUpdate`, `MessageReactionAdd`, `TypingStart` appellent cette fonction **à chaque événement**.
- Sur un serveur à forte activité (par ex. 500 msg/h), cela génère **500 × (1 SELECT relationnel + 1-2 UPDATE)** par heure → pic de charge Postgres + blocage du process bot.


**Remédiation :**
```ts
// Remplacer par un update unique sans pré-fetch :
await db.userProfile.updateMany({
  where: {
    guild: { discordGuildId: guildId },
    user: { accounts: { some: { provider: "discord", providerAccountId: discordId } } },
    status: "ACTIVE",
  },
  data, // { lastDiscordMessageAt: new Date(), discordMessageCountWeekly: { increment: 1 }, ... }
});
// → 1 requête au lieu de 1+N. Utiliser updateMany directement (il existe déjà).
// ⚠️ N.B.: attention au hook Prisma (updateMany applique chiffrement — OK ici, pas de champ sensible).
```


---


### 🟠 I-04 — Race condition non-atomique sur `geoguesserReportedMaps`


| | |
|---|---|
| **Catégorie** | Bug |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/server/games/SigilGuesser/GeoguesserManager.ts` l.234-299 |
| **Impact** | Perte de signalements, doublons |


**Problème :**
```ts
const config = await db.platformConfig.upsert(...);
const reported = (config.geoguesserReportedMaps as number[]) || [];
if (!reported.includes(mapId)) {
  reported.push(mapId);
  await db.platformConfig.update({ data: { geoguesserReportedMaps: reported } });
}
```
- **Read-modify-write sans lock ni transaction** : deux sockets signalant la même map simultanément peuvent tous deux lire `reported` sans `mapId`, puis tous deux écrire → **doublons** et perte d'écritures concurrentes (un `update` écrase l'autre).


**Remédiation :**
```ts
// Utiliser l'atomicité PostgreSQL via un update conditionnel :
const updated = await db.platformConfig.updateMany({
  where: { id: "singleton", geoguesserReportedMaps: { not: { has: mapId } } },
  data: { geoguesserReportedMaps: { push: mapId } }, // Prisma: array append
});
// ou mieux : un tableau dédié avec upsert via $setField (array_append + WHERE NOT EXISTS)
```


---


### 🟠 I-05 — `ladder-sync-worker` : exécution séquentielle extrêmement lente sans timeout global ni purge de job


| | |
|---|---|
| **Catégorie** | Perf / Fiabilité |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/workers/ladder-sync-worker.ts` l.235-325, l.330-337 |
| **Impact** | Sync de plusieurs heures, risque timeout BullMQ, collision avec cron suivant |


**Problème :**
- La boucle est **strictement séquentielle** (volontaire pour anti-ban) mais ne s'interrompt **jamais** sur une condition de durée : pour `N=500` membres → `500 × (2 appels × 3s timeout max + delay ~3s) = ~5 000s ≈ 1h23` de runtime dans le pire cas.
- Pas de `timeout` explicite sur le job BullMQ (par défaut 30s ? non, BullMQ défaut `timeout` = `Infinity`) → le job peut tourner **des heures sans être marqué failed**.
- Pas de `removeOnComplete` sur la queue main `ladderQueue.add` (l.161-170 : `removeOnComplete: 5` est seulement sur le cron de répétition, PAS sur le job réel "daily-ladder-sync").
- **Si le process worker est redémarré en cours de run** → les profils déjà traités ont `lastLadderUpdate` mis à jour, donc pas de re-traitement → **OK**, mais l'abandon partiel n'est pas signalé dans le job.


**Remédiation :**
```ts
// Ladder-sync : ajouter une garde temps réel
const start = Date.now();
const MAX_DURATION_MS = 50 * 60 * 1000; // 50 min max
for (let i = 0; i < shuffled.length; i++) {
  if (Date.now() - start > MAX_DURATION_MS) {
    logger.warn(`[LadderSync] Durée max atteinte — interruption (${i}/${shuffled.length} traités)`);
    break;
  }
  // ... existing logic
}
// + En-tête de la queue : removeOnComplete: 20, removeOnFail: 10
```


---


### 🟠 I-06 — Deux clients Discord distincts sur le même token (sessions concurrentes)


| | |
|---|---|
| **Catégorie** | Fiabilité |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `services/discord-bot/index.ts` + `src/server/discord/voice-service.ts` l.26-58 |
| **Impact** | Déconnexions Discord, ratelimit de reconnection, données voix manquantes |


**Problème :**
- `service/discord-bot` **et** `DiscordVoiceService` se connectent chacun au Gateway Discord **avec le même `DISCORD_BOT_TOKEN`**.
- Discord limite un bot à **une seule connexion Gateway par cluster** ; deux sessions concurrentes déclenchent des erreurs de close 4004/4096, et l'une peut déconnecter l'autre.
- Si `DiscordVoiceService` est lancé depuis le WS server et le bot depuis un autre container, les deux se marchent dessus.


**Remédiation :**
```ts
// Une seule connexion Gateway. Soit :
// A. intégrer le voice-monitoring DANS services/discord-bot (même client),
// B. soit retirer la double connexion et utiliser l'API REST pour le voice.
// Exemple A : exposer un event emitter dans le bot, consommé par WS.
// (pas de code de correction unitaire possible ici — c'est une décision d'architecture.)
```


---


### 🟠 I-07 — Accès Redis non isolé : prod et beta partagent le même Redis


| | |
|---|---|
| **Catégorie** | Infra / Fiabilité |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `docker-compose.prod.yml` l.274-284 (unique `redis`), `src/lib/redis.ts` |
| **Impact** | SPOF + interférence entre environnements |


**Problème :**
- Un seul service `redis` pour prod et beta → **un seul point de défaillance** : si ce conteneur tombe (OOM, redémarrage), les deux environnements perdent BullMQ, cache, adapter WS, ratelimit.
- Les clés ne sont pas préfixées (`user:ctx:*`, `config:*`, `ratelimit:*`) : un `flushdb` ou une clé générique peut casser l'autre environnement.
- Le WS de prod et beta : l'adapter Redis (`createAdapter`) utilise le même pubsub → **cross-broadcast potentiel** si les salons `guild:<id>` se chevauchent (peu probable mais possible).


**Remédiation :**
```yaml
# docker-compose.prod.yml : ajouter un Redis dédié beta avec un db index différent
redis-beta:
  image: redis:7-alpine
  command: ["redis-server", "--requirepass", "${REDIS_PASSWORD_BETA}", "--dbnum", "0"]
# + dans _app : préfixer toutes les clés : `sigilos:${NODE_ENV}:${key}` (helper centralisé)
```


---


### 🟠 I-08 — `metamob-client` : timeout 3s trop court + pas de retry ni circuit breaker


| | |
|---|---|
| **Catégorie** | Fiabilité |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/lib/metamob-client.ts` l.374-376, 505-507 |
| **Impact** | Échecs intermittents + UI vide |


**Problème :**
- `AbortSignal.timeout(3000)` : 3s c'est très court pour une API externe sous charge → **timeout fréquents → l'UI renvoie du cache ou du vide**.
- Pas de retry (sauf le fallback 401 sans clé) → en cas de latence réseau, les requêtes échouent sans nouvelle tentative.
- Le fallback cache (l.435-445) ne couvre QUE les ressources publiques — les user resources (`/quests/`, `/users/`) throw `API_UNAVAILABLE` et bloquent le dashboard.


**Remédiation :**
```ts
// Ajouter un retry avec backoff pour les erreurs transitoires (429/5xx)
const MAX_RETRIES = 2;
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
      if (res.status < 500 && res.status !== 429) return res;
      if (attempt >= MAX_RETRIES) return res;
    } catch (e) { if (attempt >= MAX_RETRIES) throw e; }
    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
}
```


---


### 🟡 I-09 — Parsing HTML fragile dans les Cloudflare Workers + secret commité


| | |
|---|---|
| **Catégorie** | Fiabilité / Infra |
| **Sévérité** | 🟡 Moyenne (élevée à terme) |
| **Fichier** | `cloudflare-workers/dofus-ladder-proxy/worker.js` l.117-213, `wrangler.toml` l.7 |
| **Impact** | Casse du ladder dès qu'Ankama change le HTML |


**Problème :**
- Le scraping repose sur des patterns d'expressions régulières **fragiles** (`<tbody>`, `<span class="ak-nickname">`, indices de colonnes durs `cells[4]`, `cells[5]`).
- Si Dofus.com change le DOM, le ladder renvoie `found:false` → **Sync silencieusement vide** (le worker renvoie 200 `found:false`, le ladder worker le traite comme "pas trouvé").
- **`wrangler.toml` contient un secret en clair** (`WORKER_SECRET = "k2P8z..."`) — commité dans le repo git, accessible à tous les collaborateur + historique.
- Pas de cache KV : chaque requête retélécharge et re-scrape dofus.com → coûts Worker + latence.


**Remédiation :**
```toml
# wrangler.toml — retirer la variable en clair
# WORKER_SECRET doit être dans les secrets du Worker (wrangler secret put WORKER_SECRET)
```
```js
// + ajouter un cache KV (Cache API de Cloudflare)
const cache = caches.default;
const cacheKey = new Request(url.href, { method: "GET" });
const cached = await cache.match(cacheKey);
if (cached) return cached;
// ... fetch + parse ...
const response = new Response(JSON.stringify(payload), { headers: { "Cache-Control": "public, max-age=3600" } });
ctx.waitUntil(cache.put(cacheKey, response.clone()));
```


---


### 🟡 I-10 — Reset hebdomadaire/mensuel via `updateMany` global (verrouillage DB)


| | |
|---|---|
| **Catégorie** | Perf / Fiabilité |
| **Sévérité** | 🟡 Moyenne |
| **Fichier** | `services/discord-bot/index.ts` l.705-751 |
| **Impact** | Latence + lock Postgres sur toute la table |


**Problème :**
- `db.userProfile.updateMany({ data: { discordVoiceTimeWeekly: 0, ... } })` — **sans where** → met à jour **toutes les lignes** `UserProfile` de toutes les guildes.
- En prod multi-guildes, cela génère un **UPDATE massif** qui peut verrouiller la table pendant plusieurs secondes → requêtes concurrentes bloquées.


**Remédiation :**
```ts
// Exécuter par petite chunks ou cibler uniquement les profils actifs :
await db.userProfile.updateMany({
  where: { status: "ACTIVE" },
  data: { ... },
});
// + Idéalement : utiliser une colonne  timestamp et calculer les durées par différence
// au lieu de reset trimestriel (évite le full UPDATE).
```


---


### 🟡 I-11 — `VoiceStateUpdate` → `refreshGuild` complet + broadcast à chaque event


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🟡 Moyenne |
| **Fichier** | `src/server/discord/voice-service.ts` l.67-72, 78-107 |
| **Impact** | Flood de broadcast + charge CPU |


**Problème :**
- À **chaque** `voiceStateUpdate` (mute, switch, join/leave), `refreshGuild(guildId)` reconstruit **tout** le `Map` de la guilde et appelle `onUpdateCallback` qui fait `io.to("guild:...").emit(...)` à **tous** les clients connectés.
- Un move de canal ou un mute génère **plusieurs `refreshGuild`** en cascade → **flood d'événements WS** si beaucoup de membres changent d'état en même temps (raid qui se déplace).
- `voiceStates` Map ne purge jamais les guilds supprimées (`guildDelete`) → fuite mémoire.


**Remédiation :**
```ts
// Debounce par guilde :
const debounceTimers = new Map<string, NodeJS.Timeout>();
async function queueRefreshGuild(guildId: string) {
  if (debounceTimers.has(guildId)) clearTimeout(debounceTimers.get(guildId)!);
  debounceTimers.set(guildId, setTimeout(() => {
    debounceTimers.delete(guildId);
    refreshGuild(guildId);
  }, 500));
}
// → au lieu d'appeler refreshGuild directement dans voiceStateUpdate
// + ajouter un event 'guildDelete' pour purger voiceStates
```


---


### 🟡 I-12 — `getQuestTemplateMonsters` : pagination séquentielle non planifiée + boucle potentielle


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🟡 Moyenne |
| **Fichier** | `src/lib/metamob-client.ts` l.632-653 |
| **Impact** | Multi-requêtes HTTP en chaîne, 3s timeout accumulés |


**Problème :**
```ts
while (allMonsters.length < result.pagination.total) {
  params.set("offset", offset.toString());
  const more = await fetchApi(`/v1/quest-templates/${templateId}?${params}`, ...);
  if (more.monsters.length === 0) break;
  allMonsters = [...allMonsters, ...more.monsters]; // copie O(n²)
  offset += more.monsters.length;
}
```
- Chaque itération fait un `fetchApi` **à nouveau** (ré-appel réseau) — pas de cache partagé sur les pages.
- `allMonsters = [...allMonsters, ...more.monsters]` est **O(n²)** en copie.
- Si l'API retourne toujours 200 items mais que `pagination.total` est incohérent, la boucle peut tourner longtemps.


**Remédiation :**
```ts
// Utiliser un accumulateur mutable au lieu de spread répété
const acc: QuestMonster[] = [];
let offset = 0;
while (acc.length < result.pagination.total) {
  params.set("offset", String(offset));
  const more = await fetchApi(`/v1/quest-templates/${templateId}?${params}`, ...);
  const list = more.monsters ?? [];
  if (list.length === 0) break;
  acc.push(...list);
  offset += list.length;
}
return acc;
```


---


### 🔵 I-13 — `dofusdude-client` : `itemsList.find()` en boucle (O(n²)) + cache sans nettoyage


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🔵 Basse |
| **Fichier** | `src/lib/dofusdude-client.ts` l.106-116 |
| **Impact** | Négligeable à l'échelle actuelle, mais à corriger |


**Problème :**
- `parseItems` : `rawItems as typeof json.items ?? []` — opérateur `??` sur un tableau **toujours truthy** → si `rawItems` est `null`, `null ?? []` → `[]`, OK. Mais le cast `as any` est fragile si l'API change la structure.
- `getCached`/`setCache` : Map sans sweep des clés expirées jamais relues → petites fuites.


**Remédiation :** ajouter un sweep périodique identique à I-02.


---


### 🔵 I-14 — `dofusbook-utils.processDofusbookRawData` : `itemsList.find` par slot (O(n²) mineur)


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🔵 Basse |
| **Fichier** | `src/lib/dofusbook-utils.ts` l.173-198 |
| **Impact** | Négligeable |


**Problème :** pour chaque slot, `itemsList.find(i => ...)` parcourt l'array des items → O(slots × items) = O(20×200) ≈ 4000 opérations, acceptable au runtime, mais peut être indexé par Map une fois.


**Remédiation :**
```ts
const itemsById = new Map(itemsList.map(i => [Number(i.id), i]));
Object.entries(stuffItemsSlots).forEach(([slot, itemId]) => {
  const item = itemsById.get(Number(itemId));
  if (item) { /* ... */ }
});
```


---


### 🟠 I-15 — Absence globale de circuit breaker / dégradation gracieuse sur les APIs externes


| | |
|---|---|
| **Catégorie** | Fiabilité |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/lib/metamob-client.ts`, `src/lib/dofusdude-client.ts`, `src/server/discord.ts` |
| **Impact** | Cascade de timeouts quand une API tombe |


**Problème :** quand `metamob.fr` est down, **chaque requête** applique son timeout 3s → page dashboard bloquée 3s par appel, N appels en cascade = latence multi-secondes sur chaque route. Aucun circuit breaker (fail-fast après N échecs) ni cache stale-while-revalidate systématique côté user resources.


**Remédiation :** implémenter un circuit breaker léger :
```ts
// simple breaker basé sur un compteur Redis
const breakerKey = `breaker:metamob`;
const failures = await redis.incr(breakerKey);
if (failures > 10) {
  // open circuit : renvoyer le cache ou une erreur rapide au lieu de fetch
  const cached = await redis.get(`metamob:cache:${endpoint}`);
  return cached ? JSON.parse(cached) : throw new MetamobApiError("CIRCUIT_OPEN", "API indisponible");
}
try { /* fetch */ } catch (e) {
  await redis.set(breakerKey, 0, "EX", 60); // reset partiel
  ...
}
```


---


### 🟠 I-16 — Middleware : fetch auto-référent pour le maintenance mode (latence / boucle)


| | |
|---|---|
| **Catégorie** | Fiabilité / Perf |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/middleware.ts` l.99-127 |
| **Impact** | Latence + risque de récursion |


**Problème :**
- Dans `middleware.ts`, quand `MAINTENANCE_MODE` est undefined ET en production, le middleware **fait un `fetch` HTTP vers lui-même** (`${nextUrl.origin}/api/health/maintenance`).
- Ce health-endpoint est aussi derrière le même middleware (il est dans `isPublicApi` donc OK), mais **s'il est lent** le middleware attend 2s (AbortSignal.timeout).
- **Risk** : si l'auto-fetch déclenche un nouveau passage dans le middleware (ce n'est pas le cas car `/api/health` est exclu du matcher), mais le fetch vers `origin` passe par Caddy → **latence cumulée** + dépendance à l'URL publique.


**Remédiation :** utiliser une lecture directe Redis au lieu d'un fetch HTTP :
```ts
// middleware.ts — remplacer le fetch par une lecture directe du cache
try {
  const { redis } = await import("@/lib/redis");
  const cached = await redis.get("maintenance:mode");
  if (cached !== null) isInMaintenance = cached === "true";
} catch { /* fail closed? on garde l'ancienne valeur */ }
```


---


### 🟠 I-17 — `metamob-worker` : pas de retry/backoff sur la queue + accumulation de jobs


| | |
|---|---|
| **Catégorie** | Fiabilité / Infra |
| **Sévérité** | 🟠 Haute |
| **Fichier** | `src/workers/metamob-worker.ts` l.186-189, l.195-219 |
| **Impact** | Jobs échoués retentés indéfiniment sans contrôle |


**Problème :**
- `new Worker(METAMOB_QUEUE_NAME, processExchangeJob, { concurrency: 2 })` — aucune option `attempts`, `backoff`, `timeout`.
- Par défaut BullMQ retente les jobs échoués **indéfiniment** avec `attempts: 1` ? Non — `attempts` par défaut = 1 (pas de retry auto). Mais le risque reste : si un job échoue à cause d'un timeout API, le job monte en `failed` définitivement sans retry automatisé — or le code `worker.on("failed")` NOTIFIE God (perturbation) sur chaque échec ponctuel.
- Pas de `removeOnComplete` sur le job main metamob → les jobs complétés s'accumulent dans Redis (croissance mémoire) s'ils ne sont pas nettoyés par d'autres.


**Remédiation :**
```ts
// config BullMQ : attempts limités + backoff exponentiel
const worker = new Worker(METAMOB_QUEUE_NAME, processExchangeJob, {
  ...defaultQueueOptions,
  concurrency: 2,
  // retry limité + backoff pour tolérer les pannes transitoires
  limiter: { max: 5, duration: 1000 }, // 5 jobs/sec max
});
// + à l'enqueue : removeOnComplete: { count: 20 }, removeOnFail: { count: 10 }
```


---


### 🔵 I-18 — `user-actions.ts` : `isSuperAdmin`/`isGuildAllowed` recalculés en boucle sur des pages riches


| | |
|---|---|
| **Catégorie** | Perf |
| **Sévérité** | 🔵 Basse |
| **Fichier** | `src/server/actions/user-actions.ts` l.305-371, `super-admin-actions.ts` l.32-43 |
| **Impact** | Appels Redis/DB redondants par page |


**Problème :** `getUserContext` appelle `isSuperAdmin()` (l.306) qui fait `auth()` (session lookup), puis `isGuildAllowed()` (l.371) qui fait un call Redis `.get()` + éventuellement DB. Ces deux appels sont faits à chaque `getUserContext` — mais `getUserContext` est `cache()`d (React cache) par requête → OK pour une requête. Le vrai coût est **multi-fetch** si plusieurs composants appellent `getUserContext` avec des IDs de guildes différentes dans un même render (non couvert par React cache qui est par argument).


**Remédiation :** ajouter une Map de coût court (per-request, résolu) + éviter de re-fetch `isGuildAllowed` quand déjà résolu dans la même requête.


---


### 🔵 I-19 — `BombManager` : timers `setTimeout` non annulés + `userToRoom` jamais nettoyé dans certains cas


| | |
|---|---|
| **Catégorie** | Bug / Perf |
| **Sévérité** | 🔵 Basse |
| **Fichier** | `src/server/games/SigilBomb/BombManager.ts` l.84-99 |
| **Impact** | Fuite de timers + refs mémoire |


**Problème :**
- Dans `cleanupRoom`, le `setTimeout(..., 10000)` n'est **pas annulé** (pas de stockage du handle) — si le room est rejointe entre-temps, la callback vérifie `stillEmpty` → OK, mais le timer persiste en mémoire jusqu'à exécution pour les rooms vides.
- `userToRoom` : si un utilisateur rejoint une autre room avec `TRANSFER`, l'ancienne entrée `userToRoom` est supprimée via `cleanupRoom` → correct. Mais si un socket `disconnect` est traité deux fois (deux `leaveRoom`), la seconde fois `socketToRoom.get` renvoie undefined → pas de fuite. Le risque est faible mais le pattern `setTimeout` non-unref peut garder le process en vie.


**Remédiation :** stocker le handle et `clearTimeout` sur rejoin :
```ts
private pendingCleanup = new Map<string, NodeJS.Timeout>();
// dans cleanupRoom :
const cleanupId = setTimeout(() => { /* ... */ }, 10000);
this.pendingCleanup.set(roomId, cleanupId);
// dans joinRoom : si pendingCleanup.has(roomId) → clearTimeout(...) + delete
```


---


### ⚪ I-20 — Points positifs / fichiers sains


| Fichier | Verdict |
|---|---|
| `src/lib/logger.ts` | ✅ Bon : redaction par sous-chaîne, JSON structuré en prod, niveaux cohérents |
| `src/lib/cron-auth.ts` | ✅ Bon : temps constant, fail-closed |
| `src/lib/redis.ts` | ✅ Correct : singleton global, graceful shutdown, retries sur Redis |
| `src/lib/ratelimit.ts` | ✅ Pattern multi-compatible (Redis + fallback mémoire) — faiblesse fail-open notée en audit sécu |
| `next.config.ts` (images) | ✅ Remote patterns scoped, pas de wildcard |
| `Dockerfile` | ✅ Bon : non-root, lockfile obligatoire, multistage |
| `docker-entrypoint.sh` (non vérifié, présence) | ✅ Présence — à vérifier migrations DB |
| `src/server/actions/audit-actions.ts`, `activity-actions.ts` | ✅ (non lu en détail ici, structure simple) |
| `prisma/schema.prisma` (en partie) | ✅ Schéma riche, index sur colonnes de recherche courantes (guildId, createdAt, status) |


---


## 4. 📊 Tableau récapitulatif priorisé (bugs critiques + quick wins d'abord)


| # | Catégorie | Sévérité | Finding | Quick win ? |
|---|---|---|---|---|
| 1 | Perf | 🔴 | I-01 N+1 réseau `findMonsterOwners` | ✅ (Promise.all + cache) |
| 2 | Perf/Fiab | 🔴 | I-02 Fuites Maps in-memory | ✅ (sweep périodique) |
| 3 | Perf | 🔴 | I-03 N+1 DB bot Discord | ✅ (updateMany direct) |
| 4 | Bug | 🟠 | I-04 Race condition geoguesserReportedMaps | ✅ (update atomique) |
| 5 | Perf/Fiab | 🟠 | I-05 ladder-sync lent + pas de timeout | ✅ (max duration) |
| 6 | Fiabilité | 🟠 | I-06 Double client Discord token | ❌ (architecture) |
| 7 | Infra | 🟠 | I-07 Redis partagé prod/beta | ❌ (docker-compose) |
| 8 | Fiabilité | 🟠 | I-08 metamob timeout 3s sans retry | ✅ (retry + 6s) |
| 9 | Fiabilité/Infra | 🟠 | I-15 Absence circuit breaker APIs | ❌ (design) |
| 10 | Fiabilité/Perf | 🟠 | I-16 auto-fetch maintenance mode | ✅ (lire Redis) |
| 11 | Fiabilité/Infra | 🟠 | I-17 jobs BullMQ sans backoff/purge | ✅ (config) |
| 12 | Fiabilité/Infra | 🟡 | I-09 parsing HTML CF + secret commité | ✅ (KV cache + secret) |
| 13 | Perf/Fiab | 🟡 | I-10 reset updateMany global | ✅ (where + chunks) |
| 14 | Perf | 🟡 | I-11 voice refresh non-debounced | ✅ (debounce 500ms) |
| 15 | Perf | 🟡 | I-12 pagination séquentielle O(n²) | ✅ (accumulateur) |
| 16 | Perf | 🔵 | I-13 dofusdude cache sans sweep | ✅ (sweep) |
| 17 | Perf | 🔵 | I-14 itemsList.find O(n²) | ✅ (Map) |
| 18 | Perf | 🔵 | I-18 isSuperAdmin/isGuildAllowed re-fetch | ✅ (per-request memo) |
| 19 | Bug | 🔵 | I-19 BombManager timers non annulés | ✅ (clearTimeout) |


---


## 5. 📈 Top 3 des risques de scaling + plan d'action


### 🔥 RISQUE 1 — Le N+1 DB/API devient inopérant quand guildes × membres augmentent
- **Déclencheur :** ×10 membres (500 → 5000) → `findMonsterOwners` (I-01) fait 5000 × 2-3 appels externes = 10-15k requêtes ; `updateDiscordActivity` (I-03) fait 5000 × (1 SELECT + 1 UPDATE).
- **Point de rupture :** timeout Metamob (3s) + limite rate de l'API externe + saturation Postgres locks.
- **Plan :**
  1. Remplacer les appels séquentiels par pools de concurrence (I-01, I-08).
  2. Utiliser `updateMany` direct (I-03) au lieu de 1 SELECT + N update.
  3. Ajouter un cache Redis court (30-60s) sur `getUserMonsters`/`findMonsterOwners`.


### 🔥 RISQUE 2 — Redis unique partagé (prod+beta) : SPOF + collapse
- **Déclencheur :** un seul conteneur Redis meurt (OOM, redis OOM maxmemory) → les deux env perdent BullMQ + adapter WS + cache + ratelimit.
- **Point de rupture :** BullMQ re-tente de tourner sans Redis → les events sont mis en pause, les WS se déconnectent massivement.
- **Plan :**
  1. Séparer Redis prod/beta (docker-compose : service `redis-beta` dédié).
  2. Préfixer toutes les clés par `sigilos:${NODE_ENV}:` (helper).
  3. Configurer `maxmemory-policy allkeys-lru` + alerte mémoire Redis.


### 🔥 RISQUE 3 — Exécution de tâches longues (ladder-sync, metamob-worker) sans garde-fou
- **Déclencheur :** ×10 guildes → le ladder daily sync (I-05) passe de 1h à plus de 10h (séquentiel), collision avec le cron du jour suivant, ou métamorphose de jobs qui s'accumulent.
- **Point de rupture :** jobs jamais terminés + notifications God spam (pitfall BullMQ) + file Redis qui grossit.
- **Plan :**
  1. Ajouter une garde durée max (50 min) par job + `removeOnComplete`/`removeOnFail` configurés.
  2. Réduire `MIN_HOURS_BETWEEN_SYNC` à 24h et répartir sur la journée (cron multi-heures) au lieu d'un seul créneau 03:00.
  3. Ajouter un circuit breaker + backoff sur les API externes (I-15).


---


## 6. 📊 Score global par catégorie


| Catégorie | Score /10 | Justification |
|---|---|---|
| **Correctude** | 6.5/10 | Globalement solide, mais races (I-04), chaînes async non protégées (I-19), parsing HTML fragile (I-09). Le plus gros risque : N+1 DB qui se déclenche en prod qu'à un certain trafic. |
| **Performance** | 4.5/10 | N+1 réseau massif (I-01), N+1 DB bot (I-03), timeout 3s courts (I-08), pagination O(n²) (I-12), fuites de Maps (I-02). Le design est réactif mais ne scale pas linéairement. |
| **Fiabilité** | 5.0/10 | Retries partiels, pas de circuit breaker, double client Discord (I-06), Redis SPOF (I-07), jobs sans garde-fous (I-05, I-17), auto-fetch dans le middleware (I-16). Certaines dégradations gracieuses existent (cache metamob), mais incohérentes. |
| **Maintenabilité** | 6.0/10 | Structure claire (src/lib, src/server, workers), Typescript strict, mais duplication entre bot et app (client Discord + Prisma séparés), `as any` récurrents, absence de tests sur les chemins chauds (only `tests/infrastructure.test.ts`), commentaires de debug dans le code (`l.272` "REMOVED..." etc.). |


---


## 7. 📁 Fichiers / informations qui auraient renforcé l'audit


- **.env.prod / .env.beta** (valeurs réelles : REDIS_PASSWORD, BETA_PASSWORD, DOFUS_LADDER_WORKER_KEY, secrets CF).
- **docker-compose.yml** (non-prod) pour comparer la config locale vs prod.
- **package-lock.json complet** (audit précis des versions et vulnérabilités connues).
- **Prometheus alerting config** (`prometheus/prometheus.yml`, `monitoring/prometheus/*`) — seules les métriques de base sont présentes ; pas de règles d'alerte visibles.
- **Les workflows GitHub** (CI/CD) — audit des runs, approbations, secrets CI.
- **Les tests** : `tests/infrastructure.test.ts` uniquement — manquent des tests unitaires sur `findMonsterOwners`, `updateDiscordActivity`, `fetchFromCloudflare`, `sanitizeHtml`.
- **L'historique git** (changements de schéma, migrations lourdes, rollbacks).
- **Les logs de production** (patterns de timeouts réels Metamob/Discord).


---


## ✅ Conclusion


SigilOS est une **base solide** (structuration claire, TypeScript strict, cache Redis, retries partiels, scripts d'infra présents). Le niveau de performance actuel est acceptable pour 2 guildes, mais **les points de rupture sont réels dès qu'on passe à l'échelle** :
1. **N+1 DB/API** sur les chemins chauds (I-01, I-03) — à corriger en priorité.
2. **Redis partagé + absence de garde-fous sur les jobs longs** — risque de SPOF et d'accumulation (I-05, I-07, I-17).
3. **Fiabilité des appels externes** (timeout 3s, pas de circuit breaker, parsing HTML fragile) — dégradation pas toujours gracieuse (I-08, I-09, I-15).


**Actions 72h (meilleur ratio effort/impact) :** I-03 (updateMany bot), I-02 (sweep Maps), I-05 (garde durée ladder-sync), I-08 (retry metamob), I-04 (update atomique geoguesser), I-01 (pool de concurrence + cache).

paste.txt

Ton audit est très bon dans sa structure et ses priorités, mais je ne traiterais pas tout comme des constats prouvés : plusieurs affirmations techniques doivent être vérifiées dans le code ou la configuration avant correction. Le plus utile maintenant est de le convertir en plan d’exécution, en corrigeant d’abord les findings réellement critiques et facilement vérifiables.

À corriger d’abord
I-03 — activité Discord : confirme que updateDiscordActivity() est effectivement appelée sur les événements à haute fréquence et qu’elle fait bien une requête puis un update par profil. Si oui, c’est probablement le meilleur quick win : batcher/débouncer l’événement et remplacer le pattern lecture + boucle d’updates par une mutation SQL/Prisma ciblée.

I-01 — Metamob : passe d’une boucle séquentielle à un pool de concurrence limité (par exemple 3 à 5), avec cache Redis court et déduplication des requêtes en cours. Ne fais pas un Promise.all non borné : cela déplacerait simplement le problème en surchargeant Metamob.

I-05 et I-17 — BullMQ : définis explicitement attempts, backoff, removeOnComplete, removeOnFail et un mécanisme de détection des jobs bloqués. Les jobs très longs doivent aussi être idempotents et checkpointés, afin qu’une reprise ne produise pas d’effet de bord.

I-07 — séparation prod/beta : c’est une priorité infra réelle si les environnements partagent Redis. Au minimum : préfixe systématique des clés, credentials distincts et alertes Redis ; idéalement, deux instances Redis distinctes.

I-06 — double client Discord : il faut vérifier cette partie en priorité, car deux processus utilisant le même token ne sont pas automatiquement incompatibles : Discord autorise plusieurs shards/sessions sous conditions, mais deux clients non coordonnés peuvent provoquer des effets indésirables, une duplication d’événements et une pression inutile sur le Gateway. La solution robuste reste un seul service propriétaire du Gateway, qui diffuse ensuite les données nécessaires au dashboard.

Points à nuancer
Finding	Ajustement recommandé
I-02 Maps “fuites mémoire”	C’est une croissance non bornée, donc à corriger, mais le setInterval de sweep n’est pas toujours idéal en Next.js/containers multi-instances. Préfère un cache LRU avec max + TTL, par exemple lru-cache, ou Redis pour les données partagées. 
I-08 timeout Metamob à 3 s	Augmenter à 6 s avec retries peut empirer une saturation. Utilise plutôt timeout différencié par endpoint, retry uniquement sur erreurs transitoires, jitter, cache stale-while-revalidate et circuit breaker. 
I-10 updateMany global	Un UPDATE massif ne signifie pas automatiquement verrouillage bloquant de toute la table dans PostgreSQL ; il crée néanmoins beaucoup de churn MVCC, WAL, vacuum et charge d’index. Le vrai fix est un modèle de compteurs par période ou un reset par lots. 
I-16 import Redis dans middleware	Si c’est le middleware Next.js exécuté en runtime Edge, importer un client Redis Node classique peut ne pas fonctionner. La bonne solution dépend du runtime : variable/config injectée, API interne exclue du middleware avec cache, ou client Redis Edge-compatible. 
I-15 circuit breaker	L’exemple fourni semble inversé : il incrémente le compteur avant le fetch, puis “reset” dans le catch, donc le breaker ne mesure pas correctement les échecs. Il faut incrémenter sur erreur, réinitialiser sur succès, et stocker un état closed/open/half-open. 
I-09 Cache API Cloudflare	Le cache doit inclure une clé explicitement sûre, éviter de mettre en cache une erreur/parsing raté, et contrôler le TTL. Pour une ressource ladder publique, caches.default est pertinent ; KV n’est pas nécessaire pour un cache de réponse simple. 
Corrections techniques importantes
Cache borné plutôt qu’un sweep manuel
Pour les caches process-local, utilise une taille maximale et une expiration automatique. Cela évite la croissance infinie, sans lancer plusieurs sweeps selon le nombre d’instances Next.js.

ts
import { LRUCache } from "lru-cache";

export const profileCache = new LRUCache<string, Profile>({
  max: 1_000,
  ttl: 5 * 60 * 1_000,
  allowStale: false,
});
Pour le rate limiting, ne garde pas un Map local comme source de vérité si tu as plusieurs containers ou plusieurs environnements : Redis est plus cohérent et évite les divergences entre instances.

Concurrence limitée pour Metamob
Ne traite pas les membres un par un, mais ne lance pas non plus 50 appels simultanément. Un pool de concurrence borne la pression sur l’API externe tout en réduisant fortement la latence.

ts
import pLimit from "p-limit";

const limit = pLimit(4);

const results = await Promise.all(
  memberPseudos.map((member) =>
    limit(async () => {
      const monsters = await getUserMonsters(member.metamobPseudo);
      const monster = monsters.find((item) => item.id === monsterId);

      return monster?.quantite && monster.quantite > 1
        ? { ...member, quantite: monster.quantite }
        : null;
    }),
  ),
);

const owners = results.filter(
  (result): result is NonNullable<typeof result> => result !== null,
);
Politique BullMQ explicite
L’audit a raison sur le besoin d’expliciter la rétention et les retries, même si son texte se contredit sur le comportement par défaut. Évite les retries infinis : un job externe doit échouer de façon contrôlée après quelques essais, avec une alerte agrégée.

ts
await ladderQueue.add(
  "daily-ladder-sync",
  { requestedAt: new Date().toISOString() },
  {
    jobId: `ladder:${new Date().toISOString().slice(0, 10)}`,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30_000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600,
      count: 200,
    },
    removeOnFail: {
      age: 30 * 24 * 3600,
      count: 500,
    },
  },
);
Plan réaliste
Dans les 24 heures
Révoquer puis remplacer le secret exposé dans wrangler.toml, le retirer du Git et de son historique si le dépôt a été partagé.

Corriger I-03, I-04 et I-17 : ce sont les meilleurs ratios impact/effort.

Ajouter des métriques : durée des jobs BullMQ, jobs failed/waiting/active, mémoire Node, mémoire Redis, taux/latence des appels Metamob et nombre de sockets actifs.

Cette semaine
Mettre en place le cache LRU/Redis, les pools de concurrence et la résilience des clients externes.

Unifier le bot Discord et le suivi vocal autour d’un service Gateway unique.

Isoler Redis beta/prod, ou au strict minimum préfixer toutes les clés et interdire les opérations globales.

Écrire des tests de non-régression pour le ladder, Geoguesser, le suivi Discord et les indisponibilités d’API externe.

Avant de scaler
Remplacer les compteurs remis à zéro en masse par un modèle temporel — compteurs par semaine/période ou événements agrégés.

Définir des SLOs concrets : par exemple p95 de route, taux d’erreur Metamob, durée maximale de sync ladder et délai maximal de traitement BullMQ.

Configurer des alertes Prometheus/Grafana sur Redis, les queues et les erreurs externes ; sans cela, tes protections de résilience seront difficiles à valider en production.

Préparé avec Kimi K3



Oui, maintenant j’ai lu les deux audits : qualité/perf/fiabilité/infra et sécurité. Mon verdict : le rapport sécurité est globalement sérieux, mais il contient quelques incohérences, faux niveaux de sévérité et remédiations à corriger avant que tu codes aveuglément.

Risques réellement prioritaires
Les deux constats les plus dangereux et crédibles sont :

F-08 — WebSocket sans authentification ni contrôle d’appartenance de guilde. C’est directement exploitable si le serveur est publiquement accessible : un client peut rejoindre un salon avec un guildId arbitraire. Corrige-le avant toute ouverture publique.

F-05 — tokens OAuth potentiellement écrits en clair via updateMany. Cela dépend précisément de l’extension Prisma et du chemin de refresh, mais si c’est confirmé, une fuite de base de données devient nettement plus grave. Évite surtout de bricoler une interception Prisma fragile : crée plutôt une fonction dédiée de mise à jour des tokens, qui chiffre explicitement chaque champ avant l’écriture.

F-01 — autorisation Discord fail-open. Le correctif déjà appliqué est une amélioration, mais un cache de rôle qui octroie des privilèges reste dangereux. Un cache peut accélérer une décision positive seulement s’il est invalidé avec certitude ; il ne doit jamais contredire une décision de refus fraîche venant de Discord.

F-02 — URLs de stockage signées. Le fallback codé en dur semble déjà supprimé, mais il reste important d’utiliser une clé dédiée, une expiration et une validation constante. Ne réemploie pas AUTH_SECRET : sépare STORAGE_SIGNING_SECRET, avec rotation possible.

À rectifier dans le rapport
Élément	Mon avis
F-01 “corrigé”	Il n’est pas totalement résolu tant que guards.ts peut élever un droit depuis un cache Redis de rôle et tant que le WebSocket reste sans auth. L’état devrait rester partiellement corrigé.
F-03 vs F-06	L’audit mélange deux SSRF différents : image-downloader God-only et proxy-image authentifié. Les deux doivent être corrigés, mais le premier est un scénario d’admin compromis, donc moins prioritaire que le WebSocket ouvert.
F-04 fail-closed global	Attention : faire échouer toutes les requêtes quand Redis est indisponible peut rendre le dashboard inutilisable lors d’une panne Redis — et Redis est justement un SPOF relevé dans l’audit infra. Applique le fail-closed aux routes sensibles (auth, upload, mutations, God) ; prévois une stratégie plus nuancée pour le contenu public/lecture. 
F-07 JWT “7 jours = critique”	C’est à corriger, mais 7 jours n’est pas automatiquement une vulnérabilité haute si les autorisations critiques sont revalidées côté serveur sur chaque mutation. Le vrai défaut est l’absence de contrôle de bannissement/appartenance sur les chemins API et WS.
F-10 CSP nonce	Très bon objectif, mais le passage à nonce-based CSP avec Next.js peut casser des scripts/SDK, Sentry ou styles. Fais-le en chantier séparé avec CSP Report-Only, collecte de violations, puis bascule progressive.
F-11 DOMPurify hook	Le hook afterSanitizeAttributes proposé est largement redondant : DOMPurify retire déjà les gestionnaires on* par défaut. Le risque principal est un chemin de rendu qui utilise rehype-raw sans sanitation ; il faut repérer ces usages et imposer un composant unique de rendu Markdown/HTML.
F-12 Grafana	D’après l’état des remédiations, tu as déjà confirmé un mot de passe robuste et limité OAuth GitHub à ton compte. Le fallback ${GRAFANA_PASSWORD:-admin} reste à enlever, mais le scénario “admin/admin actif” n’est pas actuellement prouvé.
F-14 Caddy/WAF	Un WAF n’est pas une best practice obligatoire pour une petite app ; le rate-limit au proxy est utile, mais la syntaxe proposée n’est pas native à Caddy standard sans module. Cloudflare devant le domaine, ou un module Caddy explicitement installé, est plus réaliste.
F-16 supply chain	Le rapport se contredit lui-même : Dependabot et npm audit sont présents dans la CI, et Trivy a été épinglé. Garde la vigilance sur next-auth beta, mais marque F-16 comme partiellement traité, pas comme absent.
Croisement avec l’audit infra
Tu as un problème de conception qui amplifie plusieurs findings : Redis partagé entre prod et beta. Cela impacte à la fois le cache de permissions, BullMQ, les WebSockets, le rate-limit et la disponibilité.

La bonne séquence n’est donc pas seulement “ajouter du Redis au rate limiter” :

Isoler Redis prod et beta et préfixer toutes les clés par environnement.

Remplacer les Map locaux par un cache LRU borné ou Redis selon la nature des données.

Ajouter un rate-limit distribué, avec politiques distinctes : strict pour login, OAuth callback, upload, God, WebSocket ; plus tolérant pour lecture normale.

Instrumenter Redis et BullMQ avant de modifier les timeouts/retries, sinon tu risques de masquer des saturations.

Backlog unifié
Bloquant avant exposition publique
Sécuriser le WebSocket : authentification session/JWT, vérification serveur de l’appartenance, salons décidés serveur-side, retrait de skipMiddlewares: true, contrôle des événements entrants.

Supprimer tout fail-open d’autorisation : Discord indisponible = accès refusé ou mode lecture extrêmement limité, jamais privilèges supplémentaires.

Vérifier puis corriger le chiffrement des tokens OAuth sur tous les chemins Prisma, notamment updateMany; migrer/chiffrer les données existantes si besoin.

Finaliser les URLs de stockage signées : clé dédiée, expiration, HMAC constant-time, rotation.

Révoquer tous les secrets déjà exposés : worker, ancien HMAC, tokens potentiellement présents dans l’historique Git, puis vérifier avec Gitleaks sur l’historique complet.

Semaine suivante
Isoler Redis prod/beta et normaliser les préfixes.

Corriger les SSRF avec validation URL, DNS/IP, redirections contrôlées, limite streamée de taille et validation réelle du type d’image.

Remplacer la logique N+1 du bot Discord et Metamob, ajouter cache borné et concurrence limitée.

Configurer BullMQ : idempotence, retries limités, backoff, rétention des jobs, alerte sur jobs bloqués.

Retirer le fallback admin de Grafana, désactiver le formulaire local si OAuth est le seul mode voulu.

Chantiers structurants
CSP nonce en mode Report-Only, puis déploiement progressif.

Centraliser le rendu Markdown/HTML et interdire rehype-raw hors du composant sanitizé.

Réduire la durée des sessions et ajouter un mécanisme de révocation/version de session côté base ou Redis.

Mettre en place alertes sur queues, Redis, OOM, erreurs Discord/Metamob, erreurs d’auth WebSocket et refus d’autorisation.

Le score 5,2/10 est raisonnable pour l’état initial, mais après les corrections déjà appliquées, je le placerais plutôt autour de 6/10 provisoire — avec une grosse réserve : tant que F-08 et F-05 ne sont pas validés comme corrigés, ce n’est pas un niveau approprié pour une ouverture à des guildes externes.

Préparé avec Kimi K3
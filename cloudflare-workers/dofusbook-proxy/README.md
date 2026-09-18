# SigilOS — Worker Dofusbook (proxy Cloudflare)

Proxy edge vers l'API publique Dofusbook. **Seul émetteur autorisé** vers
`dofusbook.net` : le VPS ne l'appelle jamais en direct.

## Routes

| Route | Auth | Usage |
|---|---|---|
| `GET /:id` | header `X-SigilOS-Key` | appels **serveur** SigilOS (proxy interne, warm cache) |
| `GET /s/:id?e=<exp>&t=<hmac>` | jeton HMAC (query) | appels **navigateur** (galerie : ajout/actualisation de build) |
| `OPTIONS` | — | CORS preflight |

`id` = id **numérique** Dofusbook (les liens courts `d-bk.net` sont résolus côté SigilOS
avant signature). Le jeton vaut `HMAC_SHA256(secret, "<id>.<exp>")` en hex, généré par
`src/lib/dofusbook-sign.ts` (TTL 5 min).

### Pourquoi une route navigateur ?
Dofusbook (Cloudflare) refuse désormais les requêtes dont le client d'origine est un
serveur (Node/undici, .NET → 403/5xx « Attention Required! ») alors qu'un **vrai
navigateur** passe. Le navigateur du membre appelle donc `/s/:id` ; le worker reste le
seul à contacter Dofusbook et l'IP du VPS n'est jamais exposée.

### Cache
Le worker met en cache **les succès uniquement** via la Cache API Cloudflare, sur une clé
**stable** (`https://www.dofusbook.net/api/stuffs/dofus/public/<id>`), indépendante du
jeton du navigateur — sinon chaque rafraîchissement rappellerait Dofusbook. Les échecs
(403/5xx) ne sont **jamais** mis en cache.

## Variables d'environnement (Cloudflare → Worker → Settings → Variables)

| Nom | Requis | Rôle |
|---|---|---|
| `WORKER_SECRET` | ✅ | secret de la route serveur `/:id` (doit être identique à `DOFUSBOOK_WORKER_SECRET`) |
| `WORKER_SIGN_SECRET` | optionnel | secret de signature de `/s/:id` (défaut : `WORKER_SECRET` ; à faire correspondre à `DOFUSBOOK_WORKER_SIGN_SECRET`) |

## Déploiement

```bash
cd cloudflare-workers/dofusbook-proxy
npx wrangler deploy
```

Puis vérifier (remplacer `<SECRET>` par `WORKER_SECRET`) :

```bash
# route serveur (succès attendu : 200 + JSON)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "X-SigilOS-Key: <SECRET>" \
  https://test-dofusbook.benjamin-tremoureux.workers.dev/23117628

# route navigateur sans jeton (403 attendu : "Invalid signature")
curl -sS https://test-dofusbook.benjamin-tremoureux.workers.dev/s/23117628
```

Pour tester la route navigateur **avec** un jeton valide, utiliser un vrai navigateur
(Chromium) depuis un script :

```bash
node --env-file=.env scratch/_test-signed-route.mjs
```

## Test local de la logique du worker (avant déploiement)

Émulateur Node (stubs `caches` + `fetch`) : vérifie la signature, l'expiration, le
rate-limit, le cache à clé stable et l'absence de mise en cache des échecs.

```bash
node scratch/_test-worker-local.mjs
```


## ⚠️ Comportement WAF (mesuré le 18/09/2026)

Dofusbook (Cloudflare bot-management) challenge l'égress des Workers **par
intermittence** : un `MISS` peut tomber sur la page de blocage (403 « Sorry, you have
been blocked »), la requête suivante passe. Trois protections rendent le module fiable
malgré ça :

1. **Cache 24 h des succès** (`Cache-Control: public, max-age=86400`, clé stable
   `…/api/stuffs/dofus/public/<id>`, partagée par les deux routes) ⇒ un `HIT` ne
   retouche jamais Dofusbook ;
2. **Les échecs ne sont jamais mis en cache** (un 403 n'est pas figé) ;
3. Côté SigilOS : **bake navigateur** (non concerné par le disjoncteur) + disjoncteur
   15 min sur les appels serveur pour ne pas marteler.

Relevé bêta du 18/09 : 403 sur un MISS à `00:00:13`, puis `200`+`HIT` sur les deux
routes quelques minutes plus tard (`X-Dofusbook-Status: 200`, `X-SigilOS-Cache: HIT`).

Si le blocage devenait **permanent**, le même `worker.js` fonctionne tel quel sur une
machine à IP résidentielle (`npx wrangler dev --port 8787` + `cloudflared`/Tailscale).
Détails et runbook : [`docs/GALERIE-DOFUSBOOK-RELAIS.md`](../../docs/GALERIE-DOFUSBOOK-RELAIS.md).

Attendu : `✅ Worker validé (logique OK avant déploiement)`.

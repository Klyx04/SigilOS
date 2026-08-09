# 🛡️ Plan de Hardening & Sécurité (Mise à jour après audit 2026)

> **Note :** ce fichier suit l'évolution du durcissement. Le log initial (février 2026) est conservé, puis complété par l'audit de sécurité 2026 (OWASP/ASVS).

---

## ✅ Fait (première phase — février 2026)

### 1. Redis
- [x] `docker-compose.prod.yml` : `--requirepass ${REDIS_PASSWORD}` activé
- [x] `src/lib/redis.ts` : gère l'authentification

### 2. Postgres
- [x] Sauvegardes chiffrées (GPG) vers Cloudflare R2
- [ ] Chiffrement SSL interne BDD (à renforcer si besoin)

### 3. Application
- [ ] Chiffrement des tokens OAuth au repos — **partiellement fait** (voir chantiers ouverts)

---

## ✅ Corrigé lors de l'audit 2026 (session juillet/août)

> Réf. complète en local (hors git) : `docs/audits/AUDIT_SECURITE_SIGILOS.md`

| Domaine | Correctif |
|---------|-----------|
| **Secret HMAC stockage** | `signStorageUrl` fail-closed (plus de secret en dur) |
| **SSRF proxy-image** | Whitelist de domaines exacte + blocage IP internes/protocoles |
| **Path traversal storage** | check `startsWith(storageRoot)` → check séparateur exact |
| **Fail-open RBAC Discord** | `memberFetchFailed` ne fait plus fail-open sans profil ACTIVE |
| **Rate-limit** | validation format IP + plafond mémoire (`MAX_IP_COUNTER_ENTRIES`) |
| **Bot Discord** | `DATABASE_URL` propre + intent `GuildMessageTyping` retiré |
| **Cloudflare Workers** | fail-closed si `WORKER_SECRET` absent + comparaison temps constant + erreurs neutres |
| **CI/CD** | `AUTH_SECRET` plus injecté sur les PR + Trivy épinglé |
| **Ladder sync** | valeurs `totalXp`/`classe`/`level` bornées |

---

## 🚧 Chantiers ouverts (à traiter — priorité du plus critique au moins)

1. **Authentification WebSocket (Socket.IO)** — ✅ **Activée en beta puis en PROD (09/08, `WS_AUTH_ENABLED=true`)** — décodage session + appartenance guilde à chaque connexion (F-08). Conformé sur `.env.beta` + `.env.prod`.
2. **Chiffrement des tokens OAuth (Discord)** — ✅ **FAIT + AUDITÉ (09/08)** : service `src/lib/token-encryption.ts` (anti double-chiffrement) utilisé dans `auth.ts` events.signIn **+ hook `updateMany`** dans `src/lib/prisma.ts` (commit `339db4e1`). **Audit + ré-encryptage prod terminé** : 3 tokens en clair re-chiffrés via `scripts/re-encrypt-oauth-tokens.ts` (commit `091b7c46`) → **F-05 FERMÉ** (beta 126/126 + prod 3/3 chiffrés).
3. **SSRF dans `image-downloader.ts`** — ✅ **FAIT** : `assertSafeUrl` bloque protocoles non-http(s), IP privées/réservées + DNS rebinding (F-03).
4. **Durée du JWT** — ✅ **FAIT** : `src/auth.ts` override `maxAge: 8h` + `updateAge: 4h` (NIST SP 800-63B) (F-07).
5. **CSP nonce-based** — ✅ **DÉPLOYÉ (09/08, commit `918fa308`)** : nonce par requête (proxy), `script-src` sans `'unsafe-inline'`, Report-Only par défaut, endpoint `/api/csp-report` + 16 tests. **Reste** : confirmer aucune violation bloquante sur beta puis `CSP_ENFORCE=true` (beta → prod).
6. ~~**Clé de chiffrement de secours dev**~~ — ✅ **Déjà retirée** (F-09, commit `de58c7b4` 02/08) : `src/lib/encryption.ts` fail-closed dans TOUS les environnements. **Chantier fermé**.
7. **Cache permissions** — ✅ **TTL réduit 60s → 30s** dans `guards.ts` (commit `0dd660bf`), cache **positif seulement** (F-13).
8. **Grafana** — à vérifier que `GRAFANA_PASSWORD` est défini (sinon admin par défaut).
9. ~~**Caddy rate-limit (F-14)**~~ — ✅ **FAIT (09/08, commit `cde708a7`)** : image custom `sigilos-caddy` (xcaddy + `caddy-ratelimit`), `Dockerfile.caddy`, `rate_limit` borne haute (300 req/min + burst 60/s) sur routes publiques (prod/beta/monitor), jamais fin sur le dashboard authentifié. **Fix Trivy DS-0002** (commit `fbc371e2`) : `USER caddy` non-root ajouté dans `Dockerfile.caddy`.
10. **Sanitisation HTML (F-11)** — ✅ **centralisée** dans `src/lib/security.ts` (DOMPurify) + descriptions Monstres Spéciaux + liens Ressources sanitizés (commit `d8189f42`).
11. **proxy-image (F-06)** — ✅ **FAIT** : limite de taille streaming (5 Mo), magic bytes + blocage HTML déguisé.
12. **Zero Console Policy (restant)** — ⚠️ **433** `console.*` dans `src/server/actions/` à convertir au `logger` (mesuré 09/08 ; chantier logiciel mécanique, sans risque métier — conversion 1-à-1, commit par fichier).

---

## 🪱 Supply Chain — Shai-Hulud (04/08/2026)

> Attaque npm active : compte mainteneur `keyv` compromis → ver voleur de credentials
> injecté via hook `"preinstall": "node setup.mjs"` (setup.mjs télécharge Bun → exécute
> Math_Symbol.js / math_init.js), propagation par tarballs npm + hooks IDE (.claude/.vscode).
> Sources : aikido.dev + dev.to (04-05/08/2026).

**Audit projet (05/08)** : NON impacté — versions saines verrouillées dans le lockfile :
- `keyv` installé `4.5.4` (compromis = `6.0.0`) · `flat-cache` `4.0.1` (compromis = `6.1.24`)
- `retry` `0.12.0` · `cacheable-request`/`cacheable`/`@cacheable/*` = **absents**.
- Aucun IOC dans `node_modules` (seul `setup.mjs` = motion-dom, bénin, whitelisté).
- Pas de dead-man's switch (`gh-token-monitor.sh` / `.config/gh-token-monitor` absents).

**Mesures en place (CI)** :
- ✅ **Scan IOC automatisé** `scripts/check-ioc-shai-hulud.sh` (bash, 3 niveaux, whitelist
  motion-dom justifiée) — inséré dans `verify.yml` (push + scan hebdo). Lecture seule,
  fail-closed UNIQUEMENT sur combinaison de signatures (0 faux positif validé).
- ✅ **Lockfile épinglé** (`integrity` + `npm ci`) + `npm audit --audit-level=high` en CI.
- ✅ **Build natif déplacé push→PR** dans `verify.yml` (économie double build, sans `AUTH_SECRET`).

**Décision `ignore-scripts=true`** : étudiée puis **écartée** (on laisse tel quel) —
 4 binaires natifs légitimes (esbuild, prisma, msgpackr-extract, unrs-resolver) exigent
 un postinstall ; activer globalement casserait le build et imposerait 4 commandes manuelles
 à chaque install. Profit faible sur nos machines (peu de tokens cloud, SSH seulement).
 `ignore-scripts` reste une option à considérer si un jour des tokens npm/GitHub/AWS
 durables doivent résider sur une machine de dev.

**Vigilance** : ne pas régénérer le lockfile ni mettre à jour `keyv`/`flat-cache`/`cacheable*`
 tant que l'écosystème n'est pas nettoyé.

---

## 📌 Règles à respecter pour tout futur code (voir RULES.md)

- **Fail-closed** : jamais accorder l'accès si une vérification échoue.
- **Pas de secret/fallback en dur** dans le code.
- **Comparaison de secrets en temps constant**.
- **Bornes validation** sur toute donnée issue d'une API externe.
- **Vérifier l'appartenance guilde** avant toute écriture multi-tenant.

---

*-- Plan de hardening maintenu après l'audit 2026 (refresh du log initial). --*



## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| dev     | :white_check_mark: |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in SigilOS, please report it responsibly:

1. **DO NOT** open a public issue
2. Contact the maintainer directly via Discord
3. Provide as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## État de la posture sécurité (audit 2026 — honnête et à jour)

> ⚠️ Ce fichier reflète **l'état réel** après l'audit. Certaines mesures sont **en place**, d'autres **restent à implémenter**. Il ne faut **pas** prétendre à une conformité complète tant que les chantiers ouverts ne sont pas faits.

### ✅ Mesures en place (corrigées / confirmées)
- **Auth.js avec Discord OAuth** : cookies `httpOnly`, `SameSite`, `__Secure-*` en prod
- **RBAC multi-tenant** : `getUserContext(guildId)` + guards (`isMember`, `isAdmin`) sur les actions
- **GOD Dashboard** : `isSuperAdmin()` sur toutes les actions de cycle de vie
- **Input validation** : Zod schemas sur toutes les entrées
- **Prisma ORM** : prévention SQL injection (pas de SQL brut)
- **Security Headers** : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `HSTS`, `CSP` nonce-based (via `src/proxy.ts`, Report-Only par défaut)
- **Uploads** : magic bytes + sharp post-traitement + filenames UUID (pas d'exécution)
- **SSRF proxy-image** : whitelist de domaines exacte + blocage IP internes/réservées
- **Fail-closed** : HMAC storage, RBAC Discord, rate-limit (partiellement), workers Cloudflare
- **CI/CD** : `npm audit`, Semgrep, Trivy, Gitleaks, lockfile integrity, `AUTH_SECRET` n'est plus injecté sur les PR
- **Bot Discord** : `DATABASE_URL` propre + intent `GuildMessageTyping` retiré
- **Authentification WebSocket (F-08, activée en beta 09/08 puis en PROD)** : décodage session + appartenance guilde à chaque connexion ; kill-switch `WS_AUTH_ENABLED` (false = mode permissif d'urgence). **Activée en prod le 09/08** (`WS_AUTH_ENABLED=true` dans `.env.prod`, confirmé `.env.beta` + `.env.prod`).
- **Chiffrement tokens OAuth (F-05)** : `src/lib/token-encryption.ts` (service `updateEncryptedDiscordTokens`, anti double-chiffrement) utilisé dans `auth.ts` events.signIn ; **en plus**, hook `updateMany` ajouté dans `src/lib/prisma.ts` (défense en profondeur, commit `339db4e1`) → plus aucun chemin n'écrit les tokens Discord en clair. **Audit + ré-encryptage terminé (09/08)** : beta 126/126 chiffrés · prod 3/3 chiffrés (script `scripts/re-encrypt-oauth-tokens.ts`, commit `091b7c46`) → **chantier F-05 TOTALEMENT FERMÉ**.
- **SSRF image-downloader (F-03)** : ✅ protégé — `assertSafeUrl` bloque protocoles non-http(s), IP privées/réservées (10/172.16-31/192.168/169.254/127/0.0.0.0) + DNS rebinding (re-IP après lookup), fetch timeout 20s.
- **JWT 8h (F-07)** : ✅ déjà en place — `src/auth.ts` override `maxAge: 8h` + `updateAge: 4h` (NIST SP 800-63B). (`auth.config.ts` affiche 24h mais l'override d'`auth.ts` gagne.)
- **Cache permissions (F-13)** : TTL réduit 60s → **30s** dans `guards.ts` (commit `0dd660bf`), cache **positif seulement** (une révocation/ban se propage en ≤30s).
- **proxy-image (F-06)** : ✅ protégé — limite de taille streaming (5 Mo), magic bytes (`detectMimeType`) avant traitement, blocage HTML/script déguisé en image, whitelist de domaines exacte + blocage IP internes/réservées.
- **Sanitisation HTML (F-11)** : ✅ `sanitizeHtml()` centralisée dans `src/lib/security.ts` (DOMPurify, addHook anti-tabnabbing), appliquée aux docs, sondages, présentation, guides (processHtml), songes. **Ajout 09/08** : descriptions des Monstres Spéciaux + liens Ressources sanitizés (commit `d8189f42`).
- **Zero Console Policy** : `auth.ts`, `image-downloader.ts`, `guards.ts` convertis au `logger` (commit `c62a2835`) **+ tous les `src/server/actions/` (09/08)** : **433 `console.*` → `logger`** (branche `feat/security-hardening-suite`, commits `4355d540` + `7dc0c01f`). `src/lib/logger.ts` rendu **tolérant** (contexte `unknown`/Error/BigInt → normalisation + sérialisation robuste). **Vérifs : 126/126 tests ✓ · tsc 0 ✓ · build Next.js ✓ · 0 console actif restant**. ⚠️ Script utilitaire `convert-console-to-logger.ps1` hors git.
- **Confidentialité — fuite `user.name` (nom de compte Discord)** : ✅ **CORRIGÉ (09/08, branche `fix/display-name-server-pseudo`)** — l'affichage du nom de **compte** Discord d'**autres membres** (`user.name`, ex: `john_doe_2003`) est remplacé par le **pseudo serveur** (`discordNickname`) via `getDisplayName()`/`getGameDisplayName()` dans `src/lib/display-name.ts` (priorité : pseudo serveur → pseudo Dofus → "Membre"). **~27 fichiers** (server actions, API, composants client, God). Le `user.name` reste autorisé uniquement pour le user connecté lui-même (header/nav/profil) et les logs d'audit `actorName`. Commits : `d3517f6a`→`2936f67b`. Vérifs : tsc/lint/tests/build OK.

### ⚠️ Chantiers ouverts (à résoudre — NE PAS considérer la sécurité comme complète tant qu'ils ne sont pas faits)
- **CSP nonce-based** : ✅ **DÉPLOYÉ (09/08)** — nonce par requête (proxy), `script-src` sans `'unsafe-inline'`, mode **Report-Only** par défaut (`CSP_ENFORCE=true` pour basculer en enforce), endpoint `/api/csp-report` + 16 tests. ✅ Auth WS **activée en beta puis prod** (WS_AUTH_ENABLED=true). **Reste** : confirmer aucune violation bloquante sur beta via `/api/csp-report` puis activer `CSP_ENFORCE=true` (beta, puis prod après 24-48h).
- **Grafana** : mot de passe admin à vérifier (`GRAFANA_PASSWORD` dans `.env.prod`/`.env.beta` — sinon `admin/admin` par défaut).
- ~~**Caddy rate-limit (F-14)**~~ : ✅ **FAIT (09/08, commit `cde708a7`)** — image custom `sigilos-caddy` (xcaddy + `caddy-ratelimit`), `Dockerfile.caddy`, `rate_limit` borne haute (300 req/min/IP + burst 60/s) sur **routes publiques** uniquement (prod/beta/monitor), jamais une limitation fine du dashboard authentifié. **Fix Trivy DS-0002** (commit `fbc371e2`) : `USER caddy` non-root ajouté dans `Dockerfile.caddy`.
- ~~**Zero Console Policy**~~ : ✅ **FAIT (09/08)** — 433 `console.*` → `logger` dans `src/server/actions/` (branche `feat/security-hardening-suite`, commits `4355d540` + `7dc0c01f`), logger tolérant, 126/126 tests, build OK. **Chantier fermé.**

### 🔒 Références
Le détail complet des findings et remédiations est documenté **en local** (hors dépôt) dans `docs/audits/AUDIT_SECURITE_SIGILOS.md` (généré suite à l'audit). Les rapports d'audit sont centralisés dans `docs/audits/` et ne sont **jamais committés**.

---

## 🔄 Maintenance Sécurité (fusion de SECURITY_MAINTENANCE.md)

> L'essentiel opérationnel de l'ancien `SECURITY_MAINTENANCE.md` est consolidé ici. Le détail du durcissement (fait/à faire) reste dans [`docs/SECURITY_HARDENING_PLAN.md`](./docs/SECURITY_HARDENING_PLAN.md).

### Politique de rotation des secrets
| Secret | Localisation | Impact si fuite | Fréquence |
|--------|--------------|-----------------|-----------|
| `NEXTAUTH_SECRET` | `.env` | Forgery de session (Critique) | 12 mois |
| `CRON_SECRET` | `.env` / VPS | Cron non autorisé | 6 mois |
| `DISCORD_CLIENT_SECRET` | Discord Dev Portal | Détournement de compte | 12 mois |
| `DATABASE_URL` | `.env` / VPS | Fuite de données (Critique) | À chaque changement d'infra |

### CSP (Content-Security-Policy)
- SigilOS utilise une **CSP basée sur Nonce** (implémentée 09/08, `feat/csp-nonce-based`).
- La CSP est **injectée dans la requête (pour Next) + la réponse (pour le navigateur)** par `src/proxy.ts`, en **Report-Only** par défaut. `CSP_ENFORCE=true` → mode enforce.
- Tout script (inline ou externe) **DOIT** passer le `nonce` (via `x-nonce`, posé par le proxy pour les JSON-LD).
- Les violations sont **reportées** sur `/api/csp-report` (endpoint Zod + rate-limit + logger).
- ⚠️ **Jamais `'unsafe-inline'`** dans `script-src` (en enforce). `style-src 'unsafe-inline'` est **conservé** (exigence Next.js).
- 🔜 **À faire** : confirmer aucune violation bloquante en beta via `/api/csp-report`, puis `CSP_ENFORCE=true` sur beta → prod.

### Zero Console Policy
Tous les `console.log` / `console.warn` / `console.error` sont **interdits** dans `src/server`. Utiliser le `logger` structuré (`@/lib/logger`).

### Rate-Limiting WebSocket
Le serveur WS (port 3001) est protégé par un rate-limit de connexion (défini dans `src/server/websocket/server.ts`) : **10 connexions / minute / IP**, enforcement Redis (fail-closed si Redis down).

### WebSocket Auth (F-08)
- **Activée en beta (09/08)** via `WS_AUTH_ENABLED=true` dans `.env.beta`. Le serveur WS décode la session (AUTH_SECRET) et vérifie l'appartenance guilde à chaque connexion (fail-closed : refus si décodage échoue).
- **Kill-switch** : `WS_AUTH_ENABLED=false` + `docker compose restart ws-beta` → retour au mode permissif d'urgence (rollback immédiat sans redéploiement).
- ⚠️ **Nécessite même `AUTH_SECRET` entre l'app et le WS** (déjà via le même `env_file`). En local dev, `WS_AUTH_ENABLED` absent = auth activée par défaut.
- ✅ **Testé en réel sur beta (09/08)** : présence live, 0 unauthorized, révocation God live (popup + redirect). **Avant prod** : répliquer les tests.
- ✅ **Session hardening (09/08)** : I-06 unifier Discord (bot = unique Gateway) · I-07 Redis séparé beta/prod · I-15 circuit breaker · F-14 Caddy rate-limit **déployé** · `app-prod` réparé (mot de passe DB encodé) + **rotation mdp DB prod** · CSP_ENFORCE beta activé. Détails : CONTEXT.md (Session hardening 09/08) + chantier God UX (sur branche, non merge).

### Réponse d'urgence (vulnérabilité)
1. Révoquer le secret concerné (ex. changer `CRON_SECRET`).
2. Mettre à jour les variables d'environnement VPS.
3. Redémarrer le processus Docker (`./scripts/deploy-cd.sh` ou `docker compose up -d`).
4. Examiner les logs `logger` pour détecter des patterns d'accès non autorisés.

### Rapports d'audit
- Les rapports d'audit (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `retour-kimik3.md`, `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises).
- Centralisés dans `docs/audits/`, ignorés via `.gitignore` (`docs/audits/`, `AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
- Après un audit : mettre à jour `docs/SECURITY_HARDENING_PLAN.md` (état + chantiers) et lancer `npm run test:run`.

---

## CSRF (Cross-Site Request Forgery) Protection

SigilOS s'appuie sur plusieurs couches de protection CSRF :

### 1. SameSite Cookies (Défense principale)
Tous les cookies d'authentification utilisent `SameSite=Lax` (configuré dans `auth.config.ts`) :
- Bloque les requêtes cross-site venant de domaines externes
- Cookies envoyés uniquement en navigation même-site ou GET top-level
- En prod : préfixe `__Secure-*` + `httpOnly` + `secure`

### 2. Vérification d'origine Next.js Server Actions
Les Server Actions Next.js vérifient automatiquement que le header `Origin` correspond :
- Rejette les requêtes de domaines externes
- Pas besoin de jetons CSRF pour les Server Actions

### 3. Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## XSS (Cross-Site Scripting) Prevention

### En place
- **Sanitisation HTML** : `sanitizeHtml()` ([security.ts](file:///a:/SigilOS/src/lib/security.ts)) sur les contenus utilisateur
- **Removes** : `<script>`, `<iframe>`, `<object>`, `<embed>`, handlers `on*`, protocoles `javascript:`

### À renforcer
- ✅ **CSP `script-src` nonce-based implémentée (09/08)** — plus de `'unsafe-inline'`. En **Report-Only** par défaut pour détecter les violations sans casser. **Confirmer en beta** qu'aucune violation bloquante n'apparaît via `/api/csp-report`, puis activer `CSP_ENFORCE=true`.

---

## GOD Dashboard Security (Super-Admin Actions)
- ✅ Toutes les actions de cycle de vie (`reactivateGuild`, `hardDeleteGuild`, etc.) vérifient `isSuperAdmin()`
- ✅ Confirmation des actions destructives (modals)
- ✅ Isolation guilde respectée (actions scopées par `guildId`)
- ✅ Server actions uniquement, pas de manipulation client
- ✅ Audit trail disponible via les logs

---

## Infrastructure Layer (VPS)
- ✅ **SSH Hardening** : Port 2222, Password Auth Disabled, Root login Disabled
- ✅ **Beta Gate** : Environnement Bêta protégé par mot de passe
- ✅ **Monitoring Security** : Grafana protégé par GitHub OAuth + mot de passe
- ✅ **Database Isolation** : BDD Bêta et Prod isolées
- ✅ **Automated Defense** : Fail2Ban
- ✅ **CI/CD Audits** : GitHub Actions (Lint, Build, Audit, Semgrep, Trivy, Gitleaks)

---

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix deployed:** Depends on severity (critical: ASAP, high: 1 week, medium: 2 weeks)
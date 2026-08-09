# Security Policy

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

### ⚠️ Chantiers ouverts (à résoudre — NE PAS considérer la sécurité comme complète tant qu'ils ne sont pas faits)
- **Authentification WebSocket (Socket.IO)** : le canal temps réel n'a **pas** de vérification d'identité ni d'appartenance guilde → **à sécuriser en priorité**
- **Chiffrement des tokens OAuth (Discord)** : `updateMany` ne chiffre pas → tokens potentiellement en clair en BDD
- **SSRF dans `image-downloader.ts`** (outil God) : aucune restriction de protocole/CIDR
- **Durée du JWT** : 7 jours au lieu de 8h recommandé (NIST SP 800-63B)
- **CSP nonce-based** : ✅ **Implémenté (09/08, commit `918fa308`)** — nonce par requête (proxy), `script-src` sans `'unsafe-inline'`, mode **Report-Only** par défaut (`CSP_ENFORCE=true` pour basculer en enforce), endpoint `/api/csp-report` + 16 tests. **À déployer** puis confirmer aucune violation bloquante sur beta avant enforce.
- **Clé de chiffrement de secours** codée en dur en dev (`encryption.ts`)
- **Cache des permissions** : 60s avant propagation d'une révocation
- **Grafana** : mot de passe admin à vérifier (si `GRAFANA_PASSWORD` absent → `admin/admin`)
- **Caddy** : pas de rate-limit au niveau proxy

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
- 🔜 **À faire** : déployer en beta, confirmer aucune violation bloquante via `/api/csp-report`, puis `CSP_ENFORCE=true` sur beta → prod.

### Zero Console Policy
Tous les `console.log` / `console.warn` / `console.error` sont **interdits** dans `src/server`. Utiliser le `logger` structuré (`@/lib/logger`).

### Rate-Limiting WebSocket
Le serveur WS (port 3001) est protégé par un rate-limit de connexion (défini dans `src/server/websocket/server.ts`) : **10 connexions / minute / IP**, enforcement Redis (fail-closed si Redis down).

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
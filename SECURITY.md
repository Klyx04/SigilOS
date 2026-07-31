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
- **Security Headers** : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `HSTS`, `CSP` (partielle, voir ci-dessous)
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
- **CSP nonce-based** : actuellement `'unsafe-inline'` sur `script-src` (protection XSS affaiblie)
- **Clé de chiffrement de secours** codée en dur en dev (`encryption.ts`)
- **Cache des permissions** : 60s avant propagation d'une révocation
- **Grafana** : mot de passe admin à vérifier (si `GRAFANA_PASSWORD` absent → `admin/admin`)
- **Caddy** : pas de rate-limit au niveau proxy

### 🔒 Références
Le détail complet des findings et remédiations est documenté **en local** (hors dépôt) dans `AUDIT_SECURITE_SIGILOS.md` (généré suite à l'audit). Les rapports d'audit ne sont **jamais committés**.

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

### À renforcer (chantier ouvert)
- **CSP `script-src`** utilise `'unsafe-inline'` → une XSS dans un champ non sanitisé pourrait s'exécuter. **Objectif : passer à un CSP nonce-based**. (à faire)

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
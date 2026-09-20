

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| `dev`   | :white_check_mark: (bêta) |
| `main`  | :white_check_mark: (production) |

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique.** Utiliser le canal privé :

➡️ **[Signalement privé GitHub](https://github.com/Klyx04/SigilOS/security/advisories/new)**
(*Private vulnerability reporting* — activé sur ce dépôt : l'échange reste privé entre vous et le
mainteneur, et donne lieu à un avis de sécurité publié après correctif).

À fournir : description · étapes de reproduction · impact potentiel · version/commit concerné ·
correctif suggéré le cas échéant. **Ne jamais joindre** de donnée d'exploitation réelle, de secret
ou d'export de base.

**Délais** — accusé de réception sous **48 h** · première évaluation sous **1 semaine** · correctif
selon la gravité (critique : au plus vite · élevée : 1 semaine · moyenne : 2 semaines).

**Périmètre** : le code de ce dépôt **et** le service en ligne (`sigilos.fr`, `beta.sigilos.fr`).
**Hors périmètre** : le jeu Dofus et les services tiers (Ankama, DofusDB, Metamob…) — à signaler à
leurs éditeurs.

## Référentiels pris comme cible

| Référentiel | Usage ici |
|---|---|
| **OWASP ASVS** | trame de vérification : authentification/session, contrôle d'accès, validation, crypto, journalisation |
| **OWASP Secure Headers / CSP** | en-têtes HTTP + `script-src` sans `'unsafe-inline'` |
| **OpenSSF Scorecard** | grille de contrôles du **dépôt** (protection de branche, épinglage des dépendances, permissions du token, revue de PR…) |
| **GitHub — Secure repository quickstart & Secure use reference** | politique de sécurité, secret scanning/push protection, Dependabot, CodeQL, durcissement des workflows |
| **NIST SP 800-63B** | durée de vie des sessions (`maxAge` 8 h / `updateAge` 4 h) |

> ⚠️ **Ce document décrit l'état RÉEL, jamais l'état souhaité.** Une mesure n'est cochée que si elle est
> vérifiable (fichier, commit, réglage). Les écarts connus sont listés explicitement ci-dessous, sans
> complaisance : annoncer une conformité complète serait le premier mensonge qu'un auditeur relèverait.

## Ce qui est activé côté GitHub (vérifié le 20/09/2026 via l'API)

| Réglage | État |
|---|---|
| Dépôt **public** (`Klyx04/SigilOS`) | ✅ assumé (vitrine technique) — conséquence : **aucun secret ne doit jamais y entrer** |
| Secret scanning | ✅ activé — **0 alerte ouverte** |
| Secret scanning : **push protection** | ✅ activée (un secret connu est bloqué au push) |
| Dependabot **security updates** | ✅ activées — **0 alerte ouverte** |
| Dependabot **version updates** | ✅ `npm` + `github-actions`, hebdomadaire, PR groupées (`.github/dependabot.yml`) |
| **Private vulnerability reporting** | ✅ activé (canal de signalement ci-dessus) |
| Permissions par défaut du `GITHUB_TOKEN` | ✅ **lecture seule**, approbation de revue par le token désactivée |
| Actions tierces épinglées par **SHA complet** | ✅ `gitleaks`, `semgrep`, `trivy` **et** `dorny/paths-filter` (`@ceb8a2b8… # v4`, depuis le 20/09/2026) |
| `SECURITY.md` + `CODEOWNERS` | ✅ présents (GitHub accepte `docs/SECURITY.md` comme politique de sécurité) |

### Images, métadonnées et empreintes de la machine (nettoyage du 20/09/2026)

Le dépôt étant **public**, tout ce qui trahit le poste de travail est une fuite. Audit mené
sur **1645 images suivies** + les archives d'uploads :

| Constat | Correctif appliqué |
|---|---|
| EXIF/XMP/texte présents dans les images (`Adobe Photoshop 26.5 (Windows)`, horodatages) | **199 images** nettoyées en **lossless** (données image recopiées octet pour octet, preuve : sha256 des pixels identiques avant/après) → **0 métadonnée** sur 1645 images |
| Chemins machine en dur (`C:\Users\…\Desktop\dofus_assets`) dans le code et la doc | remplacés par `os.homedir()` / placeholder — plus aucune arborescence locale nominative |
| Identifiants Discord en dur (guilde **et** propriétaire) dans des scripts | passés en variables d'environnement avec **échec explicite** si absents (jamais de fallback de dev) |
| Captures Discord (serveur tiers, pseudos de membres) suivies sans être référencées | **supprimées** (fichiers morts) |
| Captures d'écran d'explorateur local dans des uploads de « preuves » de guilde | retirées du suivi **et purgées de tout l'historique** le 20/09/2026 (voir écart **9**) |
| **Historique git** : 636 uploads morts, captures Discord d'un tiers, dump SQL (17,7 Mo), `.xlsx` (85 Mo), application Electron extraite, rapports de lint, fichiers de travail d'agents IA | **purge complète** le 20/09/2026 : `git filter-repo --invert-paths` sur **2 497 chemins** + anonymisation des identités (`Klyx04 <122028355+Klyx04@users.noreply.github.com>`) — **2 564 commits réécrits**, contenu identique à la purge près, historique **483 Mo → 206 Mo** |

**Contrôle automatique** : `node scripts/check-media-metadata.mjs` (zéro dépendance) échoue si une
image suivie porte EXIF/XMP/texte — branché dans le job `verify` **et** dans le hook `pre-commit`.
La règle « aucune capture du poste de travail » est inscrite dans [`RULES.md`](./RULES.md) §Sécurité.


## Écarts connus (backlog DevSecOps — rien n'est caché)

| # | Écart | Risque | Correctif |
|---|---|---|---|
| **1** | **Le ruleset de branche `secure-dev` existe mais est `disabled`** : ni `dev` ni `main` ne sont protégées | **Élevé** — la CI n'est pas un mur : un merge peut passer au rouge, un `push --force` reste possible sur la branche par défaut | GitHub → *Rules* → passer `secure-dev` en **Active** et y ajouter `Require a pull request`, `Required status checks` (`✅ Verify & Build`) et `Require review from Code Owners` |
| **2** | CodeQL **activé mais restreint au langage `actions`** (fichiers de workflow uniquement) : le code TypeScript/JavaScript de l'application n'est **pas** analysé | Moyen — pas d'analyse statique automatique du code applicatif | GitHub → *Settings → Advanced Security* → **CodeQL default setup** → ajouter `javascript-typescript` |
| **3** | Secret scanning : **validity checks** et **generic/non-provider patterns** désactivés | Faible (gratuit sur un dépôt public) | Même écran (*Secret Protection*) — à activer, coût nul |
| **4** | ~~`delete_branch_on_merge` = **false**~~ | — | ✅ **corrigé** : « Automatically delete head branches » est activé (`delete_branch_on_merge = true`) |
| **5** | ~~`dorny/paths-filter@v4` non épinglée par SHA~~ | — | ✅ **corrigé le 20/09/2026** : `@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4` |
| **6** | Conteneurs prod sans `security_opt: no-new-privileges:true`, `cap_drop`, `read_only`/`tmpfs` ni `user:` explicite | Moyen — surface post-exploitation | `docker-compose.prod.yml` (hors Caddy, qui doit garder ses capacités de binding) — **valider sur bêta avant prod** |
| **7** | Ni **OpenSSF Scorecard**, ni **attestation de provenance** (SLSA) sur les images GHCR | Faible/Moyen — pas de note externe ni de preuve de build reproductible | Workflow `scorecard.yml` officiel + `actions/attest-build-provenance` dans `deploy.yml` |
| **8** | **Grafana** : `GRAFANA_PASSWORD` à confirmer en prod (sinon `admin/admin` par défaut) | Moyen | Vérifier `.env.prod` |
| **9** | ~~**Médias sensibles encore présents dans l'HISTORIQUE git**~~ | — | ✅ **corrigé le 20/09/2026** : réécriture d'historique (`git filter-repo --invert-paths`, **2 497 chemins** : uploads morts, captures Discord, dump SQL, `.xlsx` de 85 Mo, `tmp/ankama-launcher-extracted`, rapports de lint) + anonymisation des identités → **2 564 commits réécrits**, arbre de chaque branche identique **à la purge près** (vérifié avant le force-push), historique **483 Mo → 206 Mo**. **Résiduel assumé** : les *pull requests* historiques (`refs/pull/*`, 688 refs) restent consultables côté GitHub, et les copies externes (Web Archive, caches) échappent au dépôt → ticket au Support GitHub + demandes d'exclusion |

## État de la posture sécurité (audit 2026 — honnête et à jour)

> ⚠️ Ce fichier reflète **l'état réel** après l'audit. Certaines mesures sont **en place**, d'autres **restent à implémenter**. Il ne faut **pas** prétendre à une conformité complète tant que les chantiers ouverts ne sont pas faits.

### ✅ Mesures en place (corrigées / confirmées)
- **Auth.js avec Discord OAuth** : cookies `httpOnly`, `SameSite`, `__Secure-*` en prod
- **RBAC multi-tenant** : `getUserContext(guildId)` + guards (`isMember`, `isAdmin`) sur les actions
- **GOD Dashboard** : `isSuperAdmin()` sur toutes les actions de cycle de vie
- **Input validation** : Zod schemas sur toutes les entrées
- **Prisma ORM** : prévention SQL injection (pas de SQL brut)
- **En-têtes de sécurité** (posés par `next.config.ts` sur `/:path*`, dupliqués dans le `Caddyfile` pour les pages statiques) : `Strict-Transport-Security` (1 an, `includeSubDomains`, `preload`) · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` (caméra/micro/géolocalisation/paiement désactivés) · `Cross-Origin-Opener-Policy` + `Cross-Origin-Resource-Policy`. La **CSP** (nonce par requête, `frame-ancestors 'none'`, `object-src 'none'`) est posée par `src/proxy.ts` en **mode enforce** (`CSP_ENFORCE=true` depuis le 10/08). `X-XSS-Protection` a été **retiré** (en-tête obsolète, non standard, pouvant introduire des failles sur sites sains — cf. MDN).
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
- **Kill-switch RBAC individuelle (16/08, chantier #72)** : `PlatformConfig.rbacUsersMappingEnabled` (migration `20260816100000_add_rbac_users_mapping_toggle`) — toggle God « Membres Spécifiques », **fail-closed** : off → `getUserContext` ignore totalement `usersMapping` et `updateRBACMapping` rejette toute modification. Helper `src/lib/platform-rbac.ts` (cache 30s, invalidé au toggle). UI : bannière 🚫 + sélecteurs par membre masqués dans `/admin/permissions`.
- **God API hardening (16/08, chantier #47)** : `api/god/notify` — Zod borné (title≤200/message≤4000/metadata≤20 clés scalaires) + comparaison secret en **temps constant** (`safeEqualStrings`) + logger ; `api/god/upload-image` — bornage taille **10 Mo** (413 avant lecture buffer). Config plateforme + maintenance tracées (`GOD_CONFIG_OVERRIDE` / `GOD_MAINTENANCE_MODE`).

### ⚠️ Chantiers ouverts (à résoudre — NE PAS considérer la sécurité comme complète tant qu'ils ne sont pas faits)
- **CSP nonce-based** : ✅ **DÉPLOYÉ + ENFORCE (10/08)** — nonce par requête (proxy), `script-src` sans `'unsafe-inline'`, `CSP_ENFORCE=true` **activé sur beta PUIS prod** (0 violation bloquante), endpoint `/api/csp-report` + 16 tests. Auth WS **activée en beta puis prod** (WS_AUTH_ENABLED=true). **Chantier fermé.**
- **Grafana** : mot de passe admin à vérifier (`GRAFANA_PASSWORD` dans `.env.prod`/`.env.beta` — sinon `admin/admin` par défaut).
- ~~**Caddy rate-limit (F-14)**~~ : ✅ **FAIT (09/08, commit `cde708a7`)** — image custom `sigilos-caddy` (xcaddy + `caddy-ratelimit`), `Dockerfile.caddy`, `rate_limit` borne haute (300 req/min/IP + burst 60/s) sur **routes publiques** uniquement (prod/beta/monitor), jamais une limitation fine du dashboard authentifié. **Fix Trivy DS-0002** (commit `fbc371e2`) : `USER caddy` non-root ajouté dans `Dockerfile.caddy`.
- ~~**Zero Console Policy**~~ : ✅ **FAIT (09/08)** — 433 `console.*` → `logger` dans `src/server/actions/` (branche `feat/security-hardening-suite`, commits `4355d540` + `7dc0c01f`), logger tolérant, 126/126 tests, build OK. **Chantier fermé.**

### 🔒 Références
Le détail complet des findings et remédiations est documenté **en local** (hors dépôt) dans `docs/audits/AUDIT_SECURITE_SIGILOS.md` (généré suite à l'audit). Les rapports d'audit sont centralisés dans `docs/audits/` et ne sont **jamais committés**.

---

## 🔄 Maintenance Sécurité (fusion de SECURITY_MAINTENANCE.md)

> L'essentiel opérationnel de l'ancien `SECURITY_MAINTENANCE.md` est consolidé ici. Le détail du durcissement (fait/à faire) reste dans [`SECURITY_HARDENING_PLAN.md`](./reference/SECURITY_HARDENING_PLAN.md).

### Politique de rotation des secrets

> Les noms ci-dessous sont ceux **réellement** portés par `.env` / `.env.example` (vérifié le 20/09/2026).

| Secret | Impact si fuite | Fréquence | Rotation immédiate si… |
|---|---|---|---|
| `AUTH_SECRET` | Forgery de session / de JWT (**critique**) | 12 mois | fuite suspectée → rotation **+ invalidation des sessions** |
| `DATABASE_URL` (mot de passe Postgres) | Fuite de données (**critique**) | à chaque changement d'infra | tout partage d'accès, départ d'un tiers |
| `ENCRYPTION_KEY` | Déchiffrement des tokens OAuth stockés (**critique**) | 12 mois | fuite → rotation **avec ré-encryptage** (`scripts/re-encrypt-oauth-tokens.ts`) |
| `DISCORD_BOT_TOKEN` | Prise de contrôle du bot | 12 mois | tout partage, tout log |
| `DISCORD_CLIENT_SECRET` | Détournement OAuth (Discord Dev Portal) | 12 mois | toute suspicion |
| `CRON_SECRET` / `WORKER_CRON_SECRET` | Déclenchement non autorisé des crons (**critique**) | 6 mois | tout partage |
| `DOFUS_LADDER_WORKER_KEY` / `_SECRET`, `DOFUSBOOK_WORKER_SECRET` | Usurpation des workers Cloudflare | 12 mois | toute suspicion |
| `METAMOB_API_KEY`, `OCR_SPACE_API_KEY`, `TWITCH_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `KOFI_VERIFICATION_TOKEN` | Quota/abus d'une API tierce, faux webhooks | 12 mois | toute suspicion |
| `GHCR_TOKEN` (PAT) | Push/écriture d'images | à l'expiration (**`deploy-cd.sh` alerte**) — viser un PAT finement scopé (`write:packages`) | tout partage |

**Procédure** : rotation → mise à jour des variables du VPS (`/opt/sigilos/.env.*`) → `docker compose up -d` (ou `./scripts/deploy-cd.sh`) → vérifier les healthchecks → consigner la rotation dans `docs/MAINTENANCE.md`.

### CSP (Content-Security-Policy)
- SigilOS utilise une **CSP basée sur Nonce** (implémentée 09/08, `feat/csp-nonce-based`).
- La CSP est **injectée dans la requête (pour Next) + la réponse (pour le navigateur)** par `src/proxy.ts`, en **Report-Only** par défaut. `CSP_ENFORCE=true` → mode enforce.
- Tout script (inline ou externe) **DOIT** passer le `nonce` (via `x-nonce`, posé par le proxy pour les JSON-LD).
- Les violations sont **reportées** sur `/api/csp-report` (endpoint Zod + rate-limit + logger).
- ⚠️ **Jamais `'unsafe-inline'`** dans `script-src` (en enforce). `style-src 'unsafe-inline'` est **conservé** (exigence Next.js).
- ✅ **CSP_ENFORCE activé sur BETA puis PROD (10/08)** : mode enforce, nonce par requête, **0 violation bloquante** collectée. Voir docs/CONTEXT.md (section CSP nonce-based).

### Zero Console Policy
Tous les `console.log` / `console.warn` / `console.error` sont **interdits** dans `src/server`. Utiliser le `logger` structuré (`@/lib/logger`).

### Rate-Limiting WebSocket
Le serveur WS (port 3001) est protégé par un rate-limit de connexion (défini dans `src/server/websocket/server.ts`) : **10 connexions / minute / IP**, enforcement Redis (fail-closed si Redis down).

### WebSocket Auth (F-08)
- ✅ **Activée en beta PUIS PROD (09/08)** via `WS_AUTH_ENABLED=true` dans `.env.beta` et `.env.prod`. Le serveur WS décode la session (AUTH_SECRET) et vérifie l'appartenance guilde à chaque connexion (fail-closed : refus si décodage échoue).
- **Kill-switch** : `WS_AUTH_ENABLED=false` + `docker compose restart ws-beta` → retour au mode permissif d'urgence (rollback immédiat sans redéploiement).
- ⚠️ **Nécessite même `AUTH_SECRET` entre l'app et le WS** (déjà via le même `env_file`). En local dev, `WS_AUTH_ENABLED` absent = auth activée par défaut.
- ✅ **Testé en réel sur beta (09/08 PUIS 10/08)** : présence live, 0 unauthorized, révocation God live (popup + redirect), reconnexion/temps réel validés. **Activé et opérationnel sur beta + prod.**
- ✅ **Session hardening (09/08)** : I-06 unifier Discord (bot = unique Gateway) · I-07 Redis séparé beta/prod · I-15 circuit breaker · F-14 Caddy rate-limit **déployé** · `app-prod` réparé (mot de passe DB encodé) + **rotation mdp DB prod** · CSP_ENFORCE beta activé. Détails : docs/CONTEXT.md (Session hardening 09/08) + chantier God UX (sur branche, non merge).

### Réponse d'urgence (vulnérabilité)
1. Révoquer le secret concerné (ex. changer `CRON_SECRET`).
2. Mettre à jour les variables d'environnement VPS.
3. Redémarrer le processus Docker (`./scripts/deploy-cd.sh` ou `docker compose up -d`).
4. Examiner les logs `logger` pour détecter des patterns d'accès non autorisés.

### Rapports d'audit
- Les rapports d'audit (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `retour-kimik3.md`, `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises).
- Centralisés dans `docs/audits/`, ignorés via `.gitignore` (`docs/audits/`, `AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
- Après un audit : mettre à jour `docs/reference/SECURITY_HARDENING_PLAN.md` (état + chantiers) et lancer `npm run test:run`.

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

### À surveiller (pas un chantier ouvert)
- ✅ **CSP `script-src` nonce-based** : plus de `'unsafe-inline'`, **mode enforce actif en bêta ET en prod depuis le 10/08** (0 violation bloquante collectée). Endpoint de collecte : `/api/csp-report`. **À surveiller** : toute nouvelle dépendance front qui injecterait un script inline doit être adaptée (nonce) — sinon elle casse en prod.

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
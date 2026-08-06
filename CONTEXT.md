# 🧠 CONTEXT — SigilOS (Contexte global à fournir à chaque prompt)

> **Ce fichier est le point d'entrée du contexte projet.** Il centralise la vision globale et pointe vers les références détaillées. À référencer en tête de **chaque** nouveau prompt, pour que l'IA (Cline, ou autre) ait toujours la vision complète et ne rate rien.

---

## 👉 À fournir pour chaque prompt (démarrage rapide)

- **→ Utiliser `PROMPT_START.md`** (à la racine) : il donne le bloc à coller + la ligne à ajouter selon le type (bug, sécu, infra, SEO, BDD). C'est le réflexe n°1.
- **Référencer `CONTEXT.md`** en premier (contexte global).
- L'IA lit ensuite les fichiers référencés selon le sujet (sécurité → `SECURITY.md`, dev → `RULES.md`, infra → `MAINTENANCE.md`, SEO → `docs/SEO_REPRISE.md`).
- **Ne pas** déverser tout le repo dans le prompt — `PROMPT_START.md` + `CONTEXT.md` suffisent à orienter.

---

## 🏗️ Vue d'ensemble

- **Produit** : Bot Discord + Dashboard web pour la gestion de guildes Dofus (missions, ladder, calendrier, services, jeux, etc.)
- **Stack** : Next.js 16 (App Router + Server Actions + RSC) • React 19 • TypeScript 5 • Prisma 7 • PostgreSQL • Redis (BullMQ) • Discord.js v14 • Socket.IO • Tailwind 4
- **Archi** : Server-first + App Router ; **multi-tenant** (une app pour toutes les guildes, données scopées par `guildId`)
- **Auth** : Auth.js v5 (Discord OAuth, JWT, cookies `httpOnly`/`SameSite`/`__Secure-*` en prod)
- **Infra** : VPS Docker (app, bot, workers, ws, db, redis, monitoring) orienté **Caddy** reverse proxy • **Cloudflare Workers** (proxies ladder/dofusbook) • **Grafana/Prometheus** • **Sentry** • Backups chiffrés GPG → Cloudflare R2
- **CI/CD** : GitHub Actions (`dev`→beta, `main`→prod), `npm audit`, Semgrep, Trivy, Gitleaks, lockfile integrity
- **Déploiement CD (2026-08)** : build sur GitHub → images poussées vers **GHCR** (`.github/workflows/deploy.yml`) → le VPS fait `./scripts/deploy-cd.sh` (pull + up, ~30s, aucun build local). Fallback historique : `./scripts/deploy.sh`. **Rollback en 1 commande** : `./scripts/rollback.sh`. Voir `MAINTENANCE.md` (section 3b + procédures).

---

## 🔒 Non-négociables (résumé — toujours appliqués)

> Détail complet : `RULES.md` (conventions + sécu) et `SECURITY.md` (posture + chantiers).

1. **Auth sur chaque action** : `await auth()` ou `getUserContext(guildId)` en début de toute action.
2. **Guild isolation** : toute requête BDD filtrée par `guildId` (multi-tenant).
3. **Fail-closed, jamais fail-open** : si une vérification/API tierce échoue → REFUSER (jamais accorder l'accès par défaut).
4. **Pas de secret en dur ni de fallback** dans le code → `process.env.*` uniquement, fail-closed si absent.
5. **Comparaison de secrets en temps constant** (`timingSafeEqual` / `timingSafeEqualStr`).
6. **Validation & bornes** : Zod sur toutes les entrées ; borner les valeurs issues d'API externes (longueur, plage).
7. **Vérifier l'appartenance à la guilde** avant toute écriture multi-tenant (cible vs contexte).
8. **Pas de `console.log` en prod** → utiliser `logger` de `@/lib/logger` (auto-redaction des secrets).
9. **Rapports d'audit JAMAIS commités** (`docs/audits/`, `AUDIT_*.md`, `src/audit-*`) — centralisés dans `docs/audits/`, gardés en local, ignorés via `.gitignore`.
10. **Secrets jamais commités** (`.env*`) ni partagés dans un canal non sécurisé.

---

## 📚 Références détaillées (à lire selon le sujet)

| Fichier | Rôle |
|---------|------|
| **`CONTEXT.md`** | Ce fichier — point d'entrée |
| [`RULES.md`](./RULES.md) | Conventions de dev + règles de sécurité **non-négociables** + patterns copy-paste |
| [`SECURITY.md`](./SECURITY.md) | Posture sécurité **réelle** (mesures en place + chantiers ouverts) |
| [`docs/SECURITY_HARDENING_PLAN.md`](./docs/SECURITY_HARDENING_PLAN.md) | Plan de durcissement (quoi de fait / quoi reste) |
| [`MAINTENANCE.md`](./MAINTENANCE.md) | Infra VPS : backups, monitoring, déploiement, urgence |
| [`README.md`](./README.md) | Démarrage, stack, structure, scripts |
| [`docs/REDIS-OCR-SETUP.md`](./docs/REDIS-OCR-SETUP.md) | Infra OCR & Redis (VPS) — setup spécifique |
| [`prisma/schema.prisma`](./prisma/schema.prisma) | Schéma BDD (source de vérité des modèles) |

---

## ⚙️ Règles d'interaction avec l'IA (moi, Cline ou autre)

0. **ENV DE DEV LOCAL (POSTE) = PowerShell** — le terminal local est PowerShell sur Windows, PAS `cmd.exe`. Utiliser la syntaxe PowerShell : séparateur `;` (PAS `&&`), suppression de dossier `Remove-Item -Recurse -Force` (PAS `rmdir /s /q`), variables `$`. Les commandes `npm`/`npx`/`git` restent identiques. Note : le VPS Docker utilise du bash/sh côté serveur — rester en PowerShell uniquement pour les actions sur le poste local.
1. **Ne jamais modifier** `docs/audits/`, `src/audit-*`, `AUDIT_*.md` (livrables locaux hors git).
2. **Respecter strictement** `RULES.md` (fail-closed, validation, guilde isolation, logger).
3. **Vérifier** avant tout commit : pas de secret, pas d'audit, `npm run test:run` + `npm run build` en local.
4. **Nommer les findings** avec référence (F-xx) si on parle d'audit, et pointer le fichier précis.
5. **Pousser** sur une branche, puis PR vers `dev` (pas directement sur `main`/`dev` sauf cas exceptionnel).

---

## 🧭 Suivi de chantier courant (Évol 4 — God evolutions)

> **Source de vérité par tâche** : `src/temp/evolution4.md` (gitignoré, à relire en PRIORITÉ à chaque reprise).
> Mode de travail : **un prompt par tâche** — lire le suivi + CONTEXT.md, pas tout le code.

**Branche** : `evo4-god-evolutions` → PR vers `dev`. **État** : R1 + R2 + R3 terminés (R3 FAIT confirmé en beta le 06/08).

- ✅ **R1** — Lectures God granuleuses par scope (`canGodAccess`) + redirect tab fail-closed + refonte `god/page.tsx` par tab. FAIT.
- ✅ **R2** — Tuto God interactif (`god-access-banner.tsx` → client + localStorage + bouton « Revoir »). FAIT.
- ✅ **R3 — FAIT (06/08)** — Anti-scout : secret route `GOD_ROUTE`, noindex + `X-Robots-Tag`, rate-limit + IP allowlist désactivable, fuite `/god/dofus-guides` retirée, F-SEC-1 corrigé.
  - ✅ **Confirmation beta** : admin connecté → panel `/god` affiche (200) ; non-connecté → 404 ; `/mng-FAKE` → 404.
  - ✅ **Deux causes du 404 admin connecté corrigées** :
    1. **Edge runtime** : `src/middleware.ts` (Next 16) forçait Edge → env inlinés au build (GOD_ROUTE/AUTH_SECRET invisibles au runtime). **Fix** : `middleware.ts` → **`src/proxy.ts`** (convention Proxy = Node runtime, `process.env` lu au runtime). Commit `f50ecdfc`.
    2. **Décodage session dans le proxy** : `req.auth` (providers vides) ne décodait pas le cookie JWT → `hasAuth:false` même connecté → garde `/god` sans session → 404. **Fix** : `getToken` de `next-auth/jwt` (`fa8fb7de`) + forcer `cookieName`/`secureCookie` pour lire le même cookie que le serveur (`963e7c07`).
  - ✅ **Rate-limit final (`d7cc8389`)** : 120 req/min sur routes God **légitimes** (plus de 429 sur `/mng-<secret>?tab=...`), 10 req/min sur **mauvais secrets** (anti-brute-force).
  - ✅ Vérifs : `test:run` 97 ✅, `tsc --noEmit` 0 ✅, `lint` 0 ✅, `build` 62 pages ✅.
  - ⚠️ **Secret réel fuité dans l'historique git → à ROTATER** (nouvelle `GOD_ROUTE` sur beta + prod, `.env`). Procédure dans `src/temp/evolution4.md`.
- ✅ **R4 FAIT (06/08)** — Session God + révocation live complète : schema Prisma (scopeVersion + GodAccessLog/GodSessionLog), revokeDelegate bump scopeVersion + audit, **révocation LIVE socket/SSE** (Redis pub/sub `god:revoked` → WS room `user:<userId>` → popup + redirect via `GodExpiryGuard`), **session active `GodSessionLog`** (open/heartbeat/close dans le layout via `god-session-tracker`). Fail-closed si socket down (polling + garde serveur).
- ✅ **R5** — Logging exhaustif God : `GOD_DASHBOARD_ACCESS` ajouté + remplacé le no-op `logPageAccess` dans le layout par `createGodAuditLog`.
- ✅ **PILIER D (PIM granulaire) FAIT + durci (06/08)** — Table `GodAccessGrant` + guard `canAccessBrick` (fail-closed, **fix double OR** qui laissait passer les grants expirés) + grant/revoke JIT (durée, justification obligatoire) + UI `/god/delegates` + warn anti-scout. **Ajouts 06/08 → commits `2f3dc878`, `028bac21`, `eb3ff2a8`, `31832de5`, `a1e9e593`** :
  - **PIM réellement fonctionnel** : registre centralisé `god-bricks.ts` (`subGodAccess` fail-closed), `getAccessibleBricks()`, sidebar/layout filtrent par brique, matrice sous-god stricte (test-debug) — ses pages interdites (overview/telemetry/infra/notifications/mini-games/security/bugs/roadmap/changelog/onboarding/delegates) jamais visibles d'un sous-god, guildes en whitelist seule (ReadOnly), pages d'atterrissage via `resolveGodLanding` tenant compte des briques.
  - **Traçage God exhaustif** : helper `logGodWrite` + nouvelles actions Audit (`GOD_GUIDE_UPDATE`, `GOD_RUSH_UPDATE`, `GOD_QUEST_DATA_UPDATE`, `GOD_GAME_DATA_UPDATE`, `GOD_TICKET_ACTION`, `GOD_DOC_UPDATE`) posées sur toutes les écritures guides/rush/quetes/game-data/tickets/docs — log UNIQUEMENT sous-god (pas de doublon admin).
  - **Édition en place des droits** : `syncBrickAccessForDelegate()` (diff atomique : crée/révoque/prolonge, bump scopeVersion, audit) + `EditAccessManager.tsx`. Plus de « révoquer + recréer ».
  - **UX sous-god** : `getMyActiveGrants()` → vue **« Mon accès »** dans le bandeau (remplace le lien mort `/god/delegates`) avec temps restant par brique ; **`GodExpiryGuard`** : badge permanent « Expire : X », popup <10 min, **déconnexion forcée** quand tous les accès expirent (fail-closed UI).
  - **Refonte `/god/delegates`** : stepper 3 étapes (Délégué → Scopes & Briques → Durée & Validation), délégué créable vierge, scopes exploitables restreints, durée flexible (min/heures/jours), historique isolé dans `AccessHistory`.
  - **`.next` corrompu** supprimé/régénéré → tsc OK ; **110 tests** ✅.
- ⚠️ **Navigation** : Sous-Gods pointe vers la route dédiée `/god/delegates` (plus `?tab=delegates`).
- ✅ **F-SEC-1** — Corrigé (invite Discord `permissions=8` → `DISCORD_BOT_INVITE_URL` + toggle).
- 🧹 **À faire** : déployer PR #405 (rate-limit) beta ; rotation `GOD_ROUTE` (secret fuité) — modifier `.env` + `docker compose up -d` ; **R4 complet** (session GodSessionLog dans le layout + révocation live socket/SSE — le guard couvre l'expiration par polling mais pas la révocation instantanée) ; volume `GOD_DASHBOARD_ACCESS` (loggé à chaque rendu) ; B3-B5 (refonte overview, primitives, animations) ; A4 purge/ménage ; évolutions 2/3 (fuite `user.name` ~90 fichiers, etc.).

**Checkpoint** : `npm run test:run` (97 tests) ✅ + `npm run build` (62 pages) ✅ + `npx tsc --noEmit` ✅ + ESLint 0 ✅.

---

## 🧭 Chantiers de sécurité restants (rappel — voir SECURITY.md)

**État au 01/08/2026 :** F-02, F-06/F-03, F-04, F-01, F-12, F-23/F-24, F-19/F-27/F-26/F-18/F-22 corrigés. **Session d'après-audit (01/08) ajoutée :** F-08 (auth WS), F-05 (chiffrement OAuth), F-04 (fail-closed + IP fiable), F-02 (expiration + clé dédiée), F-07 (JWT 8h), F-03 (SSRF image-downloader). **Rapports centralisés :** `docs/audits/` (hors git). Reste :

- **1. CSP nonce-based** (remplacer `unsafe-inline`) — chantier séparé (Report-Only d'abord).
- **2. Clé de chiffrement de secours** en dev (`encryption.ts` fallback).
- **3. Cache permissions 60s** (F-13 — réduire TTL).
- **4. Caddy rate-limit** (F-14 — au niveau proxy).
- **5. F-01 partiel** : fallback RBAC `guards.ts` (l.96-117, 229-244) + cache « positif seulement » à consolider.
- **6. F-06 partiel** : proxy-image sans limite de taille ni magic bytes (à compléter).
- **7. F-11** : sanitisation HTML centralisée.

**Déploiement :** F-08 (auth WS) est fourni avec kill-switch `WS_AUTH_ENABLED=false` → **activer en beta d'abord**, tester reconnexion, puis prod.

**Infra faite (01/08) :** I-03, I-04, I-05, I-10, I-11, I-12, I-02, I-08. **Faux positifs écartés :** I-01, I-17. **Reste infra :** I-06 (unifier Discord), I-07 (séparer Redis), I-15 (circuit breaker). **Gartic/Skribbl supprimés du code** (dashboard + code mort retiré).

---

*— Fichier de contexte global maintenu à jour (créé à l'issue de l'audit 2026). —*
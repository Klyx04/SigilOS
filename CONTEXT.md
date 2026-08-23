# 🧠 CONTEXT — SigilOS (Contexte global à fournir à chaque prompt)

> **Point d’entrée du contexte projet — VERSION CONDENSÉE (2026-08-21).**
> ⚠️ L’historique détaillé des sessions (avant le 21/08/2026) est archivé :
> `src/temp/archive/contexte/CONTEXT-historique-complet-2026-08-21.md` — NON relu par les prompts.
> Mémos / amorces anciens : `src/temp/archive/`. Rien n’a été supprimé.

---

## 👉 À fournir pour chaque prompt (démarrage rapide)

- **→ Utiliser `PROMPT_START.md`** (à la racine) : bloc à coller + ligne selon le type (bug, sécu, infra, SEO, BDD).
- **Référencer `CONTEXT.md`** en premier (ce fichier). L’IA lit ensuite selon le sujet (sécurité → `SECURITY.md`, dev → `RULES.md`, infra → `MAINTENANCE.md`, SEO → `docs/SEO_REPRISE.md`).
- **Ne pas** déverser tout le repo dans le prompt — `PROMPT_START.md` + `CONTEXT.md` suffisent.

## 🏗️ Vue d’ensemble

- **Produit** : Bot Discord + Dashboard web pour la gestion de guildes Dofus (missions, ladder, calendrier, services, jeux, etc.).
- **Stack** : Next.js 16 (App Router + Server Actions + RSC) · React 19 · TypeScript 5 · Prisma 7 · PostgreSQL · Redis (BullMQ) · Discord.js v14 · Socket.IO · Tailwind 4.
- **Archi** : Server-first + App Router ; **multi-tenant** (une app pour toutes les guildes, données scopées par `guildId`).
- **Auth** : Auth.js v5 (Discord OAuth, JWT, cookies `httpOnly`/`SameSite`/`__Secure-*` en prod).
- **Infra** : VPS Docker (app, bot, workers, ws, db, redis, monitoring) orienté **Caddy** reverse proxy · **Cloudflare Workers** (proxies ladder/dofusbook) · Grafana/Prometheus · Sentry · Backups GPG → Cloudflare R2.
- **CI/CD** : GitHub Actions (`dev`→beta, `main`→prod), `npm audit`, Semgrep, Trivy, Gitleaks. Déploiement CD (build GitHub → images GHCR → VPS `scripts/deploy-cd.sh`, ~30s). Fallback historique `scripts/deploy.sh`, rollback `scripts/rollback.sh`. Voir `MAINTENANCE.md`.

## 🧭 Chantier global — `src/temp/chantier.md` (liste des tâches annotée)

> 📌 Pour les prompts, lire **`src/temp/chantier-actif.md`** (demandes ouvertes + dernières annotations, léger).
> Le fichier `chantier.md` complet (toutes demandes + historique) est conservé/archivé.

### 🔴 PRIORITÉ #223 — Résilience Discord long terme (point dur : **16/11/2026**)
> ✅ **P0 + P1 + P2 + fix CodeQL FAIT + MERGÉ (PR #520, `6e5a779a3`)** — anti-obfuscation (name nullable, UI « Salon masqué ») · signature Ed25519 UNIFIÉE (anti-replay ±300 s, clé 64 hex, fail-closed 401) · route webhook au FORMAT RÉEL (PING→204, `APPLICATION_AUTHORIZED`/`DEAUTHORIZED` ; handlers Gateway morts supprimés — Gateway = source de vérité) · fetch membres centralisés · invite SANS `permissions=8` (bitmask 6356836904068) · User-Agent `DiscordBot (url, version)` · doc intents · **fix CodeQL SSRF** (barrière regex ancrée). Vérifs : tsc 0 · lint 0 · **283/283** · build OK · **CodeQL vert**.
> 🟢 **Reste (P3 + finition + veille)** : outbox BullMQ/Redis écritures Discord · révocation de session Auth.js sur `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) · **veille mensuelle changelog Discord + jour J 16/11/2026**.
> 📄 Plan maître : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` · Source technique : `sigilos-discord-resilience.md` (⚠️ §12 = VEILLE) · Mémo : `src/temp/memo-2026-08-21-resilience-discord.md` · Amorce : `src/temp/prompt-next-chantier-2026-08-21-resilience-discord.md`.
> 🔒 Consignes stabilité long terme (plan maître §5) : couche anti-corruption unique, IDs only (jamais de noms), name nullable, v10 explicite, UA, signature + timestamp, **pas d’upgrade v11 sans preuve changelog**.

### Sessions récentes (résumé — détail dans l’archive)
| Session | Contenu |
|---|---|
| **23/08** | **Landing & ouverture prod (vitrine `maintenance.html` + `page.tsx`)** : CTA contrasté (`.header-nav a.header-cta` → 6.67) · `docs/DECISION-OUVERTURE-LANDING.md` créé (décision + checklist ouverture) · Caddy `sigilos.fr` = `rewrite * /maintenance.html` (L75) · **métadonnées vérification Discord validées** : 4/6 manquants = URLs (CU, privacy, install) à remplir après ouverture (pointeur « offensive » déjà OK) · placeholders Discord/Portal/Dev remplis avec liens prod après ouverture (décidé — aucun code à changer) · **`/legal/*` existent** (`src/app/legal/{cgu,privacy,mentions,faq}/page.tsx`, contredit les recherches précédentes). ⏳ **Décision user pendante** : refonte immersive landing React maintenant ou après ouverture · preview `:9320` (PID 61956) jusqu'à confirmation. |
| **22/08** | **BLOC A complet (9 quick wins)** : #192 bouton Suivant darkmode · #199 tour Succès (ancres stables) · #204 upload missions masqué pour God · **#201 embeds prêts/coffre** (migration `20260822000000_add_loan_vault_discord_embeds` + suppression embed à la clôture/purge) · #202 RBAC footer sticky bas + indicateur non-sauvé · #206 Dofoobz image locale · #203 multi-DJ taille de groupe par donjon ; #286/#247 vérifiés déjà corrigés. Vérifs : tsc 0 · lint 0 erreur · 313/313 · build OK. Mémo : `src/temp/memo-2026-08-22-chantier-bloc-a.md`. |
| **22/08 (suite)** | Fix #206 Dofoobz **centralisé** (`src/lib/dofus-image-url.ts` + test, commit `1075b032a`) appliqué au hub Quêtes Dofus + profil. ✔ **Rebasé sur `origin/dev` (22/08) : divergence résolue, branche prête à merger (PR propre, 10 commits ahead).** Prochaine session : **#228 étendre `UnsavedChangesGuard` à galerie/présentation/services/donjons** + **#227 épurer l'UI de la notif partout**. |
| **22/08 (sécurité CodeQL)** | Fix `js/incomplete-url-scheme-check` : `UnsavedChangesGuard` rejette désormais `javascript:`/`data:`/`vbscript:` (helper `isExecutableScheme` : decodeURI `%xx` + trim + minuscules, insensible casse, `preventDefault` pour bloquer l'exécution au lieu de laisser le navigateur) — commit `87f56e076` + docs `13ceecc54`. Branche **12 ahead / 0 behind** `origin/dev` → PR-ready (PR à créer si pas ouverte). Vérifs : tsc 0 · lint 0 erreur · **316/316** · pre-commit vert. |
| **05/10-06/10** | Module Fiche Boss & Simulation tactique 100 % terminé (16 commits poussés) — géométrie Dofus 3 exacte, sorts Dofensive enrichis, sync intelligente local-first (701 maps + 87 fiches), refonte fiche boss, migration portable. |
| **04/10** | Anti-AI-slop UI global (6 commits) — primitives plates, home + ~13 modules, auth/docs. |
| **02-03/10** | Fiches boss + simulateur de portée + fix RBAC/cache + guides raids (Gigalodon, Jardins Éternels). |
| **20/09** | ONE-SHOT 13 chantiers restants : #127 RBAC ressources, #85 blacklist embeds, #169 boutons DJ, #172 tour Succès, #176 fiches boss, #101 SEO, guides raids, #181 privacy, #96 README, #34 télémetry UX, #41bis circuit-breaker. |
| **01-07/09** | #148 modale quête God (gros lot), #138 module Succès dédié, #141 Accès Restreint, place de marché, refonte vue Guilde, perf/virtualisation. |
| **19-31/08** | Batch dashboard, dark mode V1+V2 (tokens OKLCH, sweep blancs/états/hex/landings + garde-fou ESLint), refonte landing #80, relances, bans → tombstones, avatars Discord résilients. |

## 🎨 Assets disponibles (réutilisables dans tout chantier)

- **Design / directions UI (maquettes HTML à plat — `src/temp/`)** : `sigilos-landing-direction-2026-v3.html`, `sigilos-home-direction-2026.html`, `guide-complet-refonte.html`, `test.html`.
- **Landing / vitrine** : `public/assets/landing/` → `bg-guild.jpg` (hero), `icone-dofus.png`, `mission-preview.png`, `songes-preview.png` · `public/assets/icons/dofus_landing.png` · `public/hall-guilde.jpg` · `public/noise.svg`.
- **Icônes Dofus** : `public/module-dofus/Dofus_*.png` (28 fichiers, dont `Dofus_Dofoozbz.png`).
- **Ambiance audio Dofus (archivé)** : `src/temp/archive/media/ajout-ambiance-Dofus/Dofus_*.mp3` (Ebene, Emeraude, Ivoire, Nébuleux, Ocre, Pourpre, Turquoise, Vulbis) + `spec-audio-dofus-dashboard.md`.
- **Divers (archivé)** : `src/temp/archive/media/` → `fuji-dofensive.png`, `fuji-sigilos.png`, `map-servitude.png`.

## 🔒 Non-négociables (résumé — détail : `RULES.md` + `SECURITY.md`)

1. **Auth sur chaque action** : `auth()` / `getUserContext(guildId)` en début.
2. **Guild isolation** : toute requête BDD filtrée par `guildId`.
3. **Fail-closed, jamais fail-open** : si une API tierce échoue → REFUSER.
4. **Pas de secret en dur ni de fallback** : `process.env.*` uniquement.
5. **Comparaison de secrets en temps constant** (`timingSafeEqual`).
6. **Validation & bornes** : Zod sur toutes les entrées ; borner les valeurs externes.
7. **Vérifier l’appartenance à la guilde** avant toute écriture multi-tenant.
8. **Pas de `console.log` en prod** → `logger` de `@/lib/logger`.
9. **Rapports d’audit JAMAIS commités** (`docs/audits/`, `AUDIT_*.md`, `src/audit-*`).
10. **Secrets jamais commités** (`.env*`).

## 📚 Références détaillées

| Fichier | Rôle |
|---------|------|
| **`CONTEXT.md`** | Ce fichier — point d’entrée (condensé) |
| [`RULES.md`](./RULES.md) | Conventions + règles sécu non-négociables + patterns copy-paste |
| [`SECURITY.md`](./SECURITY.md) | Posture sécurité réelle + chantiers ouverts |
| [`docs/SECURITY_HARDENING_PLAN.md`](./docs/SECURITY_HARDENING_PLAN.md) | Plan de durcissement |
| [`MAINTENANCE.md`](./MAINTENANCE.md) | Infra VPS : backups, monitoring, déploiement, urgence |
| [`README.md`](./README.md) | Démarrage, stack, structure, scripts |
| [`docs/DECISION-OUVERTURE-LANDING.md`](./docs/DECISION-OUVERTURE-LANDING.md) | **Décision ouverture prod & landing immersive** : vitrine `maintenance.html` vs `page.tsx`, checklist ouverture, statut CTA contrasté |
| [`prisma/schema.prisma`](./prisma/schema.prisma) | Schéma BDD (source de vérité) |
| `src/temp/refonte-long-terme-discord-compatibilite/` | Chantier #223 : plan maître + source technique résilience |
| `src/temp/archive/` | Historiques complets + mémos/amorces/média archivés |

## ⚙️ Règles d’interaction avec l’IA

0. **Terminal local = PowerShell** (séparateur `;`, pas `&&` ; `Remove-Item -Recurse -Force`).
1. **Ne jamais modifier** `docs/audits/`, `src/audit-*`, `AUDIT_*.md`.
2. **Respecter** `RULES.md` (fail-closed, validation, guild isolation, logger).
3. **Avant tout commit** : pas de secret, pas d’audit, `npm run test:run` + `npm run build`.
4. **Nommer les findings** F-xx + fichier précis.
5. **Pousser** sur une branche, puis PR vers `dev`.
6. **Scripts `.ps1` de refactoring ponctuel = HORS GIT** (seuls les scripts de build/déploiement/maintenance sont commités).

## 🗂️ Archives (tout est conservé, rien n’est supprimé)

- Historique complet des sessions : `src/temp/archive/contexte/CONTEXT-historique-complet-2026-08-21.md`
- Historique complet du chantier (toutes demandes annotées) : `src/temp/archive/contexte/chantier-historique-complet-2026-08-21.md`
- Mémos anciens : `src/temp/archive/memos/` · Amorces anciennes : `src/temp/archive/amorces/` · Média : `src/temp/archive/media/`

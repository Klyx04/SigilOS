# 🗺️ ROADMAP — SigilOS (backlog priorisé + workflow de session)

> **Ce fichier est LA référence en mode plan.** Le backlog priorisé y est condensé.
> À chaque session, lire **uniquement** : `docs/ROADMAP.md` + `src/temp/chantier-actif.md`
> (+ `PROMPT_START.md` pour les exigences de type).
> **Historique long** (`CONTEXT.md` intégral, `src/temp/chantier.md`, `archive/`) : **À LA DEMANDE UNIQUEMENT**.
> Réouvrir l'historique en mode plan = gaspillage de tokens.

---

## 🧭 Règle mode plan (économie de tokens)

1. Lire `docs/ROADMAP.md` + `src/temp/chantier-actif.md`.
2. Ouvrir `PROMPT_START.md` pour le bloc exigences (type : dev / sécu / infra / SEO / données).
3. Ouvrir un fichier de référence (`RULES.md`, `SECURITY.md`, `MAINTENANCE.md`, `docs/SEO_REPRISE.md`)
   **uniquement si la tâche le touche**.
4. NE JAMAIS ouvrir en plan mode : `src/temp/chantier.md`, `CONTEXT-historique-*.md`,
   `src/temp/archive/`, `docs/audits/`. (Historique → consultation ponctuelle.)

---

## 🔴 Bloquant / Prod

- **#57 — Ouverture prod** : checklist `docs/DECISION-OUVERTURE-LANDING.md`
  (+ `src/temp/checklist-ouverture-prod-57.md`). Action VPS : retirer `rewrite * /maintenance.html`
  sur `sigilos.fr`, noindexer la beta, resoumettre le sitemap, remplir les URLs Discord
  (CU / privacy / install), vérifier `/legal/*`. **+ trancher la décision landing immersive** (`page.tsx`).

## 🔴 En cours / continuation

- **#223 — Résilience Discord long terme** (point dur **16/11/2026**)
  P0 + P1 + P2 + fix CodeQL : ✅ FAIT + MERGÉ (PR #520, `6e5a779a3`).
  **RESTE (P3)** : outbox BullMQ/Redis écritures Discord · révocation session Auth.js sur
  `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants
  (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) ·
  veille mensuelle changelog + jour J.
  📄 Plan maître : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md`
  · ⚠️ §12 = VEILLE (à relire à chaque itération Discord).
- **Fiche Boss / Simulation** (06/10, terminé — 283/283) — reliquats : icônes résistances/vitalité
  `public/assets/module-succes/*.png` (**à brancher ou supprimer**, chantier en cours) · onglet
  « Mes succès / Succès Commun » · prévisu zone sous-monde · bug faces noires 3D · butin par grade · zaaps.

## 🟠 Bloc B — UX / Perf (valeur immédiate)

- **#186a** Optimistic UI (`useOptimistic` sur Rejoindre/Cocher/Toggle) + prefetch routes +
  skeletons + **virtualisation** (ladder, annuaire, galerie).
- **#129 / #1038** Responsivité : audit composant par composant (sweep à poursuivre).

## 🟠 Retours user (suite #202)

- **#227** — Épurer l'UI de la notif partout (badges compteur + toasts, charte design-system, zéro glow, OKLCH).
- **#228** — ✅ FAIT + VALIDÉ (23/08, `feat/chantier-2026-08-23-one-shot`) : garde appliquée à galerie /
  présentation / services / donjons + interception `router.push`/`replace` **validée** : mécanisme confirmé
  sur Next 16 (`useRouter()` → instance router partagée & modifiable, `window.next.router`). Tests unitaires
  ajoutés (`tests/unit/unsaved-changes-guard.test.ts` : `isDirty` + `isExecutableScheme` sécu).

## 🟡 Bloc C — Fonctionnalités (valeur moyenne)

- **#198** Badges & Achievements (méta-succès, configurable God, raretés, ping Discord épique/légendaire).
- **#71** Prêts / Coffre : rappel auto @ping si prêt non clos (cron worker), historique/export par guilde, refonte modale.
- **#265** Épuration cartes + filtres + mode multi-donjons (2-5) + multi-embed Discord unique (1 ping).
- **#196 + #197** API Webhooks (HMAC, rate-limit, retry, OpenAPI) + PWA (service worker, push, install) — même socle.

## 🟡 Bloc D — God / Télémétrie

- **#34 / #194** Refonte Télémétrie God + **God Insights** (WAU/MAU, funnel d'activation, heatmap
  d'activité par module/heure, alertes, export).

## 🟢 Long terme / à planifier

#38 WebP items/ressources (God game-data) · #190 Worldmap (routes farm, zaaps, mines, traversées de mer)
· #175 écart Ganymède→Sylvestre · #172 musiques de fond + réglages son + interface God sons
· #205 Guesser (dictionnaires API, modale fin d'épreuve responsive) · #234 audit scalabilité worldmap/guesser
· #40 benchmark galerie stuff · #1610 sécurité/infra (à cadrer en réunion) · #186b SEO long terme
· #4 grille agenda (semaine/mois) · #188 passe module Succès · #229 plan de croissance (**NOT FAIT**, lié ouverture prod).

## ✅ Déjà soldé (surveiller)

#192 bouton « Suivant » · #199 tour tuto Succès · #202 / #204 RBAC · #206 Dofoobz centralisé
· #223 P0/P1/P2 · #127 audit RBAC · #85 blacklist embeds · #169 · #101 SEO almanax · #176 fiches boss
· #181 privacy OCR · #96 README déploiement CD · #41bis circuit-breaker Dofusbook · #140 landing God → `page.tsx`
· #232 legal (crédits Dofensive/DPLN) · #231 ladder RBAC profil membre · #230 transfert propriété durci
· ✅ #228 garde anti-nav (4 formulaires + `router.push`/`replace` — interception validée + tests) · ✅ #226 cartes dj/quêtes (P1/3/4, P5 drawer → modale fermable, P2 hiérarchie créneau en tête, P6 transitions) · ✅ #225 Dokille (édition image God + seed 4 quêtes Safari + prérequis + trackeur krokilles 20 archis) · ✅ #233 Guide gestion guilde & Discord (permissions, architecture, sorties, synergie SigilOS). (#207 FAQ · #23/#134 avatar · #26/#177 donjons : traités/poussés le 23/08.)

---

## 🔄 Workflow d'une session (sur une branche propre)

1. `git checkout dev` puis `git pull origin dev`.
2. Créer la branche : `git checkout -b feat/chantier-<AAAA-MM-JJ>-<sujet>`
   (ex : `feat/chantier-2026-08-23-ouverture-prod`).
3. **ONE SHOT** : 1 chantier = 1 session (max 2 petits). Limite le scope, facilite la revue.
4. Avant tout commit : `npm run test:run` + `npm run build` (tsc + lint inclus).
   Ne jamais committer : `docs/audits/`, `src/audit-*`, `AUDIT_*.md`, `.env*`, `src/temp/`.
5. Mettre à jour en fin de session : `src/temp/chantier-actif.md` (statut) + `docs/ROADMAP.md` +
   un mémo `src/temp/memo-<AAAA-MM-JJ>-<sujet>.md`.
6. Pousser `feat/...` → PR vers `dev` (jamais directement sur `main`/`dev`).

## 📌 Semaine type (ordre conseillé)

1. **Semaine 1** : trancher la décision landing immersive → exécuter la checklist #57 (ouverture prod)
   + #227 / #228 (retours user).
2. **Semaine 2** : **Bloc B** (perf dashboard : Optimistic UI + virtualisation) — valeur ressentie max.
3. **Semaine 3** : un choix — **#198 Badges** (engagement) OU **#71 rappels prêts** (bouchage).
4. **En creux** (si session longue) : #223 P3 Discord + reliquats fiche boss (#188 icônes module-succès).
5. **Veille** : relecture du changelog Discord avant le **16/11/2026** (jour J résilience).

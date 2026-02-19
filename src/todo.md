# 📋 SigilOS — TODO Priorisé

> Priorisé par impact utilisateur × effort. ✅ = fait, 🔄 = en cours, ⬜ = à faire.

---

## 🔥 P0 — CRITIQUES (Bloquent l'expérience Beta)

- [x] Fix Dashboard crash beta (`substring` null + Date serialization + error boundaries)
- [x] Fix Changelog : filtre non-membres ne fonctionne pas (voient tout)
- [x] Fix Changelog : scroll impossible sur la page
- [x] Fix Changelog : images chargent pas pour l'externe
- [x] Fix Changelog : les images ne s'enregistrent pas une fois les pages publiées
- [x] Faire pointer tous les liens embeds Discord vers beta.sigilos.fr (déjà env-driven)
- [x] Seed zones, boss, mobs + bonus Songes — `prisma/seed.ts` présent ✅ (à lancer via GOD)

---

## ⚡ P1 — STABILITÉ & SÉCURITÉ (Semaine prochaine)

### Sécurité
- [x] Vérifier RBAC complet sur toutes les routes API existantes
  - [x] `/api/god/audit-logs` — fail-fast auth + isSuperAdmin ajouté
  - [x] `/api/admin/migrate-krala` — session check ajouté
  - [x] `/api/seed-grolandais` — route de dev supprimée (danger)
  - [x] Autres routes : audit-logs guild, server-config, active-bonus, sync — OK
- [x] RBAC futurs modules — ajouter guard dès la création de chaque nouvelle route :
  - Pattern : `auth()` fail-fast → `getUserContext()` → `isAdmin` ou `isMember` selon besoin
  - Routes GOD : toujours `isSuperAdmin()` en plus de `auth()`
- [x] Test isolation multi-tenant (User A ≠ Guilde B) — toutes les queries filtrent par guildId interne (CUID)
- [x] Validation inputs côté serveur — audit complet effectué
  - [x] `changelog-actions.ts` — schemas Zod ajoutés (version, title, summary, content, category)
  - [x] `presentation-actions.ts` — déjà validé manuellement (sanitizeHtml, validateLevel, etc.)
  - [x] Autres actions critiques (bonus, mission, admin, profile…) — Zod déjà en place
- [x] Upload files : validation MIME complète + strip EXIF (actif via magic bytes + Sharp)
- [x] Implémenter logs d'audit Admin — visible dans `/admin/logs`, rétention 30j
  - [x] Missions : createWeekMissions, resetMission, resetWeek, validateSubmission
  - [x] Bonus : purchaseBonus, cancelBonus, updateBonusChannel
  - [x] Isolation : logs guilde ≠ logs GOD, rétention 30 jours (lazy cleanup)
  - [x] UI : labels, couleurs et filtres par catégorie dans le module logs

### Monitoring
- [x] Configurer Sentry — SDK installé, DSN configuré, actif au prochain déploiement
- [x] Alertes Discord en cas d'erreur critique — règle "Alertes Discord" active sur Sentry

---

## 🎯 P2 — UX & FONCTIONNALITÉS CORE (Sprint suivant)

### Notifications
- [x] Améliorer le design des notifications (Glassmorphism & Glow)
- [x] Vérifier couverture (ajouté: Notif globale publication missions)
- [x] Revoir positionnement (bas-droite pour ne pas gêner la navigation)
- [x] Dans les paramètres users proposer de ne pas etre notifié pour tel ou tel module , fonctionnel evidemment

### Songes
- [x] Permettre au proprio d'une run songe d'envoyer Notif Discord aux inscrits d'une run (ping Discord + Notif Dashboard + choix date/heure)
- [x] Vérifier si les runs songes se suppriment d'elles mêmes après 3 jours sans activités (Logic implémenté)
- [x] Vérifier le status de la run songes : si elle est close, supprimer l'embed discord inutile
- [x] Raccourcir message candidature songes via embed et Dashboard (Fait)
- [x] Définir durée auto-suppression runs inactives (3 jours)
- [x] Suppression des rappels et candidatures Discord quand une run est terminée ou supprimée
- [x] Validation du statut "IN_PROGRESS" : les candidatures restent ouvertes et l'embed s'actualise
- [x] Permettre aux administrateurs de supprimer n'importe quelle run (Modération)
- [x] Historique des runs par membre
- [x] créér une Image catégorie mission Songes

### Missions & Catégories
- [x] Revoir catégories missions anomalie (Labels & Paliers)
- [x] Créer paliers par 10 de 200 à 150 pour choix zones/boss
- [x] Image catégorie Anomalie

### Discord Intégrations
- [x] Changer message anti-spam embed vacances (Terminé)

---

## 🎨 P3 — POLISH UI/UX

### Landing
- [x] Réduire la quantité de violet (Passage au Teal/Amber)
- [x] Ajouter ambiance lore Dofus (Backgrounds, callouts, icono)


### Documentation
- [x] Refonte UI doc pour clarté (users + dev)
- [x] Vue temps réel chapitrage et existant (Optimisations UI)

### Onboarding
- [x] Tutorial first-login for new admins (Welcome Modal)
- [x] Tooltip for the modules (GuidePulse)
- [x] Page "Getting Started" (5 steps to launch guild)
- [x] Generate user-friendly documentation
- [x] Contextual tooltips (Added to Modules & Mission Editor)

---

## 🚀 P4 — PERFORMANCE (Quand le traffic arrive)

- [x] Cache Discord API : `fetchGuildMember` (TTL 5min) + `listGuildMembers` (TTL 10min) — in-memory cache ✅
- [x] Indexes DB critiques : `@@index([guildId])` sur `UserProfile` + `@@index([missionId/profileId/status])` sur `Submission` ✅
- [ ] Optimiser requêtes N+1 (à activer quand Prisma logs révèlent un hotspot réel)
- [ ] Pagination : missions, succès, membres (à activer quand une guilde dépasse 500 entrées)
- [x] Lazy loading avatars : mission cards + reward icons ✅
- [x] Compression images : Sharp + WebP 80% déjà actif partout ✅
- [x] Code splitting : géré nativement par Next.js ✅
- [x] Redis : overkill sur 1 seul VPS, le cache RAM Node.js suffit ✅
- [x] Plan B Discord API down : Discord down = login impossible de toute façon — hors scope ✅

---

## 📊 P5 — MONITORING AVANCÉ

- [x] UptimeRobot : configuré en monitoring externe perso (alerte Discord si VPS down) ✅
- [x] Slow query logs PostgreSQL : outil de debug réactif, à activer ponctuellement si besoin — pas un todo fixe ✅
- [x] Enrichir `/api/health` : UptimeRobot a juste besoin d'un HTTP 200, page `/status` gère déjà l'affichage détaillé ✅
- [x] Dashboard logs admin : déjà actif sur `/admin/logs` ✅
- [x] Logger structuré : logger.ts custom + Sentry already in place ✅

---

## 🎮 P6 — MODULES FUTURS

### Module Stats Guilde
- [ ] Guildatons générés
- [ ] Points activité total guilde
- [ ] Points contributions DJ/Quêtes/Missions
- [ ] Runs Songes complétées
- [ ] Events terminés
- [ ] Missions validées
- [ ] Quetes/Dj terminés

### Module Donjons & Quêtes
- [ ] Module Recherche DJ/Succès/Quêtes


### Module Service Passages DJ/Succès/Prêts/Pack

### Vote/Sondage
- [ ] Module en lecture seule pour tous sauf admin discord : 
- récupération d'un rôle écrit en dur (non discord) type PIM (role créateur-vote ou un truc comme ca) pendant 1h par exemple , loggé biensur avec timer perte de rôle dans X
- a le droit de générér un vote/sondage , full fonctionnalité best practices etat de l'art , mention everyone/role au choix
- catégorie de sondage : suggestions/améliorations/events/missions/autres
- prévisu du sondage , envoi vers discord en option via un embed superbe avec bouton et tout ce qu'il faut pour que les gens votent (sécurisé qui peut voter), temps de sondage avec suppression auto après X temps
ce module doit etre une vrai valeur ajoutée 


### Profil Utilisateur
- [ ] Statut disponibilité (Dispo Farm/Songes, AFK, Mode chill)



---

## 📄 P7 — JURIDIQUE & BUSINESS

- [x] Conformité RGPD : droit à l'effacement — bouton "Supprimer mon compte" + `handleGdprDeletionRequest()` dans `lifecycle-actions.ts` ✅
- [x] CGU, Politique Confidentialité, Mentions Légales — pages `/legal/*` complètes ✅
- [x] SEO canonicals absolues : corrigé dans `layout.tsx`, `docs/page.tsx`, `changelog/page.tsx` ✅
- [x] Google Search Console : validé via DNS TXT (OVH), sitemap soumis ✅
- [ ] SEO : vérifier Open Graph images + sitemap.xml cohérence finale (action manuelle)
- [ ] Marketing : premier post X/Discord pour acquisition communautaire (action manuelle)
- [ ] Roadmap publique pour membres (action manuelle)
- [x] Limite guildes Beta — whitelist `AllowedGuild` enforcée dans `[guildId]/layout.tsx` ✅
- [x] Formulaire "Rapporter un bug" — bouton flottant `BugReportButton` → Discord `#bugs-beta` ✅
- [ ] Channel #bugs-beta : créer + épingler règles (action manuelle Discord)
- [x] Bannière cookies RGPD : pas de tracking 3rd party — non nécessaire ✅

> ✅ **P7 conclu** — tous les items code implémentés. Reste 3 actions manuelles (marketing, roadmap, #bugs-beta).

---

## 🧪 P8 — TESTS FINAUX (Avant Prod)

- [ ] Test backup : existe et restaurable (action manuelle VPS)
- [x] Création guilde sans membres ne crash pas — `MemberDirectory` reçoit `data || []` ✅
- [x] Champs vides partout (erreurs 500) — Zod utilisé dans tous les 13 fichiers d'actions ✅
- [ ] Pagination : test avec 500+ membres fictifs (quand guilde atteint ce volume)
- [ ] Sync Discord : ajout membre → apparaît dans le roster ? (test manuel beta)
- [x] Sessions expirées — JWT 3 jours + refresh 12h dans `auth.config.ts` ✅
- [x] Isolation guildes (User A vs Guilde B) — audité et validé ✅
- [ ] Parcours complet : Inscription → Mission → Validation → Songe (test manuel beta)
- [ ] Multi-navigateurs Chrome / Firefox / Safari mobile (test manuel beta)

> ✅ **P8 conclu** — tous les items vérifiables en code sont validés. Reste 4 tests manuels à faire avec une vraie guilde beta.

---

## 🔒 DÉJÀ FAIT / VÉRIFIÉ
- [x] HTTPS certificat Caddy SSL ✅
- [x] Auth Discord login → callback → dashboard ✅
- [x] Secrets pas sur Git (Gitleaks weekly) ✅
- [x] Protection XSS (CSP configuré) ✅
- [x] Protection SQL injection (Prisma ORM, pas de raw SQL) ✅
- [x] Tokens Discord : stockage via NextAuth (chiffré) ✅
- [x] Health check /api/health ✅
- [x] CI optimisé (verify.yml) ✅
- [x] Error boundaries (global-error + dashboard error) ✅
- [x] Script d'audit et diagnostic (`audit.sh`) intégré à la maintenance ✅
- [x] API Rate Limiting (à vérifier) ✅
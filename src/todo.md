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
- [ ] Tutorial first-login pour nouveaux admins
- [ ] Tooltip pour les modules
- [ ] Page "Getting Started" (5 étapes pour lancer sa guilde)
- [x] Générer de la documentation user humanisé

- [ ] Tooltips contextuels

---

## 🚀 P4 — PERFORMANCE (Quand le traffic arrive)

- [ ] Pagination : missions, succès, membres
- [ ] Optimiser requêtes N+1
- [ ] Indexes DB manquants (requêtes >1s)
- [ ] Cache Discord API (appels répétés)
- [ ] Compression images non optimisées
- [ ] Code splitting bundle JS (First load >5s)
- [ ] Lazy loading images (avatars, screens succès)
- [ ] Plan cache invalidation Redis
- [ ] Plan B Discord API down (retry + queue)

---

## 📊 P5 — MONITORING AVANCÉ

- [ ] Logs structurés : Winston/Pino
- [ ] Dashboard consultation logs
- [ ] Uptime monitoring : UptimeRobot ou service actuel
- [ ] Slow query logs PostgreSQL
- [ ] Health check : statut DB + Bot Discord + Uptime

---

## 🎮 P6 — MODULES FUTURS

### Stats Guilde
- [ ] Guildatons générés
- [ ] Points activité total guilde
- [ ] Points contributions DJ/Quêtes/Missions
- [ ] Runs Songes complétées
- [ ] Events terminés
- [ ] Missions validées

### DJ/Succès
- [ ] Module Recherche DJ/Succès/Quêtes
- [ ] Module Service Passages DJ/Succès/Prêts/Pack

### Profil Utilisateur
- [ ] Statut disponibilité (Dispo Farm/Songes, AFK, Mode chill)
- [ ] Avancement : Points Succès en % du total Dofus
- [ ] Préférences notifications Discord
- [ ] Score d'investissement calculé

---

## 📄 P7 — JURIDIQUE & BUSINESS

- [ ] Revoir CGU, Politique Confidentialité, Mentions Légales
- [ ] Bannière cookies RGPD (si tracking actif mais on ne fait pas de tracking ? vaut le coup ?)
- [ ] Conformité RGPD données personnelles
- [ ] SEO + article X  : https://x.com/fabienr34/status/2023649306910064883
- [ ] Roadmap publique pour membres
- [ ] Limite guildes Beta (whitelist / demande accès)
- [ ] Formulaire "Rapporter un bug" (bouton flottant)
- [ ] Channel #bugs-beta : créer + épingler règles

---

## 🧪 P8 — TESTS FINAUX (Avant Prod)

- [ ] Parcours complet : Inscription → Mission → Songe
- [ ] Multi-navigateurs (Chrome, Firefox, Safari mobile)
- [ ] Test backup existe et restaurable
- [ ] Isolation guildes (User A vs Guilde B)
- [ ] Création guilde sans membres ne crash pas
- [ ] Champs vides partout (erreurs 500)
- [ ] Pagination manquante (500+ membres)
- [ ] Sync Discord : ajout membre → apparaît ?
- [ ] Sessions expirées (2h inactif)

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
- [x] API Rate Limiting (à vérifier) ✅
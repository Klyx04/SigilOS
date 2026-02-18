# 📋 SigilOS — TODO Priorisé

> Priorisé par impact utilisateur × effort. ✅ = fait, 🔄 = en cours, ⬜ = à faire.

---

## 🔥 P0 — CRITIQUES (Bloquent l'expérience Beta)

- [x] Fix Dashboard crash beta (`substring` null + Date serialization + error boundaries)
- [x] Fix Changelog : filtre non-membres ne fonctionne pas (voient tout)
- [x] Fix Changelog : scroll impossible sur la page
- [ ] Fix Changelog : images chargent pas pour le changelog externe
- [ ] Fix Changelog : les images ne s'enregistrent pas une fois les pages publiés et la prévisu pendant l'iedtion des images copiées collées ou importé non plus
- [x] Faire pointer tous les liens embeds Discord vers beta.sigilos.fr (déjà env-driven)
- [ ] Seed zones, boss, mobs  à la main moi même + bonus Songes à préparer coté page

---

## ⚡ P1 — STABILITÉ & SÉCURITÉ (Semaine prochaine)

### Sécurité
- [ ] Vérifier RBAC complet sur toutes les routes
- [ ] Vérifier que les rôles sont bien appliqués
- [ ] Ajouter un système pour toggler les modules activé/désactivé (anticipera également un modele payant?)
- [ ] Test isolation multi-tenant (User A ≠ Guilde B)
- [ ] Validation inputs côté serveur sur tous les formulaires
- [ ] Upload files : empêcher .exe, .php, etc.
- [ ] Sanitization uploads : strip EXIF + validation MIME types
- [ ] Vérifier permissions admin vs user normal
- [ ] Implémenter logs d'audit Admin (qui modifie quoi, quand)

### Monitoring
- [ ] Configurer alertes Sentry actives
- [ ] Alertes Discord en cas d'erreur critique Sentry

---

## 🎯 P2 — UX & FONCTIONNALITÉS CORE (Sprint suivant)

### Notifications
- [ ] Améliorer le design des notifications
- [ ] Vérifier couverture (où il en manque / quand elles apparaissent)
- [ ] Revoir positionnement (pas centré en haut)

### Songes
- [ ] Notif Discord aux inscrits d'une run (mention via embed)
- [ ] Raccourcir message candidature embed (trop verbeux)
- [ ] Définir durée auto-suppression runs inactives
- [ ] Historique des runs par membre
- [ ] Image catégorie Songes

### Missions & Catégories
- [ ] Revoir catégories missions anomalie
- [ ] Créer paliers par 10 de 200 à 150 pour choix zones/boss
- [ ] Image catégorie Anomalie

### Discord Intégrations
- [ ] Changer message anti-spam embed vacances
- [ ] Plan B Discord API down (retry + queue)

---

## 🎨 P3 — POLISH UI/UX

### Landing
- [ ] Réduire la quantité de violet
- [ ] Ajouter ambiance lore Dofus (backgrounds, typographies, icono)

### Documentation
- [ ] Refonte UI doc pour clarté (users + dev)
- [ ] Vue temps réel chapitrage et existant

### Onboarding
- [ ] Tutorial first-login pour nouveaux admins
- [ ] Page "Getting Started" (5 étapes pour lancer sa guilde)
- [ ] Générer documentation user
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
- [ ] Bannière cookies RGPD (si tracking actif)
- [ ] Conformité RGPD données personnelles
- [ ] SEO + article X
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
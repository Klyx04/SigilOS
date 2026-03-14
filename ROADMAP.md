# 🗺️ SigilOS — Feuille de Route (Mise à jour : 14 mars 2026)

> État d'avancement du projet après la session "Sécurité & Stockage Privé".

---

## 🏛️ Phase 0 & 1 — Lancement & Stabilisation ✅ (Terminé)

> **Objectif** : Ouverture de la Beta et correction des premiers retours critiques.

### Audit & Corrections Beta
- [x] Audit sécurité complet (auth, RBAC, isolation, secrets)
- [x] Fix drift Prisma & Hook pre-commit (Husky)
- [x] Pages maintenance stylées (lore Krosmoz)
- [x] Workflow Discord module documenté (`.agents/workflows/discord-module.md`)
- [x] **Build Zero Warning** : Fix bug Windows (`node:inspector`) & optimisation Turbopack 58k images.
- [x] **CI Perfection** : Migration ESLint 10 (`eslint.config.mjs`) & suppression `.eslintignore`.

### Monitoring
- [x] Surveillance alertes Sentry + Grafana
- [x] Channel `#bugs-beta` actif sur Discord
- [x] Repeatable job BullMQ (4h AM) pour purge notifications et vieux trades.

---

## 🚀 Phase 2 — Modules Core & Gamification ✅ (Terminé)

> **Objectif** : Dépasser le simple dashboard pour offrir de vrais outils de jeu.

### Module Carte HD & Monde des Douze
- [x] **Moteur Leaflet HD** : Drag-to-scroll, zoom fluide, modale 4/3.
- [x] **Précision Pixel-Perfect** : Ratio strict 250px (instances) / 256px (Monde) aligné sur DofusDB.
- [x] **Synchro Game Data** : Rapatriement des 5000+ sous-zones et calques spatiaux.

### Module Ressources & Almanax
- [x] **Hub Centralisé** : News Ankama, liens utiles, tutoriels.
- [x] **Tracker Almanax** : Widget dynamique avec bonus du jour et filtres.
- [x] **Proxy News** : Fallback proxy pour contourner le blocage CloudFront Ankama sur le VPS.
- [x] **Kralamoure & YouTube/Twitch** : État d'ouverture et connectivité créateurs.

### Module Mini-Jeux Premium
- [x] **Sigil King (SigilGuesser)** : Système de paris, mode spectateur isolé, player count live.
- [x] **Gartic Phone** : Fix du countdown et synchronisation des phases de dessin.
- [x] **Geoguesser Dofus** : Ladder de guilde, calcul de distance et Hall of Fame multi-joueurs.
- [x] **Skribbl** : Intégration préliminaire du module de dessin.

---

## 🔒 Phase 3 — Sécurité, Privacy & Dofusbook ✅ (Terminé)

> **Objectif** : Protection des données membres et intégration encyclopédique.

### Stockage Privé & RBAC (The "Lockdown" Update)
- [x] **Private Storage** : Migration vers `private_uploads/` (fichiers hors-web).
- [x] **RBAC Fichiers** : Route `/api/storage` sécurisée (seuls les membres voient les preuves de leur guilde).
- [x] **Audit GDPR** : Anonymisation des IPs dans les logs pour les admins (vision brute Super-Admin uniquement).
- [x] **Data Minimization** : Purge auto des missions PENDING > 48h.

### Intégration Dofusbook
- [x] **Build Caching** : Stockage local des previews (stats/images) pour pallier les pannes d'API Ankama.
- [x] **Equipments Sync** : Téléchargement local des icônes d'items via DofusDB/Doflex.

### Admin Pings (Relances)
- [x] **Relance Express** : Envoi de MP Discord, pings de channel ou de masse depuis le dashboard.
- [x] **Discord Embeds** : Modélisation stylisée des relances avec boutons d'action.

---

## 💎 Phase 4 — Services, Passages & Onboarding ✅ (Terminé)

- [x] **Marketplace Interne** : Propositions de services (donjons, succès, quêtes).
- [x] **Packages Succès** : Tarification groupée via sélection d'icônes interactive.
- [x] **Module Prêts (Loans)** : Système de caution, captures d'écran et archivage auto.
- [x] **Badge Probation** : Badge pulsant émeraude auto-géré sur le profil des nouveaux.
- [x] **Welcome V2** : Embeds de bienvenue ultra-riches et personnalisables par guilde.

---

## 🏗️ Phase 5 — Chat Live & Ocre V2 (Avril 2026) 🏗️

> **Objectif** : Communication temps-réel et fluidification des échanges Ocre.

- [ ] **Chat Live (Sidebar)** : Panneau rétractable avec historique 200 messages.
- [ ] **Ocre Trade Link** : Génération d'un lien d'échange "Public" à partager hors guilde.
- [ ] **Double Auth (2FA)** : Optionnelle pour le Super-Admin (TOTP).

---

## 📊 Phase 6 — Statistiques & Micro-Interactions (Mai 2026)

- [ ] **Tooltips Recharts** : Micro-interactions plus fluides sur les graphiques de guilde.
- [ ] **Météo In-Game** : (Concept) Tracker des zones à bonus/malus.
- [ ] **Ladder Inter-Guildes** : Comparaison du prestige entre les guildes whitelisted.

---

## 🚀 Phase 7 — Infrastructure V2 (Future)

- [ ] **Coolify Migration** : Passage à une gestion PaaS auto-hébergé pour faciliter les déploiements.
- [ ] **Cloudflare R2 full** : Migration totale si le stockage local dépasse 200 Go.
- [ ] **Alertes Disk Usage** : Alerte Discord automatique à 80% de remplissage.
- [ ] **Pagination Cursor-based** : Généralisation à toutes les listes > 500 entrées.

---

## 🏆 Archivé

- [x] SEO & OG Images Dynamiques (Terminé le 26/02/2026)
- [x] Architecture Multi-Tenant (Terminé le 12/02/2026)
- [x] GOD Dashboard V1 (Terminé le 01/03/2026)
ilité profil

- [ ] Statut visible : "Dispo Farm", "Dispo Songes", "AFK", "Mode chill"
- [ ] Configurable depuis le profil utilisateur
- [ ] Affiché dans l'annuaire et les cartes de recherche DJ

---

## 🏆 Déjà Accompli (Archive)

Tout ce qui était dans l'ancien `todo.md` (P0 à P8) a été complété et archivé.
Les détails historiques sont dans `.antigravity` et les conversation logs.

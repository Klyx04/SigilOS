# 🗺️ SigilOS — Feuille de Route

> Dernière mise à jour : 27 février 2026
> Remplace `src/todo.md` et `src/.prepa-avant-beta-membre`

---

## Phase 0 — Lancement Beta (27 Fev 2026) ✅

> **Objectif** : Ouvrir `beta.sigilos.fr` aux premiers membres de guilde.

### Audit & Corrections

- [x] Audit sécurité complet (auth, RBAC, isolation, CSP, secrets)
- [x] RBAC centralisé sur toutes les interactions Discord (`DISCORD_PERM_MAP`)
- [x] Fix boutons DJ/Quêtes "Échec de l'interaction" (relation Prisma `guildConfig` → `guild`)
- [x] Fix preview SigilOS géante sur notifications Songes (`suppressEmbeds: true`)
- [x] Audit performance — 3 indexes DB ajoutés (Notification, DreamJoinRequest, MissionInterest)
- [x] Refonte complète Welcome Embed (Premium)
- [x] Gestion manuelle des pseudos membres (Audit Logs)
- [x] Tri des membres par date d'arrivée
- [x] Badge "Nouveau" dynamique lié au rôle probation
- [x] Refonte Sondages Discord (Progress bars, % vifs, sync live)
- [x] Refonte UI Poll Creator (Expiration grid control)
- [x] Audit sécurité patterns multi-tenant validé

### Infrastructure

- [x] Pages maintenance stylées (lore Krosmoz) : prod + beta
- [x] Toggle maintenance automatique dans `deploy.sh` (flag file Caddy)
- [x] Volumes Docker montés pour les pages statiques Caddy
- [x] Workflow Discord module documenté (`.agents/workflows/discord-module.md`)
- [x] Nettoyage fichiers obsolètes (17 fichiers : logs, scripts Python, audit, dofusdude.yaml)
- [x] Mise à jour `.gitignore` (patterns debug .txt, .py one-shot)

### À vérifier manuellement

- [ ] `.env.beta` / `.env.prod` pas dans l'historique git (`git log --all -S "password"`)
- [ ] `AUTH_SECRET` différent entre beta et prod
- [ ] Mapper les permissions RBAC dans Admin → Permissions pour la guilde beta
- [ ] Tester un déploiement complet `./scripts/deploy.sh beta` sur le VPS
- [ ] `curl https://beta.sigilos.fr/api/health` → 200

---

## Phase 1 — Stabilisation Post-Lancement (Semaine +1)

> **Objectif** : Corriger les bugs remontés par les premiers testeurs, surveiller la perf.

### Monitoring & Feedback

- [ ] Surveiller les alertes Sentry + Grafana pendant 48h
- [ ] Créer le channel `#bugs-beta` sur Discord + épingler les règles
- [ ] Collecter les retours joueurs (formulaire BugReport déjà en place)

### Perf à surveiller

- [ ] **Ladder** : Si lent avec >50 profils, migrer `getActivityLadder` en CRON pré-calculé
  - Actuellement le calcul se fait on-the-fly à chaque visite de la page Ladder. Ça fonctionne bien avec quelques profils mais pourrait ralentir.
  - **Quand agir** : Si le temps de réponse dépasse 2s dans les logs Sentry/Grafana.
  - **Fix** : Repeatable job BullMQ qui pré-calcule le classement toutes les heures et stocke le résultat en Redis.

- [ ] **OCR (Succès profil uniquement)** : Extraire `submitAchievementProof` vers un job BullMQ
  - ⚠️ L'OCR concerne **uniquement les preuves de succès** dans `profile-actions.ts` (analyse d'image LLM/OCR pour extraire les points de succès). Ce n'est **PAS** lié aux missions.
  - **Les missions** utilisent un système de **soumission screenshot → validation admin manuelle**. Aucun OCR. L'admin voit la preuve et approuve/rejette. Pas de problème de perf ici.
  - **Quand agir** : Si beaucoup de joueurs soumettent des preuves de succès en même temps (peu probable en beta).
  - **Fix** : Déplacer l'appel LLM/OCR dans un job BullMQ asynchrone. Le joueur voit "Preuve en cours d'analyse" au lieu d'attendre 2-8s.

- [ ] **Pagination membres** : Activer quand une guilde dépasse 200 profils
  - La page `/admin/members` charge tous les profils d'un coup. Pas de problème avec <200 membres.
  - **Quand agir** : Première guilde qui atteint 200 membres.
  - **Fix** : Ajouter `take/skip` + pagination côté UI.

### Cleanup technique

- [x] **~~Lazy Cleanup candidatures Songes expirées → CRON BullMQ~~** ✅ **Déjà implémenté !**
  - Le worker `metamob-worker.ts` (CRON à 4h du matin) effectue déjà :
    1. **Auto-rejet** des `DreamJoinRequest` PENDING > 24h → status `REJECTED` + notification au joueur ("Candidature expirée, aucune réponse du leader sous 24h")
    2. **Auto-abandon** des runs `RECRUITING` ou `IN_PROGRESS` sans activité > 3 jours (pas de floor complété ni de joinRequest) → status `ABANDONED`
  - C'est le même CRON qui purge les notifications lues > 30j et les OcreTradeRequest > 7j PENDING.
- [ ] Activer les snapshots automatiques VPS (OVH)

---

## Phase 2 — Communication & Admin GOD ✅ (Implémenté)

> **Objectif** : Permettre à l'admin de communiquer avec les joueurs sans toucher au code.

### Bandeau d'annonce in-app ✅

- [x] Stockage Redis (clé `sigilos:announcement`, pas de migration Prisma)
- [x] Composant `AnnouncementBanner` dans le layout Dashboard — visible par TOUS les utilisateurs
- [x] Panneau GOD (onglet Maintenance) pour créer/activer/désactiver les annonces
- [x] Auto-expiration configurable (30min → 12h → permanent)
- [x] 3 types visuels : `info` (bleu), `warning` (ambre), `maintenance` (orange)

### Broadcast Discord depuis GOD ✅

- [x] Bouton "Envoyer à toutes les guildes" dans GOD → embed Discord
- [x] Preview de l'embed avant envoi (style Discord fidèle)
- [x] Choix du type (Maintenance 🛠️ / Update 🚀 / Info 📢) + toggle @everyone

#### Comment ça marche techniquement

Le broadcast utilise l'API Discord Bot (`POST /channels/{id}/messages`) pour envoyer un embed dans **chaque guilde active**. Voici comment on s'assure que ça arrive :

1. **Quel channel ?** On prend le **premier channel de notification configuré** par l'admin de la guilde dans `GuildConfig` :
   - `missionNotifyChannelId` → `songesNotifyChannelId` → `calendarNotifyChannelId` → `absenceChannelId`
   - Si aucun channel n'est configuré : la guilde est **ignorée** (le compteur `failed` s'incrémente et s'affiche dans le résultat)

2. **Comment s'assurer que ça part ?**
   - Le bot Discord doit avoir la permission **Send Messages** dans le channel cible. C'est garanti car l'admin a déjà validé le channel lors de la configuration.
   - Si le channel a été supprimé depuis ou si le bot n'a plus les permissions → le call Discord retourne une erreur 403/404 → on la catch, on incrémente `failed`, et on continue les autres guildes.
   - Le résultat affiché dans GOD indique : `"✅ Envoyé à X guilde(s) (Y échec)"` pour que tu saches exactement combien ont reçu le message.

3. **Limites et risques**
   - **Rate limiting Discord** : 5 messages/5 secondes par channel. Avec 1-5 guildes beta, aucun risque. Si un jour 50+ guildes : ajouter un `await sleep(200ms)` entre chaque envoi.
   - **Bot viré du serveur** : Si une guilde retire le bot Discord, on ne peut plus envoyer → `failed++`. La guilde reste en DB mais le message ne part pas. Pas de crash.

### Broadcast notifications in-app

- [ ] Action GOD "Notification broadcast" → `createNotification` pour tous les profils actifs (post-lancement)

---

## Phase 3 — Nouveaux Modules (Mars 2026)

### Module Optimisation Quêtes Dofus (Page "Coming Soon" ✅)

> Trouver les quêtes en commun entre membres de guilde, optimiser les parcours.

- [x] Page `/dashboard/{guildId}/quetes-dofus` avec bandeau "En développement" et image preview
- [x] Toggle module admin (`quests` dans GuildModules)
- [x] Lien sidebar (section "Bientôt")
- [ ] Définir le scope exact (quêtes des Dofus, quêtes d'exploration, quêtes de classe ?)
- [ ] Import des données quêtes depuis DofusDB / game data
- [ ] Tracker de progression par membre
- [ ] "Quêtes en commun" — matchmaking entre membres

### Module Mini-Jeux / Carte du Monde (Page "Coming Soon" ✅)

> Comme [dofusdb.fr/fr/tools/map](https://dofusdb.fr/fr/tools/map) mais intégré à SigilOS.

- [x] Page `/dashboard/{guildId}/mini-jeux` avec bandeau "En développement"
- [x] Toggle module admin (`worldmap` dans GuildModules)
- [x] Lien sidebar (section "Bientôt")
- [ ] Étude de faisabilité : données cartographiques Dofus disponibles ?
- [ ] Définir le MVP — affichage basique ou interactions avancées ?
- [ ] Assets à extraire / API à consommer

### Module Ressources Dofus (Page "Coming Soon" ✅)

> Hub centralisé avec toutes les ressources autour de Dofus.

- [x] Page `/dashboard/{guildId}/ressources` avec bandeau "En développement"
- [x] Toggle module admin (`resources` dans GuildModules)
- [x] Lien sidebar (section "Bientôt")
- [ ] Définir le contenu : liens utiles, guides, builds, recettes ?
- [ ] Intégration avec DofusDB / DofusPourLesNoobs / Dofensive
- [ ] Page statique avec catégories ou système dynamique ?

### Module Service Passages DJ/Succès/Prêts/Pack

- [ ] Définir le scope (marketplace interne de services entre membres) , passage 
Le  module service passages Donjons(avec ou sans succès / Quêtes / Combats Tactiques , Forgemagie



Pour faire simple et aller droit au but, voici comment structurer ce module de petites annonces internes à la guilde, en se basant sur les offres de services réelles du marché (comme celles visibles sur des plateformes telles que les Halles des Douze) :

1. Catégorie : Passages de Donjons & Combats (Mercenariat) Les joueurs peuvent proposer leurs services de "passeurs" avec une tarification à la carte :
• Passage Simple : Aider un client à simplement vaincre le boss du donjon.
• Succès à la carte : Facturation supplémentaire pour valider des succès spécifiques lors du passage (ex: Duo, Statue, Dernier, Spécial, Hardi, Mains Propres, Zombie, etc.).
• Packs de Succès : Offres groupées pour les joueurs voulant valider plusieurs succès d'un coup avec une réduction (ex: "Dernier + Statue", "Duo + Spécial" ou l'offre ultime "Full Succès").
• Combats de Quête : Aide pour les combats de quête bloquants (combats solo sur lesquels on peut se faire aider, combats à plusieurs, combats à vagues ou combats tactiques).
• Quêtes d'Alignement : Passages dédiés aux combats difficiles des quêtes d'alignement (ex: Erazal, Krobe, Qu'Tan, Puits de l'Ordre).
2. Catégorie : Forgemagie & Métiers Les artisans de la guilde peuvent afficher leur catalogue :
• Prestations FM : Tarification pour remonter un jet parfait, réaliser un overmage (ex: over vitalité) ou un exomage (ex: PA/PM/PO).
• Packs Métier : Un service très demandé où un joueur paie pour qu'on lui fournisse toutes les ressources nécessaires (ou le craft direct) pour monter un métier (ex: Joaillomage, Tailleur, etc.) du niveau 1 à 200.

• Packs Ocre : Vente du lot complet (ou par étapes) de toutes les captures d'âmes de monstres, de boss et d'archimonstres nécessaires pour terminer la quête du Dofus Ocre.

- [ ] Intégration Discord (notif quand un service est demandé)

---

## Phase 4 — Chat Live (Avril 2026)

> **Objectif** : Chat en temps réel sur le Dashboard sans saturer le VPS.

### Conception

- [ ] **Provider externe** (recommandé pour solo dev) : Ably, Pusher, ou Livekit ?
  - Avantage : pas de charge serveur, historique géré par le service
  - Free tier suffisant pour une guilde de 300 membres
- [ ] Ou **WebSocket maison** avec Redis pub/sub ? (plus complexe, plus de contrôle)

### Fonctionnalités

- [ ] Pas d'upload d'images dans le chat (texte seulement)
- [ ] Base d'emoji personnalisés Dofus
- [ ] Sanitization stricte (XSS, liens, etc.)
- [ ] Indicateur "X est en train de taper..."
- [ ] Pseudo exact (discordNickname > pseudoDofus)
- [ ] Historique limité (dernières 200 messages, auto-purge >7 jours)
- [ ] Toggle masquer/afficher le chat (préférence utilisateur)
- [ ] Positionnement : panneau latéral rétractable sur le Dashboard

---

## Phase 5 — Onboarding Avancé (Avril 2026)

> **Objectif** : Rendre l'accueil des nouveaux membres plus fluide.

### Rôle "Période d'essai" (système interne SigilOS)

- [ ] Nouveau type de rôle temporaire (comme PIM pour les sondages)
- [ ] Admin choisit : nom du rôle, durée (X jours), badge affiché sur le profil
- [ ] Assignable manuellement par un admin sur le profil d'un nouveau membre
- [ ] Auto-expiration et notification à l'admin avant expiration

### Template d'accueil (Admin)

- [ ] Salon dédié sur le Dashboard (écriture admin only, 1 message éditable)
- [ ] Sélecteur de membre pour personnaliser le message "Welcome @nouveau"
- [ ] Option : envoyer un embed Discord mentionnant @role ou @everyone
- [ ] Preview avant envoi

---

## Phase 6 — SEO & Marketing ✅ (Implémenté)

> Audit SEO complet réalisé le 26/02/2026.

### OG Images dynamiques ✅

- [x] Route `/api/og` (edge runtime) génère des images 1200×630 branded SigilOS
- [x] Paramètres `?title=` et `?subtitle=` pour personnalisation par page
- [x] Design cohérent (teal/amber glows, fond dark, branding sigilos.fr)
- [x] Sécurité : rendu JSX → image (pas de HTML, zéro XSS), edge sandboxé

### Metadata & Structured Data ✅

- [x] **Root layout** : `title`, `description` enrichie (keywords Dofus, Songes, Dungeon Finder, Ocre, Almanax)
- [x] **`keywords` meta tag** : 11 mots-clés français ciblés
- [x] **OG tags** : image dynamique 1200×630, titre, description, `fr_FR`
- [x] **Twitter card** : `summary_large_image` avec image dynamique
- [x] **themeColor** : corrigé `#9333ea` (violet) → `#14b8a6` (teal, cohérent avec le design réel)
- [x] **Landing page** : JSON-LD `SoftwareApplication` (schema.org) — prix gratuit, catégorie GameApplication
- [x] **Guild pages** : JSON-LD `Organization` déjà en place (nom, fondateur, serveur, recrutement)
- [x] **Pages légales** : metadata ajoutée (CGU, Confidentialité, Mentions — manquaient toutes les 3)
- [x] **Docs & Changelog** : metadata + canonical ✅ (déjà en place)
- [x] **Status** : metadata ✅ (déjà en place)

### Sitemap & Robots ✅

- [x] **Priorités différenciées** : Landing=1, Guilds=0.9, Docs=0.8, Changelog=0.7, Status=0.3, Legal=0.2
- [x] **Pages légales ajoutées** au sitemap (manquaient)
- [x] **robots.txt** : `/legal/` et `/status` ajoutés aux routes autorisées
- [x] **Routes sensibles bloquées** : `/dashboard/`, `/api/`, `/god/`, `/_next/`
- [x] **Beta entièrement bloquée** dans robots.txt (`disallow: /`)

### Manifest PWA ✅

- [x] **theme_color** corrigé → teal

### Reste à faire manuellement

- [ ] Vérifier OG preview via [opengraph.xyz](https://opengraph.xyz) après déploiement
- [ ] Google Search Console : re-soumettre sitemap après déploiement
- [ ] Premier post X/Discord pour acquisition communautaire (action manuelle)
- [ ] Roadmap publique pour membres (version simplifiée de ce fichier)

## Phase 7 — Infrastructure V2 (Future)

- [ ] Mettre Cloudflare en CDN devant le VPS (Free tier)
- [ ] Migrer uploads vers Cloudflare R2 (si disk >80%)
- [ ] Bull Board pour visualiser la queue BullMQ
- [ ] Alertes Grafana sur disk usage >80%
- [ ] Étudier la migration vers Coolify (PaaS auto-hébergé)
- [ ] Pagination cursor-based généralisée (quand >500 entrées)

---

## Statut disponibilité profil

- [ ] Statut visible : "Dispo Farm", "Dispo Songes", "AFK", "Mode chill"
- [ ] Configurable depuis le profil utilisateur
- [ ] Affiché dans l'annuaire et les cartes de recherche DJ

---

## 🏆 Déjà Accompli (Archive)

Tout ce qui était dans l'ancien `todo.md` (P0 à P8) a été complété et archivé.
Les détails historiques sont dans `.antigravity` et les conversation logs.

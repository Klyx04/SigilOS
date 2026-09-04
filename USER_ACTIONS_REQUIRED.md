# 📋 Actions & Vérifications Utilisateur (Mise en Production)

Ce document consigne l'ensemble des actions manuelles, configurations VPS, variables d'environnement, vérifications Google Search Console et Discord Developer Portal nécessaires suite aux évolutions de SigilOS (Onboarding Autonome, Audit SEO, et Tour de Contrôle Sécuritaire).

---

## 📑 Sommaire
1. [Google Search Console & Référencement (SEO)](#1-google-search-console--référencement-seo)
2. [Portail Développeur Discord (OAuth2 & Bot)](#2-portail-développeur-discord-oauth2--bot)
3. [Serveur VPS & Déploiement](#3-serveur-vps--déploiement)
4. [Variables d'Environnement (.env)](#4-variables-denvironnement-env)
5. [Surveillance Post-Déploiement (Tour de Contrôle God)](#5-surveillance-post-déploiement-tour-de-contrôle-god)

---

## 1. Google Search Console & Référencement (SEO)

### A. Soumission du Sitemap
- **Où :** [Google Search Console](https://search.google.com/search-console) > Propriété `https://sigilos.fr`.
- **Action :**
  1. Rendez-vous dans l'onglet **Sitemaps** (menu de gauche).
  2. Ajoutez l'URL : `https://sigilos.fr/sitemap.xml` et cliquez sur **Envoyer**.
  3. Vérifiez le statut : il doit passer à **Opération réussie** (découverte des URLs `/guides`, `/boss`, `/almanax`, etc.).

### B. Validation des Schémas Schema.org (Rich Snippets)
- **Où :** [Google Rich Results Test (Test des résultats enrichis)](https://search.google.com/test/rich-results)
- **Action :**
  1. Testez l'URL de la landing page : `https://sigilos.fr`.
  2. Validez que les schémas suivants sont détectés sans erreur critique :
     - **FAQ** (`FAQPage`) : Permet l'affichage des questions/réponses dépliables directement dans les résultats Google.
     - **SoftwareApplication** : Fiche produit de SigilOS.
     - **Organization** : Marque SigilOS.

### C. Inspection de robots.txt
- **Où :** [Outil de test du fichier robots.txt](https://www.google.com/webmasters/tools/robots-testing-tool) ou en consultant directement `https://sigilos.fr/robots.txt`.
- **Vérification :**
  - Confirmer que `/auth/` est bien bloqué pour éviter l'indexation de pages d'erreurs temporaires.
  - Confirmer que `/guides/`, `/boss/`, `/almanax/` sont bien ouverts à l'exploration.

---

## 2. Portail Développeur Discord (OAuth2 & Bot)

### A. Vérification de l'URL d'invitation du Bot
Pour que l'onboarding autonome fonctionne sans accroc lorsqu'un administrateur clique sur "Ajouter à mon serveur" :
- **Où :** [Discord Developer Portal](https://discord.com/developers/applications) > Application SigilOS > **Installation** ou **OAuth2 URL Generator**.
- **Permissions requises (Bot Scope) :**
  - Scopes : `bot`, `applications.commands`
  - Permissions du bot recommandées :
    - `Manage Roles` (Gestion des rôles)
    - `Manage Channels` (Gestion des salons pour l'onboarding & modules)
    - `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`
    - `Use External Emojis`
    - `Manage Messages` (pour les pings & suppressions de messages temporaires)
- **Permissions Integer standard :** `268435456` ou les permissions configurées dans votre lien d'invitation actuel.

### B. URL de Redirection OAuth2
- Vérifier que les URLs de redirection suivantes sont bien enregistrées dans **OAuth2 > Redirects** :
  - `https://sigilos.fr/api/auth/callback/discord` (Production)
  - `https://beta.sigilos.fr/api/auth/callback/discord` (Beta)
  - `http://localhost:3000/api/auth/callback/discord` (Local)

---

## 3. Serveur VPS & Déploiement

### A. Déploiement sur le VPS
Conformément aux règles du projet (`./scripts/deploy.sh`) :
- **Pour Beta :**
  ```bash
  ./scripts/deploy.sh beta
  ```
- **Pour Production (après validation Beta) :**
  ```bash
  ./scripts/deploy.sh prod
  ```

### B. Vérification des Alertes Discord (Webhook God / Staff)
- Lors d'un nouvel onboarding autonome, SigilOS envoie automatiquement une alerte enrichie sur le salon Discord du staff (`notifyGod`).
- **Action de test :** Connecter un serveur de test avec un compte admin et vérifier la réception du message dans votre canal privé avec l'étiquette `[AUTONOME]`.

---

## 4. Variables d'Environnement (.env)

**Bonne nouvelle : AUCUNE nouvelle variable d'environnement n'est à créer.**
Toutes les variables requises sont déjà configurées sur votre VPS :
- `REDIS_URL` ou conteneur Docker `sigilos-redis` : SigilOS utilise le Redis local autonome déjà présent sur le VPS (`ioredis` connecté sur le port 6379). Le rate limiting anti-abus et les purges de cache fonctionnent directement dessus sans aucun service externe.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` : Déjà en place et opérationnels.
- `NEXT_PUBLIC_APP_URL` : Déjà en place (`https://sigilos.fr` / `https://beta.sigilos.fr`).

---

## 5. Surveillance Post-Déploiement (Tour de Contrôle God)

- **Accès :** Connectez-vous avec votre compte SuperAdmin / God sur `/god`.
- **Nouveautés à exploiter :**
  1. **Radar de Déploiement (Live Feed) :** Observez en temps réel les nouveaux serveurs connectés avec badge `AUTONOME`.
  2. **Score de Risque & Heuristique :** Surveillez les serveurs signalés avec un badge jaune (ex: serveur de 1 personne) pour vous assurer qu'il ne s'agit pas de serveurs orphelins.
  3. **Kill-Switch 1-Clic :**
     - Le bouton **Geler** coupe l'accès instantanément sans supprimer les données.
     - Le bouton **Bannir** blacklist la guilde, expulse le bot automatiquement du serveur Discord et purge la mémoire Redis.
  4. **Radar Anti-Fantômes :** Détecte si le bot est présent sur des serveurs Discord non déclarés et permet de l'expulser en un clic.

---
*Ce document sera complété automatiquement si d'autres actions manuelles sont requises lors des développements.*

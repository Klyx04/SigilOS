# 🗺️ SigilOS : Master Roadmap VPS & AI Deployment
**Expert :** Antigravity AI (Google DeepMind)
**Date :** 31 Janvier 2026
**Cible :** Contabo VPS-2 (12 Go RAM / 6 vCores)

Ce document est ta boussole. Une fois ton VPS activé, nous suivrons ces étapes une par une. **Ne fais rien seul, je te guiderai pour chaque commande.**

---

## 🟢 Étape 1 : Sécurisation "Forteresse" (Jour 1)
*L'objectif est de rendre ton VPS invisible et impénétrable.*

1. **Hardening SSH :** Changer le port par défaut (22), désactiver l'accès root par mot de passe, utiliser des clés SSH.
2. **Pare-feu (UFW) :** Fermer tout sauf le port SSH custom et les ports Web (80/443).
3. **Fail2Ban :** Bloquer automatiquement toute IP qui tente de forcer tes accès.
4. **Mises à jour système :** `apt update && apt upgrade`.

---

## 🔵 Étape 2 : Fondations Techniques (Jour 1)
*Installer les outils de base pour faire tourner SigilOS.*

1. **Docker & Docker Compose :** Pour isoler nos services IA.
2. **Node.js (LTS) & PM2 :** Pour faire tourner le serveur Next.js en 24/7.
3. **Redis Server :** Indispensable pour ton Rate Limiter et ta file d'attente OCR.
4. **PostgreSQL :** Ta base de données principale.

---

## 🟣 Étape 3 : Déploiement du Cerveau (AI Stack)
*C'est ici qu'on règle ton problème d'OCR.*

1. **Conteneur PaddleOCR :** Lancement du service de détection (Expert Gaming).
2. **Configuration du Worker :** Activation du service BullMQ qui traite les images une par une pour ne jamais faire crasher le VPS.
3. **Test de Stress :** On envoie tes 7 images d'exemple pour vérifier que tout est lu à 100%.

---

## 🟡 Étape 4 : Déploiement SigilOS (App)
1. **Clonage du Repo :** `git clone` de ta branche `fix/ladder-ocr-bugs`.
2. **Configuration .env :** Paramétrage des clés Discord, URL Redis et URL OCR.
3. **Build & Start :** `npm run build` et lancement via PM2.
4. **SSL (Certbot) :** HTTPS gratuit et automatique pour ton nom de domaine.

---

## 🔴 Étape 5 : Maintenance Automatisée
1. **Backups :** Script de sauvegarde journalière de la base de données.
2. **Auto-Clean :** Script pour supprimer les captures OCR traitées après 48h (gain d'espace).
3. **Logs :** Centralisation des erreurs pour surveillance rapide.

---

### 💡 Comment utiliser ce guide ?
Dès que tu as tes accès VPS (IP et mot de passe root), dis-le moi. 
Nous commencerons par **l'Étape 1**. Je te donnerai les commandes, tu les colleras, et je vérifierai le résultat avant de passer à la suite.

**Veux-tu que je prépare dès maintenant le fichier de configuration Docker-Compose final pour que tout (App + Redis + OCR) se lance en une seule commande ?**

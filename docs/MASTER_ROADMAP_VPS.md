# 🗺️ SigilOS : Master Roadmap VPS & AI Deployment
**Expert :** Antigravity AI (Google DeepMind)
**Date :** 31 Janvier 2026
**Cible :** Contabo VPS-2 (12 Go RAM / 6 vCores)

Ce document est ta boussole. Une fois ton VPS activé, nous suivrons ces étapes une par une. **Ne fais rien seul, je te guiderai pour chaque commande.**

---

## 🟢 Étape 1 : Sécurisation "Forteresse" ✅ (TERMINÉ)
*L'objectif était de rendre ton VPS invisible et impénétrable.*
1. **Hardening SSH** : Port 2222, clés SSH uniquement, Root interdit.
2. **Pare-feu (UFW)** : Filtrage strict des ports.
3. **Fail2Ban** : Sentinelle active sur SSH.

---

## 🔵 Étape 2 : Fondations Techniques ✅ (TERMINÉ)
*Installer les outils de base pour faire tourner SigilOS.*
1. **Docker Compose** : Stack multi-conteneurs opérationnelle.
2. **Redis & DB Isolation** : Services séparés pour Bêta et Prod.
3. **Monitoring** : Prometheus & Grafana activés.

---

## 🟣 Étape 3 : Déploiement du Cerveau (AI Stack) 🟠 (EN COURS)
*C'est ici qu'on règle ton problème d'OCR.*
1. **Conteneur PaddleOCR** : Présent dans le Docker Compose, prêt pour le tuning.
2. **Configuration du Worker** : Structure en place, tests à finaliser demain.

---

## 🟡 Étape 4 : Déploiement SigilOS (App) ✅ (TERMINÉ)
1. **Dual-Environment** : Bêta (`dev`) et Prod (`main`) cohabitent.
2. **Beta Gate** : Protection personnalisée opérationnelle.
3. **Caddy Proxy** : HTTPS Let's Encrypt automatique et stable.

---

## 🔴 Étape 5 : Maintenance Automatisée ✅ (TERMINÉ)
1. **Script Maintenance** : Nettoyage quotidien via Cron (4h00).
2. **Logs Monitoring** : Centralisation via Grafana.

---

### 💡 Comment utiliser ce guide ?
Dès que tu as tes accès VPS (IP et mot de passe root), dis-le moi. 
Nous commencerons par **l'Étape 1**. Je te donnerai les commandes, tu les colleras, et je vérifierai le résultat avant de passer à la suite.

**Veux-tu que je prépare dès maintenant le fichier de configuration Docker-Compose final pour que tout (App + Redis + OCR) se lance en une seule commande ?**

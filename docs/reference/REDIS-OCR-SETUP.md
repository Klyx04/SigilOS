# 🚀 Guide de Déploiement VPS SigilOS (OCR & Redis)

Ce guide détaille les actions à effectuer sur votre VPS Ubuntu pour activer les fonctionnalités avancées d'OCR et de mise en file d'attente (Queue).

---

## 1. Installation de Redis (Essentiel)
Redis est utilisé pour le Rate Limiting (sécurité) et la gestion de la file d'attente OCR (protection CPU).

```bash
# Installation
sudo apt update
sudo apt install redis-server -y

# Vérification du service
sudo systemctl status redis-server
```

**Configuration de sécurité :**
Par défaut, Redis n'écoute que sur `127.0.0.1`. Ne changez pas cela sauf si vous savez ce que vous faites.

---

## 2. Préparation de la Stack AI (Docker)
Pour une précision maximale sans surcharger le serveur principal, nous utilisons PaddleOCR via Docker.

```bash
# 1. Installer Docker (si pas déjà fait)
sudo apt install docker.io -y
sudo systemctl enable --now docker

# 2. Lancer le service PaddleOCR léger (CPU Only)
# Ce service écoute sur le port 9999
docker run -d -p 9999:9999 --name ocr-service hub.docker.com/paddlepaddle/paddleocr:latest-cpu
```

---

## 3. Variables d'Environnement (.env)
Mettez à jour votre fichier `.env` sur le VPS :

```env
# Connexion Redis locale
REDIS_URL="redis://localhost:6379"

# URL du micro-service OCR (si déployé via l'étape 2)
# OPTIONAL_OCR_SERVICE_URL="http://localhost:9999"
```

---

## 4. Maintenance & Monitoring
Pour surveiller la file d'attente en temps réel :

```bash
# Voir les logs du Worker OCR
pm2 logs worker # Si lancé via PM2
# ou
docker logs ocr-service
```

**Zéro Crash Policy :**
Grâce à `concurrency: 1` configuré dans `src/lib/ocr-worker.ts`, le VPS ne traitera qu'une image à la fois, garantissant que vos 6 vCores ne saturent jamais, même en cas d'afflux massif de membres.

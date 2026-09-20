---
description: How to safely sync large game assets (maps, tiles) from local machine to VPS
---

# 📦 Synchronisation des Assets (Game Data)

Les fichiers de jeu (tiles, cartes HD) pèsent plusieurs gigaoctets et ne sont **jamais** inclus dans Git. Pour les envoyer sur le VPS, on utilise un script dédié basé sur `rsync`.

## 🏗️ Architecture du Transfert

```
PC Local (Windows/WSL)  ──(SSH/rsync)──►  VPS (Target)
       ↓                                       ↓
public/game-data/                       /home/sigiladmin/SigilOS/public/game-data/
  ├─ tiles/ (~13k fichiers)
  └─ hd_maps/ (~15k fichiers)
```

---

## 🚀 Procédure de Synchronisation

### 1. Prérequis (Le pont Windows-WSL)

Le script utilise `rsync` (Linux), il doit donc être lancé depuis **WSL**. Si ton alias SSH (`myvps`) est sur Windows, tu dois le lier à WSL.

#### A. Copier tes clés et ta config
Dans ton terminal **Git Bash** (Windows) :
```bash
wsl mkdir -p ~/.ssh
wsl cp -r /mnt/c/Users/$(whoami)/.ssh/* ~/.ssh/
wsl chmod 700 ~/.ssh && wsl chmod 600 ~/.ssh/*
```

#### B. Fixer les chemins dans WSL
Les chemins `C:\Users\...` dans ta config SSH Windows ne marchent pas sous Linux.
**Dans WSL :**
```bash
sed -i 's|C:\\\\Users\\\\.*\\\\.ssh/|~/.ssh/|g' ~/.ssh/config
```

### 2. Lancer la synchronisation

**Dans WSL :**
```bash
# Vers la Beta
./scripts/sync-assets.sh beta

# Vers la Production (demande confirmation "OUI")
./scripts/sync-assets.sh prod

# Faire une simulation (sans envoyer)
./scripts/sync-assets.sh beta --dry-run
```

---

## 🛠️ Résolution des problèmes fréquents

### 1. Connection Timed Out
Si la connexion vers le VPS fige (Timeout) dans WSL mais marche sur Windows :
*   **Cause :** Problème de MTU (taille des paquets) propre à WSL2.
*   **Fix (dans WSL) :** `sudo ip link set dev eth0 mtu 1400`

### 2. Demande de mot de passe (au lieu de clé)
Si `rsync` demande un mot de passe alors que tu as une clé SSH :
*   **Cause :** Ta clé n'est pas chargée ou le chemin dans `.ssh/config` est faux.
*   **Fix :** Lance `ssh-add ~/.ssh/id_ed25519` (ou `id_rsa`) dans WSL.

### 3. DNS non résolu
Si `myvps` n'est pas trouvé par WSL :
*   **Fix :** Vérifie que le fichier `~/.ssh/config` dans WSL contient bien l'alias. Sinon, utilise l'IP directe dans le script temporairement.

---

## 📊 Monitoring du Transfert

Pendant que le script tourne, tu peux voir la vitesse réelle de réception sur le **VPS** :
```bash
# Installer nload (si besoin)
sudo apt update && sudo apt install nload -y

# Lancer nload et naviguer vers l'interface publique (ex: ens3 ou eth0)
nload
```
> Cherche la valeur **Incoming** : une fibre normale tourne entre 10 Mo/s et 50 Mo/s.

---

## ✅ Après le transfert

Une fois les fichiers copiés, tu **dois** déployer le code qui sait les lire :
```bash
# Sur le VPS
./scripts/deploy.sh beta
```

> [!TIP]
> Si tu as ajouté de nouveaux items ou monstres en plus des images, n'oublie pas d'utiliser l'outil **Import/Export** dans le panel Admin (GOD) pour mettre à jour le JSON en base de données.

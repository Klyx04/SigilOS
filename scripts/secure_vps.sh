#!/bin/bash
set -e

# =============================================================================
# 🛡️ SigilOS - Script de Durcissement VPS (Hardening)
# =============================================================================
# À Lancer UNE SEULE FOIS sur un VPS vierge (Ubuntu 24.04 commandé).
# Usage: sudo ./secure_vps.sh

SSH_PORT=2222
USER_NAME="sigiladmin"

echo "🚀 Démarrage de la sécurisation 'État de l'Art'..."

# 1. Mise à jour système
echo "📦 Mise à jour des paquets..."
apt update && apt upgrade -y
apt install -y ufw fail2ban curl git unzip

# 2. Configuration du Firewall (UFW)
echo "防火 Configuration Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp  # Futur port SSH
ufw allow 80/tcp         # HTTP
ufw allow 443/tcp        # HTTPS
ufw allow 443/udp        # HTTP/3 (QUIC)
# ufw allow 22/tcp       # ⚠️ Commenté volontairement. On coupera le 22 après test.
ufw --force enable

# 3. Configuration Fail2Ban
echo "👮 Configuration Fail2Ban..."
systemctl enable fail2ban
systemctl start fail2ban

# 4. SSH Hardening
echo "🔑 Sécurisation SSH (Port $SSH_PORT)..."
# Backup config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Changement de config à la volée
sed -i "s/#Port 22/Port $SSH_PORT/" /etc/ssh/sshd_config
sed -i "s/PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config
sed -i "s/PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config
# Empêcher login mot de passe (clés uniquement)
# Attention : Assurez-vous d'avoir copié votre clé SSH avant de relancer sshd !

echo "⚠️ ATTENTION : La configuration SSH a été modifiée (Port $SSH_PORT, Root Login OFF)."
echo "👉 Assurez-vous d'avoir créé un utilisateur sudo et copié vos clés SSH."
echo "👉 Pour appliquer : 'service ssh restart'"

echo "✅ Fin du script de pré-configuration."

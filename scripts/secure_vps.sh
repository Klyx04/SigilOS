#!/bin/bash
set -e

# =============================================================================
# 🛡️ SigilOS - Script de Durcissement VPS (Hardening)
# =============================================================================
# À Lancer UNE SEULE FOIS sur un VPS Ubuntu 24.04 vierge.
# Usage: sudo ./secure_vps.sh

SSH_PORT=2222
USER_NAME="sigiladmin"

echo "🚀 Démarrage de la sécurisation 'Expert 2026'..."

# 1. Mise à jour système et installation des outils
echo "📦 Mise à jour des paquets et outils de base..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y
apt install -y ufw fail2ban curl git unzip software-properties-common ca-certificates gnupg lsb-release htop

# 2. Hardening Réseau (Sysctl)
echo "🔒 Application des protections réseau (Anti-Flood/Spoof)..."
cat <<EOF > /etc/sysctl.d/99-sigilos-security.conf
# Désactiver l'acceptation de redirection ICMP (évite les attaques MITM)
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
# Protection contre le SYN Flood
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5
# Désactiver le Forwarding IP si non nécessaire (sauf Docker qui s'en occupe)
net.ipv4.ip_forward = 1
# Désactiver l'écoute de l'adresse Source (Anti IP Spoofing)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
EOF
sysctl -p /etc/sysctl.d/99-sigilos-security.conf

# 3. Création de l'utilisateur de gestion (si inexistant)
if ! id "$USER_NAME" &>/dev/null; then
    echo "👤 Création de l'utilisateur : $USER_NAME"
    adduser --disabled-password --gecos "" $USER_NAME
    usermod -aG sudo $USER_NAME
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/$USER_NAME
fi

# 4. Configuration du Firewall (UFW)
echo "🧱 Configuration Firewall (Ports: HTTP, HTTPS, SSH:$SSH_PORT)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# 5. Installation de Docker (Standard 2026)
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installation de Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker $USER_NAME
fi

# 6. SSH Hardening
echo "🔑 Sécurisation SSH (Port $SSH_PORT)..."
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sed -i "s/#Port 22/Port $SSH_PORT/" /etc/ssh/sshd_config
sed -i "s/PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config
sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config

echo "✅ Sécurisation terminée !"
echo "⚠️  IMPORTANT : Assurez-vous d'avoir ajouté votre clé SSH à /home/$USER_NAME/.ssh/authorized_keys"
echo "👉 Redémarrez SSH pour appliquer : 'systemctl restart ssh'"

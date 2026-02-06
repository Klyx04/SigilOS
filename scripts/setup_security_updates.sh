#!/bin/bash

# =============================================================================
# 🛡️ SigilOS - Setup Automated Security Updates
# =============================================================================
# Installs and configures 'unattended-upgrades' to keep the VPS secure automatically.

echo "🛡️ Installing unattended-upgrades..."
sudo apt-get update
sudo apt-get install -y unattended-upgrades apt-listchanges

echo "⚙️ Configuring default security rules..."
# Enable standard security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Create custom configuration to ensure only security updates are applied
# and auto-reboot is handled strictly if needed (usually 02:00 AM)
cat <<EOF | sudo tee /etc/apt/apt.conf.d/50unattended-upgrades-custom
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
    "docker-ce";
    "docker-ce-cli";
    "containerd.io";
};

Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

echo "✅ Automatic Security Updates enabled!"
echo "ℹ️ Logs are available in /var/log/unattended-upgrades/"

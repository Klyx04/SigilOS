#!/bin/bash

# maintenance.sh - Le concierge automatique de SigilOS
# Ce script nettoie les ressources inutilisées pour garder le VPS rapide.

echo "--------------------------------------------------"
echo "📅 Date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "🧹 Démarrage du nettoyage hebdomadaire..."

# 1. Nettoyage Docker (Images orphelines, cache de build inutilisé)
# On garde les images de moins de 24h pour ne pas ralentir le déploiement suivant
sudo docker system prune -af --filter "until=24h"

# 2. Nettoyage des volumes de données inutilisés (ATTENTION: n'efface pas les bases actives)
sudo docker volume prune -f

# 3. Nettoyage des logs Docker vieux de plus de 7 jours (si configuré)
# (Optionnel selon ta config de logs)

echo "✨ VPS purifié ! Espace disque libéré."

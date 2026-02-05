#!/bin/bash
set -e

# =============================================================================
# 🤖 SigilOS - Ollama LLM OCR Setup
# =============================================================================
# Ce script installe Ollama et télécharge les modèles de vision pour l'OCR.
# À lancer sur le VPS après le déploiement initial.

echo "🤖 Installation d'Ollama pour SigilOS OCR..."

# =============================================================================
# 1. INSTALLATION D'OLLAMA
# =============================================================================

if command -v ollama &> /dev/null; then
    echo "✅ Ollama déjà installé: $(ollama --version)"
else
    echo "📦 Installation d'Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✅ Ollama installé avec succès"
fi

# =============================================================================
# 2. DÉMARRAGE DU SERVICE
# =============================================================================

echo "🚀 Démarrage du service Ollama..."
sudo systemctl enable ollama
sudo systemctl start ollama

# Attendre que le service soit prêt
sleep 3

# Vérifier que le service tourne
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Service Ollama actif sur http://localhost:11434"
else
    echo "❌ Erreur: Ollama ne répond pas. Vérifiez les logs: journalctl -u ollama"
    exit 1
fi

# =============================================================================
# 3. TÉLÉCHARGEMENT DES MODÈLES
# =============================================================================

echo "📥 Téléchargement du modèle de vision moondream (~1Go)..."
ollama pull moondream

echo ""
echo "✅ Installation terminée!"
echo ""
echo "📊 Modèles installés:"
ollama list
echo ""
echo "🔧 Configuration requise dans .env.prod/.env.beta:"
echo "   DEV_SKIP_OCR=false"
echo "   OLLAMA_HOST=http://localhost:11434"
echo "   OLLAMA_MODEL=moondream"
echo ""
echo "💡 Pour ajouter un modèle plus précis (optionnel, +3Go RAM):"
echo "   ollama pull qwen3-vl:4b"
echo ""
echo "🔄 Pour redémarrer Ollama:"
echo "   sudo systemctl restart ollama"
echo ""
echo "📈 Pour surveiller l'utilisation:"
echo "   htop  # Vérifier RAM/CPU pendant les inférences"

# 🦅 SigilOS : Vision Intelligence & OCR Strategy 2026
**Version :** 1.0 (PROD-READY)
**Expert :** Antigravity AI (Google DeepMind Team) - Global Architecture Specialist
**Statut :** Stratégie Validée - Phase d'implémentation initiée

---

## 1. Vision Executive Summary
L'objectif est de transformer le système de validation de SigilOS d'une lecture de caractères basique (Tesseract) en un système de **Vision Multimodale sémantique**. 

Le système doit être capable de :
1. **Extraire** les points de succès avec une précision > 98%.
2. **Valider** visuellement l'état d'une mission (Boss vaincu, checkmark vert).
3. **Scaler** pour des centaines d'utilisateurs sans jamais saturer le VPS principal.

---

## 2. Architecture Technique "High-End" (Local Stack)

Pour garantir la confidentialité des données et supprimer tout coût d'API (Google/OpenAI), nous déployons une pile 100% auto-hébergée.

### A. Le Pipeline de Traitement (Le "Flow")
1. **Frontend (Next.js) :** Upload de la capture avec compression client-side.
2. **Queue (BullMQ + Redis) :** Mise en attente du "Job" d'analyse pour lisser la charge CPU.
3. **Prétraitement "Dofus-Spec" (Sharp) :**
    *   **Ladder :** Isolation chromatique du Jaune/Or pour faire ressortir les scores.
    *   **Missions :** Compensation du "Voile Vert" de validation via égalisation adaptative (CLAHE).
4. **Worker OCR (PaddleOCR) :** Le "Scanner". Expert en extraction de texte sur UI complexes et polices dorées.
5. **Validation IA (DeepSeek-OCR2) :** Le "Cerveau". Intervient uniquement si PaddleOCR a un doute substantiel ou pour confirmer un état visuel complexe (ex: Boss mort).

### B. Spécifications VPS (Cibles)
*Analyse basée sur un déploiement sur VPS Ubuntu CPU-Only (Quantization Q4_K_M).*

| Ressource | Minimum Vital (VPS-1) | Recommandé (VPS-2) | Impact Core |
| :--- | :--- | :--- | :--- |
| **RAM** | 8 Go | **12 Go** | Stabilité des LLM en mémoire |
| **vCores** | 4 Cores | **6 Cores** | Vitesse d'inférence (Latency) |
| **Stockage** | 20 Go SSD | **100 Go NVMe** | Espace Docker & Cache |

---

## 3. Le Point Critique : "Zéro Crash" via Queue Redis

**Pourquoi Redis ?** Les modèles de vision consomment 100% de la puissance CPU pendant l'analyse d'une image (pendant 2-4 secondes). Sans queue, si 5 personnes synchronisent leur ladder simultanément, le serveur sature, les requêtes HTTP expirent, et le VPS peut redémarrer.

**La Solution BullMQ :**
* Les images sont stockées temporairement dans Redis.
* Le worker traite les images **séquentiellement** (une par une).
* La charge CPU reste maîtrisée (stable à 80-90% sans pic de saturation).
* L'utilisateur voit une barre de progression en temps réel via WebSockets/Polling.

---

## 4. Roadmap d'Implémentation (4 Phases)

### Phase 1 : Hotfix & Robustesse (En cours)
*   **Ladder :** Amélioration de la binarisation pour isoler l'Or et gestion des espaces dans les scores (ex: `21 644`).
*   **Missions :** Robuste détection du "Voile Vert" et amélioration du contraste sur les textes blancs.
*   **Debug :** Mise en place de logs de debug visuels (visualisation des filtres appliqués).

### Phase 2 : Migration Redis & BullMQ
* Installation de l'instance Redis sur le VPS.
* Déplacement de la logique `syncMemberSuccessPoints` dans un worker asynchrone.
* Mise à jour de l'UI pour gérer l'attente de validation.

### Phase 3 : Containerisation AI (PaddleOCR)
* Déploiement d'un conteneur Docker léger avec l'API PaddleOCR-Server.
* Remplacement définitif de Tesseract pour le Ladder.

### Phase 4 : Vision Multimodale (DeepSeek-OCR2)
* Intégration du modèle de vision sémantique.
* Automatisation totale des validations de missions complexes (Donjon, Songes).

---

## 5. Mesures de Sécurité (Protection du VPS)
1. **Rate Limiting Strict (Redis-based) :** 5 uploads max par utilisateur par 10 minutes.
2. **Sanitization Image :** Limitation stricte à 4 Mo et redimensionnement auto en 1080p avant traitement.
3. **Auto-Cleanup :** Suppression automatique des images de preuve après 48h ou après validation staff.

---
*Ce document sert de base contractuelle pour l'évolution des modules Missions et Ladder.*

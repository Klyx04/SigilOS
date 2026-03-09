# Rapport d'Audit : État des Mini-Jeux (SigilGuesser & Sigil-Phone)

## 🔍 Constats de l'Audit

L'audit a révélé que les deux mini-jeux sont dans des états différents de "survie" dans la base de code actuelle. Voici le détail technique :

### 1. SigilGuesser (Multiplayer GeoGuesser)
*   **Code UI** : Intégré et fonctionnel dans `src/components/worldmap/interactive-map-v2.tsx`.
*   **Logique Serveur** : Les actions sont présentes dans `src/server/actions/geoguesser-multi-actions.ts`.
*   **Infrastructure** : Utilise **Redis** pour la gestion des lobbies.
*   **Problème** : Le jeu est "vivant" mais l'UI reste masquée derrière l'onglet "Games" qui n'est pas activé par défaut ou manque de visibilité.

### 2. Sigil-Phone (Gartic Phone) - **STATUT : ORPHELIN**
*   **Modèles Prisma** : Les modèles `GarticRoom` et `GarticSession` sont présents dans `schema.prisma` (L1592+).
*   **Composants UI** : Le dossier `src/components/gartic` contient tous les écrans (`DrawingScreen`, `LobbyScreen`, etc.).
*   **Logique Coeur** : Présente dans `src/server/games/SigilGartic` avec une machine à états XState.
*   **Infrastructure manquante** : 
    *   Le serveur **WebSocket (Socket.io)** sur le port 3001, mentionné dans la documentation, est absent des scripts de démarrage.
    *   Le script `presence-worker.ts` référencé dans `package.json` est introuvable sur le disque.
*   **Traces de Refactor** : Le code est complet mais n'est **lié à aucune page active** du dashboard. Il a été "débranché" du routing.

## 🛠️ Traces Identifiées (Preuves)

| Élément | Emplacement | État |
| :--- | :--- | :--- |
| **Schéma DB** | `prisma/schema.prisma` | ✅ OK (Modèles Gartic intacts) |
| **Types Socket** | `src/types/socket-events.ts` | ✅ OK (Events Gartic définis) |
| **Scripts Worker** | `package.json` | ⚠️ KO (`presence-worker.ts` manquant) |
| **Actions Serveur** | `src/server/actions/geoguesser-multi-actions.ts` | ✅ OK |
| **Documentation** | `src/sigil_gartic_documentation.md` | ✅ OK (Détaille le setup manquant) |

## 💡 Recommandations pour la Restauration

1.  **Récupérer le serveur WS** : Il semble qu'un processus séparé (Express/Socket.io) doive être recréé ou restauré pour gérer le temps réel de Gartic.
2.  **Mapping de Page** : Recréer une route `/dashboard/[guildId]/mini-jeux/gartic` pour pointer vers le `GarticLayout.tsx`.
3.  **Nettoyage Worker** : Restaurer le `presence-worker.ts` pour que Redis puisse synchroniser les sessions.

> [!IMPORTANT]
> Rien n'a été supprimé au niveau des données (Prisma), mais l'infrastructure de connectivité (WebSockets) et le routing Next.js ont été "nettoyés" lors du dernier refactor.

---
name: doc-session
description: Utiliser en fin de session ou de lot pour mettre à jour la mémoire du projet sans créer de fichier d'état. Met à jour le statut dans docs/ROADMAP.md et ajoute un bloc en haut de docs/agents/activeContext.md, avec rotation des 6 blocs.
---
# Fin de session

1. `docs/ROADMAP.md` : le chantier livré passe au §5 (une ligne) ; les autres restent.
2. `docs/agents/activeContext.md` : **nouveau bloc EN HAUT** (demande verbatim, mesures, fait, preuves, reste/ops).
3. **Rotation** : sortir le 7ᵉ bloc (récupérable via `git log -p -- docs/agents/activeContext.md`).
4. Ne créer **aucun** fichier d'état parallèle (`CHANTIERS-RESTANTS.md`, `ETAT.md`, etc.).
5. `git status --short` propre : aucun artefact de la tâche.
6. Rapport final ≤ 15 lignes : fait · reste · côté utilisateur.

Détail : `AGENTS.md` §8.
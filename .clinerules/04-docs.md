---
paths:
  - "docs/**"
  - "AGENTS.md"
---
# Règles documentation

- **Un sujet = un fichier** ; une doc périmée est corrigée ou supprimée, jamais dupliquée.
- **Une seule source d'ordre** : `docs/ROADMAP.md`. Ne pas recréer de `FILE-EXECUTION` ni de `BRIEF`.
- Le récit de session va dans `docs/agents/activeContext.md` (6 blocs) ; l'historique dans `docs/agents/journal-sessions-2026.md`.
- **Un chemin cité doit exister** : `git grep -n "<nom>"` avant renommage ou suppression.
- Pas de `.md` hors `docs/` (sauf `AGENTS.md` et README d'un sous-projet).
- Dépôt public : aucun ID Discord, e-mail, chemin machine, capture ou secret.
- Après un lot : statut dans `ROADMAP.md` + bloc `activeContext.md` ; aucun nouveau fichier d'état.
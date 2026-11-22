---
description: Definition of Done — arbre propre + vérifs + mémoire
---

Definition of Done SigilOS.

1. `git status --short` : aucun artefact de la tâche.
2. `npm run test:run`, `npx tsc --noEmit`, `npm run lint` verts.
3. `docs/ROADMAP.md` mis à jour + nouveau bloc en haut de `docs/agents/activeContext.md` (6 dernières sessions).
4. Aucun nouveau fichier d'état, aucun mémo dupliqué.
5. Relecture : demande au sous-agent `reviewer` de relire `git diff origin/dev...HEAD` (et `git status --short` pour les non suivis).
6. Rapport final ≤ 15 lignes : fait · reste · côté utilisateur.

---
name: lot-pr
description: Utiliser quand on demande d'implémenter un lot, un chantier ou une correction et de livrer une PR vers dev. Couvre la branche depuis dev, la lecture du plan, le test de comportement, npm run test:run, tsc, lint, la PR, gh pr checks, le merge et le nettoyage de branche.
---
# Lot → PR

1. `git fetch origin dev && git switch -c <type>/<lot> origin/dev`.
2. Lire le plan cité par `docs/ROADMAP.md` ; ne pas improviser.
3. Coder **une seule** règle au bon étage : `src/lib/**` > `src/server/**` > composant.
4. Ajouter un test de comportement dans `tests/` + garder les verrous existants verts.
5. Vérifier : `npm run test:run` · `npx tsc --noEmit` · `npm run lint`.
6. PR → `dev` (jamais `main`/`dev`), `gh pr checks` jusqu'au vert, merge, branche supprimée.
7. Mettre à jour `docs/ROADMAP.md` (statut) et `docs/agents/activeContext.md` (nouveau bloc en haut).

Détail : `docs/agents/git-push.md`. Règle d'or : 1 lot = 1 branche = 1 PR.
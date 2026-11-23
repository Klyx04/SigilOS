---
paths:
  - "tests/**"
---
# Règles tests

- Tester le **comportement**, pas le rendu : règle pure dans `src/lib/**`, test dans `tests/unit/**`.
- Nommer en français, une intention claire par cas ; pas de test qui ne vérifie qu'un rendu.
- **Jamais** `.skip` / `.only` / test désactivé ; jamais verdir en supprimant un test.
- Un test neuf doit être **vert avant** de quitter l'arbre.
- Fixtures : factories, pas de dump réel ; aucune donnée personnelle.
- Gardes existantes : ne pas les affaiblir ; si un seuil change, le justifier dans la PR.
- Commandes : `npx vitest run tests/unit/<fichier>.test.ts` puis `npm run test:run`.
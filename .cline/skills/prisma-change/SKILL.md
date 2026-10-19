---
name: prisma-change
description: Utiliser dès qu'un changement touche prisma/schema.prisma, une migration ou une requête Prisma dont le schéma dépend. Impose l'arrêt et l'accord explicite avant migration, la migration additive, prisma migrate deploy en local, prisma generate et le redémarrage de npm run dev.
---
# Changement de schéma Prisma

## Arrêt obligatoire
Une migration de schéma est un **arrêt** : demander l'accord explicite avant de créer ou modifier une migration (AGENTS.md §7).

## Procédure
1. Modifier `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <nom_additif>` (ou créer la migration additive).
3. `npx prisma migrate deploy` sur la base locale (port 5433).
4. `npx prisma generate`.
5. **Redémarrer** `npm run dev` (sinon l'ancien client reste en mémoire).
6. `npx tsc --noEmit` + `npm run test:run`.
7. Documenter la migration dans la PR (bêta puis prod).

Détail : `docs/agents/prisma-schema-change.md`.
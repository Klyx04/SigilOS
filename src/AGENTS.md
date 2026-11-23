# Règles de zone — src

Avant de modifier un fichier ici, lis la règle de sa zone (source unique, aucun doublon) :

- `src/server/**`, `src/app/api/**`, `src/workers/**`, `src/lib/**` → `docs/agents/rules/01-server.md`
- `src/components/**`, `src/app/**/*.tsx` → `docs/agents/rules/02-ui.md`
- Discord (`src/lib/discord/**`, `src/lib/tickets/**`, `src/server/tickets/**`, `src/server/discord.ts`) → `docs/agents/rules/06-discord.md` **en plus** de `01-server`

Le contrat global reste `AGENTS.md` §5.

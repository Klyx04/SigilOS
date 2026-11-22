# Règles de zone — src

OpenCode ne charge pas `.clinerules/*.md` automatiquement. Avant de modifier un fichier ici, lis la règle de sa zone (source unique, aucun doublon) :

- `src/server/**`, `src/app/api/**`, `src/workers/**`, `src/lib/**` → `.clinerules/01-server.md`
- `src/components/**`, `src/app/**/*.tsx` → `.clinerules/02-ui.md`
- Discord (`src/lib/discord/**`, `src/lib/tickets/**`, `src/server/tickets/**`, `src/server/discord.ts`) → `.clinerules/06-discord.md` **en plus** de `01-server`

Le contrat global reste `AGENTS.md` §5.

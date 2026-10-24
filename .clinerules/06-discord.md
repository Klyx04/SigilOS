---
paths:
  - "src/server/discord.ts"
  - "src/app/api/discord/**"
  - "src/lib/discord/**"
  - "src/lib/tickets/**"
  - "src/server/tickets/**"
  - "src/server/actions/discord-commands-sync.ts"
  - "src/server/actions/god-slash-command-actions.ts"
  - "src/server/actions/slash-command-actions.ts"
  - "services/discord-bot/**"
---
# Règles Discord

- **Source officielle d'abord** : avant toute nouveauté, modification ou suppression côté Discord
  (commande, permission, salon, bouton, modale, intent, embed, gateway), lire la **doc officielle**
  (`docs.discord.com/developers`) **et** le type exact de la version installée
  (`node_modules/discord-api-types`) — jamais de mémoire, jamais d'extrapolation depuis un champ
  **absent** d'une réponse d'API.
- **Mesurer avant d'affirmer** : un `GET` en lecture seule (commandes, permissions, salons, rôles)
  tranche une question d'API. Une donnée manquante n'est **pas** une impossibilité.
- **Un admin Discord voit toutes les commandes** : un test « je la vois » ne prouve rien. Tester avec
  un compte **sans** admin.
- **3 secondes** : toute interaction doit répondre en moins de 3 s (déférer puis `after()` pour le
  travail lourd) ; une réponse 5xx s'affiche « L'application n'a pas répondu ».
- **Bulk overwrite** : `PUT /guilds/{id}/commands` remplace **toute** la liste — une commande absente
  est supprimée, dérogations comprises.
- **Salons** : dérogation de type `3` ; « tous les salons » = `guildId − 1`. Un salon qui n'existe pas
  encore (ticket) ne peut pas y figurer.
- **Fail-closed** si Discord refuse : remonter l'erreur, jamais un « ok » optimiste.

Détail et pièges mesurés : `docs/agents/discord-module.md` §0 · procédure : skill `discord-api`.

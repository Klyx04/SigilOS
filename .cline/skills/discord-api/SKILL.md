---
name: discord-api
description: Utiliser dès qu'on touche à Discord (commande slash, permission, salon, bouton, modale, embed, intent, gateway) — vérifie la doc et les types officiels AVANT de coder, puis mesure l'API en lecture seule pour ne pas affirmer une impossibilité fausse.
---
# Toucher Discord sans se tromper

## 1. Doc officielle, pas la mémoire

- `https://docs.discord.com/developers/interactions/application-commands.md` (commande, permissions)
- `https://docs.discord.com/developers/interactions/receiving-and-responding.md` (3 s, `type 4/5/6/9`,
  `PATCH /webhooks/{app}/{token}/messages/@original`)
- `https://docs.discord.com/developers/topics/permissions.md` · `.../gateway.md` (intents)

Les pages sont longues : viser le **titre de section** (ex. « Application Command Permissions
Object ») et citer la phrase exacte dans la PR.

## 2. Types de la version installée = contrat réel

```powershell
Select-String -LiteralPath 'node_modules\discord-api-types\payloads\v10\_interactions\_applicationCommands\permissions.d.ts' -Pattern 'type|enum' | Out-String
```

Exemple mesuré (24/10/2026) : `type` = `1` rôle, `2` membre, **`3` salon** ; `AllChannels` = `guildId − 1`.
Une dérogation de salon vit donc **dans le même tableau** que les rôles — son absence dans une réponse
signifie « aucun salon configuré », **pas** « impossible ».

## 3. Mesurer avant d'affirmer (lecture seule)

```powershell
$tok = ((Select-String -LiteralPath '.env' -Pattern '^DISCORD_BOT_TOKEN=').Line -replace '^DISCORD_BOT_TOKEN=','').Trim()
$app = ((Select-String -LiteralPath '.env' -Pattern '^AUTH_DISCORD_ID=').Line -replace '^AUTH_DISCORD_ID=','').Trim()
$h = @{ Authorization = 'Bot ' + $tok; 'User-Agent' = 'SigilOS-Probe' }
# commandes, permissions par commande, défauts d'application
Invoke-RestMethod -Uri "https://discord.com/api/v10/applications/$app/guilds/<guildId>/commands" -Headers $h
Invoke-RestMethod -Uri "https://discord.com/api/v10/applications/$app/guilds/<guildId>/commands/<cmdId>/permissions" -Headers $h
Invoke-RestMethod -Uri "https://discord.com/api/v10/applications/$app/guilds/<guildId>/commands/permissions" -Headers $h
```

Jamais de secret affiché ; **aucune écriture** sans décision explicite. Une **écriture** de contrôle
(`PUT` puis `GET`) se justifie en commentaire de PR et se limite à une commande de test.

## 4. Écrire le code

- Dériver les définitions d'une **source unique** (catalogue), pas d'une liste dupliquée.
- Pousser les **permissions** (rôles + salons) et **effacer** une restriction périmée (`permissions: []`).
- Une commande non déployée n'est **pas** enregistrée (elle disparaît partout, Intégrations comprises).
- Tests de la règle **pure** (payloads) + contrat de source pour l'appel réseau.

## Pièges mesurés (à revérifier, pas à supposer)

| Piège | Réalité |
|---|---|
| « Je vois la commande » | Un **admin** voit tout, quelles que soient les dérogations |
| « Pas de `channels` dans la réponse » | Les salons sont des entrées `type: 3` du tableau `permissions` |
| « Restreindre par salon » | Faisable **par commande** ; impossible pour un salon **pas encore créé** (ticket) |
| `PUT /guilds/{id}/commands` | Remplace **toute** la liste : une commande omise est supprimée |
| Réponse lente | 3 s maximum ; au-delà, « L'application n'a pas répondu » (même si le travail aboutit) |
| Erreur avalée | Un `catch` muet = « Enregistré » alors que Discord a refusé |

Références : `.clinerules/06-discord.md` · `docs/agents/discord-module.md` §0.

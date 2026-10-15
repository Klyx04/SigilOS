# PLAN — **Commandes slash personnalisées** (chantier « Z », étape 60)

> **Demande user (verbatim, 14/10/2026)** : « l'amélioration module commande slash perso ».
> **Statut : plan écrit ; l'étape 60 de `docs/plans/FILE-EXECUTION.md` est débloquée** (chantier Y livré).
> **Ce plan part d'un état mesuré** : le module existe **déjà à moitié** — il ne s'agit pas de le créer.

## 1. Le besoin

Aujourd'hui, une guilde peut **régler** les commandes du catalogue (rôles autorisés, salons, activation,
et des actions de rôles pour `/valider-recrue`) mais **pas en créer**. Le besoin : une guilde crée **ses
propres** commandes — nom, description, réponse (texte/embed), variables, action de rôles optionnelle —
et elles **existent réellement sur son serveur Discord**.

## 2. État mesuré (14/10/2026) — ce qui existe déjà

| Brique | Où | Verdict |
|---|---|---|
| Catalogue des commandes | `src/lib/slash-commands-catalog.ts` (`SLASH_COMMANDS_CATALOG`, pur, partagé client/serveur : `name`/`description`/`usage`/`category`/`defaultRoles`/`staffOnly`) | **figé en code** ⇒ rien de créable par une guilde |
| RBAC par guilde | `GuildSlashCommandPermission` (`prisma/schema.prisma:4004`) : `commandName`, `roleIds[]`, `channelIds[]`, `isEnabled`, `config` JSON | **existe** (rôles + salons + activation) |
| Actions de rôles | `config.addRoleId` / `removeRoleId` + `parseValiderRecrueConfig` (parse **fail-closed** du JSONB) | **existe**, mais **spécifique** à `/valider-recrue` |
| Actions serveur | `src/server/actions/slash-command-actions.ts` (`getGuildSlashCommandPermissionsAction`, `updateGuildSlashCommandPermissionAction`) | existe |
| Écran staff | `src/app/dashboard/[guildId]/admin/commandes/page.tsx` + `src/components/admin/SlashCommandsRbacPanel.tsx` | existe (matrice RBAC) |
| Guide membres | `src/app/dashboard/[guildId]/commandes/page.tsx` + `src/components/commands/CommandsVisualGuide.tsx` | existe |
| God | `src/app/god/slash-commands/page.tsx` + `god-slash-commands-panel.tsx` | existe |
| Enregistrement Discord | `src/server/actions/discord-commands-sync.ts` — `buildDiscordCommandPayloads()` **écrit les commandes en dur** | ⚠️ **duplication** : la liste des commandes vit **deux fois** (catalogue *et* payloads). À corriger dans ce chantier |

## 3. Décisions à trancher

| # | Question | Recommandation |
|---|---|---|
| 1 | Stockage d'une commande personnalisée | **Nouveau modèle** `GuildCustomCommand` : `guildId`, `name` (unique **par guilde**), `description`, `response` JSON (texte + embed : titre/description/couleur), `variables`, `rolesToAdd`/`rolesToRemove` (facultatif), `channelIds[]`, `isEnabled`, `discordCommandId?`, `syncedAt?`. **Migration additive** (à accorder, règle maison) |
| 2 | Une seule source de vérité | **Supprimer la duplication** : les payloads Discord se **déduisent** (fonction pure prenant catalogue **et** commandes de guilde) — c'est aussi ce qui rend l'enregistrement testable sans réseau |
| 3 | Portée | Commande **de guilde** (`PUT /applications/{appId}/guilds/{guildId}/commands`), jamais globale. Le sync doit **créer / modifier / supprimer** (sinon une commande supprimée au dashboard continue de répondre sur Discord) |
| 4 | Autorisation | RBAC de la page **et** `isSuperAdmin()` pour ce qui touche au cycle de vie (`AGENTS.md` §5-1) ; l'enregistrement God reste `isSuperAdmin` |
| 5 | Réponses | Réponse **statique** (texte/embed) — **aucune** exécution de code, variables en **allowlist fermée**, jamais d'`eval` (même règle qu'en Y pour le message d'annonce) |
| 6 | Garde-fous | Longueurs Discord bornées (nom ≤ 32, description ≤ 100, description d'embed ≤ 4096), rate-limit sur la création/modification, **fail-closed** si Discord refuse : la commande **ne doit pas** s'afficher « activée » sans exister côté Discord |

## 4. Lots

| Lot | Contenu | Taille |
|---|---|---|
| **Z-1** | **Données + règles pures** : migration additive (`GuildCustomCommand`) · normalisation (nom/description/réponse, bornes Discord, variables en allowlist, rendu de la réponse) · dédoublonnage catalogue ∪ guilde | M |
| **Z-2** | **Enregistrement Discord** : `syncGuildCommands(guildId)` (create/update/delete, idempotent, `discordCommandId` tracé, échec par commande qui n'interrompt pas les autres) · appelée à la sauvegarde **et** par une passe de réconciliation (une commande supprimée à la main sur Discord ne doit pas rester cassée) | M |
| **Z-3** | **Créateur assisté** (écran `admin/commandes`) : nom, description, réponse (texte/embed), **aperçu live** (le motif `DiscordEmbedPreview` existe et sert déjà en Y-3/Y-5), action de rôles optionnelle, salons autorisés, activation — et l'état **réel** côté Discord (`discordCommandId`/`syncedAt`) affiché | L |
| **Z-4** | **Exécution + guide** : branchement dans `src/app/api/discord/interactions/route.ts` (réponse rendue, action de rôles, garde RBAC/salon **avant** toute réponse) · guide membres qui liste les commandes de la guilde · télémétrie God | M |

## 5. Tests et acceptation

- **Z-1** : bornes (nom > 32 refusé, description > 100 refusée), variable inconnue **ignorée** (jamais
  exécutée), nom déjà pris par le catalogue **refusé**.
- **Z-2** : payload **pur** (testable sans réseau) ; create/update/delete ; un échec Discord **n'active
  pas** la commande.
- **Z-3** : l'aperçu est **le même rendu** que l'exécution (leçon de Y-3 : aperçu = envoi réel).
- **Z-4** : RBAC/salon **avant** réponse ; une commande désactivée ne répond pas ; une commande supprimée
  n'existe plus sur Discord.
- **Acceptation** : une guilde crée `/ma-commande`, elle apparaît sur **son** serveur, répond, et
  n'existe **nulle part ailleurs** ; la désactiver puis la supprimer la retire vraiment.

## 6. Vigilance

- **Piège Discord** : une commande **globale** du même nom **masque** la commande de guilde ⇒ refuser un
  nom déjà pris par le catalogue, et le **dire** à l'écran.
- Le sync doit être **idempotent** et **relançable** : une commande supprimée à la main sur Discord doit
  pouvoir être recréée sans doublon (l'id de commande rendu par Discord est la clé).
- Ne **pas** copier la liste des commandes une troisième fois : catalogue = source, payloads = dérivés.
- **Arrêt + question** avant d'écrire la migration (règle maison), comme pour le chantier S.

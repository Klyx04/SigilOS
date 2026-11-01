# Plan — Limite de guildes par utilisateur (`limite-guildes`, LG)

> **Décisions du 31/10/2026** : **2 guildes maximum**, **God (`isSuperAdmin`) exempté**.
> **État au 01/11/2026** : **LG-1, LG-2 et LG-3 livrés** (règle pure + migration `maxGuildsPerUser` +
> gardes G1→G5 + écran `AccessDenied` + bandeau du portail + champ God borné 1..10, et les CTA
> autonomes retirés des landings, du portail et de la modale quand le kill-switch est OFF).

---

## 1. Décisions verrouillées (31/10/2026)

| Paramètre | Valeur | Pourquoi |
|-----------|--------|----------|
| **Limite** | **2 guildes actives** maximum par utilisateur | décision du mainteneur |
| **Compteur** | **union** : profils `ACTIVE` **+** guildes possédées, dédoublonnée par `guildId` | un owner sans profil ne serait jamais compté (§2) |
| **Exemption** | **God** (`isSuperAdmin`) — pour ses tests, y compris via `god-lifecycle-actions.reactivateProfile` | décision du mainteneur |
| **Seuil réglable** | `PlatformConfig.maxGuildsPerUser`, défaut **2**, **borné 1..10** | un 0 verrouillerait la plateforme |
| **Fail-closed** | toute lecture en échec ⇒ **refus** de la création | jamais d'accès par défaut |

---

## 2. Ce qui existe (mesuré sur `dev` `f1e552b9`)

### Limites déjà en place

| Limite | Ancre | Valeur |
|---|---|---|
| `maxMembers` par guilde | `schema.prisma:379` · contrôle `user-actions.ts:906` | 350 |
| `maxGuildMules` | `schema.prisma:527` | 35 |
| `ticketMaxPerUserCap` | `schema.prisma:207` | 5 |
| **guildes par utilisateur** | — | ❌ **inexistante** (`maxGuildsPerUser` absent du schéma **et** du code) |

### Les 3 portes d'entrée

| # | Chemin | Ancre | Crée un profil ? |
|---|---|---|---|
| **A** | Accès au dashboard d'une guilde → `getUserContext()` (**mise en cache**) puis `userProfile.create` | `user-actions.ts:336` · création **1029** | **oui** ← porte principale |
| **B** | Déploiement d'une guilde → `onboardGuild()` → `guildConfig.create` | `admin-actions.ts:19` · création **153** · `ownerId: guildInfo.owner_id` (**snowflake Discord**) **157** | non (profil à la 1ʳᵉ visite) |
| **C** | Bot Discord `GuildCreate` → `AllowedGuild` (whitelist) | `services/discord-bot/index.ts` | **non** ⇒ hors périmètre |

> ⚠️ Conséquence de **B** : le profil du owner n'existe **pas** au moment du déploiement. Un owner qui
> déploie 10 guildes sans jamais ouvrir leur dashboard n'aurait **aucun** profil — d'où le compteur double (§3).

---

## 3. Le compteur (règle unique)

**On compte des guildes, pas des lignes** : un owner qui a aussi un profil dans sa propre guilde ne doit
compter **qu'une fois**.

```
guildsCountForUser(userId) =
    { guildId des UserProfile ACTIVE du userId }
  ∪ { id des GuildConfig où ownerId = <snowflake Discord du userId> }
  → taille de l'ensemble
```

- **Membres** : `UserProfile` en statut **`ACTIVE`** seulement (`ARCHIVED`, `BANNED`, supprimés et
  `GUILD_DELETED` ne comptent pas).
- **Owners** : `GuildConfig.ownerId` est un **snowflake Discord** (`String?`), pas un `User.id` ⇒ il faut
  d'abord résoudre `Account.providerAccountId` (`provider: "discord"`) du user. **Sans compte Discord lié**,
  on ne compte que les profils.
- Le tout tient en **2 requêtes bornées** (`select: { guildId }` / `select: { id }`) + un `Set`.

---

## 4. Lots

### LG-1 — Migration + règle pure (prérequis)

1. **Migration additive** : `PlatformConfig.maxGuildsPerUser Int @default(2)` —
   la migration est un **arrêt** : accord explicite avant de l'écrire (§9).
2. **`src/lib/guild-limit.ts`** — deux fonctions **pures**, testables sans I/O :
   - `resolveGuildLimit(raw: unknown): number` : `Number` fini, entier, **borné 1..10**, sinon **2**.
   - `countGuildsForUser({ profileGuildIds, ownedGuildIds })` : **union dédoublonnée** par `guildId` (§3).
3. **`isGuildLimitReached(db, userId)`** — la seule lecture en base : God (`isSuperAdmin()`) **exempté**,
   sinon `countGuildsForUser(...) >= resolveGuildLimit(cfg)`. **Fail-closed** : une exception ⇒ `true`.


### LG-2 — Gardes serveur (fail-closed)

**6 points de garde** + l'exemption God. Ancres re-mesurées le 31/10 sur `dev` `f1e552b9`.

| # | Fonction | Fichier · ancre | Garde |
|---|----------|-----------------|-------|
| **G1** | `_getUserContext` → **avant** `userProfile.create` | `user-actions.ts:1029` (entrée `getUserContext` **336**, **en cache**) | si limite atteinte : **ne pas créer** de profil, exposer `guildLimitReached: true` |
| **G2** | `onboardGuild` → **avant** `guildConfig.create` | `admin-actions.ts:19` · création **153** | si limite atteinte : `{ success: false, error: … }` |
| **G3** | `onboardGuild` — **batch** de réactivation des profils `ARCHIVED (GUILD_DELETED)` | `admin-actions.ts` (après **153**) | **remplacer l'`updateMany` aveugle** par une boucle qui vérifie **chaque `userId`** |
| **G4** | `reactivateProfileByAdmin` | `lifecycle-actions.ts:550` | compter les `ACTIVE` du **user cible** (pas de l'admin) → refuser si ≥ max |
| **G5** | `reactivateProfile` (self) | `lifecycle-actions.ts:702` | même vérification que G4 |
| **G6** | UI portail + `AccessDenied` | `src/app/dashboard/page.tsx` · `src/app/dashboard/[guildId]/layout.tsx` · `guild-setup-card.tsx` | bandeau + bouton « Déployer » **grisé** ; `AccessDenied` sur une guilde inconnue |
| **God** | `reactivateProfile` (variante God) | `god-lifecycle-actions.ts:298` | **exempté** par décision (31/10/2026) — **aucune** garde |


### LG-3 — UI (portail + dashboard)

**Correctif du 01/11/2026 (capture utilisateur)** : le bandeau du plafond vivait **hors** de
`.reg-shell` (barre pleine largeur, au-dessus du titre, alignée sur rien), et le paragraphe
d'explication posé dans la 3ᵉ colonne `auto` de `guild-setup-card.tsx` écrasait la colonne du titre
(un mot par ligne) avant de déborder de la carte — **dès 1440**, pas seulement en mobile. Règle
d'affichage extraite dans `src/lib/guild-setup-view.ts` (**une porte fermée = aucune offre**), bandeau
déplacé dans l'en-tête, verrou `tests/unit/guild-setup-view.test.ts`.

1. **Portail** `/dashboard` : si `count >= max`, afficher un bandeau d'avertissement au-dessus des guildes « Déploiement » et griser le bouton dans `GuildSetupCard`.
2. **Dashboard** d'une guilde inconnue : `getUserContext()` retourne `guildLimitReached: true` → page `AccessDenied` avec le message du §7.
3. **Panel God** : `maxGuildsPerUser` en lecture/écriture, **borné 1..10** côté serveur (Zod), **jamais 0** (verrouillerait la plateforme) ; libellé en clair, jamais de code technique à l'écran.

---

## 5. Matrice exhaustive des scénarios

### Entrées (le user veut rejoindre / déployer)

| Guildes **comptées** (§3) | Action | Résultat |
|---|---|---|
| 0 | Accès dashboard ou déploiement | ✅ OK → 1/2 |
| 1 | Accès dashboard ou déploiement | ✅ OK → 2/2 |
| **2** | **Accès dashboard** (membre) | ❌ page « Limite atteinte » |
| **2** | **Déploiement** (owner) | ❌ bouton grisé + refus serveur |
| **2 possédées, aucun profil** (owner qui n'a jamais ouvert son dashboard) | **Déploiement d'une 3ᵉ** | ❌ refusé — **c'est précisément le cas** qu'un compteur « profils seuls » laissait passer |
| quelconque | **God (`isSuperAdmin`)** | ✅ toujours autorisé (exemption du 31/10/2026) |

### Sorties (le user quitte / est retiré)

| Action | Status résultant | Libère une place ? |
|--------|------------------|-------------------|
| `archiveProfile()` (self ou admin) | `ARCHIVED` | ✅ Oui |
| `wipeUserProfile()` (exclusion) | `BANNED` | ✅ Oui |
| `deleteProfileByAdmin()` | Ligne supprimée | ✅ Oui |
| `purgeMemberFromGuild()` | Ligne supprimée (sans tombstone) | ✅ Oui |
| `handleGdprDeletionRequest()` | User entier supprimé | ✅ Oui |
| `softDeleteGuild()` (guilde supprimée) | `ARCHIVED` (`GUILD_DELETED`) | ✅ Oui |

> Les sorties ne nécessitent aucune garde (elles ne font que réduire le compteur).

### Retours (profil réactivé)

| Guildes **comptées** | Action | Résultat |
|---------------|--------|----------|
| 0 ou 1 | `reactivateProfileByAdmin()` | ✅ OK |
| **2** | **`reactivateProfileByAdmin()`** | ❌ Refusé |
| 0 ou 1 | Guilde re-déployée (batch réactivation) | ✅ OK |
| **2** | **Guilde re-déployée (batch réactivation)** | ⚠️ Ce profil **reste archivé** |
| 0 ou 1 | User purgé revient sur le dashboard | ✅ Re-provisionné |
| **2** | **User purgé revient sur le dashboard** | ❌ Limite atteinte |

---

## 6. Cas piège — réactivation d'une guilde supprimée

```
Jour 1 : User dans guildes A + B → 2/2
Jour 2 : God supprime guilde A → profils ARCHIVED(GUILD_DELETED) → user = 1/2
Jour 3 : User rejoint guilde C → 2/2
Jour 4 : God réactive guilde A → batch réactivation des profils
         → Le profil de cet user dans A reste ARCHIVED (déjà à 2/2)
         → L'user devra quitter C pour réactiver A manuellement
```

**Implémentation G3** : dans `onboardGuild()` L64, remplacer le `updateMany` aveugle par une boucle qui vérifie chaque userId avant de réactiver.

---

## 7. Messages utilisateur

| Contexte | Message |
|----------|---------|
| Dashboard (G1) | « Vous faites déjà partie de 2 guildes sur SigilOS (maximum autorisé). Quittez une guilde existante avant d'accéder à un nouveau tableau de bord. » |
| Déploiement (G2) | « Impossible de déployer : vous faites déjà partie de 2 guildes (limite plateforme). Quittez une guilde pour en déployer une nouvelle. » |
| Portail (G5) | Bandeau : « Limite de 2 guildes atteinte. Quittez une guilde pour en déployer une autre. » |
| Réactivation admin (G4/G6) | « Ce membre fait déjà partie de 2 guildes. Il doit en quitter une avant d'être réintégré ici. » |

---

## 8. Performance (la vraie contrainte)

`getUserContext()` est **mis en cache** (`user-actions.ts:336`) et appelé par presque toutes les pages.
Bonne nouvelle **mesurée** : le comptage n'a lieu que sur le **chemin de création** du profil (profil absent,
`userProfile.create` **1029**) — **pas** à chaque requête. Coût réel : **2 requêtes bornées** par
(user, guilde) **nouvelle**.

Cas résiduel : un user **déjà à la limite** qui recharge une guilde interdite rejoue le comptage à chaque
expiration du cache de contexte. Remède simple : mémoïser le verdict `guildLimitReached` **60 s en Redis**
(clé `guild-limit:{userId}`), invalidée sur `userProfile.create`, `archiveProfile`, `reactivateProfile*`,
`deleteProfileByAdmin` et `onboardGuild`.

❌ **Ne pas** mettre un `count()` inconditionnel en haut de `_getUserContext` : ce serait un N+1 sur tout le
dashboard pour une règle qui ne concerne que les arrivées.

## 9. Tests et ops

**Règle pure** — `tests/unit/guild-limit.test.ts` (aucune I/O) :
- union **dédoublonnée** : owner **avec** profil dans sa propre guilde = **1**, pas 2 ;
- `ARCHIVED` / `BANNED` / `GUILD_DELETED` ne comptent pas ;
- `resolveGuildLimit` : `0`, `-1`, `11`, `"abc"`, `null` ⇒ **2** (borné 1..10) ;
- **God exempté** ⇒ jamais bloqué ;
- **fail-closed** : erreur de lecture ⇒ refus.

**Gardes** — `tests/unit/guild-limit-guards.test.ts` (garde de source) : G1→G5 appellent `isGuildLimitReached`
**avant** l'écriture, et G3 n'a **plus** d'`updateMany` aveugle.

**Ops** : LG-1 = **1 migration additive** (`maxGuildsPerUser INT NOT NULL DEFAULT 2`) ⇒ **arrêt + accord
explicite** avant écriture, puis `npx prisma migrate deploy` + `npx prisma generate` + redémarrage en local.
Bêta et prod : la migration passe avec `deploy-cd.sh`.

## 9 bis. Reste mesuré — l'annonce Discord du bot (01/11/2026)

**Constat (captures utilisateur)** : à 2 guildes sur 2, le portail refusait bien le déploiement (garde G2),
mais le bot venait d'annoncer « ✅ Ce serveur est **actif immédiatement** — aucune approbation requise ».
Deux surfaces se contredisent, et l'utilisateur a cliqué « Déployer » pour rien.

**Pourquoi le site ne peut pas l'empêcher** : « Inviter le bot » est une URL OAuth Discord ; le service bot
reçoit `GuildCreate` **sans session utilisateur**, donc sans notion de plafond. Ce n'est pas un oubli de la
garde : c'est un autre service.

**Correctif retenu (option A, décidée le 01/11/2026)** — `services/discord-bot/index.ts` :

| Ancre | Quoi |
|---|---|
| `182` | handler `Events.GuildCreate` |
| `225` | message God (« actif immédiatement (modèle ouvert) ») |
| `251` | message public (« ✅ actif immédiatement ») |

Dans le handler, après lecture de la configuration :

1. lire `PlatformConfig.maxGuildsPerUser` et le normaliser avec `resolveGuildLimit`
   (`src/lib/guild-limit.ts`, **pur**, donc réutilisable par le bot) ;
2. compter les guildes du **propriétaire** (`guild.ownerId`) : `GuildConfig` où `ownerId = ownerId`
   ∪ `UserProfile` `ACTIVE` dont `user.accounts.providerAccountId = ownerId` — même règle que
   `countGuildsForUser` (union dédoublonnée) ;
3. si `count + 1 > limite`, annoncer « ⏳ Ce serveur n'est pas encore déployable : son propriétaire a atteint
   la limite de N guildes, il doit en quitter une depuis le portail. » ; sinon, garder le texte actuel.

**Vigilance** : service **séparé** (image `discord-bot`, déployée par `deploy-cd.sh`). Une erreur ici ne casse
pas un écran : elle coupe **toutes** les annonces d'invitation. ⇒ `tsc` du bot (`services/discord-bot`) vert
avant merge, et rebuild d'image obligatoire (sinon le conteneur garde l'ancien code).

## 10. Fichiers impactés (estimation)

| Fichier | Modification |
|---------|-------------|
| `prisma/schema.prisma` | +1 champ `PlatformConfig` |
| `src/lib/guild-limit.ts` | Nouveau : utilitaire `isGuildLimitReached` |
| `src/server/actions/user-actions.ts` | G1 : garde dans `getUserContext()` |
| `src/server/actions/admin-actions.ts` | G2 + G3 : gardes dans `onboardGuild()` |
| `src/server/actions/lifecycle-actions.ts` | G4 + G6 : gardes dans `reactivateProfileByAdmin()` et `reactivateProfile()` |
| `src/app/dashboard/page.tsx` | G5 : passer le flag au portail |
| `src/components/guild-setup-card.tsx` | G5 : griser le bouton |
| `src/app/dashboard/[guildId]/layout.tsx` | Afficher `AccessDenied` si `isGuildLimitReached` |

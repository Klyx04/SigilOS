# PLAN — Succès « Spéciaux » : **vraie description + icône**, et **retrait du pseudo-succès « Donjon validé »**

> Branche `feat/succes-speciaux-donnees` · ouvert le **11/10/2026** (plan avant code — demande user :
> « tout dans une branche `feat/succes-speciaux-donnees` : siphon DofusDB `achievements`+`challenges`
> (description réelle + icône via le proxy) **ET** suppression complète de “Donjon validé” »).
> **Ce plan est la source de vérité de l'exécution** : les mesures sont faites, les étapes ①-③ sont
> ordonnées, chaque étape a son verrou. **Aucune donnée n'est supprimée sans `--apply` explicite.**

## 0. Mesures faites (11/10/2026, jamais supposées)

**DofusDB expose tout ce qu'il faut** (lu par `curl`, API publique) :
- `GET api.dofusdb.fr/achievements/6150?lang=fr` → `name` « Mob l'Éponge (Spécial) » · **`description`**
  « Vaincre Mob l'Éponge dans son donjon en validant le challenge **[challenge,979]** » ·
  **`img` = `img/achievements/10.png`** + `iconId: 10` (c'est **l'icône du succès** — la boîte noire
  de notre UI) · `points: 10`, `level: 20` · `objectives[]` : `criterion` = `(EH>979,0)` ⇒ **l'id du
  challenge (979) est extractible**, et `name` de l'objectif = le libellé du succès.
- `GET api.dofusdb.fr/challenges/979?lang=fr` → `name` « Passer l'éponge » · **`description`**
  « À partir du tour 2, Mob l'éponge doit être poussé ou attiré au moins une fois à chaque tour
  global. » · `iconId: 977` ⇒ `img/challenges/977.png` · `activationCriterion` `GM>0,928,1&Gm=d`
  (« monstre présent dans l'équipe ennemie ») · `completionCriterion` `Ma=1` ⇒ **c'est exactement le
  texte du survol DofusDB** : le contenu est **disponible et siphonnable**.

**Côté SigilOS (mesuré dans le code, pas deviné)** :
- `Challenge` porte **déjà** `description`, `iconUrl`, `conditions` (`prisma/schema.prisma`) ;
  `DungeonAchievement` porte `imageUrl` (**aujourd'hui `NULL`**) + `points`.
- L'import God (`importGameData`, `src/server/actions/game-data-admin-actions.ts` **l.1565-1587**)
  écrit `description`/`iconUrl`/`conditions` **depuis le JSON importé**, et `DungeonAchievement` ne
  reçoit **que `points`** (l.1737-1750) ⇒ la phrase **générique** (« Vaincre tel boss dans son donjon
  en validant le challenge dédié. ») vient **du JSON source**, pas du code (grep négatif dans `src/`),
  et aucune icône de succès n'est écrite.
- **L'« image noire »** : `src/lib/achievement-icon.ts` renvoie **en premier**
  `/game-data/achievements/{slug}.png` **sans vérifier l'existence** (le dossier ne contient que
  **28** fichiers = les challenges classiques) ⇒ 404, l'`<img>` est masqué (`onError`) et la case
  reste **noire**. Aucun repli vers l'icône DofusDB n'est possible aujourd'hui : le proxy
  `/api/assets-dofus/[type]/[id]` n'accepte que `monsters|items|spells`, et `parseDofusDbImageUrl`
  ignore `img/achievements|challenges`.

## ① Succès « Spéciaux » — la vraie description (souveraine)

1. **Sonde read-only d'abord** (aucune écriture) : ce que porte **notre base** pour un succès spécial
   (`Challenge.slug/name/description/conditions/iconUrl` du donjon « Mob l'Éponge ») **et** si les ids
   de challenge de l'import (`challengeIdMap`, l.1552+) sont les ids **DofusDB** (`979`) — si oui la
   jointure est directe, sinon passer par le nom de l'objectif.
2. **Passerelle DofusDB** (règle pure dans `src/lib/**`, testée) : `fetchAchievement(dofusdbId)` →
   `{ descriptionFr, iconId, challengeId, points }` et `fetchChallenge(challengeId)` →
   `{ nameFr, descriptionFr, conditions, iconId }`. Contraintes : **garde d'identité** (l'id demandé
   est renvoyé), **timeout dur**, passage par le **limiteur partagé** (`dofusdb-limiter`) — mêmes
   règles que les autres siphons.
3. **Écriture** : `Challenge.description` ← la description **réelle du challenge** (le texte du
   survol) ; `Challenge.conditions` ← `activationCriterion`/`completionCriterion` **lus** (jamais
   interprétés en phrases inventées) ; `DungeonAchievement.imageUrl` ← l'icône **du succès**. Passe
   idempotente + filigrane (motif `runMonsterFichesPass` / veille DofusDB déjà en place).
4. **Rendu** : la fiche affiche le texte **réel** dès qu'il existe (`description` est déjà rendue dans
   `PublicBossAchievementsTab`) et garde la phrase générique en **dernier recours seulement**.

## ② Icône du succès (fin de la boîte noire)

1. **Nouvel espace d'asset `achievements`** dans le proxy : `validTypes` + `ASSET_DIRS`
   (`public/uploads/assets-dofus/achievements`) + branche de résolution `img/achievements/{iconId}.png`
   → WebP. Le motif est **exactement** celui de `sort_<iconId>` pour les sorts (mesure du 11/10/2026 :
   le nom **est** l'identité de l'icône, l'id **n'est jamais** un id d'entité) — et la même leçon
   s'applique : un chemin disque n'est **jamais** rendu brut.
2. `DofusAssetType` (`src/lib/dofus-image-url.ts`) + `parseDofusDbImageUrl` acceptent
   `achievements|challenges` ⇒ toute URL d'icône DofusDB se réécrit vers le proxy.
3. `getAchievementIconUrl` : **proxy d'abord** (auto-réparateur), asset local `/game-data/…` en repli
   **et seulement s'il existe** — la vérification d'existence se fait **côté serveur**, comme
   `getBestiaireCatalog` (l.351-360) le fait déjà pour les visuels de boss.
4. Rendu : plus jamais de case noire (le repli `Trophy` existe déjà, sinon l'icône réelle).

## ③ Retrait de « Donjon validé » (pseudo-succès)

**Tout ce qui le crée, le rattache ou le ressuscite** (à retirer, pas à contourner) :
`src/lib/dungeon-no-achievement.ts` (`ensureNoAchievementChallengeId`, l'attache) ·
`src/lib/anomaly-boss-siphon.ts` (§4.5 + l.706-736) · God `game-data-admin-actions.ts` (l.83-84,
427-468, 500-563) · mémoire anti-ressuscité `src/lib/game-data-ignores.ts` (l.111, 148) · rendu
`PublicBossAchievementsTab` (`isSystemSlug` → « Vaincre {boss} pour l'obtenir. ») **et** la fiche
interne · verrous `tests/unit/anti-resurrection.test.ts`, `tests/unit/bounty-fiche.test.ts`.

Donnée : **script `scripts/…` en dry-run par défaut** (`--apply` explicite) qui supprime les
`DungeonAchievement` du challenge système, puis le `Challenge` s'il n'a plus aucune attache —
**jamais** de re-seed (il écraserait les éditions du Studio God).

⚠️ Conséquence assumée : un donjon marqué `isNoAchievement` n'aura **plus aucun succès** à afficher
(c'est la demande : « il sert à rien ») — l'onglet Succès de sa fiche affichera son message vide
honnête (« Aucun succès connu pour X »), jamais une ligne générique.

## DoD de l'exécution

- `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` propre.
- Verrous neufs : passerelle DofusDB (garde d'identité + conditions **lues**, jamais inventées),
  icône de succès (proxy d'abord, aucun chemin disque brut), disparition du pseudo-succès (aucun
  rendu, aucune recréation par le siphon ni par God).
- Ops humain : jouer le script de suppression (dry-run → `--apply`) **puis** la passe de siphon ;
  contrôle visuel d'un succès spécial sur la fiche **publique** et **interne**.


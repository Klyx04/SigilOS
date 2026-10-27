---
description: Rush Sylvestre — organisation de la suite : 4 surfaces, blocs S0→S6, lots, dépendances, verrous de test
---

# 🏹 Rush Sylvestre — la suite du développement

> **Rôle unique.** Ce fichier porte **l'organisation** des chantiers Rush après la consolidation du
> 21/10/2026 : dans quel ordre, sur quelles surfaces, avec quels verrous.
> Il **ne duplique pas** : le contenu mesuré vit dans `MAPPING-RUSH-SYLVESTRE.md`, le « quoi » des
> modules dans `MODULE-RUSH-SYLVESTRE.md`, l'ergonomie dans `PLAN-REFONTE-RUSH-SYLVESTRE.md`, et
> **l'ordre global** dans `docs/ROADMAP.md`.

## 0. Ce qui fait foi depuis le 21/10/2026

| Sujet | Source qui fait foi | Mesure |
|---|---|---|
| Série Bonta | Tougli `100-quetes-alignement-bontarien` | **100** quêtes (`Tarche` → `L'exorciste`) |
| Série Brâkmar | Tougli `100-quetes-alignement-brakmarien` | **102** quêtes (`Cliquetis fou` → `La danse macabre`) · **mesuré le 27/10/2026** : DPLN numérote **100 étapes** ; les n° **55** et **66** listent des **variantes EXCLUSIVES** (« Ces trois quêtes seront identiques, juste le nom change ! » — on n'en joue qu'une : *Le magnanime* / *Les kamas résolvent tout* / *Assassinat effectué*) ⇒ Tougli = **100 étapes + 2 étapes dédoublées** (partie 1 + variante retenue) = **102**, et **rien ne manque** |
| Chronologie / préparation / saves | **Dofusyelle** | 57 étapes, 21 préparations, 83 donjons (40 saves) |
| Quêtes détaillées + contraintes | **Tougli** RSA | 530 occurrences (529), 1 085 détails |
| Classes | Tougli (1 nœud, 19 branches) | 19 substitutions |
| Ordres | Tougli (1 nœud, 6 branches × 5) | **30** quêtes |
| Ressources | union | **584** ids (408 communs) |
| Succès | Dofusyelle | **62** |
| Donjons | union | 99 + 83, **67 slugs identiques**, 16 alias |

**Règle de consolidation** : on **empile** (Tougli = référentiel, Dofusyelle = trame), on ne fusionne
pas ; les textes sont **réécrits**, jamais recopiés.

## 1. Les 4 surfaces (toute évolution touche les quatre)

| Surface | Fichier de référence | Contrainte propre |
|---|---|---|
| **Guide interne** (membres) | `dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx` | progression en base, multi-personnages (mules) |
| **Guide externe** (public) | `app/guides/rush-sylvestre/PublicRushGuideClient.tsx` + `RushTimelineClient` | **aucune donnée de guilde**, progression locale, `noindex` en construction |
| **Overlay interne** | `overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx` | fenêtre PiP, `ownerDocument`, présence guildée |
| **Overlay externe** | même overlay, `guildId = "public"` | pas de présence, destinations publiques (`/boss/<slug>`) |

**Invariant** : une règle nouvelle = **une** fonction pure dans `src/lib/**`, consommée par les
quatre. Aucune copie par surface. Le verrou `tests/unit/rush-public-parity.test.ts` doit rester vert.

## 2. Bloc S0 — Donjons cochables (mécanique demandée le 21/10)

**Besoin** : une quête avec **≥ 1 donjon** doit permettre de cocher **chaque** donjon ; tant qu'un
donjon **requis** n'est pas fait, la quête **ne peut pas être validée**. Option **obligatoire ou non**
par donjon ; même règle avec plusieurs donjons.

| Lot | Contenu | État |
|---|---|---|
| **S0-1** | Règle pure `src/lib/rush-dungeons.ts` : `resolveSequenceDungeons`, `sequenceDungeonProgress`, `isSequenceBlockedByDungeons`, `toggleDungeonKey`, clé stable `id > slug > nom`, fail-open sur donjon sans identité | ✅ **livré** (12 tests) |
| **S0-2** | Flag **optionnel** par donjon : `RushDungeonRef.isOptional` (type + `getDungeons`) | ✅ **livré** (type) |
| **S0-3** | **Persistance** : table `PlayerGuideDungeonState` — clé unique `(profileId, guideId, sequenceId, dungeonKey, characterSlot)` + enum `DONE/TODO` + colonne `GuideSequence.dungeonOptionalIds` (migration `20270115000000_rush_dungeon_state`) + actions `getRushDungeonStates` / `setRushDungeonState` (isolation guide, rate limit, upsert idempotent) | ✅ **livré** — migration **à jouer** (bêta puis prod) |
| **S0-4** | **Verrou à la validation** : `setRushSequenceProgress` refuse une séquence **nouvellement cochée** dont un donjon requis n'est pas `DONE` (`success:false` + `blockedSequenceId` + `missingDungeons`) | ✅ **livré** (serveur, fail-closed) |
| **S0-5** | **UI** : les donjons d'une quête, cochables **DANS la quête** — la pastille `Donjon ×N` ouvre un panneau qui **reste ouvert** (croix de fermeture) avec deux coches par donjon (`Fait` / `À faire`) | ✅ **livré** (overlay, dashboard, guide public) |
| **S0-5bis** | **Persistance des 3 surfaces** : dashboard en base (états chargés au montage, pré-contrôle local + verrou serveur) ; guide public en `localStorage` (`<préfixe personnage>dungeons`, fail-closed), verrou dans les **3** chemins d'écriture, donjons manquants nommés, reset de la 4ᵉ clé ; overlay public (invité) en `localStorage` | ✅ **livré** (21/10) |
| **S0-6** | **God** : case « optionnel » par donjon lié à la séquence | ✅ **livré** (22/10, PR #1091) — règle pure `boundOptionalDungeonIds` (intersection, dédoublonnage, bornes), colonne écrite **seulement si la liste est fournie**, case dans l'éditeur **et** la création, aperçu membre fidèle ; **16 cas** (`rush-dungeons` 22, `rush-god-studio-robustesse` 26) |
| **S0-7** | **Décoche en cascade** : décocher un donjon **dévalide** la quête (et remet à zéro ses coches de ressources) | ✅ **livré** — serveur, dashboard, guide public/overlay invité ; **9 cas** dans `tests/unit/rush-dungeon-invalidation.test.ts` |
| **S0-8** | **Verrou client par donjon** : une quête dont un donjon **requis** n'est pas coché n'est **pas cochable** — la ligne dit « Donjons requis non validés » (vignettes cliquables), le clic ne part plus au serveur (fin des « erreurs de synchronisation ») | ✅ **livré** (22/10) — `missingRequiredDungeons`, overlay eager |
| **S0-9** | **Notifications DANS l'overlay** : Toaster **dédié** (`toasterId`) monté dans le portail PiP — les messages ne s'affichent plus hors de la fenêtre | ✅ **livré** (22/10) — `src/components/rush/overlay-toast.tsx` |
| **S0-10** | **Modale donjons lisible** : état en **aplat** (vert fait / ambre à faire), vignette 40 px avec liseré d'état, **barre de progression**, et **ciblage** du donjon cliqué depuis la ligne de quête | ✅ **livré** (22/10) |

**S0-6 — livré le 22/10/2026 (PR #1091).** Ce paragraphe est conservé comme mesure de
référence : `GuideSequence.dungeonOptionalIds` était **lu** à trois endroits et **jamais écrit**,
donc **tout donjon était requis**. Le chemin d'écriture et la case existent désormais
(`boundOptionalDungeonIds` côté règle, `upsertRushSequence` côté serveur, case dans l'éditeur God
pour l'édition **et** la création). **S4-1 est livré le 23/10/2026** (vue Branches à 2 étages : règle pure `src/lib/rush-branches.ts`, onglet God, paires alignées, manques, orphelins).

État du code au moment de la mesure : le type
`RushDungeonRef.isOptional` (S0-2) et sa propagation étaient déjà en place ; il ne manquait que le
chemin d'écriture et la case.

Ce qu'il fallait toucher, dans cet ordre :

1. **Serveur** — `src/server/actions/optimized-guide-actions.ts` : `upsertRushSequence` (l. **3819**) écrit
   déjà `dungeonIds` (l. 3861, 3870) ; ajouter `dungeonOptionalIds?: string[]` à la signature **et** à
   `commonFields`, borné (ids appartenant à `dungeonIds` de la même séquence). Garder `requireRushAccess()`
   et le `logGodWrite` de l'action.
2. **Éditeur God** — `src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx` : l'état `selectedDungeons`
   alimente les payloads aux l. **2597** (aperçu membre `previewSeq`), **2638** (`handleSubmit` → `onSave`)
   et **3700** (sauvegarde du bloc). Ajouter une case « optionnel » **par donjon**, envoyée en
   `dungeonOptionalIds`, et la refléter dans `previewSeq` (`dungeons[i].isOptional`) pour que l'aperçu montre
   exactement ce que le joueur verra.
3. **Lecture** — rien à écrire : les trois chargeurs (dashboard, overlay, guide public) lisent déjà
   `dungeonOptionalIds`. Vérifier au test qu'un donjon optionnel coché/décoché **ne bloque plus** la
   validation (`sequenceDungeonProgress` / `isSequenceBlockedByDungeons`), alors qu'un requis manquant bloque
   toujours.
4. **Tests** — nouveau `tests/unit/rush-dungeons-optional.test.ts` (la règle ignore les optionnels, le requis
   manquant bloque) + un cas d'UI dans `rush-dungeons-ui.test.ts`. **Ne pas affaiblir**
   `rush-dungeon-invalidation.test.ts` (verrou S0-7) ni `rush-public-parity.test.ts`.

**DoD S0-6** : depuis God, cocher « optionnel » sur un donjon d'une séquence → enregistrer → rouvrir la
séquence (la case est toujours cochée) → côté dashboard, la quête se valide **sans** ce donjon et **refuse**
toujours sans un donjon resté requis. **Aucune migration** : la colonne existe depuis
`20270115000000_rush_dungeon_state`, **appliquée en prod le 22/10/2026** (281 migrations, `Base à jour`).

**Après S0-6** : **S4-1** (vue Branches 2 étages) → **S1** (contenu 100/102 séries + 30 Ordres + 19 classes,
voir §3 et `MAPPING-RUSH-SYLVESTRE.md`).

**Modèle retenu (mesuré, 21/10)** :

- **Deux états**, jamais une case binaire : `DONE` (fait) et `TODO` (à faire). L'absence de ligne = « pas encore décidé ».
- ⚠️ **La coche est par OCCURRENCE (quête × donjon)**, jamais mutualisée par donjon : le même donjon demandé par trois quêtes se coche **trois fois**. `sequenceId` fait partie de la clé unique, et l'index (`buildDungeonIndex`) sert seulement à **lister les endroits** — pas à partager l'état.
- Un donjon **optionnel** (`GuideSequence.dungeonOptionalIds`) s'affiche et se coche mais **ne bloque pas**. Le drapeau est propagé par **les trois** chargeurs (dashboard, public, God) depuis le 21/10 — sans lui, un donjon facultatif serait traité comme requis.
- Le verrou est **serveur** : le client ne fait pas foi ; `doneDungeonKeysForSequence` ne rend que les clés `done` **de la quête concernée**. Un donjon **sans identité** (ni id, ni slug, ni nom) est signalé mais ne fige pas la quête (fail-open documenté, même doctrine que les prérequis).
- **Deux chemins d'écriture** portent le verrou côté serveur : `setRushSequenceProgress` (une quête) **et** `toggleMilestoneProgress` (la case « valider tout le bloc », qui l'écrivait sans contrôle avant le 21/10).
- **Guide public** : aucune donnée de guilde, aucun serveur. La coche vit dans `localStorage` sous `<préfixe personnage>dungeons` (même préfixe que les étapes cochées, donc par personnage déclaré) ; le verrou y est **local et fail-closed**, appliqué dans les **3** chemins d'écriture (étape, chapitre entier, lot de quêtes), et les donjons manquants sont **nommés** dans la carte.

**Verrous de test** : `rush-dungeons` (**17** cas, dont les états par occurrence) · `rush-dungeons-ui` (**6** cas sur le panneau de quête) · `rush-dungeon-storage` (**12** cas, fail-closed du stockage local) · `rush-public-parity` (**9** cas donjons : même panneau, même règle, 3 chemins verrouillés, verrou serveur du bloc, absence d'onglet global) · `rush-overlay-dungeons` (pastille → panneau, portail `ownerDocument`) → **95 tests verts** sur le périmètre donjons.

**UI retenue (corrigée le 21/10 par le user)** : **aucun onglet global**, aucune icône ajoutée dans la barre de l'overlay, aucune fenêtre « tous les donjons du guide ». La coche vit **dans la quête**, ouverte depuis la pastille `Donjon ×N`, et le panneau **reste ouvert** jusqu'à sa croix (le survol n'ouvre plus rien : on ne peut pas cocher dans une fenêtre qui se referme). Rendus partagés : `RushQuestDungeonsPanel` (cadre + croix) et `RushOverlayDungeonCard` (lignes + deux coches).

**Ops (humain)** : `npx prisma migrate deploy` en **bêta puis prod** (migration additive : `CREATE TYPE`, `CREATE TABLE`, 3 index, 2 FK, 1 colonne `TEXT[]`).

**Sans serveur, ce qui marche déjà** : côté **externe** (guide public), la coche et le verrou vivent entièrement dans le `localStorage` — aucun compte n'est requis.

**Verrous de test** : `tests/unit/rush-dungeons.test.ts` (12 cas, vert) · à compléter par
`rush-dungeons-gate.test.ts` (l'action refuse, l'action accepte, idempotence) et un cas de parité.

## 3. Bloc S1 — Le contenu (le gros morceau)

| Lot | Contenu | Cible mesurée | Taille |
|---|---|---|---|
| **S1-1** | Série **Bontarien** : 100 quêtes ordonnées, `alignReq="bontarien"`, pas d'Ordre | **98 présentes** (mesure **par nom**, 27/10/2026) → **2 à créer** (#65 « Bandanarthrie », #70 « Le subterfuge de la corne ») · ⚠️ **32 présentes sans `alignReq`** (#2 à #33) : visibles des deux camps et non comptées ⇒ `tag-bonta-alignment.mjs` (dry-run, garde d'état dans le `WHERE`) | M |
| **S1-2** | Série **Brâkmarien** : 102 quêtes ordonnées | **0 présente** par nom (la jumelle « Entraînement avec Tarche [brakmarien] » n'est pas la série) → **102 à créer** ; export prêt `export-god-cites.json` (**6 blocs** : 2 Bonta palier 80 + 5 Brâkmar 20/40/60/80/100) · **variantes exclusives** (mesuré le 27/10/2026) : l'étape **55** offre **3 quêtes au choix** (« Le magnanime » / « Les kamas résolvent tout » / « Assassinat effectué », cette dernière **publiée le 26/09/2026**) et l'étape **66** en offre **2 selon le temps de trajet** (« Les ordres sont-ils les ordres ? » / « On m'appelle l'Escargot ») — le guide n'en porte qu'**une branche** ; `export-god-variantes.json` ajoute les **3 manquantes** en **optionnel** avec la note « variante exclusive » (dry-run : 0 nouveau bloc, 3 quêtes, 0 avertissement) | M |
| **S1-3** | **30 quêtes d'Ordre** : `alignReq` + `alignOrderCode` + `alignLevelReq` **dérivé par position** (20/40/60/80/100) | 6 × 5 | ✅ **livré le 27/10/2026** — export `export-god-ordres.json` (6 blocs × 5, `dofusDbId` résolu par nom 30/30, DPLN 30/30) importé dans God ▸ JSON ; **vue Branches à 5/5 × 6** après correctif du classement (`normalizeOrderCode`) |
| **S1-4** | **19 quêtes de classe** : `classReq` sur la branche Astrub (1 seule s'affiche) | 19 | ✅ **export prêt le 27/10/2026** — `export-god-classes.json` (1 bloc, 19 quêtes, `dofusDbId` 19/19, DPLN 19/19) ; le **filtre de classe** est branché côté guide interne (`resolveDofusClassId` : le profil stocke un **libellé**, la route compare des **ids**) ⇒ chaque membre ne voit que sa quête |
| **S1-5** | **Prérequis** : chaîne commune (1958→1859) sans les 19 liens de `1960` | 11 lignes | S |
| **S1-6** | **Groupes parallèles** (16) : les quêtes d'un groupe ne s'ordonnent pas entre elles | 16 groupes | S |
| **S1-7** | **Prises anticipées** (49) : `takeEarly` sur la séquence cible | 49 | S |
| **S2-3 bis** | **Étape à variantes EXCLUSIVES** (modèle, livré le 27/10/2026) : une étape, N quêtes dont **une seule** est jouée (étape 55 = 3 variantes, étape 66 = 2). Convention **sans migration** : tag `choice_group` dans `activityTags` ; règle pure `src/lib/rush-choice-groups.ts` (`getChoiceGroup`, `stepCounts`, `applyChoiceExclusivity`) ; l'**import** porte `choiceGroup` ; les **compteurs** comptent le groupe pour 1 ; le **serveur** (`setRushSequenceProgress`) dé-coche les sœurs et termine le bloc dès qu'une variante est cochée. **6 cas** dans `rush-choice-groups` + **1 cas** de vue | — | M |

**Reste à trancher** : côté **visiteur** (guide public), ni la cité ni la classe ne sont connues ⇒ les 19 quêtes de classe s'affichent toutes jusqu'à un **sélecteur de classe** public (même famille que le sélecteur d'Ordre).

**Méthode de saisie** : partir de la liste ordonnée (index = `order`), pas du nom ; les **jumelles**
God (cité 1→1, Ordre 1→3) servent de squelette, jamais de contenu (elles recopient les noms).

## 4. Bloc S2 — Contraintes enrichies (ce que Tougli porte et pas nous)

| Lot | Champ | Source mesurée | Pourquoi |
|---|---|---|---|
| **S2-1** | `hoursKind` : `window` (`from`/`to`) vs `wait` (`minutes`) | 7 entrées, 2 natures | l'overlay doit dire « reviens à 20 h » ou « attends 3 min » |
| **S2-2** | `partySize` + `partyRoles[]` | 38 `needPlayer` | entraide : « 4 joueurs pour des dalles » |
| **S2-3** | `dungeonChoice` : liste de donjons + note « selon votre niveau » | 7 entrées | `1608`, `2425` |
| **S2-4** | `bashMobs[]` (espèces à tuer, sans quantité) | 81 entrées | affichage fidèle « Pious à combattre » |
| **S2-5** | `combat` : mode + composition (monstre × n) | 726 entrées, 5 modes | solo / groupe / tactique / vagues |

**Interdit** : déduire les opérateurs ET/OU d'un texte libre. Ce qui n'est pas structuré reste **texte**.

## 5. Bloc S3 — La trame (chronologie Dofusyelle)

| Lot | Contenu | Source |
|---|---|---|
| **S3-1** | Bloc de préparation (21 piliers, options alternatives) | `prep` Dofusyelle |
| **S3-2** | Saves de donjons (40) comme état par donjon, pas comme quête | `donjons.save` |
| **S3-3** | Avertissements éditoriaux (spans `red` / `orange` = « contournable ») | `body` Dofusyelle |
| **S3-4** | Succès (62) rattachés aux étapes | `succes` Dofusyelle |

## 6. Bloc S4 — God (outillage de saisie)

| Lot | Contenu | État |
|---|---|---|
| **S4-1** | **Vue Branches à 2 étages** (cité → Ordre, paires alignées, manques) — cible **100/102** | **livré** le 23/10/2026 (`src/lib/rush-branches.ts`, onglet God, 9 verrous) · **corrigé le 27/10/2026** : ① le classement compare les codes d'Ordre **normalisés** (source unique `rush-order-codes`) au lieu des ids courts du catalogue — sans quoi les **30 quêtes d'Ordre importées** tombaient « hors branche » (**+3 cas**) ; ② le tri des « paires » utilise l'**ordre du bloc** puis l'ordre interne (`blockOrder`), et non plus `seq.order` seul qui repart à 0 dans chaque bloc ⇒ la table était triée **par alphabet** (« L'exorciste », 100ᵉ quête, en position **68** → **99** après correctif, mesuré en base) (**+2 cas**) |
| **S4-2** | Édition des champs de route sur une séquence **existante** | ✅ **livré** le 26/10/2026 — section « 7. Route » du formulaire d'édition (cité / Ordre / palier / classe), avec les codes d'Ordre **canoniques** |
| **S4-3** | Case **optionnel** par donjon (S0-6) | bloqué migration |
| **S4-4** | Import consolidé (dry-run) : listes ordonnées + 30 Ordres + 19 classes, **jamais de re-seed destructif** | ✅ **livré** le 26/10/2026 — `importRushGuide(raw, apply)` : dry-run par défaut, `src/lib/rush-import.ts` (plan pur), **ajoute seulement** · ✅ **complété le 27/10/2026** : le payload porte aussi les **liens** de la fiche (`dofusdbUrl`, `dofuspourlesnoobsUrl`), validés par **allowlist d'hôte + `https`** (`safeRushGuideLink`) — un lien refusé produit un avertissement dans le dry-run, jamais une URL arbitraire en base |

## 7. Bloc S5 — Dette de bascule & performance

| Lot | Contenu |
|---|---|
| **S5-1** | Supprimer `alignOrderReq` et `alignmentLevel` quand toutes les surfaces sont migrées — ✅ **partiel le 27/10/2026** : `alignOrderReq` n'est **plus lu ni écrit** (client, 2 formulaires God, jumeau serveur, 2 seeds, sync enrichie) ; la **colonne** reste en base (**drop = migration ⇒ accord explicite**). `Profile.alignmentLevel` **reste** : c'est le palier du joueur, affiché par le profil et le panneau de guilde |
| **S5-2** | Perf : **mesure d'abord** (profiler), puis compilateur React, `useOptimistic`, abonnements fins, virtualisation |

## 7 bis. Hors dépôt — la page « Trame » (outil de construction)

**But** : disposer d'une page **non commitée** qui rassemble les deux sources et sert à **construire
la trame** avant la saisie dans God. Ce n'est **pas** une surface produit : aucun code de `src/app`
n'en dépend.

**Livré le 26/10/2026 (v1 — consultation + export ; l'édition n'est pas faite).**

| Élément | Réalité mesurée |
|---|---|
| Emplacement | `src/temp/trame-rush/` (couvert par `/src/temp/`, **jamais commité**) |
| Fichiers | `build-data.mjs` (siphon + corrélation) · `index.html` · `app.js` · `data.json` et `data.js` (générés) · `cache/` (réponses Tougli horodatées, 24 h) |
| Dépendances | **aucune** (vanilla, aucun build) — ouverture par double-clic, sans serveur |
| Construction | `node src/temp/trame-rush/build-data.mjs` (`--refresh` refait le fetch, `--no-db` saute l'instantané PostgreSQL) |
| Sources | `src/temp/archive/siphon-align/tougli-guide-details.json` (RSA) + `dofusyelle … data.js` + `GET api.tougli.barbofus.com/api/guide/details/{100-quetes-alignement-bontarien,100-quetes-alignement-brakmarien}` |
| Mesures obtenues | **530** quêtes Tougli · **36** blocs · séries **100 / 102** · **30** quêtes d'Ordre (6 × 5) · **19** classes · **381** objets · **99** donjons (**99** rapprochés de notre table, dont **3** alias mesurés) · **530 / 530** quêtes présentes dans `GameQuest` (`dofusDbId`) |
| Dofusyelle | **57** étapes · **21** piliers · **83** donjons · **531** ressources ; corrélation par nom normalisé : **361 / 384** quêtes rapprochées (les 23 restantes sont des consignes rédactionnelles) |
| Vues | Trame (route cité/Ordre/classe résolue) · Cités (paliers de 20) · Ordres (6 × 5) · Classes · Dofusyelle (corrélation) · Donjons (correspondance) · Contraintes · Export God |
| Édition | **non livrée** : pas de réordonnancement, pas de fusion, pas d'exclusion. Seules la route et les cases « fait » sont persistées |
| Persistance | `localStorage` + export fichier — **aucune** base, aucune guilde |
| Export | `export-god.json` par route : blocs → séquences avec `order`, `subGuideName`, `questDbIds`, `alignReq`, `alignOrderCode`, `alignLevelReq`, `classReq`, `dungeonIds` (cuid de notre table), `takeEarly`, `tips` + un bloc `_mesure` (palier de cité, niveau, donjons Tougli, contraintes) qui **ne s'écrit pas** en base |

**Ce que l'outil ne fait pas** : il n'écrit rien lui-même — il produit un fichier. L'écriture se fait **dans God**, via
le lot **S4-4** (`importRushGuide` : dry-run puis application, qui **ajoute seulement**) ; l'outil ne réordonne pas, et
il ne remplace pas la décision éditoriale (les textes se **réécrivent**, jamais ils ne se recopient).

**Interdits** : ne rien committer depuis ce dossier, ne pas l'importer dans `src/lib`, ne pas en faire
un seed automatique. C'est un **brouillon de session** (règle `docs/agents/zone-volatile.md`).


## 8. Dépendances à ne pas inverser

```
S0-1/2/3/4 (fait) ──► S0-5 + S0-5bis (fait : pastille de quête, 3 surfaces + overlay invité)
S0-3 (migration) ──► S0-6 (case « optionnel » God) ──► S0-7 (décoche en cascade)
S1 (contenu) ──► S4-1 (la vue Branches sert à saisir) ──► S1-1/S1-2/S1-3
S1-3 ──► S2-1..S2-5 (les contraintes se posent sur des quêtes existantes)
S1 ──► V-D (ressources : les nouvelles quêtes apportent de nouveaux objets)
Toutes les surfaces ──► S5-1 (suppression des champs legacy)
```

## 9. Définition de fini (par lot)

1. Règle pure dans `src/lib/**` + test de **comportement** (pas de rendu).
2. Les **4 surfaces** consomment la même règle (parité publique vérifiée).
3. `npm run test:run` · `npx tsc --noEmit` · `npm run lint` verts.
4. `docs/ROADMAP.md` (statut) + bloc `activeContext.md` ; aucun fichier d'état nouveau.
5. **Aucune migration sans GO explicite** (règle `AGENTS.md` §7).



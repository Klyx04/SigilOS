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
| Série Brâkmar | Tougli `100-quetes-alignement-brakmarien` | **102** quêtes (`Cliquetis fou` → `La danse macabre`) |
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
| **S0-5** | **UI** : modale « Donjons du guide » (index global, `fait` / `à faire`, qui a marqué « à faire », recherche) + bouton dans l'en-tête de l'overlay interne | ✅ **livré** (overlay interne) — reste : dashboard + guide public (`localStorage`) |
| **S0-6** | **God** : case « optionnel » par donjon lié à la séquence | à faire |
| **S0-7** | **Décoche en cascade** : décocher un donjon **dévalide** la quête (et remet à zéro ses coches de ressources) | à faire |

**Modèle retenu (mesuré, 21/10)** :

- **Deux états**, jamais une case binaire : `DONE` (fait) et `TODO` (à faire). L'absence de ligne = « pas encore décidé ».
- ⚠️ **La coche est par OCCURRENCE (quête × donjon)**, jamais mutualisée par donjon : le même donjon demandé par trois quêtes se coche **trois fois**. `sequenceId` fait partie de la clé unique, et l'index (`buildDungeonIndex`) sert seulement à **lister les endroits** — pas à partager l'état.
- Un donjon **optionnel** (`GuideSequence.dungeonOptionalIds`) s'affiche et se coche mais **ne bloque pas**.
- Le verrou est **serveur** : le client ne fait pas foi ; `doneDungeonKeysForSequence` ne rend que les clés `done` **de la quête concernée**. Un donjon **sans identité** (ni id, ni slug, ni nom) est signalé mais ne fige pas la quête (fail-open documenté, même doctrine que les prérequis).

**Verrous de test** : `rush-dungeons` (**19** cas) · `rush-dungeons-ui` (**6** cas) · non-régression `rush-overlay-*`, `rush-public-parity`, `rush-god-studio-robustesse` → **179 tests verts**.

**Ops (humain)** : `npx prisma migrate deploy` en **bêta puis prod** (migration additive : `CREATE TYPE`, `CREATE TABLE`, 3 index, 2 FK, 1 colonne `TEXT[]`).

**Sans migration, ce qui marche déjà** : le verrou est calculable partout (`isSequenceBlockedByDungeons`) ;
côté **externe**, l'état peut vivre dans le `localStorage` (comme la progression publique).

**Verrous de test** : `tests/unit/rush-dungeons.test.ts` (12 cas, vert) · à compléter par
`rush-dungeons-gate.test.ts` (l'action refuse, l'action accepte, idempotence) et un cas de parité.

## 3. Bloc S1 — Le contenu (le gros morceau)

| Lot | Contenu | Cible mesurée | Taille |
|---|---|---|---|
| **S1-1** | Série **Bontarien** : 100 quêtes ordonnées, `alignReq="bontarien"`, pas d'Ordre | 100 (66 déjà présentes → **34** à créer) | M |
| **S1-2** | Série **Brâkmarien** : 102 quêtes ordonnées | **102** (0 aujourd'hui) | M |
| **S1-3** | **30 quêtes d'Ordre** : `alignReq` + `alignOrderCode` + `alignLevelReq` **dérivé par position** (20/40/60/80/100) | 6 × 5 | M |
| **S1-4** | **19 quêtes de classe** : `classReq` sur la branche Astrub (1 seule s'affiche) | 19 | S |
| **S1-5** | **Prérequis** : chaîne commune (1958→1859) sans les 19 liens de `1960` | 11 lignes | S |
| **S1-6** | **Groupes parallèles** (16) : les quêtes d'un groupe ne s'ordonnent pas entre elles | 16 groupes | S |
| **S1-7** | **Prises anticipées** (49) : `takeEarly` sur la séquence cible | 49 | S |

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
| **S4-1** | **Vue Branches à 2 étages** (cité → Ordre, paires alignées, manques) — cible **100/102** | à faire |
| **S4-2** | Édition des champs de route sur une séquence **existante** | à faire |
| **S4-3** | Case **optionnel** par donjon (S0-6) | bloqué migration |
| **S4-4** | Import consolidé (dry-run) : listes ordonnées + 30 Ordres + 19 classes, **jamais de re-seed destructif** | à faire |

## 7. Bloc S5 — Dette de bascule & performance

| Lot | Contenu |
|---|---|
| **S5-1** | Supprimer `alignOrderReq` et `alignmentLevel` quand toutes les surfaces sont migrées |
| **S5-2** | Perf : **mesure d'abord** (profiler), puis compilateur React, `useOptimistic`, abonnements fins, virtualisation |

## 7 bis. Hors dépôt — la page « Trame » (outil de construction)

**But** : disposer d'une page **non commitée** qui rassemble les deux sources et sert à **construire
la trame** (réordonner, annoter, exclure), puis à **exporter** le JSON qui deviendra le contenu du
guide. Ce n'est **pas** une surface produit : aucun code de `src/app` n'en dépend.

| Élément | Choix |
|---|---|
| Emplacement | `src/temp/trame-rush/` (déjà couvert par `/src/temp/`) |
| Fichiers | `index.html` · `app.js` · `data.json` (généré) · `build-data.mjs` · `cache/` |
| Dépendances | **aucune** (vanilla, pas de build, pas de Next) |
| Données | `tougli-guide-details.json` + `dofusyelle … data.js` locaux + 2 guides Tougli d'alignement (fetch, cache horodaté) |
| Vues | Trame (57 étapes) · Alignement (100/102) · Ordres (6×5) · Classes (19) · Contraintes (1 085) · Ressources & donjons (union 584 / 99+83) |
| Édition | réordonner, fusionner, exclure, annoter, marquer `parallèle` / `prise anticipée`, puis **Exporter** |
| Persistance | `localStorage` + export fichier — **aucune** base, aucune guilde |

**Interdits** : ne rien committer depuis ce dossier, ne pas l'importer dans `src/lib`, ne pas en faire
un seed automatique. C'est un **brouillon de session** (règle `docs/agents/zone-volatile.md`).

## 8. Dépendances à ne pas inverser

```
S0-1/2/3/4 (fait) ──► S0-5 (overlay fait) ──► S0-5bis (dashboard + public localStorage)
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



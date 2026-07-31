# 📘 Contexte complet — Projet "Carte du Monde & Quête Ocre"

> **But de ce fichier** : donner à un prochain agent (sans mémoire de cette session) tout le contexte nécessaire pour continuer ce projet. À lire avant toute modification.

---

## 🎯 Objectif global

Refondre la **Page Carte du monde** de SigilOS pour :
1. Permettre de **marquer les donjons de la Quête Ocre** (Dofus Ocre, Éternelle Moisson) et d'**afficher l'icône Ocre** sur ces donjons (carte + modale).
2. Avoir une **base locale perpétuelle** sur tous les mobs/boss/archis (éviter de tirer sur DofusDB à chaque recherche).
3. **Détecter les changements** de l'API DofusDB (resync + notification).
4. **Améliorer la recherche** de la carte : filtres corrects (boss vs mob vs archi), pas de tirage réseau à chaque frappe.

---

## 🔑 Décisions clés validées par l'utilisateur

- **« Le plus fiable à long terme »** = un **sélecteur cliquable sur la carte** pour lier un donjon admin (Game Data) à sa position sur la carte, plutôt qu'une saisie d'ID à la main ou un croisement par nom exact (fragile avec accents/variantes).
- L'utilisateur est **dev non-professionnel** qui peuple les boss/succès manuellement via **Game Data** (à la main). Il faut des Toggles/UI simples et explicites, pas des IDs à chercher.
- Méthode de travail imposée : **étape par étape, commit et push la branche avant de pousser la suite**.

---

## 🧩 Architecture concernée

### Page Carte du monde
- `src/components/worldmap/interactive-map-v2.tsx` — composant principal (client). Construit `groupedDungeons`, indexe les maps/donjons, gère la recherche & les onglets.
- `src/components/worldmap/leaflet-map-core.tsx` — rendu Leaflet : tuiles, grille, **marqueurs de donjons** (ligne ~1230-1267), interactions, GPS.
- `src/components/worldmap/DungeonDetailModal.tsx` — modale affichée quand on clique sur un donjon (succès de guilde, boss, etc.).

### Game Data (source de vérité donjons)
- `src/components/admin/DungeonManager.tsx` — CRUD des donjons (formulaire admin).
- `src/components/admin/DungeonMapPicker.tsx` — **nouveau sélecteur cliquable** : liste les donjons de `worldmap.json` (recherche + clic) pour remplir `mapId`.
- `src/server/actions/game-data-admin-actions.ts` — actions serveur (create/update/delete Dungeon, export/import) + `DungeonFormSchema`.
- `src/server/actions/game-data-actions.ts` — lecture publiques, **`searchArchimonstresForMap()`** (recherche carte, tire sur DofusDB), `getArchimonstres`, `syncOcreArchimonstres`.

### Quête Ocre / Archimonstres
- `src/server/actions/ocre-map-actions.ts` — **nouveau** : `getOcreDungeonMapIds()` qui renvoie les `mapId` des donjons `isOcreQuest=true`.
- Modèle `Archimonstre` (Prisma) — type `archimonstre|boss|monstre`, `dofusdbId`, `subareaIds`, `worldMapId`, `centerX/Y`.
- `src/components/admin/ArchimonstreManager.tsx` — panneau GOD (filtres Tous/Archi/Boss/Mob + Sync Metamob).

### Base de données (Prisma)
- `prisma/schema.prisma` — modèle `Dungeon` (voir champs ci-dessous), `Archimonstre`, `Challenge`, etc.
- `prisma/migrations/20260731000000_add_ocre_dungeon_fields/migration.sql` — ajoute `isOcreQuest` + `mapId` à `Dungeon`.

---

## ✅ Champs ajoutés au modèle `Dungeon` (Prisma)

```prisma
isOcreQuest  Boolean  @default(false) // Donjon de la Quête Ocre (Éternelle Moisson)
mapId        Int?                     // Identifiant map worldmap.json (position carte)
```
> **Important** : `mapId` est l'ID d'une map **dans `public/game-data/worldmap.json`** (champ `id` d'un dungeon de la carte, généralement ses `mapId`/`entranceMapId`), PAS l'ID DofusDB.

---

## 🔄 Les fichiers modifiés/ajoutés dans cette branche

- `prisma/schema.prisma` — champs Ocre sur Dungeon
- `prisma/migrations/20260731000000_add_ocre_dungeon_fields/migration.sql` (nouveau)
- `src/server/actions/ocre-map-actions.ts` (nouveau)
- `src/components/admin/DungeonMapPicker.tsx` (nouveau)
- `src/components/admin/DungeonManager.tsx`
- `src/server/actions/game-data-admin-actions.ts`
- `src/components/worldmap/interactive-map-v2.tsx`
- `src/components/worldmap/leaflet-map-core.tsx`
- `src/components/worldmap/DungeonDetailModal.tsx`

---

## 🧭 Flux fonctionnel actuel (Icône Ocre)

1. **Game Data → Donjons** : l'admin coche le toggle **« Quête Ocre »**. Si coché, le **`DungeonMapPicker`** apparaît : il charge `worldmap.json`, permet de **rechercher + cliquer** sur le bon donjon de la carte → remplit `formData.mapId`.
2. **Sauvegarde** → `updateDungeon`/`createDungeon` persiste `isOcreQuest` + `mapId` (via `DungeonFormSchema`).
3. **Page Carte** (`interactive-map-v2.tsx`) : au montage, appelle `getOcreDungeonMapIds()` → `Set<number>` (`ocreMapIds`).
4. `groupedDungeons` est enrichi de `isOcreQuest` (si `ocreMapIds.has(mapId)`).
5. **`leaflet-map-core.tsx`** : le marqueur du donjon affiche l'icône `/module-dofus/Dofus_Ocre.png` **centrée au-dessus** du cercle doré.
6. **Au clic** sur un donjon : les dungeons sont enrichis de `__isOcreQuest` → **`DungeonDetailModal`** affiche un badge doré "Quête Ocre" avec son icône dans l'en-tête.

### Fichier icône
`public/module-dofus/Dofus_Ocre.png` — icône officielle du Dofus Ocre.

---

## 🔍 Problème technique identifié (à traiter en priorité)

**`searchArchimonstresForMap()`** (dans `src/server/actions/game-data-actions.ts`, ligne ~1253) :
- Appelle `https://api.dofusdb.fr/monsters?...` avec **`cache: 'no-store'` à CHAQUE recherche** de la carte, **même si des résultats locaux existent** déjà (tables `Archimonstre` + `Bounty`).
- Le front (`interactive-map-v2.tsx`) a un debounce 300ms, mais la fonction serveur tape DofusDB **systématiquement en fallback** même quand le local suffit.

### Correctifs suggérés (ordre logique)
- **A1** : Passer en local d'abord ; **ne taper DofusDB que si aucun résultat local** + ajouter un cache/TTL (ex: Redis/Upstash ou réutiliser le cache mémoire de `discord.ts`).
- **A2** : Revoir les filtres de la recherche (zones vs archis vs donjons) — actuellement "mal faits".
- **B1** : Pré-compiler dans `Archimonstre` tous les mobs/boss/archis connus (DofusDB sollicité pendant la sync, pas à la frappe) → recherche 100% locale.
- **B2** : Détection des nouveautés DofusDB + resync avec notification.
- **C1** : Badge "Quête Ocre" dans la liste des donjons du `DungeonManager`.
- **C2** : Icône Ocre dans le Dungeon Finder (`DjPostCard`, `DjPostCreateModal`, `AchievementTracker`).

---

## 🚦 Méthode rappel

- Toujours **étape par étape**, valider avec l'utilisateur.
- **Commit + push** une fois une étape terminée (sur la branche `feat/rush-position-preview` actuellement).
- Vérifier `npx tsc --noEmit` (`EXIT_CODE=0`) et les pre-commit (secrets, Prisma, lint, tsc).
- L'utilisateur est non-dev : privilégier UI claire (Toggles, sélecteurs), pas d'IDs à chercher à la main.

---

## 💡 Notes annexes

- Les boutons "Boss"/"Mob" du GOD sont des **filtres de type** de la table `Archimonstre` (pas des actions).
- Les archis/boss/mobs de la Quête Ocre sont **syncés en local** via `syncOcreArchimonstres` (Metamob zones + DofusDB) → table `Archimonstre` = base locale.
- La carte ne s'appuie **pas encore intelligemment** sur cette base (elle tape DofusDB en fallback systématique).

---

*Dernière mise à jour : fin de session "carte/OCRE" — branche `feat/rush-position-preview`.*
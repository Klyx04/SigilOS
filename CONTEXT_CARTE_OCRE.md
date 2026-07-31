# 📘 Contexte complet — Projet "Carte du Monde & Quête Ocre"

> **But de ce fichier** : donner à un prochain agent (sans mémoire de cette session) tout le contexte nécessaire pour continuer ce projet. À lire avant toute modification.
> **Dernière mise à jour** : session "carte/OCRE" — branche `feat/rush-position-preview`, HEAD = `0098f6f1`.

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
- **La Quête Ocre ne contient plus de monstres classiques** : la table Ocre ne gère que `archimonstre` et `boss`. Les monstres normaux viendront du **catalogue complet DofusDB** (étape Sync Catalogue).
- Détection des nouveautés **aussi côté DofusDB** (nouveau contenu du jeu), pas seulement Metamob.
- Notifications doubles pour la détection : **en base (panel GOD)** + **Discord**.
- Pensé pour **multi-guilde / scale** : le fallback DofusDB doit être ultra-rare (cache global + auto-heal).

---

## 📌 ÉTAT ACTUEL DE LA BRANCHE (HEAD `0098f6f1`)

### ✅ Déjà fait (commits poussés)

| Commit | Contenu |
|--------|---------|
| `35e9aa91` | Fondation Quête Ocre : `isOcreQuest` + `mapId` sur Dungeon + icône Ocre + formulaire admin |
| `b38c6aac` | Sélecteur cliquable `DungeonMapPicker` (remplace la saisie manuelle du mapId) |
| `33a8b3a9` | Icône Ocre centrée/agrandie sur la carte + badge Quête Ocre dans la modale donjon |
| `9f07fa43` | Docs : premier fichier de contexte (celui-ci, avant refonte) |
| `9addd69a` | **Étape 1 — Recherche carte LOCAL-FIRST** |
| `299141a4` | **Fix carte noire** après clic recherche |
| `62a10993` | **Barre de filtres permanente + pré-chargement + retrait bouton choix du jeu** |
| `0b5d85ee` | Docs : mise à jour du contexte (état HEAD `62a10993`) |
| `79cb8fd4` | **Fix dropdown "World Selection"** : passage en dropdown **cliquable** (état `worldDropdownOpen`), ancré `right-0`, overlay `fixed` pour fermer au clic extérieur → plus de débordement à gauche (voir détail) |
| `da3223b2` | **B1 — Sync catalogue DofusDB** : `syncWorldMonsters()` paginé + bouton GOD "Sync Catalogue Dofus" avec progression (voir détail) |
| `2f5bb7d4` | **Fix dropdown navbar + filtre catalogue** : dropdown "World Selection" porté via **portal `document.body`** (`z-[5000]`) pour passer AU-DESSUS de la navbar ; `syncWorldMonsters` mappe `typeId=23 → boss` et préserve les lignes Ocre/archimonstre existantes (voir détail) |
| `57ca105f` | **Fix contrainte unique** : `syncWorldMonsters` supprime la ligne d'ancien type (même nom) avant l'upsert pour respecter `@@unique([name, type])` |
| `59de4cad` | **Fix 3 bugs carte** : dropdown mondes toujours peuplé (fallback), freeze GOD (`take:500`), filtre Boss via fallback DofusDB `typeId=23` |
| `583916a3` | **Fix portal dropdown** : déplacé dans le `return` JSX (était hors rendu React → jamais affiché) |
| `f4eb9ed6` | **Fix scroll molette** : le dropdown ne se ferme plus quand on scrolle dans le panel (retrait listener `scroll` global en capture) |
| `0098f6f1` | **Fix archis sous-mondes** : `getZoneArchmonsters` normalise les accents + matching partiel (égal ou inclusion) → couvre Labyrinthe Dragon Cochon etc. |

### 🔜 Reste à faire

- **B2** : Détection des nouveautés (Metamob **ET** DofusDB) + notifs base + Discord. **La fondation B1 est prête** (`syncWorldMonsters` paginé avec `nextSkip`/`done`). B2 pourra réutiliser `OcreMonsterTemplate` comme snapshot des `dofusdbId` connus et se déclencher **à la fin d'une sync catalogue** (depuis `ArchimonstreManager` ou un cron).
- **C1** : Badge "Quête Ocre" dans la liste des donjons du `DungeonManager`.
- **C2** : Icône Ocre dans le Dungeon Finder (`DjPostCard`, `DjPostCreateModal`, `AchievementTracker`).
- **📌 Modale tuile HD (`MapDetailsPanel.tsx`)** : s'ouvre au clic sur une position de la carte (`/game-data/hd_maps/{mapId}.webp`, zoom ±, maximize, Sol/Air, bouton Analyser). À enrichir :
  - un **bouton Metamob** (lien/recherche vers l'archi/monstre de la zone)
  - **lister les trades dispo** (`OcreTradeRequest`) pour la zone
  - **remplir la modale plus proprement** (structuration du contenu)

> ⚠️ **NB — "La modale"** dans les échanges utilisateur = **`MapDetailsPanel.tsx`** (la tuile HD satellite), PAS `DungeonDetailModal.tsx`.

---

## 🧩 Architecture concernée

### Page Carte du monde
- `src/components/worldmap/interactive-map-v2.tsx` — composant principal (client). Construit `groupedDungeons`, indexe les maps/donjons, gère la recherche & les onglets.
  - États recherche : `searchFilter: MapSearchFilter`, `preloadedFilterResults`, `pendingFilter`, `isLoadingFilter`, `loadFilterResults(f)`.
  - Prop `showGameEntry` (défaut `false`) — contrôle le bouton "Choix du Jeu".
- `src/components/worldmap/leaflet-map-core.tsx` — rendu Leaflet : tuiles, grille, **marqueurs de donjons** (ligne ~1230-1267), interactions, GPS.
  - `key` du `MapContainer` = `\`${selectedWorldId}-${isMiniMap}\`` (⚠ ne PAS y remettre `triggerCenterPosition`).
- `src/components/worldmap/MapDetailsPanel.tsx` — **modale tuile HD satellite** (clic sur une position de la carte) : zoom/pan, maximize, layer Sol/Air, bouton "Analyser". **À enrichir (voir Reste à faire)**.
- `src/components/worldmap/DungeonDetailModal.tsx` — modale affichée quand on clique sur un **donjon** (succès de guilde, boss, etc.), badge Ocre `__isOcreQuest`.

### Game Data (source de vérité donjons)
- `src/components/admin/DungeonManager.tsx` — CRUD des donjons (formulaire admin). Ajouter badge Ocre dans la liste (**C1**).
- `src/components/admin/DungeonMapPicker.tsx` — **sélecteur cliquable** : liste les donjons de `worldmap.json` (recherche + clic) pour remplir `mapId`.
- `src/server/actions/game-data-admin-actions.ts` — actions serveur (create/update/delete Dungeon, export/import) + `DungeonFormSchema`.
- `src/server/actions/game-data-actions.ts` — lecture publiques + recherche local-first (voir détail).

### Quête Ocre / Archimonstres / Catalogue
- `src/server/actions/ocre-map-actions.ts` — `getOcreDungeonMapIds()` (renvoie les `mapId` des donjons `isOcreQuest=true`).
- Modèle `Archimonstre` (Prisma) — champ `isOcre`, contrainte `@@unique([name, type])`, index `isOcre` + `dofusdbId`.
- `src/components/admin/ArchimonstreManager.tsx` — panneau GOD (filtres Tous/Archi/Boss/Mob + Sync Metamob). **À enrichir avec sync Catalogue + détection nouveautés (B1/B2)**.

### Base de données (Prisma)
- `prisma/schema.prisma` — modèles `Dungeon`, `Archimonstre`, `Bounty`, `OcreTradeRequest`, `OcreMonsterTemplate` (orphelin, à réutiliser pour la détection), `Challenge`, etc.
- Migrations clés :
  - `20260731000000_add_ocre_dungeon_fields` — `isOcreQuest` + `mapId` sur `Dungeon`.
  - `20260731000001_add_is_ocre_catalog_archimonstre` — `isOcre` + `@@unique([name,type])` + index.

---

## ✅ Champs ajoutés au modèle `Dungeon` (Prisma)

```prisma
isOcreQuest  Boolean  @default(false) // Donjon de la Quête Ocre (Éternelle Moisson)
mapId        Int?                     // Identifiant map worldmap.json (position carte)
```
> **Important** : `mapId` est l'ID d'une map **dans `public/game-data/worldmap.json`** (champ `id` d'un dungeon de la carte, généralement ses `mapId`/`entranceMapId`), PAS l'ID DofusDB.

---

## ✅ Modèle `Archimonstre` (refondu en catalogue)

```prisma
model Archimonstre {
  id          String   @id @default(cuid())
  name        String
  type        String   @default("archimonstre") // archimonstre | boss | monstre
  isOcre      Boolean  @default(false)          // Membre de la Quête Ocre
  imageUrl    String?
  level       Int      @default(0)
  dofusdbId   Int?
  zone        String?
  subzone     String?
  subareaIds  Json     @default("[]")
  worldMapId  Int      @default(1)
  centerX     Float?
  centerY     Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([name, type]) // Les monstres normaux peuvent avoir des homonymes (type diff)
  @@index([name])
  @@index([type])
  @@index([isOcre])
  @@index([dofusdbId])
}
```

---

## 🔍 Détail de la recherche LOCAL-FIRST (commit `9addd69a`)

### `searchArchimonstresForMap(query, filter: MapSearchFilter = 'all')`
Signature : `(query: string, filter: 'all'|'zones'|'archis'|'boss'|'mobs'|'ocre')`

Couches (pensé multi-guilde / scale) :
1. **Table `db.Archimonstre`** (catalogue local) filtrée par type/`isOcre` → **zéro réseau, zéro Redis**.
2. **Table `db.Bounty`** (avis de recherche) — seulement filtres `all`/`boss`.
3. **Si zéro résultat local** → fallback DofusDB **avec cache Redis global TTL 24h** (`withCache('dofusdb:mapsearch:…', 86400, fetch)`).
4. **Auto-heal** : un monstre trouvé via DofusDB est **inséré en local** (`type:'monstre', isOcre:false`) → la prochaine recherche est 100% locale pour tous.
5. **Rate-limit** par user : `rateLimit("map:search:{userId}:{filter}", 30, 10_000)`.

### `getArchimonstresByFilter(filter)` (pré-chargement chips, NOUVEAU)
LOCAL-ONLY, `take: 20`, **zéro réseau**. Utilisé quand on clique une chip **sans texte** (ex: 🟡 Ocre → liste directe).

### `syncOcreArchimonstres(guildId?)` (adapté)
Upsert par `name_type` + `isOcre:true`, type normalisé ('monstre' si contient "monstre").

---

## ✅ Détail barre filtres + pré-chargement (commit `62a10993`)

- Chips **toujours visibles** dès qu'on ouvre le dropdown (avant : seulement après recherche).
- Clic chip **sans texte** → `loadFilterResults(f)` → `getArchimonstresByFilter` → `preloadedFilterResults` (section "Pré-chargement du filtre").
- Clic chip **avec texte** → le debounce 300ms relance `searchArchimonstresForMap(search, f)`.
- Placeholder : "Zone, monstre, boss, archimonstre...".
- Pastilles/types + badge Ocre/Boss dans les résultats.
- Bouton "Choix du Jeu" désormais contrôlé par `showGameEntry` (retiré sur `/worldmap` et modales embarquées).

---

## ✅ Détail fix carte noire (commit `299141a4`)

**Problème** : après un clic de recherche, la carte devenait noire (tuiles transparentes), obligeant au refresh.
**Cause** : `triggerCenterPosition` était dans la `key` du `MapContainer` → **remount complet de Leaflet** + course sur `window._activeWorld_for_crs` (CRS global).
**Fix** : `key` = `\`${selectedWorldId}-${isMiniMap}\``. Le recentrage est géré par `ExternalController.flyTo()`.

---

## 🧭 Flux fonctionnel actuel (Icône Ocre)

1. **Game Data → Donjons** : l'admin coche **« Quête Ocre »** → `DungeonMapPicker` apparaît → recherche + clic sur le donjon de la carte → remplit `mapId`.
2. **Sauvegarde** → `isOcreQuest` + `mapId` persistés (`DungeonFormSchema`).
3. **Page Carte** : `getOcreDungeonMapIds()` → `ocreMapIds` (Set).
4. `groupedDungeons` enrichi de `isOcreQuest`.
5. **`leaflet-map-core.tsx`** : marqueur du donjon + icône `/module-dofus/Dofus_Ocre.png` centrée au-dessus.
6. **Au clic donjon** : `__isOcreQuest` → `DungeonDetailModal` badge "Quête Ocre".

### Fichier icône
`public/module-dofus/Dofus_Ocre.png` — icône officielle du Dofus Ocre.

---

## 🌊 Priorités restantes détaillées

### B1 — Sync catalogue complet DofusDB
- `syncWorldMonsters()` : paginer `https://api.dofusdb.fr/monsters?lang=fr&$limit=50&$skip=...` par batchs (3 concurrency, délai 200ms), résoudre monde/subarea/coords via `worldmap.json`, upsert local `isOcre:false`.
- GOD (`ArchimonstreManager`) : 2 boutons "Sync Quête Ocre" + "Sync Catalogue Dofus" avec progression.

### B2 — Détection nouveautés (Metamob + DofusDB)
- Réutiliser **`OcreMonsterTemplate`** (orphelin) comme snapshot des `dofusdbId` connus.
- Comparer après chaque sync → nouveautés.
- Notifs : **base** (panel GOD) + **Discord**.

### C1/C2 — Badges Ocre cohérents partout
- C1 : badge doré Ocre dans la **liste** des donjons du `DungeonManager`.
- C2 : icône Ocre dans `DjPostCard`, `DjPostCreateModal`, `AchievementTracker`.

### 📌 Modale tuile HD (`MapDetailsPanel.tsx`)
- Ajouter :
  - **bouton Metamob** (lien vers l'archi/monstre de la zone, ou recherche)
  - **liste des trades dispo** (`OcreTradeRequest`) pour la zone/position
  - **remplissage plus propre** de la modale (structuration du contenu satellite)

---

## ✅ Détail fix dropdown "World Selection" (commit `79cb8fd4`)

**Problème** : le dropdown (anciennement `w-60 right-0` en hover `group-hover`) sortait à gauche du composant.
**Fix** : dropdown **cliquable** (`worldDropdownOpen` state) — le bouton toggle le panel, un overlay `fixed inset-0 z-[650]` ferme au clic extérieur, le panel est `absolute top-full right-0 w-60 z-[700]`. Chevron tourne 180° quand ouvert. Plus de dépendance au hover fragile → pas de débordement.

## ✅ Détail B1 — Sync catalogue DofusDB (commit `da3223b2`)

### `syncWorldMonsters(params?: { skip?: number; batchSize?: number })`
Action serveur **super-admin**. Pagine l'API `https://api.dofusdb.fr/monsters?lang=fr&$limit={batchSize}&$skip={skip}` **un batch par appel**, puis upsert chaque monstre en local (`type:'monstre'`, `isOcre:false`) avec résolution monde/subarea/coords via `worldmap.json` (même logique que `syncOcreArchimonstres`).

Retourne `{ synced, skipped, total, nextSkip, done }` :
- `nextSkip` = `skip + batch.length` → à passer au prochain appel
- `done` = `nextSkip >= total` → indique la fin de la pagination

### `ArchimonstreManager.tsx` — bouton "Sync Catalogue Dofus"
- Nouvel état `catalogSync` (`idle | running | done | error`)
- `handleCatalogueSync()` boucle sur `syncWorldMonsters({ skip, batchSize: 50 })` jusqu'à `done`, en accumulant `synced`/`skipped`/`processed`
- **Barre de progression** (largeur `processed/total`) + compteur `✅ synced · ⏭ skipped`
- Bandeau de succès final + rechargement de la liste

## 🚦 Méthode rappel

- Toujours **étape par étape**, valider avec l'utilisateur.
- **Commit + push** une fois une étape terminée (branche `feat/rush-position-preview`).
- Vérifier `npx tsc --noEmit` (exit 0) + pre-commit (secrets, Prisma, lint, tsc).
- L'utilisateur est non-dev : privilégier UI claire (Toggles, sélecteurs), pas d'IDs à chercher à la main.
- ⚠️ le shell est **PowerShell** (pas `&&`, utiliser `;` et `$LASTEXITCODE`).
- `rg` n'est pas dispo sous PowerShell → utiliser `findstr /n` avec le **chemin absolu** (ex: `findstr /n "^model Archimonstre" "a:\SigilOS\prisma\schema.prisma"`).

---

## 💡 Notes annexes

- Les boutons "Boss"/"Mob" du GOD sont des **filtres de type** de la table `Archimonstre`.
- Le fallback DofusDB utilise **`(?i)` inline flag** (DofusDB rejette `$options=i`).
- Le front passe `initialTab="map"` sur `/worldmap` et les modales embarquées → c'était la cause du bouton "Choix du Jeu" (désormais géré par `showGameEntry`).
- La carte s'appuie désormais **intelligemment** sur la base locale (local-first + cache + auto-heal).

---

*Dernière mise à jour : session "carte/OCRE" — branche `feat/rush-position-preview`, HEAD `0098f6f1`.*

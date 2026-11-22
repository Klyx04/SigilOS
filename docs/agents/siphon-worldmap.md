---
description: Intégrer un monde / sous-monde DofusDB dans la worldmap SigilOS — process ciblé (données, images, positions, VPS)
---

# 🗺️ Intégrer un monde / sous-monde DofusDB

Guide pas à pas pour intégrer un nouveau monde ou une sous-zone DofusDB dans la carte du monde interactive de SigilOS.

---

## 0. Mesurer le sous-monde (DofusDB)

1. **Sous-zone → monde** : `GET https://api.dofusdb.fr/subareas?name.fr=NOM` → `id` et `customWorldMapId` (c'est le `worldMap`).
2. **Monde** : `GET https://api.dofusdb.fr/worlds/{worldId}` → nom, dimensions, `visibleOnMap`.
3. **Cartes** : `GET https://api.dofusdb.fr/map-positions?worldMap={worldId}&$limit=100` → `id`, `posX`, `posY`, `subAreaId`.

Exemple mesuré le 22/11/2026 — **Temple Céleste** : sous-zone **446**, monde **41**, cartes **241443329** (1,1), **241444353** (2,2), **241445377** (3,3).

---

## 1. Données — ajout ciblé (voie normale)

```bash
npx -y tsx scripts/sync-subworld.ts 41           # dry-run : montre ce qui serait ajouté
npx -y tsx scripts/sync-subworld.ts 41 --apply   # écrit worlds.json + worldmap.json
```

Le script :

- ajoute le monde, ses cartes et ses sous-zones **manquantes** ;
- **ne supprime rien** et **n'écrase jamais** une entrée existante (un conflit est signalé) ;
- **refuse** les mondes exclus **19** (« Mappemondes ») et **29** (« Ecaflip City ») ;
- affiche la ligne `DOFUS_WORLDS` à ajouter.

Ajouter ensuite, dans `src/lib/dofus-assets.ts` :

```ts
{ id: 41, name: "Temple Céleste" },
```

> `DOFUS_WORLDS` est la liste statique utilisée par l'éditeur God (choix du monde d'une position). Le test `tests/unit/worldmap-worlds.test.ts` vérifie désormais qu'elle est **exactement** alignée sur `worlds.json` : un oubli casse la CI.

---

## 2. Images (non versionnées)

```bash
node scripts/sync-world-hd-maps.js 41   # cartes HD : 241443329 / 241444353 / 241445377
node scripts/sync-world-tiles.js 41     # tuiles : banques 1 / 0.75 / 0.5 / 0.25
```

- Les cartes HD arrivent **propres** (`stripWatermarkBuffer` au vol) : aucune passe de nettoyage supplémentaire.
- Les deux scripts sont **résumables** (les fichiers déjà présents sont sautés).
- Résultat mesuré pour le monde 41 : **3** cartes HD et **160 / 84 / 40 / 12** tuiles.

---

## 3. Positions du guide (le piège du `worldId`)

Un `pos_tags` peut porter un `worldId` faux (souvent **1** par défaut) alors que la quête démarre dans le sous-monde. L'audit compare chaque tag à la carte réelle de la quête (`GameQuest.imageUrl`, déjà résolue par le siphon) :

```bash
npx -y tsx scripts/audit-rush-pos-worlds.ts --world 41
```

Exemple mesuré :

```text
- Réponses à tout (quête 1631) : pos_tags worldId=1 → attendu 41 (Temple Céleste), carte 241443329
```

Correction dans **God ▸ Guide Rush ▸ quête ▸ Destination** : monde **Temple Céleste**, carte **241443329** (ou carte imposée `pos_tags.mapId`). Relancer l'audit jusqu'à `✅ Aucun écart`.

> Sans `--world`, l'audit est **global** et plus bruyant : `GameQuest.imageUrl` peut pointer sur une étape ou un donjon (`worldMap = -1`), ce n'est pas toujours le donneur de quête.

---

## 4. Publication VPS

```bash
./scripts/sync-assets.sh beta   # puis prod (PowerShell : .\scripts\sync-assets.ps1 beta)
```

- `worlds.json` / `worldmap.json` sont **versionnés** : un `deploy-cd.sh` les propage.
- `tiles/` et `hd_maps/` sont **git-ignorés** : seul `sync-assets.sh` les publie.
- Aucun rebuild n'est nécessaire pour les assets (Caddy sert le volume).

---

## 5. Vérifier

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://beta.sigilos.fr/api/rush/map-at?x=1&y=1&world=41"   # → 200
curl -s -o /dev/null -w "%{http_code}\n" "https://beta.sigilos.fr/game-data/hd_maps/241443329.webp"    # → 200
curl -s -o /dev/null -w "%{http_code}\n" "https://beta.sigilos.fr/game-data/tiles/w41/1/1.webp"         # → 200
```

Puis contrôler à l'écran : le sélecteur de monde propose **Temple Céleste**, et la première quête du Rush affiche la bonne carte.

---

## Repli (ne pas utiliser par défaut)

`sync-worldmap.ts` / `sync-worldmap-deep.ts` réécrivent **tout** le fichier et **ressuscitent** les mondes 19/29. Si on doit les utiliser (rafraîchissement complet), rejouer ensuite la suppression de `docs/MAINTENANCE.md` §3 (données + `tiles/w19` / `tiles/w29` des deux côtés), puis relancer le test `worldmap-worlds`.


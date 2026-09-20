---
description: Procedure to siphon, crop 4:3 viewports, assemble, and tile-generate a new DofusDB world map in SigilOS
---

# 🗺️ Procédure de Siphonnement & Intégration d'un Nouveau Monde DofusDB

Guide étape par étape pour intégrer un nouveau monde ou une sous-zone DofusDB dans la carte du monde interactive de SigilOS.

---

## 🛠️ Étape 1 : Récupération des Données (DofusDB API)

1. Identifier l'`id` de la sous-zone et le `customWorldMapId` (ex: sous-zone 76 -> Monde 38).
```bash
node -e "
async function find() {
  const res = await fetch('https://api.dofusdb.fr/subareas?name.fr=NOM_DE_LA_ZONE');
  const json = await res.json();
  console.log(json.data.map(s => ({ id: s.id, name: s.name?.fr, customWorldMapId: s.customWorldMapId })));
}
find();
"
```

2. Récupérer toutes les cartes de ce monde :
```bash
https://api.dofusdb.fr/map-positions?worldMap={WORLD_ID}&$limit=100
```

---

## 🖼️ Étape 2 : Rognage 4:3 & Assemblage Panoramique

Les captures HD brutes de DofusDB (`https://api.dofusdb.fr/img/maps/1/{mapId}.jpg`) sont au format **16:9 (1910x970)**. Elles comportent :
- Des marges latérales 16:9 (~368px de chaque côté) qui chevauchent les cartes voisines.
- Des barres d'interface haut/bas (~45px).

### Rognage 4:3 Pur (Sharp Node.js)
```javascript
const croppedBuf = await sharp(hdMapBuffer)
    .extract({ left: 368, top: 45, width: 1173, height: 880 })
    .resize(209, 150, { fit: 'fill' })
    .toBuffer();
```

---

## 📐 Étape 3 : Calculs de Projection Leaflet (CRS Math)

Pour aligner la grille de surbrillance et la couche de tuiles :
- **Dimensions cellules secondaires** : `mapWidth = 209px`, `mapHeight = 150px`
- **Nombre de colonnes (`cols`)** : `maxX - minX + 1`
- **Nombre de lignes (`rows`)** : `maxY - minY + 1`
- **Dimensions totales** : `totalWidth = cols * 209`, `totalHeight = rows * 150`
- **Origines Leaflet (`origineX`, `origineY`)** :
  - `origineX = -minX * 209`
  - `origineY = -minY * 150`

---

## 🧱 Étape 4 : Découpage de la Pyramide de Tuiles (250px)

Découper l'image composite assemblée dans `public/game-data/tiles/w{WORLD_ID}/` pour les banques :
`1`, `0.75`, `0.5`, `0.25`, `custom2`, `custom3`.

---

## 📄 Étape 5 : Déclarations Configuration (`game-data`)

1. Mettre à jour `public/game-data/worlds.json` avec l'objet du monde (`id`, `origineX`, `origineY`, `totalWidth`, `totalHeight`).
2. Mettre à jour `public/game-data/worldmap.json` :
   - Ajouter l'entrée du monde dans `worldmapData.worlds`.
   - Mettre à jour `worldMap: WORLD_ID` sur les cartes de la sous-zone dans `worldmapData.maps`.

---

## 🚀 Étape 6 : Transfert sur le VPS

Consulter la procédure de synchronisation dans `docs/agents/sync-game-assets.md` pour transférer les tuiles vers le VPS via `sync-assets.sh` ou exécuter le script de siphonnement directement sur le serveur.

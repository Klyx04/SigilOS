# DofusDex — référence officielle extraite du client Dofus 3

> **Rôle unique.** Ce fichier documente le **DofusDex du jeu** (Aventure / Guide,
> `Maj+A`) : où il vit dans le client, comment il est lu, ce qu'il contient et comment
> le seed Rush l'utilise. Il ne remplace ni `docs/reference/TOUGLI-API.md` (source
> Tougli) ni `docs/plans/MAPPING-RUSH-SYLvestre.md` (corrélation Tougli × Dofusyelle).
> **Dernière mesure : 17/11/2026**, client `3.6/3.7` installé localement.

## 1. Ce que c'est

Le DofusDex n'est pas un site : c'est l'**interface du jeu** qui liste, pour chaque
Dofus, ses objectifs **dans l'ordre officiel d'Ankama**, avec leur type (quête, succès,
PNJ, donjon) et leur niveau. La capture du 17/11/2026 montre Domakuro (30–140) et ses
9 lignes ; le client contient **30 progressions** et **783 objectifs**.

## 2. Où il vit dans le client

| Élément | Chemin mesuré |
|---|---|
| Racine client | `%LOCALAPPDATA%\Ankama\Dofus-dofus3` |
| Données | `Dofus_Data\StreamingAssets\Content\Data` |
| Progression | `data_assets_dofusprogressionsdataroot.asset.bundle` (2,7 Ko) |
| Quêtes / étapes | `data_assets_questsdataroot.asset.bundle` (1 984) · `data_assets_queststepsdataroot.asset.bundle` (2 233) |
| Succès / objectifs | `data_assets_achievementsdataroot.asset.bundle` (2 777) · `data_assets_achievementobjectivesdataroot.asset.bundle` (8 936) |
| PNJ / monstres / donjons | `data_assets_npcsdataroot.asset.bundle` (6 487) · `data_assets_monstersdataroot.asset.bundle` (5 135) · `data_assets_dungeonsdataroot.asset.bundle` (187) |
| Localisation FR | `Content\I18n\fr.bin` |

Le bundle déclare `UnityFS` / `5.x.x` ; la version réelle est lue dans
`Dofus_Data\globalgamemanagers` (mesurée : **6000.3.16f1**). UnityPy exige
`config.FALLBACK_UNITY_VERSION` quand le bundle ne porte pas la version : c'est ce que
fait le script.

## 3. Comment il est lu (et pourquoi c'est fiable)

Le data root est un `MonoBehaviour` **avec typetree** : `obj.read_typetree()` rend les
champs nommés, pas une hypothèse sur des octets. Chaque entrée est dans
`references.RefIds[]` :

```jsonc
{
  "id": 21,
  "nameId": 1186201,
  "descriptionId": 1187099,
  "gfxId": "23032",
  "backgroundColor": "452a45",
  "minLevel": 30,
  "maxLevel": 140,
  "prerequisites": [],
  "steps": [{ "order": 0, "value": 3034, "type": 1, "hideObjectives": 0 }],
  "order": 10,
  "isPrimordial": 0,
  "isEvent": 0
}
```

Les textes ne sont **pas** dans le bundle : `nameId`/`descriptionId` se résolvent dans
`fr.bin`. Les objectifs d'un succès sont dans `achievements[id].objectiveIds[]`, puis
dans `achievementobjectives[id].criterion` (`Qf=2149` → quête 2149).

## 4. Types d'étape — mesurés, pas devinés

Mesure sur les **224 entrées** (115 étapes + 109 prérequis) des 30 progressions :
chaque type a été confronté aux six tables. Le mapping retenu résout **0 non résolu** :

| `type` | Table | Résolution mesurée | Exemple |
|---:|---|---:|---|
| 1 | `achievement` | 107/107 | Domakuro → « Les grands esprits se rencontrent » |
| 2 | `npc` | 10/10 | Dofus Ocre → Otomaï |
| 3 | `quest` | 80/80 | Dofawa → « Les principes d'Archie m'aident » |
| 4 | `achievement` (repli `dungeon`) | 26/27 + 1 donjon | Argenté Scintillant → « Benjamin » |

⚠️ Le type 4 est un **succès de donjon** : 26 se résolvent comme succès, le dernier
comme donjon. Le type 5 n'apparaît pas. Les identifiants de tables différentes se
recoupent (`7` est à la fois « Benjamin » et « Antre de Crocabulia ») : c'est le
**type** qui tranche, jamais l'id seul.

## 5. Les 30 progressions (mesure du 17/11/2026)

> `Étapes` et `Prérequis` comptent les **lignes de tête**. Les objectifs dépliés des
> succès sont plus nombreux : **783 objectifs** au total.

| # | Dofus | Niveau | Étapes | Prérequis |
|---:|---|---:|---:|---:|
| 1 | Dofawa | 10–20 | 2 | 0 |
| 2 | Dofus Argenté | 15–40 | 8 | 2 |
| 3 | Dofus Cawotte | 40–80 | 4 | 2 |
| 4 | Dokoko | 50–100 | 1 | 0 |
| 5 | Dofus Émeraude | 40–120 | 1 | 4 |
| 6 | Dofus des Veilleurs | 100–200 | 4 | 0 |
| 7 | Dofus Kaliptus | 100–120 | 1 | 0 |
| 8 | Dotruche | 15–130 | 2 | 0 |
| 9 | Dofus Pourpre | 110–130 | 2 | 1 |
| 10 | Domakuro | 30–140 | 1 | 0 |
| 11 | Dorigami | 140–170 | 1 | 5 |
| 12 | Dofus Turquoise | 100–180 | 1 | 1 |
| 13 | Dofus Ocre | 40–180 | 3 | 2 |
| 14 | Dofus des Glaces | 100–200 | 15 | 0 |
| 15 | Dofus Nébuleux | 100–200 | 16 | 1 |
| 16 | Dofus Abyssal | 180–200 | 7 | 0 |
| 17 | Dofus Tacheté | 180–200 | 2 | 2 |
| 18 | Dofus Forgelave | 180–200 | 5 | 1 |
| 19 | Dofus Ivoire | 180–200 | 1 | 18 |
| 20 | Dofus Ébène | 120–200 | 1 | 14 |
| 21 | Dofus Vulbis | 180–200 | 4 | 4 |
| 22 | Réunification | 200–200 | 1 | 12 |
| 23 | Dofus Argenté Scintillant | 180–200 | 2 | 12 |
| 24 | Dofoozbz | 170–200 | 8 | 4 |
| 25 | Dofus du Cauchemar | 180–200 | 6 | 4 |
| 26 | Dom de Pin | 50–200 | 6 | 19 |
| 27 | Dofus Sylvestre | 90–200 | 4 | 1 |
| 28 | Dofus Cacao | 20–50 | 2 | 0 |
| 29 | Dokille | 20–200 | 3 | 0 |
| 30 | Dolmanax | 20–200 | 1 | 0 |

## 6. Exemple vérifié — Domakuro (30–140)

C'est **exactement** la liste de la capture du 17/11/2026 :

| # | Type | Objectif | Niveau |
|---:|---|---|---:|
| 1 | Succès | Les grands esprits se rencontrent | 140 |
| 2 | Quête | Le réveil de Pandala | 30 |
| 3 | Quête | À la croisée des mondes | 100 |
| 4 | Quête | Sous le bois de sa colère | 110 |
| 5 | Quête | Au nom de l'Art | 130 |
| 6 | Quête | La jetée des enfants perdus | 130 |
| 7 | Quête | Le festival de la lanterne | 140 |
| 8 | Quête | L'équilibre des forces | 140 |
| 9 | Quête | Sang d'encre | 140 |

⚠️ La capture affiche « Song d'encre » (première lettre coupée) ; le client dit
**« Sang d'encre »** (quête `2197`). Le niveau du Dofus (30–140) correspond au
minimum/maximum des objectifs.

## 7. Le siphon

```bash
# Lecture seule du client, sortie versionnable (faits : noms, ids, niveaux, prérequis)
python scripts/siphon-dofusdex.py

# Sortie volatile + descriptions officielles (⚠️ texte Ankama, ne pas committer)
python scripts/siphon-dofusdex.py --out src/temp/dofusdex/dofusdex.json --with-descriptions
```

- **Prérequis local** : `pip install UnityPy` (même dépendance que
  `scripts/siphon-unity-bestiary.py`, qui lit déjà les bundles du client).
- **Sortie par défaut** : `public/game-data/dofusdex.json` (245 Ko, à côté de
  `unity-bestiary.json`). Aucune description, aucun chemin machine, aucun secret.
- **Compteurs imprimés** : 30 progressions · 115 étapes · 109 prérequis ·
  **783 objectifs** · **0 non résolu**.
- **Aucun appel DofusDB** : la source est le client installé. La licence LPNC-IA de
  DofusDB ne concerne pas ce siphon ; les liens DofusDB existants du guide sont
  inchangés.

Forme d'une entrée :

```jsonc
{
  "id": 21, "name": "Domakuro", "minLevel": 30, "maxLevel": 140,
  "prerequisites": [],
  "steps": [{
    "type": "achievement", "id": 3034,
    "name": "Les grands esprits se rencontrent", "level": 140,
    "objectives": [
      { "order": -1, "type": "achievement", "id": 3034, "name": "Les grands esprits se rencontrent", "level": 140 },
      { "order": 0, "type": "quest", "id": 2149, "name": "Le réveil de Pandala", "level": 30 }
      // … 8 objectifs
    ]
  }]
}
```

## 8. Utilisation dans le seed Rush

`scripts/build-rush-trame-seed.ts` lit **par défaut** `public/game-data/dofusdex.json`
(`--dofusdex <path>` pour un autre fichier). Pour chaque bloc dont le titre contient un
nom de Dofus (recouvrement de mots : « Dofus Pourpre », « Dofus Pourpre 2 »,
« Quêtes Pandala - Domakuro »), le générateur ajoute :

- `**DofusDex officiel** — <nom> (<min>–<max>)` + la liste des objectifs (nom + niveau) ;
- `**Prérequis** : …` (les lignes de tête, pas les sous-objectifs) ;
- le `dofusId` du référentiel `RUSH_DOFUS_META` (`emeraude`, `des_veilleurs`,
  `domakuro`, `argente_scintillant`…), match le plus long gagnant.

Mesure du 17/11/2026 : **23 blocs Yelle** et **9 blocs Tougli** enrichis. Exemples :
Dofus Émeraude (9 objectifs + 4 prérequis), Dofus des Veilleurs (18 objectifs). Les
conseils sont **tronqués à 3 950 caractères** (limite Zod de 4 000) pour qu'un Dofus
très long ne fasse jamais refuser tout le payload.

Les Dofus sans entrée `RUSH_DOFUS_META` (Dofawa, Kaliptus, Dotruche, Nébuleux,
Forgelave, Réunification, Dofoozbz, Cacao, Dokille) reçoivent la checklist mais pas de
`dofusId` : à ajouter au référentiel si le module les affiche un jour.

**Utilisation prévue (26/11/2026)** : ce fichier devient la **trame officielle de la fiche par Dofus**
(double vue « Ordre Rush » / « Trame DofusDex »), importée dans `DofusQuestChain`/`DofusQuestEntry`
par des chaînes `DOFUSDEX_*`. Le module Dofus ne le consomme pas encore ; le cadrage, l'algorithme
d'import et le mapping DofusDB vivent dans `docs/plans/PLAN-REFONTE-OBJECTIF-DOFUS.md` §4.4.

## 9. Limites mesurées

1. **Ordre et prérequis = la valeur** ; les bornes de niveau de la carte du jeu peuvent
   différer du champ `minLevel/maxLevel` (ex. Dofus Pourpre : données 110–130, carte
   communautaire 100–180). Le seed affiche les données, pas une moyenne.
2. **Noms et niveaux sont des faits** ; les **descriptions** Ankama sont exclues par
   défaut et ne doivent pas être commitées.
3. Le client peut changer (Unity, ids, objectifs) : re-lancer le script et comparer
   `counts`/`unresolved` avant de remplacer le JSON.
4. Le DofusDex ne remplace pas la **trame** : il dit l'ordre **officiel** des objectifs
   d'un Dofus, pas l'ordre de **rush** entre Dofus (celui de Dofusyelle/Tougli).
5. Le **graphe de prérequis entre quêtes** n'est **pas** dans le DofusDex : voir
   `docs/reference/QUEST-PREREQUISITES.md` (Tougli 430/530, client 990/1 984, ET/OU).

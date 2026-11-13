> **Statut** : dossier de session **promu le 19/10/2026** depuis `src/temp/`. Chantier rang 32 de
> `docs/ROADMAP.md`. Les prototypes restent dans `src/temp/kalisthe-solveur/` et
> `src/temp/minogolem-solveur/` (zone volatile, jamais versionnée).

# Solveurs tactiques Dofus — dossier de référence

> Mémo de passation : tout ce qui a été découvert, construit et décidé sur la
> décompilation du jeu + le premier solveur (Comte Harebourg). Branche :
> `fix/songes-cloture-points-epreuve` — **rien committé, rien poussé** (demande user).

---

## 1. Le jeu sur disque (mesuré)

- Racine : `A:\Dofus\Dofus Unity\Dofus-dofus3\` — Dofus 3 Unity, version **3.6.11.15** (build 10/09/2026, `StreamingAssets\version`).
- Binaire : `GameAssembly.dll` (110 Mo) + `Dofus_Data\il2cpp_data\Metadata\global-metadata.dat`
  (38 Mo, magic `af1bb1fa` OK = **non chiffré**, version metadata **39**, **131 792 strings**).
- **IL2CPP natif** : pas de dossier `Managed/`, pas de C# lisible. `ScriptingAssemblies.json`
  liste les assemblies (`Ankama.Dofus.Core.*`, `Protocol.Game`, …) + `OPS.Obfuscator.dll`
  (obfuscation active) + `XLuaAssembly.dll` (scripts Lua embarqués).
- Données : `Dofus_Data\StreamingAssets\Content\` → `Data/` (**383 bundles** `.asset.bundle`),
  `Map/` (5,7 Go), `Characters/`, `Audio/`, `I18n/`, `Animations/`, `Picto/`.

## 2. Architecture prouvée : le client ne résout rien

- 334 000 strings extraites du metadata : ce qui ressort, c'est le **protocole réseau**
  (`Com.Ankama.Dofus.Server.Game.Protocol.*` : `FightSpellCast`, `FightMark`,
  `FightResultListEntry`, `FightLoot`…).
- **Zéro classe IA** (`MonsterAI`, `Brain`, `BehaviourTree`…), **zéro calcul de dégâts**
  (`ComputeDamage`, `RollCritical`…) dans les 131 k symboles.
- Conclusion : combats **server-authoritative**. Le client envoie des intentions, le
  serveur tranche (dégâts, IA, RNG). **Décompiler le client ne donnera jamais la
  résolution des combats.** Le solveur se nourrit de DONNÉES, pas de code client.

## 3. MÉTHODE DE DÉCOMPILATION (à reprendre / améliorer)

### 3.1 Outils construits (hors dépôt, temp session)

Tous dans `C:\Users\user\AppData\Local\Temp\opencode\` — **à rapatrier ou réécrire** si on
industrialise (idéal : `scripts/` + tests, jamais d'écriture vers le jeu) :

| Script | Rôle |
|---|---|
| `scan-bundles.cjs` | Scanne les 383 bundles : header → info → validation (blocs/nœuds). **Référence de validation du format** |
| `extract-bundle.cjs` | Extraction complète : UnityFS → blocs (LZ4 en node, LZMA via `lzma_raw.py`) → nœuds CAB → `.bin` + strings `.txt` dans `dofus-bundles/` |
| `lzma_raw.py` | Décompression LZMA brut Unity (props + dict + stream) via stdlib Python (`py` launcher, Python 3.13 OK) |
| `read-bundle.cjs` / `dbg-bundle.cjs` | Brouillons de debug (dépassés par les deux ci-dessus) |

### 3.2 Format conteneur UnityFS (validé sur 383/383 fichiers)

```
[magic "UnityFS"] [version u32] [unityVersion cstr] [generatorVersion cstr]
[fileSize u64 BE] [compInfoSize u32 BE] [uncompInfoSize u32 BE] [flags u32 BE]
[+ alignement 16 octets si version >= 7]
[section blocksInfo (décompressée selon flags & 0x3F)]
[+ alignement 16 octets si flags & 0x200]
[blocs de données]
```

- Flags observés : **579 = 0x243 = 0x200 | 0x40 | 0x03** → LZ4HC (0x03) +
  `BlocksAndDirectoryInfoCombined` (0x40) + `BlockInfoNeedPaddingAtStart` (0x200).
- **Piège n°1 (a coûté 3 itérations)** : `0x40` n'est PAS « infos à la fin »
  (c'est `0x80`). Avec 0x40, l'info est APRÈS le header (alignée 16).
- **Piège n°2** : version bundle = **8** → alignement 16 obligatoire avant l'info
  (headerEnd=44 → info à **48**). Sans ça, tout échoue silencieusement.
- **Piège n°3** : la compression du header (LZ4HC) ne dit rien des blocs de données :
  ici **382 blocs en LZMA (flag 0x41), 1 en LZ4HC**. Node n'a pas de LZMA →
  passer par Python (`FORMAT_RAW`, props = octet + dict LE32).
- Section info : hash(16) + blockCount(u32 BE) + blocs `{u32unc, u32comp, u16flags}` +
  nodeCount(u32 BE) + nœuds `{offset u64, size u64, flags u32, path cstr}`.
- Validation d'un parse : `blockCount`/`nodeCount` petits, `off+size <= total décompressé`,
  paths `CAB-<hex>`.

### 3.3 Contenu : SerializedFile avec typetrees PRÉSENTS

- Les nœuds CAB contiennent des objets sérialisés **avec noms de champs en clair**
  (ex. `FightScenarioData { id, nameId }`, `FightScenariosDataRoot`,
  `Core.DataCenter.Metadata.Scenarios`, `Ankama.Dofus.Core.DataCenter`).
- Conséquence : un lecteur générique par typetree est possible (champs nommés),
  pas besoin du code. En attendant, le **carving de strings** (≥4 caractères
  imprimables) suffit pour formules Lua, noms, IDs.

### 3.4 Pistes d'amélioration (prochains prompts)

1. **Lecteur typetree générique** : parser les définitions de types embarquées →
   objets typés (plus de carving aveugle). Cible : `quests`, `monsters`, `spelllevels`.
2. **Résolution `nameId`** : les noms vivent dans `Content/I18n/` → croiser pour nommer
   les 22 scénarios et les quêtes.
3. **Maps de combat** : `Content/Map/` (5,7 Go) + `worldmap.json` du repo → graphes
   de cases (adjacences exactes, métrique PO réelle au lieu de Manhattan).
4. **Ne PAS tenter** : Ghidra sur GameAssembly (110 Mo natif obfusqué, semaines pour
   zéro logique combat — elle est serveur), Il2CppDumper (metadata v39 trop récente
   pour les builds classiques), Frida/injection (ban), XOR unitaire (testé : rien).
5. **Règle d'hygiène** : PowerShell 5.1 corrompt l'UTF-8 (`Set-Content` interdit —
   un fichier a été corrompu puis réparé via `scripts/fix-mojibake.mjs` + retrait BOM
   + renormalisation LF). Écriture : outil `Edit`/`Write` ou node uniquement.

## 4. Données extraites (session)

- **`fightscenarios` : 22 scénarios** — IDs : 1098274, 1131368, 1141799, 1140912,
  1144386, 1145788, 1145994, 1148975, 1150887, 1151471, 1151475, 1155794, 1186781,
  1157943, 1160432, 1158270, 1169203, 1178302, 1186141, 1187486, 1187735, 1188277.
- **`luaformulas` : formules Lua en clair** — XP (`level*100 + level^2*2`, paliers 200+),
  scaling stats monstres, arrondis. La math du jeu, lisible.
- **`spellscripts` (2,6 Mo)** : `SpellScriptData` structurés (conditions + effets).
- **Quêtes/steps/objectifs, donjons, challenges, monstres, spelllevels** : extraits.
- **Pipeline DofusDB validé** (public) : `api.dofusdb.fr/quests/{id}` → steps →
  objectifs `QuestObjectiveFightMonsterData` (IDs monstres) → `/monsters`, `/spells`,
  `/maps`. Testé sur quête 1471 (Émeraude/Dark Vlad). C'est cette API qui nourrira
  les solveurs (pas les bundles, sauf champs absents de l'API).

## 5. Corpus des ~30 combats tactiques (fourni par user) + taxonomie

| Archétype de solveur | Combats |
|---|---|
| Mémoire / shell observable | Reine Cornue (memory), Vigicoffre de chasse |
| Inversion / sacrifice de rôles | Entropix Cavaliers ×2 (boost relique inversé, double sacrifié) |
| Invocations + symétrie | **Comte Harebourg → LIVRÉ (voir §6)** |
| Jeu de plateau | Go (Pandala) — moteur de règles complet, plus gros |
| Boss scripté (planificateur au cas par cas) | Dark Vlad, Bolgrot, Furye, Hyrkul, Minogolem, Grougalorasalar, Crocoburio, Bulak, Crocobur, Tylezia, Silvosse, Oiseau du temps, Péki Garou, Helzbeth (4 peurs), Bavdur, Valkyr, Écho, Krashtête, Kalisthe, Reflet d'Imagirorukmam, Tourelle endommagée, Bosko Tho, Kralab Rah, Miss Tique/Teigne, Chevalier de l'Automne |
| Non-solvable exactement | Kolizéum/PvP (adversaire + info cachée), RNG caché (Monte-Carlo seulement) |

Quêtes DofusDB associées (/corpus user) : 1471, 1654, 1663, 1915, 1528, 2044, 2040,
2042, 2035, 2083, 1441, 2488, 1614, 2180, 2422, 2423, 2114, 2116, 2136, 2420, 2407,
2202, 1613, 657, 1792, 1793 (+ ocre/abyssal sans ID).

## 6. Solveur Harebourg livré (moteur, pas encore d'écran)

- Fichiers repo : `src/lib/harebourg-solver.ts` + `tests/unit/harebourg-solver.test.ts`
  (**16 tests verts**, `tsc` 0, `eslint` 0). Non committé, non poussé.
- Règles encodées (sourcées guides + fiche boss interne `songes-bosses.json` #3416) :
  symétrie 180° pair/impair, strip = atterrissage sur entité un tour pair (+100
  dommages si allié), échange avec invocation = alliés à ≤3 cases du point de départ
  tués, arrivée impossible = team wipe, glyphe Mi-temps en croix taille 3 (centre
  inclus), confusions 90/180/270° + dérive +90° antihoraire par ligne au contact,
  invocations sans confusion, appât 5 PO (IA agressive).
- Fonctions : `symmetricOf`, `glyphDangerCells`, `applyConfusion`,
  `meleeConfusionDrift`, `planVulnerabilityStrip` (verdict lisible),
  `scoreSummonPlacement` (strip/bait/block, 0-100 + notes).
- Hypothèse assumée : distances en Manhattan (métrique exacte = suivi §3.4.3).
- Ce que c'est : un **conseil** (valide un coup envisagé), jamais un bot.

## 7. Lignes rouges (légalité / compte)

- Fait : lecture seule de fichiers locaux + APIs publiques + guides web. OK.
- Les solveurs existants (chasses DofusDB/pourlesnoobs/overgame, `/travel` autopilot)
  utilisent des données publiques — c'est ce régime de tolérance qui couvre aussi
  nos solveurs-conseil (même famille que simu tactique + guides boss).
- **Interdit** : injection/hook du client (ban), automatisation du jeu (bot = ban),
  redistribution des assets du jeu, écriture dans `A:\Dofus`.
- Note : `tests/unit/user-context.test.ts` porte 1 mojibake **préexistant** (committé,
  pas de cette session — signalé, non touché).

## 8. Prochaines étapes proposées

1. Pilote Vigicoffre/Reine Cornue (tracker d'état mémoire — même pattern).
2. Nommer les 22 scénarios (croiser IDs ↔ quêtes DofusDB via le siphon du repo).
3. Lecteur typetree générique (§3.4.1) + maps de combat (§3.4.3).
4. Moteur générique (état observable + coups légaux + objectif) + écran dans le module.

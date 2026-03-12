# Module de progression de quêtes Dofus pour dashboard de guilde — Spécification v3 complète

> Vision : un **GPS narratif de guilde** pour Dofus, combinant graphe de quêtes, carte du monde, analytics de guilde, UI neuronale et copilote IA.
>
> Cette v3 agrège tout ce qui a été défini dans les versions précédentes (v1, v2) et ajoute une **spécification UI/UX & Motion Design complète**, ainsi qu’une **roadmap de versions jouables (V0 → V3)**.

---

## 1. Contexte et objectifs

### 1.1 Complexité des quêtes Dofus

- Un joueur recense 1 949 quêtes dans Dofus via un agrégateur communautaire (ofus.fr), confirmant l’ordre de grandeur de ~2 000 quêtes.[web:33]
- DofusDB liste au moins : 247 quêtes « principales », 39 quêtes de temple de classe, 115 quêtes d’alignement Bonta, 120 quêtes d’alignement Brâkmar, 390 quêtes d’Almanax, etc., ce qui illustre la densité du contenu.[web:58][web:61]
- Les quêtes d’obtention des Dofus (Émeraude, Turquoise, Ivoire, Ébène, Vulbis, etc.) reposent sur des chaînes longues avec de nombreux prérequis : succès de zones, donjons spécifiques, conditions de niveau/métier et parfois événements temporels.[web:37][web:40]

### 1.2 Limites des outils actuels

- Dofus Pour les Noobs, JeuxOnline, NSI4Noobs fournissent d’excellents guides linéaires par quête ou par Dofus, mais sans vue globale de la progression ni optimisation d’ordre.[web:34][web:37][web:40]
- DofusDB et Dofus Map offrent une encyclopédie et des cartes très riches mais focalisées sur la recherche ponctuelle (quêtes individuelles, donjons, spots de ressources) plutôt que sur des **routes personnalisées**.[web:50][web:55][web:70][web:75]
- DofusPlanet / DofusGuide et quelques outils de checklist (Google Sheets, sites dédiés) permettent de cocher des quêtes, mais restent essentiellement des TODO listes sans moteur de recommandation ni dimension guilde.[web:51][web:56][web:93][web:105]

### 1.3 Ambition du module

- Remplacer ces approches fragmentées par un **système de knowledge graph** : quêtes, donjons, succès, zones, sous‑zones, ressources, métiers, Dofus, etc. reliés dans un graphe pondéré.
- Proposer à chaque membre de la guilde un **chemin optimal ou enrichi** vers ses objectifs (Dofus, succès, zones, métiers), en tenant compte de son état réel et de ses préférences.
- Fournir aux meneurs une **War Room** qui visualise la progression collective et suggère des événements de guilde alignés sur les besoins réels.
- Offrir une **expérience UI/UX premium**, inspirée de Dofus et des MMO modernes : arbre neuronal animé, zoom sémantique, HUD diégétique et intégration avec une carte du monde interactive.

[image:1]

---

## 2. Modélisation de données avancée (Graphe)

### 2.1 Types de nœuds

Tous les IDs externes (DofusDB, ofus, dofapi, dofusdude) sont conservés, mais le graphe utilise ses propres IDs internes.

- **QuestNode**
  - Représente une quête unique.[web:33][web:58]
  - Champs : `id`, `externalIds`, `name`, `level`, `type`, `isRepeatable`, `isCriticalFor: DofusId[]`, `isSynergyCandidate: boolean`, `estimatedTime`, `difficulty`.

- **AchievementNode**
  - Succès regroupant plusieurs quêtes/donjons (par zone, Dofus, événement).[web:58]
  - Champs : `id`, `name`, `category`, `rewardXp`, `rewardKamas`, `rewardItems`.

- **DungeonNode**
  - Donjon unique.[web:35][web:55]
  - Champs : `id`, `name`, `minLevel`, `boss`, `locationSubAreaId`, `recommendedIdolScore`.

- **DofusNode**
  - Dofus primordial ou majeur (Émeraude, Turquoise, Ivoire, Ébène, etc.).[web:37][web:40]
  - Champs : `id`, `name`, `rarity`, `element`, `isPrimordial`.

- **ZoneNode**
  - Zone géographique principale (Amakna, Frigost, Pandala, Saharach, Sufokia…).[web:63][web:74]
  - Champs : `id`, `name`, `continent`, `levelRange`, `theme`.

- **SubAreaNode**
  - Sous‑zone (ex. Plaine de Cania → Campement des Bworks, Mines de Sidimote).[web:63]
  - Champs : `id`, `zoneId`, `name`, `mapCoordApprox`, `hasZaap`, `resourceProfile`.

- **RequirementNode**
  - Contrainte abstraite : niveau, métier, alignement, accès zone.[web:34][web:37]
  - Champs : `id`, `type` (`LEVEL`, `JOB_LEVEL`, `ALIGNMENT`, `ACCESS_QUEST`…), `value`.

- **TemporalNode**
  - Contrainte temporelle : Almanax, hebdo, événement saisonnier.[web:33]
  - Champs : `id`, `type` (`DAILY`, `WEEKLY`, `YEARLY`, `EVENT`), `calendarPattern`.

- **ResourceNode**
  - Ressource, craft, drop spécifique utile à une ou plusieurs quêtes.[web:68][web:75]
  - Champs : `id`, `itemId`, `name`, `type` (`ORE`, `HERB`, `MONSTER_DROP`, `CRAFT`), `rarity`, `avgMarketPrice`.

- **NPCNode** (optionnel mais utile pour l’UI et l’overlay futur)
  - PNJ clé d’une série de quêtes.
  - Champs : `id`, `name`, `subAreaId`, `role` (`QUEST_GIVER`, `CRAFT_MASTER`…).[web:99]

- **PlayerProgressNode (virtuel)**
  - Représente l’état d’un joueur sur le graphe (quêtes faites, en cours, bloqués, inventaire de ressources pertinent).
  - Pas stocké comme nœud persistant, mais utile conceptuellement.

### 2.2 Types d’arcs

- `REQUIRES_QUEST (QuestNode → QuestNode)` : A doit être complétée avant B.[web:40]
- `REQUIRES_DUNGEON (QuestNode → DungeonNode)` : B requiert le donjon X.
- `REQUIRES_LEVEL (QuestNode/AchievementNode → RequirementNode)`.
- `REQUIRES_ALIGNMENT / REQUIRES_JOB_LEVEL`.
- `UNLOCKS_QUEST (QuestNode → QuestNode)`.
- `PART_OF_ACHIEVEMENT (QuestNode/DungeonNode → AchievementNode)`.[web:58]
- `FEEDS_DOFUS (AchievementNode → DofusNode)`.
- `LOCATED_IN_AREA (QuestNode/DungeonNode/NPCNode → ZoneNode)`.[web:63]
- `LOCATED_IN_SUBAREA (QuestNode/DungeonNode/NPCNode → SubAreaNode)`.
- `REQUIRES_RESOURCE (QuestNode/AchievementNode → ResourceNode)`.[web:68]
- `DROPPED_IN (ResourceNode → DungeonNode/MonsterGroup)`.[web:68]
- `HARVESTED_IN (ResourceNode → SubAreaNode)`.[web:75]
- `CRAFTED_BY (ResourceNode → RequirementNode{JOB_LEVEL})`.
- `HAS_TEMPORAL_CONSTRAINT (QuestNode/AchievementNode → TemporalNode)`.

Chaque arc porte des **poids** :

- `timeCost` (minutes estimées).[web:51]
- `difficulty` (1–5, basé sur niveau recommandé, nécessité de groupe, complexité du combat).[web:40][web:49]
- `profit` (XP/kamas/succès/ressources par minute).[web:51]
- `synergyScore` (à quel point cette étape se combine bien avec d’autres objectifs, notamment via ressources ou sous‑zones partagées).

### 2.3 Tables SQL minimalistes (PostgreSQL + Prisma)

Sans tout réécrire ici, les tables clés :

- `raw_quests`, `raw_dungeons`, `raw_achievements`, `raw_areas`, `raw_subareas`, `raw_items` : mirroirs des sources externes (DofusDB, ofus, dofapi, dofusdude).[web:33][web:48][web:53][web:55][web:58][web:59]
- `graph_nodes` (`id`, `type`, `refId`, `metadata` JSONB).
- `graph_edges` (`id`, `fromId`, `toId`, `type`, `weights` JSONB).
- `ui_layouts` (positions XY, zoom, styles par nœud + vue).
- `player_progress` (par perso : quêtes faites, succès faits, Dofus obtenus, ressources clés connues).
- `guild_analytics` (counters agrégés par zone, donjon, Dofus, etc.).

---

## 3. Moteurs de calcul

### 3.1 Coût de chemin et variantes

Base : \(C(q) = \sum_{i=1}^{n} (T_i \times D_i)\) pour un chemin de n étapes, où \(T_i\) est le temps estimé et \(D_i\) la difficulté.[web:35]

On l’enrichit avec :

- `SynergyFactor` : bonus si la même étape sert plusieurs objectifs (plusieurs Dofus, succès, métiers).
- `TravelCost` : coût de déplacement entre sous‑zones/zaaps (approximation via distance carte + nombre de transitions de zones, inspirée de projets type WorldGraph).[web:43][web:45]
- `PreferenceFactor` : pondération en fonction du style du joueur (plus de quêtes de dialogue, plus de donjons, évitement des combats THL, etc.).[web:106][web:107]

Le moteur expose plusieurs profils :

- `FASTEST_DOFUS` : minimiser principalement `C(q)`.
- `RICH_ROUTE` : tolérer un certain `detourBudget` pour insérer des quêtes `isSynergyCandidate`.
- `FARM_ROUTE` : privilégier les nœuds à fort `profit` (kamas, ressources, succès).

### 3.2 Gestion des quêtes critiques vs optionnelles

- `isCriticalFor` : route minimale vers un Dofus ou une saga ; utilisée pour la vue “chemin pur”.
- `isSynergyCandidate` : quêtes qui :
  - se trouvent dans une sous‑zone déjà visitée,
  - ont un bon ratio profit/temps,
  - n’ajoutent pas de prérequis lourds.

L’algorithme :

1. Calcule le chemin critique minimal vers l’ensemble des objectifs choisis.
2. Identifie les fenêtres où le joueur reste dans une même sous‑zone ou repasse par une même zone.
3. Dans ces fenêtres, propose des quêtes `isSynergyCandidate` dans la limite d’un budget de détour.

### 3.3 Profondeur de prérequis

Pour chaque Dofus/saga, le moteur calcule un **niveau de profondeur** par quête : distance minimale en nombre d’arcs `REQUIRES_QUEST` à un DofusNode ou un AchievementNode final.[web:35]

Utilisations :

- Colorer les nœuds (gris clair pour profondeur élevée, couleur vive pour quêtes proches de la fin).
- Marquer certains nœuds comme **pivots** (forte centralité) pour les mettre en avant dans le HUD.

### 3.4 Multi‑joueurs et synergie de guilde

Pour chaque joueur, on stocke une route proposée. Le serveur calcule l’intersection des routes :

- Nœuds communs (quêtes/donjons/ressources) sur une fenêtre temporelle.
- Classe ces nœuds par nombre de joueurs impactés + importance (pivots, Dofus feedés).

Ces nœuds deviennent des **cibles de synergie** affichées dans la War Room.

---

## 4. Couche cartographique : intégration du module « map monde »

### 4.1 Lien graphe ↔ carte

- Chaque `ZoneNode` et `SubAreaNode` référence une zone/sous‑zone existant dans ton module de carte (environ 35 zones principales).[web:63][web:74]
- Un clic sur une zone/sous‑zone dans la carte filtre l’arbre sur :
  - quêtes présentes dans cette zone,
  - donjons présents,
  - ressources récoltables ou drops majeurs.
- Depuis l’arbre, un clic sur un nœud (quête, donjon, ressource) centre la carte sur la sous‑zone correspondante, avec un zoom smooth type Dofus Map.[web:70][web:75]

### 4.2 Heatmap de progression de guilde

- Chaque zone/sous‑zone reçoit un score basé sur :
  - nombre de joueurs avec une étape critique dans la zone,
  - nombre de joueurs avec une étape `isSynergyCandidate` pertinente.
- Ce score est traduit en heatmap colorée sur la carte : chaud = priorité pour les sorties de guilde.

### 4.3 Itinéraires optimisés

- Le chemin calculé par le moteur est projeté sur la carte comme une polyligne (séquence de subareas / maps importantes).
- Un mode “itinéraire de farm” peut mettre en avant les SubAreaNode liés aux ResourceNode critiques (mines, champs, spots de mobs ciblés).[web:68][web:75]

---

## 5. Sources de données et pipeline

### 5.1 Couche brute locale (source de vérité interne)

- Tables `raw_*` remplies par des imports depuis :
  - DofusDB (API/HTML),
  - dofapi,
  - dofusdude,
  - ofus.fr,
  - autres wikis.[web:33][web:48][web:53][web:55][web:58][web:59]
- Ces tables sont **read‑only** via l’admin : jamais éditées à la main, seulement via jobs d’import.

Avantage : si un site communautaire tombe, ton module garde une copie complète.

### 5.2 Couche curation / overrides

- `graph_nodes`, `graph_edges`, `graph_overrides`, `ui_layouts` sont éditables par toi (super‑admin) via un éditeur graphique.
- La vue visible par les joueurs est une **vue matérialisée** issue de `raw_*` + `graph_*`.

### 5.3 Connecteurs d’import

- Chaque source (DofusDB, dofapi, etc.) a un connecteur capable de :
  - lister les quêtes/donjons/succès,
  - retourner leurs métadonnées,
  - fournir un indicateur de mise à jour.[web:48][web:53][web:55][web:58][web:59]
- Un job planifié compare les données externes à `raw_*` et applique les diffs.

---

## 6. Éditeur d’admin orienté graphe

### 6.1 Objectifs

- Permettre au super‑admin/dev de modifier quotidiennement l’arbre (regroupements, pondérations, layout) sans toucher au code.
- S’inspirer des outils de quest design node‑based utilisés en dev de jeux (QuestMap, LoomGraph, editors internes).[web:80][web:82][web:90]

### 6.2 Fonctionnalités

- Canvas React (Cytoscape.js ou React‑Flow) avec :[web:81][web:85]
  - recherche/autocomplétion sur quêtes/donjons (`raw_*`),
  - drag & drop pour relier/déplacer des nœuds,
  - édition des poids/flags dans un panneau latéral,
  - groupement de quêtes en “chapitres”/sagas,
  - système de versions de graph (v1, v2) + rollback.[web:82][web:86]
- Bouton “Prévisualiser comme joueur X” :
  - applique l’état de quêtes du joueur,
  - calcule le sous‑graphe montré au membre et la route proposée.

### 6.3 Environnements

- **Draft** : modifications visibles seulement par toi et certains rôles (officiers).
- **Prod** : lorsque validé, un graphe de draft est promu en prod ; les joueurs voient immédiatement la nouvelle organisation.

---

## 7. Suivi de progression par personnage

### 7.1 Sans API Ankama

- Import manuel : multi‑sélection des quêtes déjà faites, ou validation de “lignes terminées” (succès, Dofus).
- Synchronisation opportuniste : lorsqu’un joueur confirme avoir obtenu un Dofus ou validé un succès, toutes les quêtes correspondantes sont marquées comme complétées.
- Les outils existants (DofusPlanet, DofusGuide) montrent que ce modèle “semi‑manuel” est réaliste pour les joueurs investis.[web:51][web:56]

### 7.2 Outil compagnon / overlay (optionnel)

- Inspiré de DofusDB Treasure Hunt Overlay : une PWA/Electron superposée au client qui aide sans le modifier.[web:38]
- À terme, l’overlay peut :
  - scanner la liste de quêtes via OCR,
  - envoyer au dashboard un diff des quêtes mises à jour.

---

## 8. UI / UX & Motion Design — Spécification 2026

### 8.1 Design system (tokens)

- **Couleurs principales** :
  - `dofus-emerald` : vert lumineux (nœuds Émeraude),
  - `dofus-turquoise` : bleu clair,
  - `dofus-ebony` : violet sombre,
  - `dofus-ivory` : blanc doré,
  - `accent-guild` : couleur personnalisable par la guilde.
- **États de nœuds** :
  - `locked` (cadenas gris),
  - `available` (halo léger),
  - `in-progress` (halo animé, contour pulsant),
  - `completed` (check vert, glow réduit),
  - `critical` (bordure plus large, légère aura).
- **Typographie** :
  - Titres : font fantasy type *Cinzel*,
  - Corps : sans‑serif lisible type *Inter*.

### 8.2 Composants majeurs

- **Neural Tree Canvas** :
  - nœuds Dofus (gros gemmes),
  - nœuds chapitres (médaillons),
  - nœuds quêtes (pastilles),
  - arcs lumineux (flux entre nœuds).[web:101]
- **HUD “Main Scenario”** (bandeau en bas ou en haut) :
  - objectif majeur,
  - 3–4 étapes suivantes,
  - indicateur de rentabilité (XP/Kamas/Succès attendus).
- **Panneau de détail** (à droite ou en modal) :
  - détails d’une quête/chapitre/saga,
  - checklist, récompenses, liens vers guides externes.[web:34][web:51]
- **War Room** :
  - grande carte + heatmap,
  - liste des synergies de guilde,
  - timeline des événements proposés.

### 8.3 Motion & transitions

Guidelines inspirées des bonnes pratiques de graph UX et de quest logs modernes.[web:83][web:98][web:101]

- **Durées** :
  - petites transitions (hover, toggles) : 120–180 ms,
  - déplacements/zoom du graphe : 200–350 ms,
  - animations de complétion de Dofus : 400–600 ms max.

- **Zoom sémantique** :
  - Zoom out : consolidation des quêtes en chapitres, puis en Dofus ; les nœuds fusionnent visuellement (morphing léger).
  - Zoom in : explosion progressive d’un Dofus en chapitres, puis d’un chapitre en quêtes ; arcs qui se dévoilent avec un effet de “signal électrique”.

- **Transitions d’état de nœud** :
  - `available` → `in-progress` : l’aura s’allume, un fil lumineux part du Dofus racine vers la quête.
  - `in-progress` → `completed` : flash rapide, check animé, propagation d’une onde lumineuse sur la branche correspondante.
  - `locked` → `available` : cadenas qui se dissout, halo qui apparaît.

- **Déplacements sur carte** :
  - pan/zoom inertiels (ease‑in‑out),
  - recentrage sur sous‑zone ciblée avec léger tilt de caméra (si WebGL) pour donner un côté “table de stratégie MMO”.

- **Feedback de guilde en temps réel** :
  - lorsqu’un membre termine une étape critique, micro‑anim sur sa position dans l’arbre et sur la carte (icône de classe Dofus qui clignote une seconde).

### 8.4 Accessibilité

- Mode **daltonien** : icônes/formes différentes par état, pas seulement des couleurs.[web:83]
- Mode **réduction de mouvement** : animations ralenties ou remplacées par des transitions plus simples.
- Contrastes minimum conformes aux bonnes pratiques (textes sur fonds foncés, etc.).

---

## 9. Copilote IA et journal narratif

### 9.1 Copilote IA branché sur le graphe

- Un module IA (LLM) interroge ton knowledge graph plutôt que le web.
- Cas d’usage :
  - “J’ai 40 minutes, je veux avancer Turquoise + Vulbis en solo, je fais quoi ?”
  - “Qu’est‑ce qu’on peut faire à 4 ce soir qui avance au mieux les quêtes émeraude/turquoise de X, Y et Z ?”
- L’IA utilise ton moteur de chemin comme oracle et se contente de reformuler en langage naturel, en expliquant pourquoi ces étapes sont proposées.[web:94][web:97][web:103]

### 9.2 Journal narratif par personnage

- Au‑delà de la checklist, chaque joueur a un **journal de saga** :
  - chapitres = grands nœuds ou sagas (Émeraude, Frigost I, Pandala, etc.),
  - entrées = quêtes pivots complétées.
- Chaque entrée est générée à partir des métadonnées de quêtes + un gabarit IA, pour raconter “l’aventure de la guilde” plutôt que juste “tu as coché X”.[web:95][web:98]

---

## 10. Analytics de guilde

- Temps médian pour chaque Dofus dans la guilde.
- Funnels : combien commencent vs terminent chaque saga ; où les gens décrochent.[web:51]
- “Dofus per month” par joueur, temps passé par zone.
- Campagnes de guilde : objectifs globaux (ex. “Mois de l’Émeraude”) avec suivi automatisé.

---

## 11. Roadmap de développement (versions jouables)

### 11.1 V0 — Prototype local (solo)

Objectif : prouver le concept sur une petite portion du jeu.

- Scope limité :
  - Dofus Émeraude + Dofus Turquoise, quêtes principales seulement.[web:37][web:40]
  - Quelques zones : Astrub, Amakna, Cania, Frigost 1.[web:63][web:74]
- Fonctionnalités :
  - Import manuel ou semi‑auto des quêtes/donjons concernés (`raw_*`).
  - Graphe minimal (QuestNode, DungeonNode, DofusNode, ZoneNode).
  - Calcul de chemin critique simple (temps + difficulté).
  - Affichage en liste + mini‑HUD (sans arbre neuronal).

### 11.2 V1 — MVP guilde (core graphe + UI simple)

Objectif : module **utilisable par la guilde**.

- Ajouts :
  - Intégration complète des Dofus primordiaux + quelques sagas majeures (Frigost, Pandala).[web:58][web:61]
  - Carte du monde Dofus (ton module) reliée aux ZoneNode/SubAreaNode.[web:70][web:75]
  - Moteur de chemin critique multi‑objectifs (sans quêtes synergie au début).
  - HUD “3 prochaines étapes” stable.
  - Suivi de progression manuel simple (cocher des quêtes / lignes finies).

- UI :
  - Graphe 2D simple (Cytoscape) sans animations poussées.
  - War Room basique : heatmap par zone, liste de donjons prioritaires.

### 11.3 V2 — Version “Neural Tree” (LOD, synergie, ressources)

Objectif : passer au **vrai produit différenciant**.

- Moteur :
  - Ajout SubAreaNode + ResourceNode + arcs de ressources.[web:68][web:75]
  - Routage avec budget de détour + quêtes `isSynergyCandidate`.
  - Indice de profondeur + marquage des nœuds pivots.

- UI :
  - Implémentation du Neural Tree (zoom sémantique, transitions animées).[web:83][web:101]
  - Animations d’état de nœud (available/in‑progress/completed/locked).
  - HUD enrichi (rentabilité, indicateurs visuels).

- Guilde :
  - Détection de synergies multi‑joueurs (intersections de routes).
  - War Room améliorée (heatmap zones + sous‑zones, top ressources/donjons).

### 11.4 V3 — Version “Grotesque” (copilote IA, journal, analytics)

Objectif : transformer le module en **centre névralgique** de la guilde.

- Ajouts IA :
  - Copilote branché sur ton graphe pour requêtes naturelles avancées.[web:94][web:97][web:103]
  - Journal narratif par personnage.

- Analytics :
  - Statistiques de progression fines, funnels, temps médian par Dofus.
  - Campagnes de guilde avec objectifs globaux et suivi automatique.[web:51]

- UX :
  - Motion design abouti (effets particules, sons, thèmes par monde).
  - Options d’accessibilité complètes (mode daltonien, réduction de mouvement).

### 11.5 Au‑delà (V4+) — Overlay & auto‑sync

- Overlay PWA/Electron pour lire l’UI de Dofus et synchroniser automatiquement les quêtes (OCR, parsing limité).[web:38]
- Plugins communautaires (API publique) pour que d’autres outils puissent consommer ton graphe.

---

## 12. Valeur ajoutée récap

Par rapport à tout ce qui existe aujourd’hui (checklists, Dofus Quests, wikis, cartes), ton module :

- traite les quêtes comme un **knowledge graph complet** (quests/donjons/zones/sous‑zones/ressources/Dofus),
- fournit des **routes personnalisées** et optimisées multi‑objectifs,
- donne une **vue de guilde** (War Room, synergies, analytics),
- offre une **UI neuronale animée** directement inspirée de Dofus mais plus moderne,[web:101]
- et intègre un **copilote IA** + journal narratif.

C’est bien au‑delà d’un “site pour cocher des quêtes” : c’est le **cerveau stratégique** d’une guilde Dofus moderne.

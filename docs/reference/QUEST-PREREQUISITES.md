# Prérequis entre quêtes — ce que chaque source porte réellement

> **Rôle unique.** Ce fichier tranche une question **mesurée le 17/11/2026** : Tougli et
> le DofusDex du client encodent-ils les prérequis **entre quêtes**, ou seulement un
> ordre linéaire ? Il ne duplique ni `docs/reference/TOUGLI-API.md` (source Tougli) ni
> `docs/reference/DOFUSDEX.md` (DofusDex). Les chemins cités existent dans le dépôt.

## 1. Réponse courte

| Source | Prérequis entre quêtes ? | Forme | Couverture mesurée |
|---|---|---|---|
| **Tougli** | **Oui, dans les données de quête** — **non dans l'arbre du guide** (linéaire) | `prerequisites: [{type:"quest", id}]` — **sans opérateur** `&` / `\|` | **430 / 530 quêtes**, **492 arêtes**, max 19 |
| **DofusDex du client** | **Non** pour le graphe complet | 109 prérequis **de Dofus** + 115 étapes + 783 objectifs | 30 Dofus ; **pas** les 1 984 quêtes |
| **Client `QuestsDataRoot`** | **Oui, graphe complet** | `startCriterion` avec `Qf=` + `&` / `\|` | **1 984 quêtes**, **990 avec `Qf=`**, **1 187 arêtes**, **842 cibles**, max 35 |
| **SigilOS** | **Oui, mécanisme `prereq_text`** | tag `{type, id?, name?}` — **AND uniquement** | **301 tags** sur **259 / 335** séquences, **tous par nom** |

## 2. Tougli — l'arbre est linéaire, les données ne le sont pas

- **L'arbre du guide** : 383 objectifs **ordonnés** ; 11 `choice` (alternatives),
  16 `group` (quêtes parallèles), 74 `take_quests` (« prendre à l'avance »). Ce n'est
  **pas** un graphe : l'ordre est la route, `take_quests` est une **astuce anti-blocage**,
  `group` n'impose pas d'ordre interne, `choice` est une alternative.
- **Les données de quête** : `prerequisites: [{ type: "quest", id }]` sur **430 / 530**
  quêtes, **492 arêtes**, **max 19**. Répartition : 405 quêtes à 1 prérequis, 14 à 2,
  8 à 3, 1 à 5, 1 à 11, 1 à 19.
- **Aucun opérateur** : la liste est plate. Le cas `1960` « Ça sent le gaz » porte les
  **19 quêtes de classe** : c'est un **OU** (la sienne), pas un ET. Le client le prouve
  (voir §4) ; l'import en ET bloquerait la quête à vie. C'est déjà la raison pour
  laquelle le mapping du dépôt **écarte** ces 19 liens et laisse `classReq` +
  `resolveRushRoute` faire le travail.

## 3. DofusDex — 109 prérequis de **Dofus**, pas le graphe de quêtes

Le DofusDex du client contient **30 progressions, 115 étapes, 109 prérequis, 783
objectifs**. Ses `prerequisites` sont des **lignes de Dofus** (ex. Dofus Ivoire : 18
prérequis ; Dom de Pin : 19) — des succès, quêtes ou PNJ qui débloquent le Dofus, pas
les prérequis entre **toutes** les quêtes. Le DofusDex est une **vue curatée** :
il ne contient pas les 1 984 quêtes du client et ne remplace donc pas le graphe.

> Le graphe complet est dans `QuestsDataRoot.startCriterion` (§4), pas dans
> `DofusProgressionsDataRoot`.

## 4. Le client — le graphe complet est dans `startCriterion`

Mesure sur les **1 984 quêtes** de `QuestsDataRoot` :

| Indicateur | Valeur |
|---|---:|
| Quêtes sans critère | **0** |
| Quêtes avec `Qf=` (quête terminée) | **990** |
| Arêtes `Qf=` | **1 187** |
| Cibles distinctes | **842** |
| Maximum de `Qf=` sur une quête | **35** (`1445` « L'école fantastique ») |
| Quêtes `Qf=` **sans** `\|` (AND-only) | **893** · **957 arêtes** |
| Quêtes `Qf=` **avec** `\|` (OR) | **97** · **230 arêtes** |
| Quêtes avec `&` | 1 441 |
| Quêtes avec `\|` | 170 |
| `PG=` (classe) | 40 |
| `Qa=` (succès) | 181 |
| `Qc=` (catégorie de quête) | 48 |

Exemples mesurés :

- `1971` « C'est pour ta pomme » : `Qf=2009&PG=9` → **ET** (Conseil de classe + classe 9).
- `1960` « Ça sent le gaz » : **19 groupes `(Qf=…&PG=…)` séparés par `|`** → **OU** des
  19 classes. Un import en ET est impossible ; `classReq` + `resolveRushRoute` le règlent.
- `747` « Une enquête alambiquée - Investigation » : `(Qf=720|…|723)&Qf=724&…` → **ET
  contenant un OU** : ni un simple ET, ni un simple OU.
- `1329` « Le Dofus des Glaces » : 35 `Qf=` dont un groupe `(Qf=710|Qf=711|Qf=1316)`
  → mélange ET/OU.
- `Qa=` (181 quêtes) est un prérequis de **succès**, `PG=` une **classe** : ce ne sont
  pas des quêtes. Le graphe `Qf=` est celui qui nous intéresse pour `prereq_text`.

## 5. SigilOS — ce que le moteur sait déjà, et sa limite

- Le tag `prereq_text` porte `{ id?, name? }`. `resolvePrereqTag` résout **l'id
  d'abord** (comparé au **`seqId` de la séquence**, pas au quest id), puis le **nom
  exact**, puis un nom partiel. Un id fourni mais introuvable ne devine pas : `null`.
- `isSequenceBlockedByPrereqs` traite **plusieurs tags comme un ET** : si une cible
  connue n'est pas cochée, la quête est bloquée. Une cible introuvable **ne bloque pas**
  (pas de verrou à vie).
- État du dataset : **335 séquences**, **259** avec `prereq_text`, **301 tags**,
  **0 avec id**, **301 par nom**. Le T-2c (« stocker l'id dans le tag ») est **encore
  à faire** ; un renommage de quête peut casser la résolution par nom.
- **Le nouveau seed Trame n'ajoute aucun `prereq_text`** : il importe la route, les
  ressources et les tags de contrainte. Les 301 tags existants restent sur les
  séquences déjà présentes ; un guide **neuf** importé depuis le seed n'aurait donc pas
  les prérequis.
- **L'ET seul ne suffit pas** : les 97 quêtes à `|` (dont `1960`) seraient sur-verrouillées
  si on importait la liste plate de Tougli en ET. `1960` est déjà exclu par `classReq`.

## 6. Décision et prochain lot

1. **Siphonner le graphe du client** (lecture seule, `QuestsDataRoot`) vers
   `public/game-data/quest-prerequisites.json` : `{ questId, criterion, qfTargets,
   andGroups, orGroups }`. Le script `scripts/siphon-dofusdex.py` charge déjà les
   quêtes ; un `scripts/siphon-quest-prerequisites.py` séparé garde les sujets distincts.
2. **Parser pur** (`parseQuestCriterion`) + tag `prereq_expr` (JSON dans
   `activityTags`, **aucune migration**) + évaluation **ET/OU** dans
   `isSequenceBlockedByPrereqs`, avec tests : `(Qf=720|Qf=721)&Qf=724` doit se lire
   « (720 ou 721) et 724 ».
3. **Seed** : importer maintenant les **893 quêtes / 957 arêtes AND-only** en
   `prereq_text` par **nom** ; **ne pas importer** les **97 quêtes / 230 arêtes OR**
   avant `prereq_expr` ; **exclure** les prérequis dont la cible porte un `classReq`
   (le cas `1960`).
4. **T-2c** : après import, backfiller l'**id de séquence** dans `prereq_text` (le
   `seqId` est connu une fois les lignes créées) ; le nom reste un repli.
5. **DofusDex** : garder ses 109 prérequis comme **checklist de Dofus** (ce que le seed
   écrit dans `tips`) ; ne pas lui demander le graphe de quêtes — il ne l'a pas.

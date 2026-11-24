---
description: Rush Sylvestre — fiche unique des restes (section ⚡ en tête), puis contenu S0→S6, mesures, lots, verrous de test (l'ordre global vit dans ROADMAP)
---

# 🏹 Rush Sylvestre — la suite du développement

> **Rôle unique.** Ce fichier porte **l'organisation** des chantiers Rush et, depuis le 22/11/2026,
> la **fiche unique des restes** (section ⚡ juste en dessous) : c'est la **seule** section à lire pour
> savoir ce qui reste. `docs/ROADMAP.md` garde l'**ordre global** ; les autres plans ne portent plus
> le détail des restes.

## ⚡ Restes — fiche unique (23/11/2026)

> **Seule section à lire au démarrage d'une session Rush.** Elle remplace tous les « reste » éparpillés :
> `ROADMAP.md` (rangs 9/10/10b/55), `PLAN-REFONTE-RUSH-SYLVESTRE.md`, `MODULE-RUSH-SYLVESTRE.md` et
> `ROUTE-RUSH-ISO-TOUGLI.md` **pointent ici** et ne portent plus le détail.
>
> **Mesuré le 22/11/2026 sur la base live** (`rush-sylvestre`) : **36 blocs / 536 séquences** ·
> 527 positions (**0 sans `worldId`**) · 527 `prereq_text` (**0 orphelin**) · 530 ids DofusDB
> (**530 trouvés**) · **518/536 cartographiables** · 863 tags `item` (505 ids) · 746 tags combat ·
> 3 succès officiels (**3/3 `isSuccess`**).
>
> **Mesures locales du 23/11/2026** (non autoritaires pour la bêta) : **541 séquences** (bêta **540**)
> · **117 séquences Brâkmarien = 102 série + 15 quêtes d'Ordre** (3 × 5) · **0 `constraints`** réelles
> (le champ existe, le backfill S2 n'est pas fait) · **29 conseils** (7 de quête + 22 de bloc ; bêta
> **49**) · **742 tags combat** (bêta 746) · **6 positions** de quêtes ajoutées à traiter (local fait,
> bêta à vérifier) · dialogue **DPLN : 0 à mettre à jour** (532 positions sur les deux).

### A. Code — prêt à exécuter (aucune décision requise)

| # | Lot | Définition / mesure | Ancrages | Taille |
|---|---|---|---|---|
| 1 | **O13 carte des quêtes — monde + accès** | **Décision du 22/11/2026 : pas de carte dans la PiP, pas de pion.** On garde le menu existant (dashboard + guide public) et on répare : ① `/api/rush/map-at` **public** (un visiteur non connecté recevait **401**) ; ② `worldId` du `pos_tags` transmis au menu **et** au zaap — **112 / 527** positions tombent sur une case présente dans plusieurs mondes ; ③ carte `mapId` de God **prioritaire** (la branche était dans un commentaire, `mapParam` jamais lu). Règle d'URL pure `buildRushMapAtUrl`. **Positions** : `(0,0)` autorisé dans un sous-monde (monde 24) + `fix-rush-pos-worlds` (514 corrections proposées : 149 monde+carte, 365 carte seule ; 4 appliquées en local). | `src/lib/rush-map-at.ts`, `RushCoordinateChip`, `RushPositionMenu`, `map-at/route.ts`, `src/proxy.ts` | ✅ **livré — PR #1499 mergée** |
| 2 | ~~**Compteur « 448 »**~~ ✅ **clos par mesure le 23/11/2026** | Les deux surfaces affichent **515** quêtes cochables (local 29/515 · bêta 26/515), pourcentages cohérents (6 % / 5 %) et compteurs de bloc alignés (INCARNAM 0/8, ASTRUB 12/12). Le total est le nombre de quêtes **cochables** : blocs info, séparateurs, bandeaux et combats ne comptent pas. Le « 448 » était une ancienne mesure. **Aucun code à changer.** | — | — |
| 3 | **Phase 1 — cohérence de progression** | Cascade **montante** des prérequis à la validation d'un bloc, coche des donjons requis, resets qui effacent les donjons, modales recalculées, coche du sommaire, reset bloc dans l'overlay, placement de la célébration. Détail et ordre : **§H**. Aucune migration. | `src/lib/rush-*` + `optimized-guide-actions.ts` + `RushTimelineClient` + `GuideOverlayClient` | ✅ **livré — PR #1525** |
| 4 | **Choix exclusifs Brak (55/66)** | Une seule étape avec **carte de choix** : étape 55 = Le magnanime / Les kamas résolvent tout / Assassinat effectué ; étape 66 = Les ordres sont-ils les ordres ? / On m'appelle l'Escargot. Comptée pour **1**, note « quêtes identiques, seul le nom change », **éditable dans God** (variantes + libellé + condition). `rush-choice-groups` porte déjà le comptage et l'exclusivité ; il manque le rendu. | `RushTimelineClient`, `PublicRushGuideClient`, `GuideOverlayClient`, studio God | **à coder** |

### B. Code — mesure ou décision d'abord

| # | Lot | Pourquoi ce n'est pas codé | Décision attendue |
|---|---|---|---|
| 8 | **T-6 / G6** (contextes → Zustand) | **20** `createContext` encore dans `RushTimelineClient.tsx` (l. 1341-1378, mesuré le 23/11) ; `SequenceRow` en lit **18** ; `CompletedStepsCtx` **retiré**. Le plan impose un **profiler navigateur avant/après**. Le guide public est profilable sans compte ; le dashboard demande une **session connectée** | session dédiée avec profiler |
| 9 | ~~**`useOptimistic`**~~ ✅ **supprimé le 23/11/2026** | `src/hooks/use-optimistic-toggle.ts` n'était importé nulle part ; l'overlay fait déjà optimiste + rollback + cascade. `CompletedStepsCtx` (fourni mais jamais lu) retiré de `RushTimelineClient`. | — |
| 10 | ~~**O9 carte « Maintenant »**~~ ✅ **abandonnée le 23/11/2026** | La carte n'existe pas dans l'overlay ; doublon de « Reprendre » + objectif courant retiré. Rayée du plan. | — |
| 11 | ~~**O11 jauges / anneaux**~~ ✅ **abandonnés le 23/11/2026** | Une seule jauge dans l'en-tête (anti-doublon assumé). | — |
| 12 | ~~**O5 « Aller à la suite »**~~ ✅ **abandonné le 23/11/2026** | « Reprendre » fait déjà le saut ; libellé absent du code. | — |
| 13 | ~~**Bulles d'aide du guide navigateur**~~ ✅ **livré le 23/11/2026** | Bulle portée dans le `body` en `fixed` (plus de sortie d'écran) : bascule haut/bas, clamp horizontal, **6 tests** 390/768/1024/1440 ; survol = aperçu, clic = épingle, Échap/clic extérieur = fermeture. Ajouts : Ordre, actions de bloc (en plus de progression, recherche, personnage et guide). Overlay inchangé (son bouton d'aide). | — |
| 14 | ~~**E2 `achievements[]`**~~ ✅ **écarté le 23/11/2026** | **Pas de migration** : les succès restent des tags par **id Ankama stable** + le catalogue `achievements.json` (2 777). Une nouveauté = re-siphon du client + rattachement éditorial ; la colonne ne l'automatise pas. Le vrai garde-fou est le contrôle des succès dont les quêtes manquent (§G ④). | — |
| 16 | ~~**Accents Dofus**~~ ✅ **cadré le 23/11/2026** | Couleur réservée à l'identité du bloc et aux états actifs ; jamais le texte. | — |
| 17 | ~~**Overlay étroit (3ᵉ palier)**~~ ✅ **sans objet le 23/11/2026** | Précédence corrigée et mode compact livrés le 22/11 ; l'overlay large est validé tel quel (capture 1440). Rouvrir seulement sur une gêne mesurée. | — |

### C. Déjà livré — à acter (ne plus compter comme reste)

O10 (3 densités `wide/normal/tight`, mesurées sur le conteneur) · O12 (bulles « En attente ici » par quête + toast live) · G2 (`SuccessChip`) · T1 (303 succès, 451 + 76 prérequis) · T5 (`rush-choice-groups` ; le hook `useQuestGroups` n'existe pas) · O3 (écarté par la mesure) · **T-2c : 0 orphelin sur 527 `prereq_text` ⇒ lot inutile** · **3 succès officiels 3/3 `isSuccess`** (le « reste 3 tags » du ROADMAP était périmé) · 173 vs 143 (écart de route) · 1 position 1938 (temple de classe, expliqué) · **22/11 : bandeaux Combat de séquence** (`sequence_banner`, studio `+ Quête` + inspecteur, rendu centré sur les 3 surfaces) · **« Dofus obtenu » partagé** (le titre du studio passe devant) · **blocs hors quête conservés** par `resolveRushRoute` (bannière invisible corrigée) · **V-D2 livré** (`isResolvableItemId`, borne Int32) · **O6 livré** (`autoFocus`, verrou de scroll porteur, piège Tab `nextFocusIndex`) · **E5 livré** (4 `prompt()` → 2 `Dialog`) · **descriptions de blocs recalées** (`syncQuestCountInDescription`, 3 écritures) · **carte HD** (`pos_tags.mapId`) **réellement** prioritaire depuis le 22/11 (branche réactivée) · **positions sous-mondes** : `(0,0)` d'un sous-monde autorisé + `fix-rush-pos-worlds` (514 proposées, 4 appliquées en local) · **`questDbIds` : déjà utilisé sur les 3 surfaces pour les succès ⇒ lot clos par mesure** · **saut prérequis overlay (22/11)** : cible par `milestoneId` + `seqId` (fail-closed), focus dans le document PiP, retour « Revenir » — verrou `rush-overlay-jump` **11**.

### D. Bloqué par le mainteneur / données à vérifier

| Sujet | Ce qu'il manque |
|---|---|
| **G7 hero + composition G9** | **Captures d'écran** (G8, O15 et G9 tokenisée sont livrés). ⚠️ **Priorité au mode blanc** : le guide doit d'abord être utilisable en thème clair ; G7/G9 sont cosmétiques et viennent après. |
| **98 conseils Brâkmarien** | Textes : **49 en base (bêta)**, **29 en local** (7 de quête + 22 de bloc), **194 visés**. Les 98 Brâkmarien n'ont **aucune source** (Tougli/Dofusyelle) → rédaction manuelle. |
| **V-C purge WebP** | Ops VPS + validation de l'archive `rush-sylvestre-archive-*` avant `rush-delete-archive --apply`. |
| **Touglie enrichi** | Import VPS : la bêta a **540 séquences**, le local **541** ; l'archive **108/492** est l'ancien guide. Les données locales ne sont pas toutes sur le VPS. |
| **6 positions des quêtes ajoutées (23/11)** | **Local fait ; bêta à vérifier/appliquer.** Le dialogue **DPLN** dit **0 à mettre à jour** : il ne couvre pas ces positions manuelles. Valeurs `DofusQuestEntry.coords` : 614 `(-85,-36)` (correction), 626 `(-63,-75)`, 710/711 `(-34,-16)`, 1939 `(1,0)`, 1988 `(7,-19)` déjà bonne. **894 : aucune source.** |
| **Brâkmarien 121 vs 102** | **Mesuré** : 117 en local = **102 série + 15 quêtes d'Ordre** (3 × 5). Le 121 est le compte **brut** (variantes incluses) ; le 102 le compte **jouable**. Ce n'est **pas** un doublon à supprimer. Le vrai lot est le **choix exclusif des étapes 55/66** (§H) et l'actage « 102 + 15 Ordres + variantes ». |
| **Combats** | **746 tags** bêta / **742** local avec au moins un monstre sans id. La résolution **815 / 1 443** date du **19/11** et porte sur les fichiers statiques (`unity-bestiary.json` + `rush-monster-map.json`), **pas** sur la base : re-mesurer sur la bêta avant de compléter. |
| **Itérations 5/6** | ~~Définition absente~~ → **supprimées de la liste le 23/11/2026** : elles ne sont pas actionnables. Toute itération future est un **nouveau lot à définir**. |

### E. Ops (hors code)

**Bêta** : code à vérifier (dev `2275227c`), **540 séquences** contre **541 en local** ; les données locales (6 positions, quête manquante) ne sont pas toutes sur le VPS. Dialogue **DPLN : 0 à mettre à jour** (532 positions) — il ne couvre **pas** les 6 positions manuelles. Migrations `20270112000000` + `20270113000000` (bêta puis prod) · bot Discord + **4 crontabs**.

**Prod** : **en attente** (décision du 23/11/2026), `main` = `c190f2c7`, aucune date.

**Ordre données (bêta)** : import Tougli → `scripts/add-rush-missing-quests.ts --apply` → `scripts/fix-rush-prerequisites.ts --apply` (l'import écrase les `activityTags`) ; **prod en attente**.

### F. À savoir avant de coder

- import **additif** : `importRushGuide(raw, apply)` fait un **dry-run par défaut** ;
- **aucune migration** pour les lots restants ci-dessus (E2 écarté) ;
- **valider un bloc = confort** : aucun refus (donjon/prérequis), mais **cascade montante** des prérequis + **coche des donjons requis** ; ne jamais transformer le bloc en verrou fail-closed (la quête seule reste fail-closed) ;
- **reset bloc/guide** : efface les donjons du personnage ; **dévalider** un bloc laisse les donjons (fait acquis) ;
- ne pas affaiblir `rush-choice-groups`, `rush-public-parity`, `rush-dungeon-invalidation`, `rush-dungeons` ;
- piège connu : le studio écrit `subGuideRef: name.trim()` (le code `RS-S2-QN` est écrasé) ;
- **1 lot = 1 branche = 1 PR → `dev`**, DoD §9 de ce fichier.

### G. Succès & quêtes — audit des sources (23/11/2026)

> **Mesure** : Tougli (`GET /api/guide/details-batch?slugs=rsa-rush-sylvestre-accelere`, 1,18 Mo) expose **530 quêtes**, exactement les **530 `questDbIds`** du guide (écart **0**). L'oubli est donc **dans Tougli**, pas dans l'import. Dofusyelle (`window.RUSH_DATA`, 58 étapes) apporte **8 candidates**, dont **2 déjà dans le guide** (faux positifs d'URL) : **6 quêtes réellement absentes** — L'histoire en mouvement (**1988**) · Mieux vaut ne pas se fier à la première impression (**894**) · Full Contact (**614**) · La destinée (**710**) · La fatalité (**711**) · L'arme fatale (**1939**). Les deux faux positifs : Dépôt de ravitaillement (**596**, Frigost) et Qui nous protège du Protecteur ? (**2488**, Dofus Sylvestre). **Quête de classe** est couverte par les **19 variantes du guide** (filtrées par classe) ; **626 Le pic qui glace** est un prérequis de **2 quêtes du guide** (2014, 1910) — les 19 autres dépendants de la table client ne sont pas dans le guide.
>
> **Checkup prérequis (23/11/2026)** : **537** quêtes distinctes · **37 arêtes manquantes** (9 client `quest-prerequisites.json` + 28 DofusDB, toutes cibles dans le guide) + **626** requise par **2014/1910** · après correctif : **0 arête / 0 cible manquante** (client + DofusDB) · 102 quêtes hors catalogue client, dont 28 avec prérequis DofusDB, toutes corrigées · **OR** : `275 → 272/273/274` (Brâkmarien exclusif) et `1960 → 19 classes` (filtrées) — variantes, pas des manques. Les autres prérequis des mêmes dépendants (`2442←232/1462/1781`, `2481←2480`, `2420←2409/2138`, `2014←2010`) étaient **déjà taggés**. **Nouvelles quêtes** : 1988←1960, 614←613, 1939←1938 ; 894/710/711/626 sans prérequis de quête (DofusDB `need` vide).
>
> **Succès** : les **72 succès** référencés par le guide sont tous résolus dans `public/game-data/achievements.json` (2 777 succès, `questIds` fournis par le siphon client). **114 quêtes** liées à ces succès manquent dans le guide ; la fiche d'un succès ne liste que les quêtes présentes → **0/0** et message « les N quêtes ne sont pas dans le guide » alors que **3/4 existent** en local. La bêta est en plus en retard (3/4 en local, 0/0 sur la bêta).
>
> **Lots** : ① ✅ **livré le 23/11/2026** : `SuccessChip` affiche **toutes** les quêtes d'un succès (nom du guide ou catalogue `quest-names.json`, **les 19 variantes de classe repliées sur celle du guide**, coché/non coché, badge « hors guide », icône de succès) · **fiche détail** : `SuccessChip` (trophée + liste, z-120, Échap/focus/PiP, une pastille par succès) ; toast retour fermable ; ② ✅ **script livré le 23/11/2026** (`scripts/add-rush-missing-quests.ts`, dry-run/--apply, idempotent, **bloc résolu par l'ancre**, ordres verrouillés, tags `prereq_text` avec **id de séquence** T-2c) : 6 quêtes ajoutées en local ; 1988 prérequis de 1989, 710/711 prérequis de 1317, 614/1939 avec leur prérequis ; **bêta faite 23/11** (540 séquences) ; **prod à jouer** ; **626 ajouté** (2 dépendants) ; ③ ✅ **checkup prérequis livré** (`scripts/fix-rush-prerequisites.ts`, dry-run/--apply) : **37 arêtes** (9 client + 28 DofusDB) + **626**, re-mesure **0 manquant** ; **bêta faite 23/11** ; variantes OR (275, 1960) inchangées ; ④ garde-fou : contrôle qui liste les succès dont les quêtes manquent ; ⑤ **import Tougli d'abord**, puis jouer `add-rush-missing-quests --apply` puis `fix-rush-prerequisites --apply` — l'import réécrit les `activityTags` ; **bêta faite 23/11** ; reste **prod** (même ordre). **Aucune migration.** Sources : `docs/reference/TOUGLI-API.md` · `https://dofusyelle.com/rush-sylvestre.html`.


### H. Plan de reprise consolidé — 5 phases (23/11/2026)

> **Décisions du 23/11/2026** (elles lèvent les ambiguïtés) :
> · **Cascade montante** : valider un bloc coche ses quêtes **et** les prérequis manquants, récursivement (un seul par groupe « OU »), sans valider les dépendants. Dévalider/reset recalcule la fermeture des blocs encore validés et **retire** les prérequis qui ne sont plus impliqués. Aucune migration ; un prérequis coché **manuellement** qui n'est plus impliqué serait aussi retiré (cas rare accepté).
> · **Donjons** : valider un bloc coche tous les donjons **requis** (un seul par groupe « au choix », optionnels ignorés) ; reset bloc/guide **efface** les donjons du personnage ; dévalider un bloc **laisse** les donjons (fait acquis).
> · **UI** : la modale Dofus « Avancement », la modale « Progression Donjons » (statut par membre) et la coche du sommaire se recalculent après validation/dévalidation de bloc, coche/décoche de quête, reset bloc/guide, pour le personnage ciblé. Overlay : bouton **« Réinitialiser »** du bloc. Célébration : placement unifié (bloc = toast discret, chapitre = burst central).
> · **Choix Brak 55/66** : carte de choix claire + édition God. **Mode blanc** prioritaire sur G7/G9. **E2** écarté. **Itérations 5/6** supprimées. **Prod en attente**.

| Phase | Contenu | État |
|---|---|---|
| **1 — Cohérence de progression** (aucune migration) | ① cascade montante · ② donjons à la validation · ③ resets qui effacent les donjons · ④ modale Dofus recalculée · ⑤ modale Donjons par membre + refresh · ⑥ coche du sommaire · ⑦ reset bloc overlay · ⑧ célébration unifiée | ✅ **livré — PR #1525** |
| **2 — Lisibilité** | ⑨ mode blanc · ⑩ fiche quête (types de combat, icônes, accordéon vide, assets) · ⑪ choix Brak 55/66 + God | à faire |
| **3 — Données** | ⑫ 6 positions (bêta + 894) · ⑬ 514 positions sous-mondes + verbe ops · ⑭ contraintes 1 085 + 4 donjons Maïmane · ⑮ 98 conseils · ⑯ combats 746/742 · ⑰ actage Brâkmarien · ⑱ Touglie VPS | à faire |
| **4 — Ops / vérifs** | ⑲ bêta 540/541 · ⑳ V-C purge · ㉑ contrôle visuel · ㉒ migrations/bot/crons · ㉓ prod (attente) | à faire |
| **5 — Perf / décisions** | ㉔ T-6 (session dashboard) · ㉕ E2 (écarté) · ㉖ G7/G9 (après mode blanc) · ㉗ itérations (supprimées) · ㉘ D-G1 (idée) | à faire / tranché |

**Prochain lot** : **graphe des succès 2b** (données + fiche, PR à ouvrir), puis **2c** (cascade « Valider les prérequis »). Route d'alignement livrée en **PR #1526**. Les phases 3/4/5 restent pour la prochaine conversation.

### I. Route d'alignement & graphe des succès (24/11/2026)

| # | Lot | Définition / mesure | État |
|---|---|---|---|
| 1 | **Route d'alignement unique** | Un seul `RushAlignmentPanel` (cité / Ordre / palier 20-100) ; plus de dropdown dans chaque bloc ; l'Ordre terminé devient un badge statique (dropdown masqué) ; `toggleMilestoneProgress` accepte un **périmètre** (`scopeSeqIds`) et ne valide que la route visible (cascade + donjons + ressources sur ce périmètre) ; la complétude d'un bloc se déduit de ses séquences de route (dashboard + overlay), plus du drapeau global ; l'overlay ne dévalide plus par le nœud du chapitre, le reset est l'action dédiée ; `RushOrderSelect` `allowAll` pour un choix de route. Aucune migration. | ✅ **livré — PR #1526** |
| 2b | **Graphe des succès — données & fiche** | `OA=<achievementId>` siphonné dans `achievements.json` (`successIds`) : **576** succès avec OA, **1 983** OA distincts ; dans le guide, **3** succès ont des OA (1705 Six sur six, 2298 La chevauchée fantastique, 7761 En attendant le printemps) et **61** succès sont des prérequis. `rush-success-graph` : succès **dérivé** (`Qf + OA`), cycles, hors guide. | ✅ **livré — PR #1527** |
| 2c-1 | **Graphe DofusDB — données & fiche** | Siphon **statique** DofusDB (`siphon-dofusdb-success-graph.mjs`) : **2 777** succès (`need.achievements`/`need.quests`/`need.items`), **1 984** quêtes (`startCriterion` Qf/OA/PO/PL), méta **5933 L'héritage de l'île brisée** (absent du client). Graphe **effectif** : OA du succès + OA des quêtes + succès parent d'une quête prérequise + overrides éditoriaux (`rush-success-meta.json`, Dom de Pin → 5933). Les trois exemples sont couverts : **1048 → 1036**, **5222 → 1705**, **7761 → 5222/7760/5933**. La fiche affiche l'état, les prérequis (sous-prérequis dépliés), les **possessions** (à part des ressources) et la date DofusDB. `--check` pour le diff. Aucune migration. | **code + tests** (branche `feat/rush-success-graph-2c-2026-11-24`, PR à ouvrir) |
| 2c-2 | **Graphe — cascade** | « Valider les prérequis » avec **aperçu** : liste des succès, des blocs et des quêtes du guide concernés, puis écriture des seules quêtes présentes dans la route (cascade Phase 1 par bloc) ; les nœuds hors guide/route et les possessions sont affichés, jamais inventés. Aucune migration. | **à coder** |

> **Six sur six / Vert émeraude / Dom de Pin** : le client ne portait pas toutes les arêtes ; DofusDB les donne (`need`, `startCriterion`) et expose **5933 L'héritage** que le client avait perdu. Le 2c-1 les **affiche** ; le 2c-2 les **écrit** avec aperçu. Le bloc « Six sur six - Prérequis 2/2 » reste un ajout manuel de 2 quêtes, **pas** les 11 succès.
>
> **Long terme** : l'instantané DofusDB est daté et commité ; `node scripts/siphon-dofusdb-success-graph.mjs --check` compare au DofusDB courant. Le branchement d'un contrôle hebdomadaire (cron VPS + **alerte Discord ops/Sentry**, pas les membres) et le changelog « guide mis à jour » sont en **phase 4 ops**.

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

## 0 bis. Amorçage de la prochaine session (29/10/2026)

> **Pourquoi ici et pas une sixième doc** : un sujet = un fichier. Ce document porte déjà
> l'organisation des chantiers Rush ; l'amorce en est la **tête de lecture**, pas une copie.

**État mesuré au 04/11/2026** (contenu) · **V-H livré le 10/11/2026** (donjons ocre : `Dungeon.isOcreQuest`
prioritaire, coches dans la fiche détail, guide public connecté, toasts d'overlay) — mécanique **terminée** (S0),
outillage God **fini** (S4), route **livrée** (G0 / L1 / L2 / L3), contenu **inégal** : Bontarien **100/100**, Ordres
**5/5 × 6**, classes **19**, Brâkmarien **121 séquences importées** (cible **102**, l'écart venant des étapes
dédoublées/variantes). **Mesure neuve** : sur ces 121 séquences, **115 n'avaient AUCUN tag** — la
route était là, le contenu ne l'était pas.

**Livrés le 04/11/2026** : ① **25 conseils** écrits depuis les contraintes Tougli (19 Brâkmarien,
6 Bontarien), rattachement par **`questDbIds`** ; reste **194** conseils, dont **98 Brâkmarien sans
aucune source**. ② **V-D1 — les ressources par quête** : **390 → 485 ids**, **81 séquences** et
**252 tags** ajoutés (Brâkmarien **1 → 151 ids**), **2ᵉ passage = 0 écriture**, dataset
**inchangé**, **aucune migration**.

**Prochain lot** : voir la **fiche unique des restes** (section ⚡ en tête de fichier). Cette ligne
annonçait `V-C` le 04/11/2026 : elle reste comme repère historique, plus comme état.

| Ressource (dans `src/temp/trame-rush/`, **jamais commité**) | Contenu |
|---|---|
| `export-god-cites.json` | les Brâkmar en **6 blocs** (Bonta palier 80 + Brâkmar 20/40/60/80/100) |
| `export-god-variantes.json` | les **3 variantes exclusives** manquantes (groupes 55 et 66) |

**À savoir avant de coder** :

- l'import est **additif** : `importRushGuide(raw, apply)` fait un **dry-run par défaut** et **ajoute seulement** ;
- **aucune migration** pour ce lot — `alignReq`, `alignOrderCode`, `alignLevelReq`, `classReq`, `questDbIds`, `takeEarly` existent déjà ;
- les **variantes exclusives** se taguent `choice_group` dans `activityTags` (règle `src/lib/rush-choice-groups.ts`), sans colonne neuve ;
- **ne pas affaiblir** `rush-choice-groups`, `rush-public-parity`, `rush-dungeon-invalidation`, `rush-dungeons` ;
- piège connu : le studio écrit `subGuideRef: name.trim()` ⇒ le code **`RS-S2-QN` est écrasé** au premier enregistrement (sans effet sur ce lot, mais ne pas s'en servir comme identifiant) ;
- **1 lot = 1 branche = 1 PR → `dev`** ; DoD du §9 (règle pure + 4 surfaces + tests + docs).

**Prompt d'amorçage** : `docs/agents/harnais.md` §0 (prompt générique). Ne pas coller un prompt de
lot déjà livré — l'état et le prochain geste vivent dans la **fiche unique** en tête de fichier.

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
- **Un seul chemin d'écriture porte le verrou côté serveur** : `setRushSequenceProgress` (une quête). Depuis le **20/11/2026**, valider un **bloc entier** (`toggleMilestoneProgress`) ne consulte **plus** le verrou donjon/prérequis — décision user : un membre déjà en cours ne doit pas recocher 500+ quêtes à la main ; la dévalidation reste toujours possible. Le toast affiche le message serveur exact, jamais un « Erreur » muet.
- **Guide public** : aucune donnée de guilde, aucun serveur. La coche vit dans `localStorage` sous `<préfixe personnage>dungeons` (même préfixe que les étapes cochées, donc par personnage déclaré) ; le verrou y est **local et fail-closed**, appliqué dans les **3** chemins d'écriture (étape, chapitre entier, lot de quêtes), et les donjons manquants sont **nommés** dans la carte.

**Verrous de test** : `rush-dungeons` (**17** cas, dont les états par occurrence) · `rush-dungeons-ui` (**6** cas sur le panneau de quête) · `rush-dungeon-storage` (**12** cas, fail-closed du stockage local) · `rush-public-parity` (**9** cas donjons : même panneau, même règle, 3 chemins verrouillés côté quête, **bloc sans verrou depuis le 20/11/2026**, absence d'onglet global) · `rush-overlay-dungeons` (pastille → panneau, portail `ownerDocument`) → **95 tests verts** sur le périmètre donjons.

**UI retenue (corrigée le 21/10 par le user)** : **aucun onglet global**, aucune icône ajoutée dans la barre de l'overlay, aucune fenêtre « tous les donjons du guide ». La coche vit **dans la quête**, ouverte depuis la pastille `Donjon ×N`, et le panneau **reste ouvert** jusqu'à sa croix (le survol n'ouvre plus rien : on ne peut pas cocher dans une fenêtre qui se referme). Rendus partagés : `RushQuestDungeonsPanel` (cadre + croix) et `RushOverlayDungeonCard` (lignes + deux coches).

**Ops (humain)** : `npx prisma migrate deploy` en **bêta puis prod** (migration additive : `CREATE TYPE`, `CREATE TABLE`, 3 index, 2 FK, 1 colonne `TEXT[]`).

**Sans serveur, ce qui marche déjà** : côté **externe** (guide public), la coche et le verrou vivent entièrement dans le `localStorage` — aucun compte n'est requis.

**Verrous de test** : `tests/unit/rush-dungeons.test.ts` (12 cas, vert) · à compléter par
`rush-dungeons-gate.test.ts` (l'action refuse, l'action accepte, idempotence) et un cas de parité.

## 3. Bloc S1 — Le contenu (le gros morceau)

| Lot | Contenu | Cible mesurée | Taille |
|---|---|---|---|
| **S1-1** | Série **Bontarien** : 100 quêtes ordonnées, `alignReq="bontarien"`, pas d'Ordre | ✅ **100 / 100** (mesure par nom, 27/10/2026) · **32 présentes sans `alignReq`** (#2 à #33) **taguées** · doublon « Entraînement avec JF » **supprimé** (c'était « Entraînement avec Tarche », DofusDB 55, nom inexistant) · **Bandanarthrie** (#65) et **Le subterfuge de la corne** (#70) **remises dans leurs blocs** (ordre 0) · **L'exorciste = position 100** (vérifié en base) | M |
| **S1-2** | Série **Brâkmarien** : 102 quêtes ordonnées | **0 présente** par nom (la jumelle « Entraînement avec Tarche [brakmarien] » n'est pas la série) → **102 à créer** ; export prêt `export-god-cites.json` (**6 blocs** : 2 Bonta palier 80 + 5 Brâkmar 20/40/60/80/100) · **variantes exclusives** (mesuré le 27/10/2026) : l'étape **55** offre **3 quêtes au choix** (« Le magnanime » / « Les kamas résolvent tout » / « Assassinat effectué », cette dernière **publiée le 26/09/2026**) et l'étape **66** en offre **2 selon le temps de trajet** (« Les ordres sont-ils les ordres ? » / « On m'appelle l'Escargot ») — le guide n'en porte qu'**une branche** ; `export-god-variantes.json` ajoute les **3 manquantes** en **optionnel** avec la note « variante exclusive » (dry-run : 0 nouveau bloc, 3 quêtes, 0 avertissement) | M |
| **S1-3** | **30 quêtes d'Ordre** : `alignReq` + `alignOrderCode` + `alignLevelReq` **dérivé par position** (20/40/60/80/100) | 6 × 5 | ✅ **livré le 27/10/2026** — export `export-god-ordres.json` (6 blocs × 5, `dofusDbId` résolu par nom 30/30, DPLN 30/30) importé dans God ▸ JSON ; **vue Branches à 5/5 × 6** après correctif du classement (`normalizeOrderCode`) |
| **S1-4** | **19 quêtes de classe** : `classReq` sur la branche Astrub (1 seule s'affiche) | 19 | ✅ **export prêt le 27/10/2026** — `export-god-classes.json` (1 bloc, 19 quêtes, `dofusDbId` 19/19, DPLN 19/19) ; le **filtre de classe** est branché côté guide interne (`resolveDofusClassId` : le profil stocke un **libellé**, la route compare des **ids**) ⇒ chaque membre ne voit que sa quête |
| **S1-5** | **Prérequis** : chaîne commune (1958→1859) sans les 19 liens de `1960` | 11 lignes | S |
| **S1-6** | **Groupes parallèles** (16) : les quêtes d'un groupe ne s'ordonnent pas entre elles | 16 groupes | S |
| **S1-7** | **Prises anticipées** (49) : `takeEarly` sur la séquence cible | 49 | S |
| **S2-3 bis** | **Étape à variantes EXCLUSIVES** (modèle, livré le 27/10/2026) : une étape, N quêtes dont **une seule** est jouée (étape 55 = 3 variantes, étape 66 = 2). Convention **sans migration** : tag `choice_group` dans `activityTags` ; règle pure `src/lib/rush-choice-groups.ts` (`getChoiceGroup`, `stepCounts`, `applyChoiceExclusivity`) ; l'**import** porte `choiceGroup` ; les **compteurs** comptent le groupe pour 1 ; le **serveur** (`setRushSequenceProgress`) dé-coche les sœurs et termine le bloc dès qu'une variante est cochée. **6 cas** dans `rush-choice-groups` + **1 cas** de vue. **Tag appliqué le 27/10/2026** sur les **5** variantes (2 déjà en base + 3 importées) : groupe **55** = Le magnanime · Les kamas résolvent tout · Assassinat effectué, groupe **66** = Les ordres sont-ils les ordres ? · On m'appelle l'Escargot — écriture **additive** et idempotente. **Vérifié en base** : le bloc « palier 60 » passe de **22 séquences à 20 étapes** (les 3 variantes comptent pour une) et cocher une variante suffit à terminer l'étape | — | M |

**Tranché le 02/11/2026** : côté **visiteur**, cité, Ordre et classe viendront du **compte visiteur**
(authentification Discord) et non plus d'un sélecteur anonyme ; en attendant, les 19 quêtes de classe
s'affichent tant que le compte n'a pas déclaré sa classe. Voir `docs/plans/PLAN-ESPACE-VISITEUR.md`.

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

**V3 livrée le 12/11/2026 — combat, donjon au choix et monstres** : la colonne
`GuideSequence.constraints Json?` porte aussi `combat` (5 modes : solo, groupe, tactique,
solo à vagues, groupe à vagues — monstres ×N, niveau, PV), `dungeonChoice` (jusqu'à 8
donjons avec boss, niveau, visuel et note) et `bashMobs` (espèces à combattre). L'éditeur
les cherche dans le catalogue local (`searchMonstersForDefi`, `searchDungeonsLocal`),
affiche les portraits réels et un aperçu membre ; les trois surfaces rendent les cartes
(`RushCombatCard`, `RushDungeonChoiceCard`, `RushBashMobsCard`). Zod borné (5 modes, 20
monstres, 8 donjons, 20 espèces). **Aucune migration** (la colonne JSON existe depuis V2).
Reste : **backfill des données Tougli** (les 1 085 contraintes → `constraints`, dry-run/apply)
et reprise éditoriale.

## 5. Bloc S3 — La trame (chronologie Dofusyelle)

| Lot | Contenu | Source | État (21/11/2026) |
|---|---|---|---|
| **S3-1** | Bloc de préparation (21 piliers, options alternatives) | `prep` Dofusyelle | non mesuré |
| **S3-2** | Saves de donjons (40) comme état par donjon, pas comme quête | `donjons.save` | non mesuré |
| **S3-3** | Avertissements éditoriaux (spans `red` / `orange` = « contournable ») | `body` Dofusyelle | non mesuré |
| **S3-4** | Succès (62) rattachés aux étapes | `succes` Dofusyelle | non mesuré |

> Aucun de ces lots n'a de **statut mesuré** : la table ne portait que le contenu et la source.
> À confirmer (existence en base, compteurs) avant de le traiter.

## 6. Bloc S4 — God (outillage de saisie)

| Lot | Contenu | État |
|---|---|---|
| **S4-1** | **Vue Branches à 2 étages** (cité → Ordre, paires alignées, manques) — cible **100/102** | **livré** le 23/10/2026 (`src/lib/rush-branches.ts`, onglet God, 9 verrous) · **corrigé le 27/10/2026** : ① le classement compare les codes d'Ordre **normalisés** (source unique `rush-order-codes`) au lieu des ids courts du catalogue — sans quoi les **30 quêtes d'Ordre importées** tombaient « hors branche » (**+3 cas**) ; ② le tri des « paires » utilise l'**ordre du bloc** puis l'ordre interne (`blockOrder`), et non plus `seq.order` seul qui repart à 0 dans chaque bloc ⇒ la table était triée **par alphabet** (« L'exorciste », 100ᵉ quête, en position **68** → **99** après correctif, mesuré en base) (**+2 cas**) |
| **S4-2** | Édition des champs de route sur une séquence **existante** | ✅ **livré** le 26/10/2026 — section « 7. Route » du formulaire d'édition (cité / Ordre / palier / classe), avec les codes d'Ordre **canoniques** |
| **S4-3** | Case **optionnel** par donjon (S0-6) | ✅ **livré le 22/10/2026** avec S0-6 (PR #1091) — la mention « bloqué migration » était **périmée** : la colonne `dungeonOptionalIds` existe depuis `20270115000000_rush_dungeon_state`, appliquée en prod le 22/10 |
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



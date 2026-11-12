# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 12/11/2026 (suite 5) — **Rang 59 · Une seule quête, deux textes (lot 4, `routeVariants`)** — branche `feat/rush-route-variants`

> **Décision user (verbatim)** : « Une quête avec deux textes (je fais la modification de la base) » — lot 4 de l'amorce, après avoir écarté « deux quêtes Jumelle » (déjà en place, mais deux lignes à cocher et une progression comptée deux fois).
> **Fait** : colonne **`routeVariants Json?`** sur `GuideSequence` — migration **additive** `20261112170000_add_route_variants` (`prisma migrate dev` exigeait un **drop** de la base locale : refusé, SQL écrit à la main puis `migrate deploy`) ; schéma Zod borné (2 camps × 2 champs, nom ≤ 200, conseils ≤ 4000) ; résolution dans **`resolveRushRoute`** (`applyRouteVariant`) — le point par lequel passent le guide membre, le guide public **et** l'overlay : une règle, trois surfaces ; studio : section **« 🎭 Texte par camp »** (2 × nom + conseils), `isDirty` et payload ; serveur : `parseRouteVariants` + refus net d'une forme invalide, `null` efface.
> **Preuves** : `rush-route-variants` **15** (neuf) · `rush-route` 14 · `rush-route-tooling` 19 · `rush-twin-branch` 13 · `rush-sequence-inspector` **18** (« neuf accordéons » → **dix**, justifié : la section du lot 4) · suite **666 fichiers / 7 153 tests ✓** · `tsc` 0 · ESLint 0 erreur.
> **Reste / ops (humain)** : **jouer la migration en bêta puis en prod** (`npx prisma migrate deploy`) et **redémarrer `npm run dev`** (client Prisma régénéré) ; contrôle visuel de la section dans le studio et d'un texte qui change avec le camp.
> **Lot 5 — brouillon local livré le 12/11/2026** : le formulaire de quête persiste une saisie non enregistrée **par quête** (`rush-editor-draft:<id>`, Zod borné, fail-closed), l'annonce « Brouillon restauré » + « Jeter », et la jette à l'enregistrement ; `key={selectedQuest.id}` force une instance PAR quête (le formulaire gardait sinon la quête précédente). Règle pure `src/lib/rush-editor-draft.ts` · verrou `rush-editor-draft` **9** · suite **667 fichiers / 7 162 tests ✓**.
> **Rotation** : bloc « 11/11/2026 (suite 3) — Chantier 4/5 · Finitions anonymes » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 12/11/2026 (suite 4) — **Rang 59 · Reset automatique au changement de cité/Ordre (lot 3)** — branche `feat/rush-reset-auto`

> **Demande user (verbatim)** : « fais 3-4 » — lot 3 de l'amorce : « Reset de progression au changement de cité/Ordre = **OUI**, automatique, sur le personnage sélectionné (mule comprise), avec annonce de ce qui a été décoché ».
> **Mesure** : le reset existait (`resetAlignmentQuests` / `resetOrderQuests`) mais vivait dans le **formulaire** `AlignmentChoiceForm` ; `updateUserProfile` et `updateMuleAlignment` acceptaient `alignment` / `alignmentOrder` et écrivaient **sans aucun reset** — l'onboarding et les fiches profil pouvaient changer de camp en laissant les coches de l'ancien. Et le `cleared` calculé était **jeté** : le joueur lisait « Alignement mis à jour » sans savoir ce qui avait été décoché.
> **Fait** : règle pure `alignmentChangeReset` (cité prioritaire, sinon Ordre, sinon rien ; fail-closed sans Ordre quitté) ; helper serveur `resetProgressOnAlignmentChange` (`src/server/rush-alignment.ts`) appelé **avant l'écriture** par `updateUserProfile` (principal) et `updateMuleAlignment` (mule, `characterSlot = pseudo`) ; les deux actions renvoient `{ cleared }` et le formulaire **annonce** « X quêtes de l'ancien camp décochées » ; les actions manuelles `resetAlignmentProgress` / `resetRushOrderProgress` sont **supprimées** (une seule source).
> **Preuves** : `rush-alignment-auto-reset` **12** (neuf) · `rush-alignment-source` **15** · `rush-order-reset` **8** · `rush-alignment-tranche` **8** · suite **665 fichiers / 7 138 tests ✓** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : lot **4** (variante de texte par camp) — **bloqué** par le choix `routeVariants` (migration) vs quêtes « Jumelle ». Le reset précède l'écriture : si l'upsert échoue juste après, la progression reste décochée (comportement identique à l'ancien formulaire ; à durcir par une transaction si demandé).
> **Rotation** : bloc « 11/11/2026 (suite 3) — Chantier 4/5 · Finitions anonymes » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 12/11/2026 (suite 3) — **Rang 59 · Navigation par bloc dans les deux guides** — branche `feat/rush-nav-blocs`

> **Demande user (verbatim)** : « je veux que dans les guides navigateurs on ait tous ces fameux blocs là comme dans l'overlay » · « supprime le "tout" pour ne conserver que le mode paginé c plus performant non ? ».
> **Mesure** : le sommaire listait les **chapitres** (5 sur la route Bontarien) et une page = UN chapitre montait jusqu'à **89 quêtes** ; « Tout » rendait les **54 blocs** de la route d'un coup. Le guide public paginait **déjà par bloc** (`chapterPages` = un `ms` + ses bannières) ; seul le dashboard était resté au chapitre.
> **Fait** : `RushChapterNav` liste **tous les blocs numérotés** (`rushChapterNumbers`, le même rang que l'en-tête de bloc et l'overlay), chapitre en mention secondaire (`.da-guide-nav-sub`, tokens `--da-*`), API `selectedMilestoneId` / `onSelectMilestone` ; le dashboard passe à **une page = un bloc** (`blockPages`, `showHeader: false`), le bouton **« Tout »** et l'état `isAllChapters` sont supprimés, et les liens internes (repère, prérequis, « Reprendre ») visent le **bloc** (`seqToMs` + `ensureMsFor`) ; le public branche la même sélection. `src/lib/rush-guide-pages.ts` (`mergeChapterPages`) est supprimé — plus aucun appelant.
> **Corrigé le 12/11/2026 (retour user)** : ① « quand on clique sur suivant ça rescroll plus haut » — le pager ancre désormais sur `#guide-blocs` (`scrollToGuideTop`), plus sur le haut de la page ; ② le rail de droite (progression, donjons à prévoir, objets requis) est calculé sur le **bloc** affiché (`selectedMilestoneId`, prioritaire sur le chapitre) — il annonçait « 1 / 89 quêtes » et 20 donjons pour un bloc de 2 quêtes.
> **Preuves** : `rush-block-navigation` **13** (neuf, dont 4 pour le rail et l'ancre) · `da-wakfu` **54** · `rush-public-parity` **48** · suite **664 fichiers / 7 126 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**, aucune server action modifiée.
> **Reste** : contrôle visuel 390/768/1024/1440 (sommaire 54 blocs, pager, rail sur le bloc).
> **Rotation** : bloc « 11/11/2026 (suite) — Chantier 2/5 · Échanges Metamob » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 12/11/2026 (suite 2) — **Rang 59 · « Problèmes » : deux incohérences de route** — branche `feat/rush-problemes-route`

> **Demande user (verbatim)** : « 2 contrôles "Problèmes" (quête de classe sans classe, quête d'alignement sans cité) » — puis, sur la mesure : « c du bolulot qui marchera que en local non ? sur le vps c différent ».
> **Mesure (base locale 5433, 715 séquences — seed, **PAS** la prod)** : les **19** quêtes de classe portent **toutes** `classReq = cra` → 18 sortent pour la mauvaise classe. Une recherche par sous-chaîne est inutilisable (« Cania » → cra, « Srambad » → sram, « Ecaflipus » → ecaflip) ; en **mot entier**, seules **4** quêtes citent une classe (« Iop et hop », « Braquage à la Roublard », « Zobal Hibaba… » déclarées `cra`, « Sram d'Égoutant » sans classe). `alignOrderCode`/`alignLevelReq` sans `alignReq` = **0**. Corriger le seed local serait du travail jetable (le VPS a ses éditions God) ⇒ **aucune correction de données** : seul le contrôle est livré, et il lit les données de l'environnement où God ouvre l'onglet.
> **Fait** : `rush-editor-problems` passe de **5** à **7** familles — `class-quest-misrouted` (le nom cite une classe, en **mot entier**, et `classReq` en déclare une autre ou aucune ; détail « dit iop · route cra ») via `classMentionedInName` (mot entier, sans casse ni accent, source unique `DOFUS_CLASSES`) et `alignment-quest-without-camp` (un Ordre ou un palier sans cité sort dans les deux camps) ; `detail` optionnel sur la cible, affiché à droite de la ligne.
> **Preuves** : `rush-editor-problems` **22** (+9) · voisins `rush-class-branches` 10 · `rush-branches-cockpit` 8 · `rush-route-tooling` 19 ✓ · suite **664 fichiers / 7 119 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**, aucune server action modifiée, aucune lecture base depuis le studio (la règle reste pure).
> **Reste** : contrôle visuel de l'onglet avec les deux nouvelles familles ; en prod le compte peut différer du local — c'est l'écran qui dit la vérité. Lots suivants : **3** (reset auto) → **13** (flaky).
> **Rotation** : bloc « 11/11/2026 — Chantier 1/5 · Hub Communauté SigilOS » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 12/11/2026 (suite) — **Rang 59 · Numérotation des blocs : une seule règle pour les deux guides et l'overlay** — branche `feat/rush-numerotation-blocs`

> **Demande user (verbatim)** : « Numérotation des blocs dans les 2 guides navigateur (même règle que l'overlay) » — décision actée le 12/11 : « **OUI** — même règle que l'overlay (`rushChapterPosition`) ».
> **Mesures** : ① le guide **membre** numérotait avec `msIdx + 1` alors que sa liste ne porte **que les blocs d'un chapitre** (`milestoneList`) : chaque page repartait à 1 ; ② le guide **public** numérotait avec `milestones.indexOf(ms) + 1`, **bandeaux compris** : les numéros sautaient dès qu'un séparateur ou un encart s'intercalait ; ③ l'overlay suivait déjà la bonne règle (`rushChapterPosition`, bandeaux exclus) — trois surfaces, deux numérotations.
> **Fait** : règle pure `rushChapterNumbers(blocks)` (`src/lib/rush-guide-utils.ts`) — table `id → rang` en O(n), construite sur `isNonCheckableBlock` ; `rushChapterPosition` **en dérive** (une seule source). Chaque parent calcule la table **une fois sur le guide complet** et la passe aux lignes : `blockNumbers` dans `RushTimelineClient` (prop `blockNumber` de `MilestoneRow`, fin de `blockIndex = msIdx + 1`) et dans `PublicRushGuideClient` (fin de `milestones.indexOf(ms)`). Un bloc non numéroté affiche une chaîne vide, jamais « 0 ».
> **Preuves** : verrou neuf `rush-block-numbering` **5** (les deux guides et l'overlay sur la même règle, absence des deux anciens calculs) · `rush-guide-utils` **+4** (table, bandeaux absents, rang identique à `rushChapterPosition`, guide vide) · suite **664 fichiers / 7 110 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**, aucune server action modifiée.
> **Reste** : contrôle visuel 390/768/1024/1440 (un guide avec séparateurs : la suite des numéros ne doit plus sauter) ; puis **2** (deux contrôles « Problèmes ») → **3** (reset auto) → **13** (flaky), selon l'amorce.
> **Rotation** : bloc « 10/11/2026 (suite 3) — V-H corrigé par la mesure » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 12/11/2026 — **Rang 59 · E2b + E2c + E2d : cockpit Branches, écrans plats, inspecteur en 3 groupes et modale large** — branche `feat/studio-e2`

> **Demande user (verbatim)** : « j'ai vraiment du mal avec …/rush-sylvestre … j'ai besoin d'avoir un visuel où mon cerveau va capter direct et où je vais être efficace pour ajouter des quêtes, faire des modifs à la volée » · « l'onglet branche : c'est juste une lecture ? » · « l'onglet lancement … devrait prendre toute la page aussi ; l'onglet config aussi non ? » · « go pour la soluce 1 » (E2a → E2c → E2b).
> **Mesures** : ① le panneau Branches ne recevait que `view`, `classView` et `milestones` — **aucun callback** : lecture seule par design (`RushEditorStudio.tsx:5249`), donc **aucun geste** possible ; ② **Lancement** et **Config** étaient plafonnés à `max-w-xl` (**576 px**) → deux tiers de page vide ; ③ le monolithe faisait **5 472 lignes** (`SequenceEditForm` 1 606 l. à lui seul).
> **Fait** : `panels/RushBranchesCockpit.tsx` — 6 Ordres × 5 paliers + **19 classes cliquables** : un emplacement **rempli** ouvre la quête dans l'inspecteur (`selectQuest`), un emplacement **vide** ouvre la création **pré-remplie** (cité + Ordre + palier + classe) par `AddSequenceForm.defaultRoute`, et le bandeau **Problèmes** (orphelins, sans palier, classe inconnue, conflit cité/classe) est cliquable ; `panels/RushRoutePreview.tsx` et `fields/RushClassSelect.tsx` sortis du studio ; **Lancement** et **Config** en 2 colonnes pleine largeur (aperçu **membre réel** du pense-bête, effet de chaque interrupteur, état du guide). Studio **5 472 → 5 264 lignes**, dette DA **644 → 594**.
> **Fait (E2b)** : inspecteur quête en **3 groupes** (`src/lib/rush-editor-sections.ts` + `fields/SectionGroupHeader.tsx`) — Essentiel (identité, **route**, conseils), Contenu (destination, prérequis, ressources, liens), Avancé (alignement, options) — les **9** accordéons numérotés 1→9 (dont **deux « 8 »**) disparaissent au profit des groupes ; **pied sticky** (Enregistrer / Annuler + « ● Non enregistré ») ; **« Déplacer vers » remonté en tête** ; scission derrière un menu « … » avec sa confirmation en tête. Studio **5 297 lignes**, dette DA **594 → 577**.
> **Fait (E3a)** : la **route du bloc** (cité / Ordre / palier / classe) est montée **dans l'inspecteur** — elle vivait sous la ligne dépliée de la liste ; le **séparateur** s'édite au même endroit (`blockBeingEdited` n'exclut plus les séparateurs, le dernier formulaire inline de la liste disparaît) ; les **quêtes du bloc** y sont listées, cliquables, avec « + Quête ». Verrou `rush-block-inspector` **9**.
> **Fait (E3b)** : onglet **« Problèmes »** — règle pure `src/lib/rush-editor-problems.ts` (bloc vide, quête sans conseil, sans lien DofusDB, sans ressource, quête d'Ordre sans palier), chaque ligne **ouvre** la quête ou le bloc, **pastille de compte** dans la barre ; **menu « … »** par ligne de quête (jumelle, 3 Ordres, suppression) au lieu de boutons déguisés en badges. Verrou `rush-editor-problems` **11**.
> **Corrigé + E2b-suite (1/2), 12/11/2026** : ① dans « Problèmes », `selectQuest` **ne quittait pas l'onglet** — aucun clic ne semblait fonctionner ; il bascule maintenant sur **Contenu**. ② « + 324 autres » était mort : la règle coupait à **12** cibles ; elle rend désormais **toutes** les cibles et le panneau **pagine** (12 puis 50 par clic). ③ le formulaire de quête **masque les 7 sections vides** (`hidden`, pas de démontage) avec un bouton **« Tout afficher »** ; l'identité et les options avancées ne sont jamais masquées.
> **Vocabulaire unifié, 12/11/2026** (retour user : « je comprends rien, l'overlay dit 54, le guide 5, God autre chose ») : le mot « **étapes** » comptait des **quêtes** dans l'overlay, le dashboard et le guide public, et des **blocs** dans `OptimizedGuideClient` — trois chiffres incomparables pour le même guide. Désormais : **quête** (ligne cochable) · **bloc** (regroupement du guide) · **chapitre** (regroupement de blocs, la pagination 1/5). Verrou `rush-vocabulary` **3**.
> **Preuves** : `rush-branches-cockpit` **8** (neuf, dont un **rendu réel** `renderToStaticMarkup`) · `rush-sequence-inspector` **14** (neuf) · `rush-block-inspector` **9** (neuf) · `rush-editor-problems` **11** (neuf : les 5 familles, le comptage, les 12 cibles max, le câblage de l'onglet) · `rush-route` **+3** (`alignmentSetContradictsCamp`) · `rush-public-parity` **+3** (route publique à 3 étages) · `rush-route-tooling` repointé sur le **dossier** · `rush-editor-shell` : les **4** fichiers neufs sont aux tokens · suite **662 fichiers / 7 092 tests ✓** · `tsc` 0 · ESLint **0 erreur** · **aucune migration**, aucune server action modifiée.
> **Reste** : contrôle visuel 390/768/1024/1440 (cockpit, création pré-remplie, Lancement/Config, 3 groupes + pied sticky) ; **E2b-suite** (sections vides masquées avec « tout afficher », brouillon local par quête) puis **E2d-suite** (aperçu « guide 100 % » + overlay : exige une route d'aperçu God, le studio n'a **aucun `guildId`**) ; E3 → E4 → E5.
> **Corrigé le 12/11/2026 (hors E2)** : le guide public passait **seulement la cité** à `resolveRushRoute` — un visiteur voyait **15** quêtes d'Ordre (3 × 5) au lieu de 5 et **19** variantes de classe au lieu d'une. Il passe désormais les **trois** étages (`camp`/`order`/`playerClass`), avec l'ordre du profil visiteur et la classe du **personnage sélectionné** (mule comprise) ; verrou étendu dans `rush-public-parity`.
> **Rotation** : bloc « 10/11/2026 (suite 2) — V-H donjons ocre » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

















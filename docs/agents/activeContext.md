# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 07/11/2026 (suite 2) — **Guide public : alignement réglable, mules, en-tête (V2a-4/V2a-5)** — branche `feat/rush-public-surface-ui`

> **Demande user (verbatim)** : « le bandeau avec les trois alignement […] doit disparaitre > le conseil aussi », « mon espace visiteur doit bouger ailleurs […] dans le gros bandeau », « pk pas juste rendre cliquable son pseudo pour changer de perso », « peut-on lancer un rush sur un mule déclaré en mode connecté ? », « Alignement : pas cliquable pour changer comme l'interne », « Metamob : idem », « l'image floue […] renommer en aventure rush sylvestre + icône du dofus », « l'affichage niveau et succès est moche en bas, prends la place à droite », « espace vide entre rush live et ouvrir overlay », « une vrai icône pour ouvrir overlay », « tout doit être responsive ».
> **Mesures** : ① `PublicProfile.alignment` **n'avait aucune action** (l'interne passe par `resetRushAlignment(guildId, …)` — pas de `guildId` visiteur) ⇒ chaîne complète à créer ; ② `PublicProfileView` ne portait **pas** `alignmentOrder` (ajouté au DTO **et** au `select`) ; ③ `AlignmentChoiceForm` (interne) est câblé sur les actions de **guilde** ⇒ formulaire visiteur dédié ; ④ les filets `<span>` des tuiles étaient rendus **hors** des gardes `visitor` ⇒ les trois tirets orphelins vus chez l'anonyme ; ⑤ la progression est clé par `characterSlot` (texte) ⇒ une mule est un emplacement comme un autre.
> **Fait** : « Ma cité » → sous-menu radio de « Options » (`PublicRouteChoice` supprimé, orphelin) · conseil « Niv. 200 » retiré des **deux** surfaces · « Mon espace visiteur » dans le bandeau du titre · pseudo cliquable · **Metamob cliquable** · **alignement cliquable** (`updatePublicAlignment` + `PublicAlignmentModal`, Ordre vérifié contre la cité) · **mules déclarées** dans la modale personnage · anonyme = ni Metamob ni Rush Live **et plus aucun filet orphelin** · en-tête : image de fond supprimée, « Aventure Rush Sylvestre », **Dofus sur la ligne du titre** (`da-logo-line`), porte visiteur · tuile : chiffres **à droite**, plus de `ml-auto` sur Overlay, **picto réel** `modules/guide.png`.
> **Preuves** : `public-alignment` **10** · `rush-public-parity` **46** · `public-guide-visitor` **10** · suite **635 fichiers / 6 710 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V2a-2** (Progression Communautaire — « l'avancement des dofus entre visiteurs du même serveur » n'existe pas encore) → **V2a-4 reste** (modale d'entrée + tour) → **V2a-5 reste** (« Réinitialiser » dans la barre) → V2a-6 → V2b → V2c → V2d → V3. **Ops** : contrôles 390 / 768 / 1 024 / 1 440, connecté **et** anonyme.
> **Rotation** : bloc « 06/11/2026 (suite 9) — l'onglet Succès (V1i) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 07/11/2026 — **Guide Rush public : la surface connectée alignée sur l'interne (V2a-3)** — branche `feat/rush-public-connecte`

> **Demande user (verbatim)** : « UI UX encore mauvaise », « je voudrais ceci [vue interne] » — puis, devant les trois schémas d'anatomie, « 1 · Fusion ».
> **Mesures** : ① `PublicProfileView` porte **déjà** `metamobPseudo` + `metamobVerified` (et `showPresence`) et réduit la clé au booléen `hasMetamobApiKey` ⇒ la tuile Metamob n'exige **ni requête, ni SELECT, ni migration** ; ② le client public n'a **aucune** présence : sa tuile Rush Live ne peut donc dire que « présence indisponible » (formulation déjà employée par l'interne, `RushTimelineClient` l. 2310) ; ③ la recherche du public vivait **hors** du bandeau, dans la colonne du détail ; ④ quatre des cinq entrées du menu « Options » interne n'ont **aucune source** côté visiteur.
> **Fait** : bandeau V2a-1 **fusionné** dans la tuile « Personnage actif » (pseudo, serveur, niveau, points de succès, porte espace visiteur — `visitor` reste le **seul** garde, anonyme inchangé) ; **cinq tuiles** dans l'ordre interne avec **Metamob** (règle pure `metamobState`, 3 états) et **Rush Live** (div non interactive, aucun compteur) ; rangée **« Rechercher une quête » + Options** entre les tuiles et la progression — la densité a quitté la barre du haut, le champ a quitté la colonne du détail (un seul `searchQuery`) ; DTO de **sept scalaires**.
> **Preuves** : `public-guide-visitor` **10** (liste blanche des identifiants `metamob*`, clé non recopiable même passée en entrée, `metamobState` ×3) · `rush-public-parity` **42** (ordre des 5 tuiles, Rush Live honnête, recherche+Options entre tuiles et progression) · suite **634 fichiers / 6 699 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V2a-2** (Progression Communautaire) → **V2a-4** (modale classe → alignement → lancer, tour rejouable ; « Revoir le tour » ira dans **Options**) → **V2a-5** (titre « Rush Dofus Sylvestre » + icône + image nette + « Ma cité » compacte + « Réinitialiser » remonté) → **V2a-6** (CTA profil anonyme) → V2b → V2c → V2d → V3. **Ops** : contrôles 390 / 768 / 1 440 sur le guide connecté, le guide anonyme, `/visiteurs` et la barre « Explorer ».
> **Rotation** : bloc « 06/11/2026 (suite 8) — Reprise documentée : l'ordre et le prochain lot » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 13) — **Guide public : le bandeau du visiteur (V2a-1)** — branche `feat/visiteur-guide-connecte`

> **Demande user (verbatim)** : « fais les 3 » (V1e, V1d, V2a).
> **Mesures** : ① le guide public ne savait pas **qui** le lisait (aucune identité, même connecté) ; ② `PublicProfile.dofusLevel/successPoints` sont remplis depuis V1e — le bandeau peut donc afficher des chiffres réels ; ③ les tuiles de l'interne qui dépendent d'une guilde (Metamob, Rush Live) **n'ont aucune source** côté visiteur : les rendre aurait été un mensonge.
> **Fait** : bandeau au-dessus du guide (classe + pseudo, serveur icône + nom, niveau, points de succès, lien espace visiteur) ; DTO de **cinq scalaires** (`src/lib/public-guide-visitor.ts`) ; `getPublicAccount()` appelé **seulement s'il y a une session** — anonyme = zéro requête, guide inchangé.
> **Preuves** : `public-guide-visitor` **6** · `rush-public-parity` 39 (le client n'importe toujours aucun `@/server/`) · suite **634 fichiers / 6 692 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V2a-3** (surface connectée = anatomie interne) → **V2a-2** (Progression Communautaire) → **V2a-4/5/6** (modale classe>alignement>lancer + tour rejouable, en-tête « Rush Dofus Sylvestre » + image nette + « Ma cité » compacte, CTA profil anonyme) → V2b → V2c → V2d → V3. **Brief UI complet du 06/11 : `PLAN-ESPACE-VISITEUR.md` §5 « refonte de la surface Rush public ».** Limite assumée : `resources` reste locale. **Ops** : contrôles 390 / 768 / 1 440 sur le guide connecté (bandeau) et anonyme.
> **Rotation** : bloc « 06/11/2026 (suite 7) — vérifications (D-V16) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 06/11/2026 (suite 12) — **Espace visiteur : ladder (V1e) + progression en base (V1d)** — branches `feat/visiteur-ladder`, `feat/visiteur-progression`

> **Demande user (verbatim)** : « fais les 3 » (V1e, V1d, V2a).
> **Mesures** : ① le snapshot Ankama vivait **inline** dans `updateUserProfile` (`profile-actions.ts` l. 843-887) ; `PublicProfile.dofusLevel/totalXp/successPoints/lastLadderSync` existaient mais **personne ne les remplissait** ⇒ annuaire à « — » ; ② `PublicRushProgress.characterSlot` était un **`Int`** quand les trois tables `PlayerGuide*` portent une **chaîne** (`"PRINCIPAL"` / pseudo) et que la clé invitée est un texte (`pseudo-serveur`) ; ③ la table était **vide par construction** (aucun writer).
> **Fait (V1e)** : noyau extrait dans `src/server/ladder-snapshot.ts` (bornes dures, fail-open, timeout 6 s), branché deux fois côté visiteur (enregistrer l'identité, vérifier **son propre** pseudo). `classe` jamais écrite depuis le ladder (libellé ↔ id).
> **Fait (V1d)** : Zod borné `src/lib/public-rush-progress.ts` (300 blocs / 500 étapes / 2 000 donjons), store `src/server/rush-public-store.ts` (garde, rate limit, `guideId` constant, `skipDuplicates`), actions minces ; guide : adoption **une fois par emplacement**, miroir débouncé 2 s, reset ciblé, **aucun appel** si non connecté ; **migration** `20270128000000_public_rush_progress_slot_text` (Int → String, **D-V20**).
> **Preuves** : `ladder-snapshot` **8** · `public-rush-progress` **15** · `public-profile-schema` **16** · `tsc` 0 · ESLint 0 erreur · **1 migration** (298 au total).
> **Reste** : **V2a** (guide connecté + Progression Communautaire) → V2b → V2c → V2d → V3. Limite assumée : `resources` (5ᵉ clé locale) reste locale. **Ops** : `npx prisma migrate deploy` en **bêta** + redémarrer `npm run dev` (client Prisma régénéré).
> **Rotation** : bloc « 06/11/2026 (suite 6) — assets (D-V15) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 06/11/2026 (suite 11) — **Annuaire des visiteurs (V2e)** — branche `feat/visiteur-annuaire`

> **Demande user (verbatim)** : « moi je veux qu'on continue et avance les chantier profil perso landing, annuaire landing (dispo uniquement connecté) le guide rush loggé discord visiteur ».
> **Mesures** : ① `/guilds` existe (annuaire public des **guildes**), aucune route visiteur ; ② `PublicProfile` porte déjà `showOnDirectory` (fermé), `dofusServerId` obligatoire et `PublicProfession` — l'annuaire ne demande **aucune migration** ; ③ `PublicHeader` rend `localizedNav`, donc un lien conditionnel suffit sans nouvelle coque ; ④ la landing redirige **tout** compte connecté (QG ou espace visiteur) : une section « visiteurs » sur `/` n'aurait été vue de personne — l'entrée vit donc dans l'en-tête, pas sur la landing.
> **Fait** : `/visiteurs` + `/visiteurs/<id>` (connectés seulement, `noindex`), filtres classe/métier **sans JavaScript** (`<details>` + assets réels), recherche bornée 40, pagination par curseur `id` ; règles pures `src/lib/public-directory.ts`, requêtes `src/server/public-directory.ts` (`showOnDirectory` + serveur du lecteur, **aucun `guildId`**) ; DTO sans mule / Metamob / `userId` ; **barre publique regroupée** (Guides + Guildes + Visiteurs sous « Explorer », « Guides »/« Guildes » voisins étant illisibles) avec **un asset Dofus par entrée**, menu `<details>` natif (liens dans le HTML, donc indexables).
> **Preuves** : `visitor-directory` **18** · `public-header-nav` **6** · `tsc` 0 · ESLint 0 erreur · ROADMAP **61 266 / 61 440** · **aucune migration**.
> **Reste** : **V1d** (progression en base — décision d'emplacement texte à trancher) → V1e → **V2a** (guide connecté + Progression Communautaire) → V2b → V2c → V2d → V3. **Ops** : contrôles 390 / 768 / 1 440 sur `/visiteurs`, compte sans admin, puis `PUBLIC_VISITOR_ENTRY=1`.
> **Rotation** : bloc « 06/11/2026 (suite 5) — coque publique (D-V14) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 06/11/2026 (suite 10) — **Espace visiteur : les écrans alignés sur l'interne** — branche `feat/visiteur-succes`

> **Demande user (verbatim)** : « moi j'aurai voulu l'interface semblable à l'interne (conserve ton design) sans le bouton créer groupe », « le lien vers sa fiche publique », « les images des boss », « ajoute les avis », « le bouton anomalie cliqué n'est pas flagrant », « les métiers reprend l'interface interne profil guilde », « icône laide du choix du serveur, plus grande », « doublon des icônes affichées serveur et classe ».
> **Mesures** : ① l'icône était rendue **deux fois** (une dans `SelectTrigger`, une rejouée par `SelectValue` depuis l'item) ; ② les avis de recherche sont des `Bounty` (`isBountyMonster`, 96 lignes), **sans aucun succès** ; ③ `DOFUS_JOBS`/`JOB_CATEGORIES` portent déjà les quatre catégories et les icônes des métiers ; ④ l'état actif `bg-elevated` était indistinguable du fond.
> **Fait** : onglet Succès en **liste + fiche** (vignette du boss, niveau, progression, tranche à gauche ; succès en grille, « Tout cocher / Tout décocher », lien fiche à droite), portée **Donjons / Avis**, action `togglePublicDungeonAchievementsGroup` (garde, 20/min, donjon relu), aucun bouton de groupe ; onglet **Métiers** refait sur `jobs-grid.tsx` (onglets par catégorie, cartes, icônes réelles) ; icônes serveur/classe en `size-6` et **doublon supprimé** ; états actifs des filtres en `warning`.
> **Preuves** : `visitor-succes-brackets` **21** · `visitor-metiers-ui` **5** · `visitor-assets` **6** · suite **629 fichiers / 6 636 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : V1d (progression en base) → V1e (ladder) → V2a-e → V3. **Ops** : contrôles 390 / 768 / 1 440 sur Succès (deux portées) et Métiers, compte sans admin, puis `PUBLIC_VISITOR_ENTRY=1`.
> **Rotation** : bloc « 06/11/2026 (suite 4) — porte d'entrée (D-V13) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.













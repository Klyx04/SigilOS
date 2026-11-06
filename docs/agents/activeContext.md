# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

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


## 📝 Session 06/11/2026 (suite 9) — **Espace visiteur : l'onglet Succès (V1i)** — branche `feat/visiteur-succes`

> **Demande user (verbatim)** : reprise sur le prochain lot documenté (« un peu paumé là », puis validation du plan V1i).
> **Mesures** : ① `LEVEL_PRESETS` vivait **privé** dans `SuccesTracker.tsx` (l. 76-82) et ses libellés affichaient « Niv. 1-200+ » pour la tranche « Tous » ; ② la page visiteur ne lisait ni `level`, ni `slug`, ni `imageUrl`/`challenge.iconUrl` ; ③ `/boss/[dungeonId]` accepte le **slug** et redirige en 308 vers le canonique ; ④ `PublicDungeonAchievement` porte déjà `@@unique([publicProfileId, dungeonAchievementId])` — `skipDuplicates` est sûr.
> **Fait** : règle pure `src/lib/succes-level-brackets.ts` (5 tranches, résolution **stricte** côté serveur, borne `SUCCES_DUNGEONS_TAKE = 200`) ; tracker interne migré sur un **id de tranche** (plus de liste locale, libellés corrigés) ; action `togglePublicDungeonAchievementsBracket` (Zod borné, 5/min, `where` sur le profil public, cibles relues, `createMany skipDuplicates`) ; onglet visiteur : filtre par tranche, bascule « Valider / Décocher la tranche », icône réelle par succès, lien `/boss/<slug>`.
> **Preuves** : `visitor-succes-brackets` **15** · 10 verrous visiteurs **88 ✓** · suite **628 fichiers / 6 623 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : V1d (progression en base) → V1e (sync ladder) → V2a-e → V3. **Ops** : contrôles 390 / 768 / 1 440 sur `/espace-visiteur/succes`, compte sans admin, puis `PUBLIC_VISITOR_ENTRY=1`.
> **Rotation** : bloc « 06/11/2026 (suite 3) — plafond de guildes » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 8) — **Reprise documentée : l'ordre et le prochain lot** — branche `dev`

> **Demande user (verbatim)** : « tout est documenté ? pour reprendre dans une prochaine session les prochaines iterations ».
> **Constats** : ① le rang 57 affichait encore « démarre après `L3` », périmé depuis huit lots ; ② le plan ne décrivait **pas V1i** (le prochain lot), seuls les lots livrés y figuraient ; ③ l'amorce volatile précédente avait été supprimée sans remplacement conforme au nommage de `zone-volatile.md`.
> **Fait** : rang 57 → « prochain : **V1i** » ; `PLAN-ESPACE-VISITEUR.md` §5 décrit V1i (tranches exactes, `Dungeon.level`/`slug`, action batch, lien boss, verrou de parité) ; mémo de reprise daté `src/temp/memo-2026-11-06-espace-visiteur.md` (volatile, hors git) ; `activeContext` refermé.
> **Preuves** : `harness-config` 9 ✓ (ROADMAP sous la limite) · aucune ligne de code touchée · **aucune migration**.
> **Reste** : V1i → V1d → V1e → V2a-e → V3. **Ops** : contrôles 390 / 768 / 1 440, compte sans admin, trois boutons « Vérifier », puis `PUBLIC_VISITOR_ENTRY=1`.
> **Rotation** : bloc « 06/11/2026 (suite 2) — les six écrans (V1c) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 7) — **Espace visiteur : les vérifications (D-V16)** — branche `feat/visiteur-verifications`

> **Demande user (verbatim)** : « v1h oui et enchaine ensuite » — vérification du pseudo ladder Ankama + repli manuel du toggle God, et vérification du pseudo/clé Metamob comme l'interne.
> **Mesures** : ① `checkPseudoExistsOnLadder` vivait **privée** dans `profile-actions.ts` et `verifyDofusPseudo` exige `getUserContext(guildId)` (membre) ⇒ inutilisable pour un visiteur ; ② `updatePublicMetamob` renvoyait la vérification au worker de V1e (`metamobVerified = false`) ; ③ le toggle God (`PlatformConfig.ladderManualFallback`) existait mais n'était lu que par l'interne.
> **Fait** : helper **extrait** dans `src/server/ladder-pseudo.ts` (une seule mesure pour les deux vies) ; actions `verifyPublicPseudo` (garde session, Zod, rate limit 10/min, toggle God puis ladder) et `verifyPublicMetamob` (garde compte, rate limit 5/min, `/v1/me`, écriture `where: { userId }`) ; boutons « Vérifier » dans Identité, Mules (serveur du profil) et Metamob ; messages uniques via `src/lib/pseudo-verification.ts` (fail-open assumé).
> **Preuves** : `visitor-verifications` **8** · suite **627 fichiers / 6 608 tests ✓** · `tsc` 0 · ESLint 0 erreur · `harness-config` 9 ✓ · **aucune migration**.
> **Reste** : **V1i** — onglet Succès (tranches de niveau, icônes, validation par tranche, liens vers les fiches boss) → V1d → V1e → V2a-e → V3.
> **Rotation** : bloc « 06/11/2026 (suite) — double cross-check » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 6) — **Espace visiteur : les assets du produit (D-V15)** — branche `feat/visiteur-assets`

> **Demande user (verbatim)** : « icone serveur · icone classe · tooltip comment trouver sa clé metamob comme l'interne · […] présentation > activité préférés : icones assets · […] idem métier les icones enfin faut reprendre comme l'interne profil ».
> **Mesures** : ① `DOFUS_CLASSES[].icon`, `DOFUS_JOBS[].icon`, `ACTIVITY_ASSETS` et `public/assets/dofus/servers/*.webp` (13 serveurs) existaient déjà — rien à créer ; ② `ALL_DOFUS_SERVERS` désignait déjà la liste de **noms** validée côté serveur, d'où la collision corrigée en `ALL_DOFUS_SERVER_ENTRIES` ; ③ un asset absent est servi en 404 par `/_next/image` (issue Sentry documentée).
> **Fait** : icône du serveur dans le sélecteur (déclencheur + items) via `ALL_DOFUS_SERVER_ENTRIES` (source unique) ; icône de classe dans Identité **et** Mules ; `ACTIVITY_ASSETS` sur les activités ; `DOFUS_JOBS[].icon` sur les métiers ; lien « Où trouver ma clé API ? » (`metamob.fr/settings#api`) dans le formulaire Metamob.
> **Preuves** : `visitor-assets` **4** (13 serveurs + activités + classes + métiers existent sur disque) · verrous visiteurs **31** (routes 12 · coque 6 · entrée 9 · assets 4) · suite **626 fichiers / 6 600 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V1h** — vérification du pseudo (ladder Ankama, repli manuel si le toggle God est actif) et du pseudo Metamob, comme l'interne → **V1i** — refonte de l'onglet Succès (tranches, liens boss) → V1d → V1e → V2a-e → V3.
> **Rotation** : bloc « 06/11/2026 — socle de données + garde d'entrée (V1a/V1b) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



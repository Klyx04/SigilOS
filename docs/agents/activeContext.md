# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

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


## 📝 Session 06/11/2026 (suite 5) — **Espace visiteur : la coque publique (D-V14)** — branche `feat/visiteur-coque`

> **Demande user (verbatim)** : « t mignon mais c fait expres de pas mettre le footer / header landing quand on est loggé visiteur ? […] il retrouve ou les guides les pages le rush les outils etc ? et pk ya aucun asset dans les onglets ? ».
> **Mesures** : ① D-V6 (« aucun chrome de **guilde** ») avait été appliqué comme « aucun chrome du tout » ⇒ le visiteur n'avait plus aucun lien vers la landing, les guides, le rush ou les outils, seule sortie « Se déconnecter » ; ② `visitor-nav.tsx` était du texte nu alors que `public/assets/dofus/game-icons/` et `assets/nav/` fournissent les six pictos sans créer un fichier ; ③ le piège documenté (asset absent ⇒ 404 `/_next/image`) impose un verrou sur l'existence des chemins.
> **Fait** : le layout rend `PublicHeader` (`dashboardHref="/espace-visiteur/general"`, donc « Tableau de bord » reste dans l'espace) + bandeau « Espace visiteur » + `VisitorNav` + `GalacticFooter` ; `SignOutButton` maison retiré (la déconnexion vit dans le menu avatar) ; six onglets avec assets réels (`party`, `guilde-et-mules`, `parchment`, `trophy-1`, `hammer`, `assets/nav/cog.png`) via `GameIcon`.
> **Preuves** : `visitor-shell` **6** · routes 12 · entrée 9 (**27** sur les 3 verrous) · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V1g** — parité des formulaires avec l'interne (icônes serveur/classe, aide + vérif Metamob, ladder Ankama, mules avec repli manuel, activités en vignettes, métiers en icônes) → refonte de l'onglet Succès (tranches, liens boss) → V1d → V1e → V2a-e → V3.
> **Rotation** : blocs « 05/11/2026 (suite 10) — E3e » et « (suite 9) — DA E3d » sortis (7ᵉ et 8ᵉ) — récupérables via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 4) — **Espace visiteur : la porte d'entrée (D-V13)** — branche `feat/visiteur-porte-entree`

> **Demande user (verbatim)** : « l'entrée visiteur (menu avatar « Mon espace visiteur » + /dashboard sans guilde → /espace-visiteur/general + même règle sur la landing), sans migration ».
> **Mesures** : ① aucun lien de l'interface ne menait à `/espace-visiteur` (seulement `robots.ts` et la garde serveur) ; ② `/dashboard` sans guilde rendait `NoGuildMessage` (cul-de-sac) ; ③ la landing ne repliait que `active`/`pending` ; ④ `sign-in-policy.ts` et `.env.example` annonçaient encore « après V1c », périmé depuis #1281 ; ⑤ un admin Discord sans guilde déployée ressort en `pending`/`awaiting`, jamais `isEmpty` ⇒ la redirection ne coupe pas le tunnel de déploiement.
> **Fait** : règle pure `shouldOpenVisitorSpace` (`src/lib/visitor-entry.ts`) + garde `redirectGuildlessUserToVisitorSpace` (`src/server/visitor-entry.ts`) appelée par `/dashboard` et la landing — **une seule source**, fail-closed (interrupteur fermé, Discord en échec) et **anti-boucle** (compte banni re-vérifié par `getPublicSession` avant `redirect`, sinon `/` ⇄ espace) · entrée « Mon espace visiteur » dans le menu avatar (tout compte connecté, D-V2) · `nav.visitorSpace` en fr **et** en · commentaires périmés corrigés.
> **Preuves** : `visitor-entry` **9** · suite **624 fichiers / 6 590 tests ✓** · `tsc` 0 · ESLint 0 erreur · `harness-config` 9 ✓ · **aucune migration**.
> **Reste** : V1d (progression en base + adoption) → V1e (ladder) → V2a-e → V3. **Ops** : contrôles à 390 / 768 / 1 440 puis `PUBLIC_VISITOR_ENTRY=1` en bêta, avec un compte Discord **sans admin**.
> **Rotation** : bloc « 05/11/2026 (suite 9) — DA E3d » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite 3) — **Plafond de guildes : le tiroir ne contourne plus la limite** — branche `fix/plafond-guildes-portail`

> **Demande user (verbatim)** : « il a bien la limite affiché le déploiement grisée pour d'autres guilde mais quand il passe par le bouton "mes guildes" sur son profil le bandeau qui s'affiche lui permet d'onboardé c quoi ce bordel ! il y a combien de trous comme ca ».
> **Mesures** : ① le tiroir `dashboard-drawer.tsx` listait `pending` avec un lien d'invitation **sans lire le plafond** ; ② `getGuildsSeparated()` ne rendait pas l'état, donc `/dashboard` le recalculait pour lui seul ; ③ `onboardGuild` créait `AllowedGuild` (whitelist) **avant** la garde G2 ; ④ sa branche de réactivation rendait `success` **avant** `requireGuildAdmin` (un identifiant de guilde suffisait). Le déploiement était déjà refusé par G2, et le bot Discord comptait déjà les profils ACTIVE — pas de trou de ces deux côtés.
> **Fait** : `guildLimitReached` + `guildLimit` rendus par `getGuildsSeparated` (fail-closed, God exempté, **source unique**) ; le portail les consomme sans recompter ; le tiroir réemploie `resolveGuildSetupView` (« Déploiement verrouillé », aucune invitation) ; `onboardGuild` borne l'id (Zod), **autorise d'abord** (`requireGuildAdmin` avant la réactivation), puis G2 **avant** `allowedGuild.create`.
> **Preuves** : `guild-limit-guards` **13** (+4) · suite **623 fichiers / 6 581 tests ✓** · `tsc` 0 · ESLint 0 erreur · build vert · **aucune migration**.
> **Reste** : contrôle à l'écran (tiroir à 2 guildes, 390 / 1 440) · V1c livré (PR #1281).
> **Rotation** : bloc « 05/11/2026 (suite 8) — DA E3c » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

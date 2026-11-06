# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 06/11/2026 (suite 5) — **Espace visiteur : la coque publique (D-V14)** — branche `feat/visiteur-coque`

> **Demande user (verbatim)** : « t mignon mais c fait expres de pas mettre le footer / header landing quand on est loggé visiteur ? […] il retrouve ou les guides les pages le rush les outils etc ? et pk ya aucun asset dans les onglets ? ».
> **Mesures** : ① D-V6 (« aucun chrome de **guilde** ») avait été appliqué comme « aucun chrome du tout » ⇒ le visiteur n'avait plus aucun lien vers la landing, les guides, le rush ou les outils, seule sortie « Se déconnecter » ; ② `visitor-nav.tsx` était du texte nu alors que `public/assets/dofus/game-icons/` et `assets/nav/` fournissent les six pictos sans créer un fichier ; ③ le piège documenté (asset absent ⇒ 404 `/_next/image`) impose un verrou sur l'existence des chemins.
> **Fait** : le layout rend `PublicHeader` (`dashboardHref="/espace-visiteur/general"`, donc « Tableau de bord » reste dans l'espace) + bandeau « Espace visiteur » + `VisitorNav` + `GalacticFooter` ; `SignOutButton` maison retiré (la déconnexion vit dans le menu avatar) ; six onglets avec assets réels (`party`, `guilde-et-mules`, `parchment`, `trophy-1`, `hammer`, `assets/nav/cog.png`) via `GameIcon`.
> **Preuves** : `visitor-shell` **6** · routes 12 · entrée 9 (**27** sur les 3 verrous) · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : **V1g** — parité des formulaires avec l'interne (icônes serveur/classe, aide + vérif Metamob, ladder Ankama, mules avec repli manuel, activités en vignettes, métiers en icônes) → refonte de l'onglet Succès (tranches, liens boss) → V1d → V1e → V2a-e → V3.
> **Rotation** : bloc « 05/11/2026 (suite 10) — E3e » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


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


## 📝 Session 06/11/2026 (suite 2) — **Espace visiteur : les six écrans (V1c)** — branche `feat/espace-visiteur-v1c`

> **Demande user (verbatim)** : « on reprend l'espace visiteur (lot V1c, rang 57) » · « DTO étanche […] `metamobApiKey` ne sort jamais » · « `touchLastSeen()` dans `requirePublicAccount()` » · « la migration `drop_declared_guild_logo` est DÉJÀ approuvée ».
> **Mesures** : ① `getPublicAccount()` rendait la ligne Prisma **entière** et le hook de `src/lib/prisma.ts` déchiffre `metamobApiKey` ⇒ fuite RSC **latente** (aucun appelant alors) ; ② `touchLastSeen` n'avait **qu'un** appelant (`getUserContext`) ; ③ D-V5 (**365 j**) écrite mais le cron passait encore **90** ; ④ `PublicProfession.metierId` était un `Int` **sans référentiel stable** (ids dérivés de l'ordre des tableaux).
> **Fait** : **DTO étanche** (`src/lib/public-profile-dto.ts` : `select` explicite, `hasMetamobApiKey`, mules/activités normalisées) · gardes `requirePublicSession` (création) et `requirePublicAccount` (6 segments) avec **`touchLastSeen`** · **une migration** `20270127000000_visitor_profile_v1c` (logo retiré, `altPseudos` JSON, `metierId` en **texte**) · 6 segments `/espace-visiteur/*` + `loading`/`error` · **10 actions** bornées (Zod, rate limit, `where: { userId }`, cible relue) · **D-V10** (vie publique seule si profil ACTIVE) · export JSON · rétention **365 j** · robots.
> **Preuves** : suite **623 fichiers / 6 576 tests ✓** · 5 verrous visiteur (**49** cas : DTO, routes, actions, schéma, rétention) · `tsc` 0 · ESLint 0 erreur · migration **appliquée** (**297**).
> **Reste** : **porte d'entrée** (menu avatar + redirection `/dashboard` → `/espace-visiteur/general`, **aucune migration**) **avant** l'activation → V1d (progression en base + adoption) → V1e (ladder) → V2a-e → V3. **Ops** : `PUBLIC_VISITOR_ENTRY=1` en bêta après contrôle à l'écran (390 / 768 / 1 440).
> **Rotation** : bloc « 05/11/2026 (suite 7) — DA E3 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 06/11/2026 (suite) — **Espace visiteur : double cross-check + décisions V1c** — branche `docs/espace-visiteur-decisions`

> **Demande user (verbatim)** : « double cross check c'est primordial » · « vulgarise un peu les points à trancher » · « 365 jrs pour tous » · « reparcourir toute ta mémoire de l'ensemble des discussions précédentes pour maj exhaustivement les chantiers ».
> **Mesures** : ① l'état physique est exact (dev `87cbc95d`, 0 PR, arbre propre, **296** migrations, 24/24 chemins cités, 5 verrous = **49** cas verts) mais **8 écarts documentaires** ; ② **`getPublicAccount()` rend `metamobApiKey` déchiffrée** (`findUnique` sans `select` + hook `result.publicProfile`) ⇒ fuite dans le payload RSC dès le premier écran ; ③ **`touchLastSeen` n'a qu'un appelant** (`getUserContext`) ⇒ un visiteur n'est **jamais** marqué « vu » et serait purgé malgré des visites quotidiennes ; ④ la purge ne touche **jamais** un membre actuel (`profiles: { none: { status: "ACTIVE" } }`) ; ⑤ `User.rushServerVisible` (D-V4) **n'existe pas** — c'est `PublicProfile.showOnDirectory` + `showPresence` ; ⑥ le panneau par Dofus **n'existe pas** dans le guide public, seulement dans l'interne (`GuildStatusPanel`, l. 168).
> **Fait** : **D-V1→D-V12** verrouillées (`PLAN-ESPACE-VISITEUR.md`) : route `/espace-visiteur/<segment>`, **aucun logo** (colonne retirée par migration), **Progression Communautaire** (panneau par Dofus + blocs + donjons requis / « à faire »), **Succès Donjons** visiteurs (boss + titans + avis), suppression « vie publique seulement », **`touchLastSeen` dans la garde**, guide public connecté = bandeau interne (5 tuiles, recherche + Options entre les deux blocs). **D-V5 révisée** : rétention **365 j pour tous**. ROADMAP rang 57 réécrit, `AGENTS.md` (6 538 tests), `.env.example` (`PUBLIC_VISITOR_ENTRY`).
> **Preuves** : suite **619 fichiers / 6 538 tests ✓** · `harness-config` **9 ✓** · verrous visiteur **49 ✓** · ROADMAP **61 276 o / 61 440** (marge **164 o**).
> **Reste** : **V1c** (écrans + DTO étanche + `touchLastSeen` + migration logo) → V1d → V1e → V2a-e → V3. **Ops** : migration à jouer, `PUBLIC_VISITOR_ENTRY=1` en bêta après V1c.
> **Rotation** : bloc « 05/11/2026 (suite 6) — Songes : clôture unique » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 06/11/2026 — **Espace visiteur : socle de données + garde d'entrée (V1a/V1b)** — branche `feat/espace-visiteur`

> **Demande user (verbatim)** : « reprenons l'espace visiteur » · « un espace perso : onglet général identique avec fallback pseudo manuel même mécanique que l'interne… » · « obligatoirement choisir un serveur … ça populera tout seul sa page ladder » · « pas d'accent, apostrophe et tiret ok, Majuscule OK » · « feu ».
> **Mesures** : ① rien n'existait (`PublicProfile`/`PublicRushProgress` : **0 occurrence**) ; ② `UserDungeonAchievement` pointe `UserProfile`, cloisonné par guilde ⇒ table dédiée ; ③ le ladder interne se synchronise par un **worker** (`DOFUS_LADDER_WORKER_URL`, `server_id` + pseudo) ⇒ le serveur devient **obligatoire** ; ④ **10 actions serveur** cloisonnées par guilde ne vérifient qu'une session ⇒ ouvrir `signIn` les exposerait à tout compte Discord.
> **Fait** : **V1a** = 4 tables (`PublicProfile` avec `dofusServerId` NOT NULL et deux consentements fermés, `PublicRushProgress`, `PublicProfession`, `PublicDungeonAchievement`), migration additive `20270126000000_public_profile`, chiffrement Metamob étendu au profil public (create/update/updateMany + lecture), règle pure du nom de guilde + Zod. **V1b** = décision de connexion extraite en règle pure (`src/lib/sign-in-policy.ts`), `signIn` branche la porte visiteur, garde `requirePublicAccount` (session + bannissement + profil). **Audit** = les 10 actions cloisonnées qui ne vérifiaient qu'une session portent `assertGuildMemberAccess` (ladder ×10, activité ×3, présence, réglages système), `isGod` sur les sessions God, et les **6 modules `"use server"` sans authentification** sont **sortis du dossier d'actions** (noyaux déplacés dans `src/server/` : plus une surface appelable), verrouillé par test.
> **Preuves** : **49 tests neufs** verts · `tsc` 0 · ESLint 0 erreur · migration appliquée (**296**, base « up to date ») · suite complète **6 538 ✓ / 619 fichiers** (aucun échec) — chiffres **re-mesurés** le 06/11 (le bloc annonçait 46 / 297 / 6 535).
> **Reste** : activation de la porte à **V1c** (`PUBLIC_VISITOR_ENTRY=1`, l'écran d'installation n'existe pas encore) · V1c (profil) → V1d (progression/adoption) → V1e (sync ladder) → V2 (annuaire + présence) → V3 (God).
> **Rotation** : bloc « 05/11/2026 (suite 5) — DA E2 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

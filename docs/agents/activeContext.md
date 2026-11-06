# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

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
> **Reste** : V1d (progression en base + adoption) → V1e (ladder) → V2a-e → V3. **Ops** : `PUBLIC_VISITOR_ENTRY=1` en bêta après contrôle à l'écran (390 / 768 / 1 440).
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


## 📝 Session 05/11/2026 (suite 10) — **Guide public : le bandeau et le panneau ne font plus qu'une carte (E3e)** — branche `feat/rush-panneau-public-parite`

> **Demande user (verbatim)** : « moi je veux que tu mettes ce bloc dans le bloc du titre rush sylvestre, supprime les lignes explicatives slop sur "rush sylvestre", centre "rush sylvestre" en gros et aligne les boutons comme l'interne en dessous » — puis, sur la divergence des deux panneaux : « pk on propose pas le même que l'interne ? ».
> **Mesures** : ① deux panneaux pour la même intention — le public portait 4 boutons en grille + **deux** barres de progression (une de 160 px dans la rangée, un `reg-progress` global plus bas), l'interne 5 tuiles + une barre ; ② `Rush Live` et `Metamob` n'ont **aucune source publique** (présence de guilde, compte lié) : les aligner sans donnée aurait affiché des tuiles vides ; ③ le bandeau vivait dans `page.tsx` (serveur) et le panneau dans le client, donc deux cartes ; ④ `{!isUnderConstruction && (…)}` était **du code mort** : il vivait dans la branche `isUnderConstruction ? … : …` (les chips « ~370 étapes » et « sauvegarde locale » ne s'affichaient jamais).
> **Fait** : le bandeau est **rendu par le client** (`heroArt` en prop, `children` supprimé) et contient le panneau — **une seule carte** ; titre **centré** (`clamp(44px, 8.6vw, 92px)`), sous-titre et chips supprimés, fil d'Ariane calé à gauche ; panneau `da-guide-controls` (fond opaque + filet, jamais une boîte dans une boîte) à l'anatomie interne : barre du haut (niveau + route + Ressources/Pense-bête/Masquer), tuiles **Personnage actif · Alignement · Ouvrir Overlay**, progression **pleine largeur** et **unique** ; code mort et 2 imports retirés.
> **Preuves** : suite **6 489 ✓ / 614 fichiers** · `tsc` 0 · ESLint **0 erreur**, 7 829 avertissements (−1) · **5 verrous réécrits** (`rush-public-parity` ×4 : grille 4 colonnes → barre + tuiles, doublon `reg-progress` ; `rush-guide-ui-polish` ×2 : panneau `.da-guide-controls`, une seule carte ; `rush-sylvestre-construction` ×1 : client auto-fermant), **aucun supprimé** · un `lot4-slash-commands` instable, non reproduit sur deux passes.
> **Reste** : tuiles **Metamob** et **Rush Live** dès que l'espace visiteur (rang 57) fournira la donnée · **E4** (passation dashboard) · captures 390 / 768 / 1 440 px.
> **Rotation** : bloc « 05/11/2026 (suite 4) — le guide public reçoit sa coque (E2) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 05/11/2026 (suite 9) — **DA « Gouache Wakfu » : le reste des guides (E3d)** — branche `feat/da-wakfu-e3d-reste`

> **Demande user (verbatim)** : « enchaine » — après les 12 modales, l'étape 2 du brief : « panneaux de bloc du guide interne, `MilestoneRow` garde `bg-surface`/`border-border`/`bg-elevated`, 80 occurrences de tokens produit ».
> **Mesure qui contredit le brief** : ces 69 chaînes étaient **déjà bridgées** par `[data-da].rush-guide` (`globals.css`) — elles peignent donc `--da-*` depuis E2. Comptage réel sur les deux guides : **0** rayon > 12 px, **0** ombre, **0** `backdrop-blur`, **0** `font-black`, **0** couleur dure `zinc`/`emerald`/`indigo`. Les réécrire n'aurait rien changé au rendu et aurait cassé des verrous pour rien. `guide-styles.css` (85 Ko, 256 hex, 273 rgba) est **vivante** : elle sert `OptimizedGuideClient`, l'autre guide — autre chantier, pas une feuille morte.
> **Ce qui restait vraiment hors DA** : ① `--font-cinzel` sur deux titres du guide interne (chip de camp, bandeau « Dofus obtenu ») **et** sur `MilestoneCelebrationBurst` — la DA a tranché pour Barlow Condensed dès E1b ⇒ `var(--da-font-title)` / `.da-title` ; ② **six** italiques décoratifs (4 guide interne, 2 guide public), proscrits par le déslop ; ③ `Cinzel` **retirée** du layout overlay : plus un seul usage dans la route, trois graisses de moins à télécharger dans la PiP qui flotte au-dessus du jeu ; ④ `bg-zinc-950 text-zinc-100` du `<body>` overlay → `bg-background text-foreground` (les 2 seuls avertissements `sigil/no-hardcoded-colors` du fichier).
> **Preuves** : suite **6 487 ✓ / 614 fichiers** (un run intermédiaire a signalé 1 échec, non reproduit sur deux passes complètes) · `tsc` 0 · ESLint **0 erreur**, 7 830 avertissements (−2) · `da-wakfu` **51** (+2 : plus de Cinzel dans la route, plus d'italique dans les deux guides, assertions négatives sur source décommentée) · **aucun verrou supprimé** · aucune migration.
> **Reste** : **E4** (passation dashboard) · la décision **A/B** du panneau de contrôle public à 1 440 px · `guide-styles.css` (ancienne UI, vivante via `OptimizedGuideClient`) · contrôle à l'écran 390 / 768 / 1 440 px.
> **Rotation** : bloc « 05/11/2026 (suite 3) — l'overlay est habillé (E1e) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.










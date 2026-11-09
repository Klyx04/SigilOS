# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 09/11/2026 (suite 5) — **Le proxy images est réparé ; les cibles sans image sont nommées** — branche `fix/ocre-cibles-sans-image`

> **Constat user (verbatim)** : « les 4 blops sont encore ko on dirait » — après le déploiement de `1f18c008`.
> **Mesures (bêta `1f18c008` puis `438fa26a`)** : ① le **proxy télécharge** — `curl` rend **5 482 octets** (`image/webp`) pour `monsters/646?…&sprite=1`, et `logs app` n'a **aucun** `[assets-dofus]` d'échec (les 118 octets vus via `Invoke-WebRequest` venaient de la sonde, pas du serveur). ② Le log de diagnostic a **nommé exactement 4 cibles** non résolues : `Blop Coco Royal`, `Blop Griotte Royal`, `Blop Indigo Royal`, `Blop Reinette Royal` — sur 337. ③ **Cause trouvée** : le `where` filtrait `type in (archimonstre, boss)` ; ces 4 lignes existent mais leur `type` varie selon la source du seed, donc elles étaient **invisibles** alors que la table les connaît (aucune n'est absente, `imageUrl` n'est pas nulle).
> **Fait** : `getMyOcreProgress` **nomme** les cibles sans image résolue (`logger.warn`, noms de monstres seuls) ; le chargement de `Archimonstre` **ne filtre plus par `type`** — la clé de rapprochement est le **nom**, et un même nom désigne la même créature (`where: imageUrl ou dofusdbId non nul`).
> **Preuves** : `rush-overlay-ocre` **49** (verrou repointé sur l'absence de filtre `type`) · suite **6 873 tests ✓** · `tsc` 0 · aucune migration.
> **Reste** : redéployer, ouvrir le panneau et confirmer `unresolved: []` dans `logs app` ; chantier **rang 61** (`souverainete-images`) pour ne plus dépendre du réseau.
> **Rotation** : bloc « 08/11/2026 (suite 3) — Profil dashboard (P1 → P4) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 09/11/2026 (suite 4) — **Deux bruits Sentry : 429 Metamob et clé chiffrée** — branche `fix/sentry-bruit-429-krala`

> **Constat user** : deux Issues à chaque passage — `[updateUserMonsterQuantityAction] Error: Trop de requêtes` et `[Calendar] Failed to sync Krala counts in list: Erreur 400 de l'API`.
> **Mesures** : ① `updateUserMonsterQuantityAction` appelait `logger.error(...)` **avant** de distinguer un 429 Metamob, alors que le retour porte déjà `retryAfterMs: 30_000` et que le client met sa file en pause — cas **prévu**, pas une panne ; ② `calendar-actions.ts` passait `userProfile.metamobApiKey` **brute** à `getKralamoureEvents` : la clé est **chiffrée en base** (`decrypt` est utilisé par `getMyOcreProgress` et `updateUserMonsterQuantityAction`), donc l'amont répondait **400**. `event-actions.ts` avait le même défaut latent (il importait `decrypt` sans l'appliquer à cette clé).
> **Fait** : le 429 est loggué en `warn` (le `logger.error` ne couvre plus que les vrais échecs) · le calendrier et les événements **déchiffrent** la clé avant l'appel, sinon n'envoient aucun en-tête · l'échec Krala du calendrier passe en `warn` (config utilisateur / amont, pas le produit), aligné sur `getGuildKralamoureEvents` (mesure du 18/10/2026).
> **Preuves** : `sentry-bruit-metamob` **3** (neuf) · suite **644 fichiers / 6 868 tests ✓** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : confirmer dans Sentry que `JAVASCRIPT-NEXTJS-2M` / `-2N` cessent d'arriver après déploiement ; sinon la cause est ailleurs et il faudra la stack exacte.
> **Rotation** : bloc « 08/11/2026 (suite 2) — V2f : le menu, les vérifications, l'onglet Élevage (F12→F17) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 09/11/2026 (suite 3) — **Vignettes Ocre iso partout + proxy qui dit pourquoi il échoue** — branche `fix/ocre-vignettes-guide-payload`

> **Demande user (verbatim)** : « le probleme est aussi présent dans le bandeau metamob des par dofus … j'ai un pb certain asset s'affiche tjrs pas dans l'overlay non plus … le fix doit etre global partout et iso ».
> **Mesures (bêta `8fde214b`, déploiement automatique confirmé)** : ① `page.tsx` du guide faisait `ocreMonsters = monsters` et `DofusQuestBanner` castait les monstres bruts (`as unknown as OcreMonsterLite[]`) ⇒ **`imageUrl` n'existait jamais** sur ces deux surfaces, donc repli `.webp`/`.png` (404) malgré le correctif d'`getMyOcreProgress`. ② Tous les sprites `?sprite=1` renvoient le placeholder (`X-SigilOS-Placeholder: 1`, **118 octets**) alors que `api.dofusdb.fr/img/monsters/<n>.png` répond **200, ~20 Ko** — et `monsters/646` (entité) répond **404** (« No record found ») : le nombre est bien un `gfxId`. ③ `Archimonstre` contient bien les cibles (ex. `Blop Griotte Royal` = `img/monsters/646.png`), donc le rapprochement par nom fonctionne ; l'écart « Kaskapointe »/« Kaskapoin**th**e » reste un cas de graphie à traiter séparément.
> **Fait** : les **deux surfaces** qui perdaient l'image passent désormais par la même conversion `toOcrePanelData` (source unique, iso) ; la route `/api/assets-dofus` **logge la cause** d'un échec de téléchargement (le `catch` muet cachait une panne totale de siphonnage), le placeholder restant un PNG 1×1 transparent `no-store`.
> **Preuves** : `rush-overlay-ocre` **48** (+2 verrous iso) · `assets-dofus-diagnostic` **2** (neuf) · suite **644 fichiers / 6 869 tests ✓** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : lire `logs app` après déploiement pour nommer la cause du refus de téléchargement (SSRF/DNS/`sharp`/budget), puis corriger au bon étage ; traiter les graphies de noms divergentes (« Kaskapointe »).
> **Rotation** : bloc « 08/11/2026 (suite) — V2f : l'overlay respire (F8→F11) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 09/11/2026 (suite 2) — **Rôles Discord du cycle de vie d'essai (V1)** — branche `feat/roles-essai-v1`

> **Demande user (verbatim)** : « J'aimerai pouvoir propose en option l'ajout d'un rôle discord quand on met quelqu'un à l'essai depuis sa modale membre … un second settings à la fin d'essai : pouvoir ajouter un rôle automatiquement / en supprimer un ».
> **Mesure** : le socle existait déjà et n'était **pas branché** — `GuildConfig.arrivingRoleId` / `trialRoleId` / `confirmedRoleId` (migration `20261012000000`), `getGuildLifecycleData` qui les expose, `updateMemberLifecycleConfig` qui les écrit, et `addGuildMemberRole` / `removeGuildMemberRole` (`src/server/discord.ts`, `PUT|DELETE …/members/{u}/roles/{r}`, fail-closed, `X-Audit-Log-Reason`). Il manquait **l'UI**, la **persistance dans les réglages** et **l'application**. Constat de sécurité : `getGuildRoles` (bonus) est ouvert à tout membre et **ne filtre pas la hiérarchie** → inutilisable ici. `/valider-recrue` porte déjà les rôles d'**arrivée** (`addRoleId` / `removeRoleId`, panneau `SlashCommandsRbacPanel`) : aucune 2ᵉ source créée.
> **Décision (user)** : validation **automatique** (la case « me montrer avant » part en V2, avec une migration) ; `/valider-recrue` applique **aussi** `trialRoleId` quand elle démarre un essai, **sans changer sa modale**.
> **Fait** : règle pure `filterAssignableRoles` / `highestRolePosition` (`src/lib/discord/assignable-roles.ts`) — `@everyone`, rôles `managed` et tout rôle ≥ `min(bot, staff)` écartés, fail-closed si la position du bot est inconnue ; action `getAssignableTrialRoles` (RBAC `isAdmin || canManageMembers`, positions bot + staff lues en direct) ; `updateTrialEndSettings` persiste `trialRoleId` / `confirmedRoleId` (`undefined` = ne pas toucher, `null` = retirer) et **refuse** un rôle non attribuable ; `setMemberTrialState` applique `+ trialRoleId` au démarrage, `+ confirmedRoleId` / `− trialRoleId` à la validation, chaque refus Discord remonté dans le message (jamais un faux « ok ») ; un départ retire le rôle d'essai sans bloquer l'archivage ; écran **Paramètres ▸ Fin d'essai** = 2 sélecteurs Radix thémés (tokens, aucun contrôle natif).
> **Preuves** : `assignable-roles` **7** + `trial-roles` **9** (neufs) · `membres-essai-fixes` / `registre-membres-b2` / `deslop-membres` verts (verrou « pas de `valider-recrue` dans cet écran » respecté) · suite **643 fichiers / 6 861 tests ✓** · `tsc` 0 · ESLint 0 erreur.
> **V2 (même branche)** : case **« Me montrer avant d'appliquer les rôles »**, persistée par `GuildConfig.trialConfirmRoleChange` — **migration additive** `20261109000000_add_trial_confirm_role_change`, défaut `false` (aucune guilde ne change de comportement). `setMemberTrialState` **refuse** toute validation non confirmée quand elle est active (fail-closed via `rolesConfirmed`), et la fiche membre ouvre une fenêtre à cases (`applyConfirmedRole` / `removeTrialRole`) : décocher un geste ne l'applique pas. Garde de déslop respectée (rayon `rounded-lg`, pas `rounded-xl` dans la fiche).
> **Reste** : contrôle à l'œil (Paramètres ▸ Fin d'essai **et** fiche membre, 390 / 768 / 1440). **Ops** : `npx prisma migrate deploy` sur la bêta puis la prod, et redémarrer `npm run dev` en local (le client Prisma est régénéré).

## 📝 Session 09/11/2026 (suite) — **Ocre : la vignette vient de la table locale, jamais de l'id Metamob** — branche `fix/ocre-vignettes-archis-boss`

> **Demande user (verbatim)** : « je comprends pas on vient de passer un fix session précédente mais tjrs ko sur le vps pour les images des archi et des boss dans les boutons metamob sur sigilos (overlay, rush sylvestre, par dofus etc) ».
> **Mesures (VPS, clé `agent-ro2` en lecture seule)** : bêta = `8869dfcf`, 4 conteneurs `Up 7 minutes` ⇒ le `#1324` **était bien déployé** (pas un retard de déploiement). `curl` : `/uploads/assets-dofus/monsters/347.webp` → **404** · `/assets/dofus/monsters/347.png` → **404** (**0** des 17 ids vus en console n'existe au dépôt) · `/api/assets-dofus/monsters/347` → 200 mais **118 octets** = PNG transparent 1×1 · `/api/assets-dofus/monsters/2508` → **4 596 octets** de WebP. Côté source d'images : `monsters/347` → `No record found`, et `2508` = **« Kirevam »**, un AUTRE monstre que « Kiroyal le Sirupeux ». `sigilos.fr` (prod) sert une **page d'attente statique** (`Last-Modified 24/09/2026`, `/assets/maintenance.css`) : hors sujet.
> **Cause racine** : `getMyOcreProgress` → `normalizeQuestMonster` pose `image` = URL **Metamob** absolue, que `ocreMonsterImageUrl` refuse par design ⇒ `imageUrl === null` sur les **337** cibles ; la chaîne retombait sur `.webp` puis `.png` (404) puis picto. Le `#1324` avait ajouté le maillon `imageUrl` **sans source**, et l'`id` affiché est un id **Metamob** : le proxy par id d'entité renvoie soit un 1×1, soit **l'image d'un autre monstre**.
> **Fait** : `getMyOcreProgress` résout l'image **par nom** dans `Archimonstre` (`type in archimonstre|boss` → `internalDofusDbImageUrl`, espace apparence `?sprite=1`, repli `normalizeDofusAssetStoredUrl` sur `dofusdbId`) et l'écrit dans `norm.image` ; la chaîne de vignette devient la **règle pure** `ocreMonsterThumbChain(id, type, imageUrl)` — le WebP local `/uploads/…` n'est plus retenté quand le serveur a résolu l'image (un 404 de moins par vignette) ; `OcreTargetBits` ne code plus aucun chemin.
> **Preuves** : `rush-overlay-ocre` **46** (2 cas neufs + 1 repointé, jamais affaibli) · suite **641 fichiers / 6 847 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : contrôle à l'œil après déploiement bêta (modale « Mon Ocre » de l'overlay **et** du dashboard, filtres Gardiens/Archis) — une cible sans ligne dans `Archimonstre` garde le picto (comportement inchangé, aucun 404). **Ops** : `./scripts/deploy-cd.sh beta` (action humaine).
> **Rotation** : bloc « 07/11/2026 (suite 4) — Responsive : le skill devient un cliquet vérifié » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 09/11/2026 — **Ocre public ISO + hero de l'overlay plafonné** — PR #1315 · #1316

> **Demandes** : ① « Metamob public ISO avec l'interne » — panneau unique, peau DA, options Gardiens/Archis + zones, filtres Tous/Possédés/Manquants, clé repliée, accusé d'écriture ; ② la **bande vide de 276 px** du hero de l'overlay en fenêtre courte.
> **Mesures** : ① la modale publique montait sa **propre** version de la quête Ocre (« Marquer ») quand l'interne a un panneau complet (liste, recherche, onglets, stepper ±1, retour d'écriture) ; ② la lecture publique était **bornée à 200** cibles pour une quête qui en compte **337** ⇒ troncature silencieuse ; ③ `.da-hero` en densité `wide` impose `min-height: min(276px, 30vh)` alors que le PiP n'a que **~100 px** de contenu ⇒ **~170 px** volés à la liste des quêtes (`flex-1`).
> **Fait** : **#1315** (mergée `bbf21678`) — `OcreQuestPanel` porte liste, recherche, onglets, stepper et retour d'écriture, et **les deux guides le montent** (la version publique « Marquer » disparaît) ; `daScopeProps(useDaTheme())` sur la modale publique (le guide monte déjà `DaThemeProvider`) ; compte vérifié ⇒ **clé repliée** derrière « Modifier » ; accusé « Enregistré sur Metamob » (debounce 650 ms déjà en place) ; onglets **Gardiens / Archis** + ligne **zone · subzone** (`/v1/quests/{slug}/zones`, **même** clé de cache Redis que l'interne) ; lecture **200 → 400** ; repli `.png` du dépôt avant le picto générique ; écriture publique par `useOcreWriteQueue` à **envoi injecté** (`patchPublicOcreMonster`) — même file, aucun chemin dupliqué ; règle pure `classifyOcreType`. **#1316** (mergée `ccf03710`) — `@media (max-height: 700px)` plafonne `wide` à la hauteur de `normal` (**112 px**) : CSS seul, grand écran intact, aucun contenu, bouton ni libellé déplacé.
> **Preuves** : `rush-overlay-ocre` **41** (repointé, pas affaibli) · `da-wakfu` **+2** (le plafond existe **et** la règle `276px / 30vh` reste intacte) · suite **640 fichiers / 6 840 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : V2f **F1→F7** (bandeau Dofus anonyme, export/import JSON, espacement, prérequis repliables, « ce que tu perds ») · **F16** (succès par donjon + succès en commun) · **F17b** (`?niveau=`) · **V2a-4 reste** (tour spotlight public) → V2b → V2c → V2d → V3 · profil **P2-ter** (30 classes de palette, 65 marqueurs slop). **Ops** : contrôle **390 px** de la modale publique, PiP court (~700 px) et grand écran.
> **Rotation** : bloc « 08/11/2026 (suite 3) — Profil dashboard : cliquet, un accent, 8 onglets (P1 → P4) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.








> **Rotation** : bloc « 06/11/2026 (suite 12) — ladder (V1e) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

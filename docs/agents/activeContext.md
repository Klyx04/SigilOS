# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 10/11/2026 — **Souveraineté S1b + S2 : le frigo est plein, le fil réseau est coupé** — branche `feat/souverainete-s2-hybride`

> **Décision user** : « remplis le frigo : les 456 images d'archimonstres et de boss », puis **mode hybride** pour S2.
> **Mesures** : ① siphon complet exécuté sur la bêta — **2 294 apparences**, `remaining: 0`, **1** seul 404 amont (`2179` « Membre de la Maoufia », sprite inexistant) ; ② après redéploiement, le volume **persiste** (`646` → 5 482 o), donc `assets-beta-data` fait son travail ; ③ un sprite en cache répond **0,122 s** contre **0,413 s** pour un téléchargement à la volée.
> **Fait** : `ASSETS_REMOTE_FETCH` (`src/lib/dofus-monster-assets.ts`, règle pure testée) — défaut **`false`** : le proxy ne sort **plus** pour un sprite, il sert le fichier siphonné, sinon le picto (`logger.warn`). Seule la valeur exacte `true` rallume le réseau, **sans redéployer**, le temps d'une MAJ de contenu. Le contrôle se fait **après** le service du fichier local, et **uniquement** pour l'espace apparence (`?sprite=1`) : items, sorts, succès et id d'entité gardent leur comportement actuel. Variable documentée dans `.env.example`.
> **Preuves** : `siphon-monster-assets` **10** · `assets-dofus-route` **19** (1 cas repointé sur l'interrupteur rallumé + 1 cas neuf « réseau coupé ⇒ aucun fetch ») · suite **646 fichiers / 0 échec** · `tsc` 0 · aucune migration.
> **Reste (S3/S4)** : script de couverture + alerte (une cible sans fichier doit être visible), cron quotidien de siphon, `?url=` retiré du DOM. **Ops** : déployer, puis vérifier qu'un sprite absent renvoie le placeholder **sans** requête sortante.
> **Rotation** : bloc « 09/11/2026 (suite 6) — S1 : le frigo se remplit hors ligne » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 09/11/2026 (suite 6) — **Rang 61 · S1 : le frigo d'images se remplit hors ligne** — branche `feat/souverainete-s1-siphon-monstres`

> **Demande user (verbatim)** : « remplis le frigo : les 456 images d'archimonstres et de boss ».
> **Mesure préalable** : le stockage est **déjà** un volume persistant (`assets-beta-data` / `assets-prod-data`, monté sur `/app/public/uploads/assets-dofus`, commenté « sinon remis à ~0 à chaque deploy ») — aucune décision de stockage à prendre, R2 n'apporterait rien (une instance, ~9 Mo).
> **Fait** : règle pure `gfxIdFromDofusDbImageUrl` / `spriteAssetFileName` (`src/lib/dofus-monster-assets.ts`) — l'espace **apparence** uniquement (`<gfx>.sprite.webp`), jamais la clé d'entité ; route `GET /api/cron/siphon-monster-assets` (fail-closed `CRON_SECRET`, **dry-run par défaut**, `limit` 1–200, `offset`, concurrence 4) qui remplit le cache et rapporte `total / alreadyThere / siphoned / failed / remaining`. **Déployée et exécutée sur la bêta** : 447 apparences, `remaining: 0`, `failed: 0` ; preuve de bout en bout `646` **0,122 s** (cache) contre `650` **0,413 s** (téléchargement). Le périmètre est ensuite **étendu à tous les types** (monstres compris) pour pouvoir couper le réseau sans multiplier les pictos.
> **Piège désamorcé** : le placeholder du proxy pèse **118 octets** — un seuil à 100 l'aurait pris pour une vignette valide et le siphon n'aurait **jamais** rien rempli. `MIN_SPRITE_BYTES = 500`.
> **Preuves** : `siphon-monster-assets` **7** (neufs) · suite **6 879 tests ✓** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste (S2)** : trancher le **mode réseau** — strict (picto sur le nouveau contenu), secours borné, ou hybride (recommandé : drapeau `ASSETS_REMOTE_FETCH=false` + cron quotidien) ; puis `?url=` retiré du DOM et script de couverture. La **chaîne de rafraîchissement des nouveautés DofusDB** est écrite dans `AMORCE-SOUVERAINETE-IMAGES.md` §8 : `data-watch` **ne surveille pas les monstres** aujourd'hui, et `Archimonstre` n'a **aucun siphon automatique** (seed + auto-heal God) — c'est le trou à combler avant de couper le réseau.
> **Rotation** : bloc « 09/11/2026 — Ocre public ISO + hero de l'overlay plafonné » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


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
> **Rotation** : bloc « 09/11/2026 (suite) — Ocre : la vignette vient de la table locale » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.













> **Rotation** : bloc « 06/11/2026 (suite 12) — ladder (V1e) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

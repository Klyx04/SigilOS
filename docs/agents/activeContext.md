# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 10/11/2026 (suite 2) — **Rang 10 · V-H : les donjons ocre disent « capturé / à capturer » et ouvrent le suivi** — branche `feat/rush-ocre-dungeon-state`

> **Demande user (verbatim)** : « Nous devons avancé sur la continuité du profil perso public et les chantiers rush sylvestre » → après F17b, **V-H** (donjons ocre).
> **Mesure préalable** : le schéma n'a **aucune relation `Dungeon → Monster`** ; l'ancien dashboard comparait les noms avec `includes` (faux positif « Bouftou » vs « Bouftou Royal ») et `getDungeons` marquait **tous** les donjons d'une séquence dès qu'un tag `ocre_dungeon` existait. La progression Metamob (`OcrePanelData.monsters`) est déjà dans le payload de l'overlay et du dashboard.
> **Fait** : règle pure `src/lib/ocre-dungeons.ts` (`normalizeOcreDungeonName`, `ocreDungeonCapture` → `captured | to-capture | unknown`) ; la carte partagée `RushOverlayDungeonCard` affiche « Ocre : capturé / à capturer » (sous-ligne) et un bouton qui ouvre la fenêtre Ocre ; `RushQuestDungeonsPanel`, la popover et la fiche détail transmettent `capturedOcreNames` / `onOpenOcre` ; le dashboard alimente avec `capturedMonsterNames` (contexte `OpenOcreCtx` → `OcreProgressModal`), l'overlay dérive les captures de `ocre.monsters` (aucun appel réseau) et ouvre `RushOverlayOcreModal` ; le guide **public** ne reçoit aucune action. `getDungeons` marque **un** donjon par tag (`isOcreTagged`). **Aucune migration.**
> **Preuves** : `ocre-dungeons` **15** (règle, rendu réel, câblage) · suite **647 fichiers / 6 905 tests ✓** · `tsc` 0 · ESLint 0 erreur.
> **Reste** : contrôle visuel du panneau donjon (dashboard + overlay PiP, 390 / 768 / 1 440) avec un compte Metamob lié **et** non lié ; version stricte « tous les monstres du donjon » = table Donjon → Monstres (migration ⇒ accord), non ouverte. Ensuite : **V-C**, **F16**, **F1→F7**.
> **Rotation** : bloc « 09/11/2026 (suite 3) — Vignettes Ocre iso partout + proxy qui dit pourquoi il échoue » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 10/11/2026 (suite) — **Rang 57 · F17b : l'annuaire sait demander un métier à un niveau** — branche `feat/visiteur-filtre-niveau`

> **Demande user (verbatim)** : « Nous devons avancé sur la continuité du profil perso public et les chantiers rush sylvestre » → choix explicite : **le filtre niveau d'abord**, puis l'Ocre.
> **Mesure préalable** : l'annuaire ne connaissait que `q`, `classe`, `metier`, `cursor` ; le `where` filtrait le métier **sans niveau** ; le verrou `visitor-directory` exigeait **2** `<FilterMenu>`. La donnée était prête : `PublicProfession` porte `@@index([metierId, level])` et les niveaux sont bornés **1..200**.
> **Fait** : `niveau` borné (entier 1..200, lu **seulement** avec un métier valide), `where` en `level: { gte }` (« au moins ce niveau »), lien qui conserve le niveau et le retire avec le métier ; 3ᵉ menu « Niveau » (paliers 50/100/150/200) rendu **seulement** quand un métier est actif, via le `FilterMenu` partagé (exclusivité, Échap, clic extérieur) ; libellés fr/en.
> **Preuves** : `visitor-directory` **25** (+7) · suite **646 fichiers / 6 890 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste** : contrôle visuel 390 / 768 / 1 440 ; `PUBLIC_VISITOR_ENTRY=1` en bêta ; puis **V-H** (donjons ocre « capturé / à capturer »), **F16**, **F1→F7**.
> **Rotation** : bloc « 09/11/2026 (suite 2) — Rôles Discord du cycle de vie d'essai (V1) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


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


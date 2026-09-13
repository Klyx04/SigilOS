# 🗺️ ROADMAP — SigilOS (backlog priorisé + workflow de session)

> **Ce fichier est LA référence en mode plan.** Le backlog priorisé y est condensé.
> À chaque session, lire **uniquement** : `docs/ROADMAP.md` + `src/temp/chantier-actif.md`
> (+ `PROMPT_START.md` pour les exigences de type).
> **Historique long** (`CONTEXT.md` intégral, `src/temp/chantier.md`, `archive/`) : **À LA DEMANDE UNIQUEMENT**.
> Réouvrir l'historique en mode plan = gaspillage de tokens.

---

## 🧭 Règle mode plan (économie de tokens)

1. Lire `docs/ROADMAP.md` + `src/temp/chantier-actif.md`.
2. Ouvrir `PROMPT_START.md` pour le bloc exigences (type : dev / sécu / infra / SEO / données).
3. Ouvrir un fichier de référence (`RULES.md`, `SECURITY.md`, `MAINTENANCE.md`, `docs/SEO_REPRISE.md`)
   **uniquement si la tâche le touche**.
4. NE JAMAIS ouvrir en plan mode : `src/temp/chantier.md`, `CONTEXT-historique-*.md`,
   `src/temp/archive/`, `docs/audits/`. (Historique → consultation ponctuelle.)

---

## 🔴 Bloquant / Prod

- **#57 — Ouverture prod & PRA** : Guide maître Jour J `docs/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md`
  (+ `src/temp/checklist-ouverture-prod-57.md` & `docs/DECISION-OUVERTURE-LANDING.md`).
  Actions VPS : 2 applications Discord isolées (Prod vs Beta), hardlinks des assets (`game-data` + `uploads`),
  restauration DB automatique (`./scripts/restore_db.sh prod --download-latest`), retrait du rewrite Caddy `maintenance.html`
  sur `sigilos.fr`, noindexer la beta, resoumettre le sitemap, vérifier `/legal/*`. **+ trancher la décision landing immersive** (`page.tsx`).

- ✅ **Session 10/09/2026 — Module « Marché » · B1 = S1 (fondations)** (branche `feat/marche-b1` → PR `dev` ; mémo `src/temp/memo-2026-09-10-marche.md` ; plan `src/temp/refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` §0.1.bis bloc B) :
  - **Schéma** : 9 modèles (`MarketListing`, `MarketListingStat`, `MarketListingComponent`, `MarketOffer`, `MarketReservation`, `MarketListingMedia`, `MarketDiscordMessage`, `MarketReport`, `MarketAuditLog`) + 9 enums + `GuildModules.marche` (OFF par défaut) + 16 colonnes `GuildConfig.market*` · migration **idempotente** `20261110000000_add_market_module`.
  - **Module activable** : `module-types` / `module-actions` (Zod + verrou God) / **2 permissions** `market:trade` + `market:moderate` (matrice RBAC) / `canViewMarket` + `canManageMarket` (`applyModule`) / sidebar « Marché » / carte Pilotage / onglet **Réglages → Marché**.
  - **Écrans** : `/marche` (catalogue cartes + tableau + filtres), `/marche/nouveau` (assistant 3 étapes), `/marche/[listingId]` (fiche + jet étiqueté + actions vendeur), `/marche/mes-espaces` (en cours / terminées).
  - **Actions** : catalogue, CRUD, publication (`expiresAt = +20 j`), retrait, renouvellement (1 fois), soft-delete, **journal d'audit** ; réglages + **« Tester la configuration »**.
  - **Docs & tour** : fiches `/docs/marche` + « Configurer le Marché », 2 permissions documentées, `docs-mapping`, `seed:docs`+`build:seeds` · tour `marche` (6 étapes) + les 2 boutons (`📖 Documentation` / `❓ Tutoriel`).
  - Vérifs : **`prisma validate`** ✅ · **`migrate diff` 0 écart** ✅ · **`tsc` 0 erreur** ✅ · **`build` OK** · tests Marché **27/27** ✅ · **suite complète 682/682** ✅ (2 tests « préexistants » réparés : fixtures `data-health` / `siphon-stats` figées au 09/09 → rendues relatives à l'horloge, commit `5136214ba`).
  - ⚠️ `prisma migrate dev` **impossible en local** (dérive préexistante `20260819000000_add_inter_guild` absente du repo → reset destructif refusé) ⇒ migration écrite à la main + `prisma db execute`.
  - ✅ **PR #627 MERGÉE** dans `dev` (merge `62e53aae4`, 21:50Z) — CI **Verify & Build** ✅ + CD **Build & Push Images** ✅ · branche mergée supprimée.
  - 🔧 **2 bugs d'infra corrigés avant merge** : (1) **fixtures de tests figées** (`data-health`, `siphon-stats`) = bombes à retardement → `const NOW = Date.now()` (`5136214ba`) ; (2) **plafond mémoire Node ≈ 2 Go** → OOM sur `tsc --noEmit` **et** `next build` ⇒ `NODE_OPTIONS=--max-old-space-size=4096` dans `.github/workflows/verify.yml` **et** `Dockerfile` (`66ffdd724`).
  - ⚪ RESTE : DoD visuelle dark/light/mobile (vérif user) · assistant **5 étapes** (S1.42 → B2) · ➡️ **B2 = S2 + S3** (branche depuis `dev`).

- ✅ **Session 11/09/2026 — Module « Marché » · B2 = S2 + S3 (catalogue enrichi, éditeur FM, carte d'item, publication Discord)** (branche `feat/marche-b2` → PR `dev` ; plan `src/temp/refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` §21 S2/S3) :
  - **Données (S2)** : siphon des référentiels DofusDB `/effects` (872) + `/characteristics` (123) → `GameEffect` / `GameCharacteristic` (`siphonMarketReferentials`) · lecture **data-driven** (`src/lib/market/referential.ts`) avec repli codé (`effects.ts`) · catalogue local-first `src/lib/market/item-catalog.ts` + `getGameItemCatalogFacets` (DISTINCT familles/types) · route `GET /api/market/items/search` (session + `market:trade` + module + rate-limit) · siphon à la demande `siphonGameItemByAnkamaId`.
  - **Éditeur de jet (S2)** : plages natives **recalculées serveur** depuis `GameItem.nativeEffects` (jamais le client) + libellés référentiels · exos PA/PM/PO/invocation en 1 clic + ligne libre · bouton « ✦ Jet parfait » · état en direct · assistant porté de **3 → 4 étapes** (`Nature → Objet & jet → Prix → Publication`).
  - **Carte d'item (S2)** : `src/components/market/market-item-card.tsx` (anatomie §12.3) + `stat-icon.tsx` (mapping lucide partagé) · « Modifié par » + **prix moyen guilde** (`getMarketPriceStats`) · PNG `/api/og/market/[id]` (cache `statsHash`) · icônes `sagesse.png` / `invocation.png` ajoutées · `ItemSearchPanel` consomme désormais `effects.ts` (doublons supprimés).
  - **Publication Discord (S3)** : payload **pur** `src/lib/market/discord-payload.ts` (par état, compteur d'offres seul, boutons désactivés hors ACTIVE) · service `src/server/market/discord.ts` (`publishListingToDiscord` / `syncListingMessage` / `regenerateMarketImage`, **jamais bloquant**, `syncStatus=FAILED`+`lastError`, salon non configuré = pas d'erreur, mode texte **ou** forum) · réécriture d'embed à chaque transition · étape 4 avec aperçu fidèle (`DiscordEmbedPreview`) + rôles à ping **revalidés serveur** · `resyncMarketListing` / `regenerateMarketImage` (modo).
  - **Tests** : `market-effects.test.ts` (13) + `market-discord-payload.test.ts` (9) + cas limites `market-stat-quality.test.ts` (16) → **suite complète 709/709** ✅ · `tsc` 0 erreur · `build` exit 0 · `lint` 0 erreur (warnings préexistants).
  - Docs `marche` / `admin-marche` revues + `seed:docs` (30 MAJ) + `build:seeds` · tour `marche` enrichi (8 étapes : + `marche-jet`, `marche-publish`).

- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S2.12 : référentiel FM versionné + filet de données natives** (branche `feat/marche-b2`, commit `1e1646dcb` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` §12.8.3) :
  - **Référentiel FM** : `src/lib/market/fm-effects.ts` (**pur, client-safe, testé**) — **52 lignes forgeables** (`rune`, densité, `maxOverStandalone` = ⌊101/densité⌋, `canExo`/`canOver`) · **plafond 101** (`computeFmBudget`) · `maxOverFromRemaining()` (ex. exo PM **90** ⇒ reste **11** ⇒ **+55 Vitalité**) · `getFmStatus()` = **MALUS / EXO / A_VERIFIER / OVER / PARFAIT / BON / FAIBLE** · `describeFmReadonly()` (vol de vie, dégâts d'arme, panoplie, conditions) · `resolveFmEffectKey()` (`characteristic` → `effectId` → libellé FR normalisé + runes) + alias FR.
  - **Éditeur de jet** (`market-jet-editor.tsx`) : ligne libre choisie **dans le référentiel**, bandeau **densité** (consommé/101/reste), badge **rune**, étiquette FM, **over max** par ligne. Statuts **purement visuels** (ne bloquent jamais — D34/D35) ⇒ `MarketStatQuality` inchangé, **aucune migration de schéma**.
  - **Bug « aucun effet natif » corrigé** : cause = **données périmées** (`nativeEffects` vide sur les 21 747 fiches siphonnées AVANT S2.2), **pas** un bug de mapping → `toNativeEffects()` tolère la forme **brute** DofusDB (`diceNum`/`diceSide`) · **filet centralisé** `resolveNativeEffects()` (recherche locale, fiche item, recalcul serveur des annonces, `getItemCatalogEntry`) · action God **`backfillNativeEffects()`** + bouton « **Rattraper les effets natifs** » dans `GameItemSiphonPanel`.
  - **Tests** : `market-fm-effects.test.ts` (12) + cas `diceNum`/`diceSide` + `resolveNativeEffects` → **suite complète 723/723** ✅ · `tsc` 0 erreur · `eslint` 0 erreur · `build` exit 0 · hook pre-commit (lint-staged + tsc) ✅.
  - ⚪ RESTE : **V1.1** détection « arme » (dégâts élémentaires en lecture seule — le type de l'item n'est pas encore transmis à l'éditeur) · **densités à relire ligne par ligne** (donnée communautaire) · ✅ **PR #632 ouverte** (`feat/marche-b2` → `dev`, commits `1e1646dcb` + `4f9132c1d`) — les PR #630/#631 étant déjà mergées, ce reliquat devait repartir dans une PR dédiée · ➡️ **B3 = S4 + S5** (`src/server/market/*`, interactions Discord).


- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S7 lot 1 : vrais assets de stats, libellés d'effets et plages natives** (branche `feat/marche-b3` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` **§21 S7**) :
  - **Cause racine unique** des 3 symptômes remontés par le user (libellés « Effet », lignes FM en **« lecture seule »**, **« 0 SOUS LA PLAGE »**) : `CHAR_NAMES` ne couvrait pas les `effectId` DofusDB **et** la cascade de résolution prenait `characteristic ?? effectId` **en un seul essai** → un `effectId` connu était masqué dès qu'une caractéristique non cartographiée était présente.
  - **Référentiel de caractéristiques vérifié en base** (`GameCharacteristic`, 48 lignes) : **plusieurs ancres codées étaient fausses** — `16` = **Dommages** (et non Force), `26` = **Invocation**, `27`/`28` = **Esquive PA/PM**, `33`→`37` = résistances % , `40` = Pods, `44` = Initiative, `48` = Prospection, `49` = Soins, `50` = Renvoi ; **Force = `10`**. `CHAR_NAMES` corrigé + `getStatLabel()` en cascade `characteristic` → `effectId` → `int_id`, les libellés **placeholders** du siphon `/effects` (« Effet 63 », « }{ ») étant désormais ignorés (`isPlaceholderStatLabel`). `EXO_EFFECT_PRESETS` : caractéristique d'invocation corrigée `28` → **`26`**.
  - **Vrais assets graphiques** : nouveau module partagé **`src/lib/dofus-stats-theme.ts`** (pur, 40 thèmes → **PNG officiels** `public/assets/dofus/stats/*`) ; `StatIcon` affiche l'asset officiel et **retombe sur lucide** si l'effet n'est pas identifiable (jamais d'icône cassée) ; consommé par la carte d'item, l'éditeur de jet et la fiche d'annonce (« Jet déclaré »).
  - **Plages inversées `[10 à 0]`** : `normalizeNativeRange()` (DofusDB : second dé absent ⇒ `diceSide = 0` **⇒ valeur fixe**) appliqué à l'**écriture** (`toNativeEffects`) **et à la lecture** (`findNativeRange`, `getMarketListing`, `getMarketListings` via `withDisplayReadyStats`) ⇒ les lignes **déjà en base** sont soignées **sans migration** ; garde `computeStatQuality()` (plage inversée ⇒ `NORMAL`, jamais un faux `LOW`) ; affichage `[10]` au lieu de `[10 à 0]`.
  - **Tests** : nouveau `dofus-stats-theme.test.ts` (8 — dont **garde-fou d'existence des PNG**), `market-effects.test.ts` (22), `market-stat-quality.test.ts` (17), fixture `game-item-backfill` alignée → **suite complète 960/960** ✅ (94 fichiers) · `tsc` 0 erreur · `eslint` 0 erreur · `build` exit 0 · **0 migration**.

- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S7 lot 2 : la réservation est enfin lisible** (branche `feat/marche-b3` ; plan §21 S7) :
  - **Symptôme user** : « on ne voit pas si l'item est déjà réservé ni par qui ».
  - **`getMarketListing()`** retourne désormais **`MarketListingDetail`** = la fiche + `reservation` (`MarketReservationView`) : **pseudo Dofus** + **classe** du réservataire, **échéance**, `isMine`. La réservation est lue **une seule requête indexée** et **uniquement sur une annonce `RESERVED`** ; **aucune modification de `MARKET_INCLUDE`** (le catalogue n'a pas besoin du pseudo, seulement de `MarketListing.reservedUntil` déjà porté par la ligne).
  - **Isolation** : le profil du réservataire est relu **dans la guilde du contexte** (`where: { id, guildId: guildConfig.id }`) — un `buyerProfileId` ne suffit jamais ; profil illisible ⇒ repli neutre « Un membre de la guilde » (jamais d'id brut). §13.7 : le pseudo n'apparaît que sur l'écran **privé** de la guilde, **jamais** dans l'embed Discord (inchangé).
  - **UI** : bandeau « **Réservé par X jusqu'au …** » sur la fiche (variante « **Tu as réservé cette annonce** » pour l'acheteur) + carte « Acheter » adaptée (déjà réservée / c'est moi) + **échéance sur la carte du catalogue** (`RESERVED`). Échéance affichée **date + heure** (`formatDeadline`).
  - **Tests** : `market-guards.test.ts` **13** (+3 : pseudo + échéance, `isMine`/repli neutre, aucune réservation hors `RESERVED`) → **suite complète 963/963** ✅ (94 fichiers) · `tsc` 0 · `eslint` 0 · `build` exit 0 · **0 migration**.

- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S7 lot 3 : le créateur peut éditer son annonce** (branche `feat/marche-b3` ; plan §21 S7) :
  - **Symptôme user** : « le créateur peut pas éditer ses fiches et changer par exemple le jet de l'item / quantité » — le serveur (`updateMarketListing`) le permettait **depuis S1**, mais **aucun écran ne l'appelait**.
  - **Route `marche/[listingId]/modifier`** (S7.11) : gardes identiques à la fiche (module + `canViewMarket`) **+ propriétaire uniquement**, **statuts éditables** (`DRAFT`/`ACTIVE`/`EXPIRED`) et types couverts par l'assistant (`EQUIPMENT`/`RESOURCE`) — sinon redirection vers la fiche (le serveur reste l'autorité).
  - **`MarketCreateClient` en mode `edit`** (S7.12) : le **même** assistant est rejoué sur l'état initial (nature, objet du catalogue relu par `getLocalGameItemDetails`, jet, lot/quantités, prix, description, troc) — **aucune duplication** ; l'étape 4 (publication Discord) disparaît (fil à **3 étapes**) et la dernière étape enregistre (`updateMarketListing` : vendeur + statut revalidés, **jet recalculé serveur**, `statsHash` rejoué, journal `LISTING_UPDATED`). Charge utile **mutualisée** (`buildPayload()`) création/édition : jamais de `quality` client.
  - **Resynchro Discord non bloquante** après édition d'une annonce `ACTIVE`/`RESERVED` (`void syncListingMessage(...)`, même invariant qu'en S3) + `revalidatePath` de la fiche.
  - **Boutons « Modifier »** (S7.13) : fiche (carte « Actions du vendeur ») **et** « Mes espaces », visibles seulement pour le vendeur et les statuts éditables.
  - **Tests** (S7.14) : `market-guards.test.ts` **16** (+3 : non-vendeur refusé, `RESERVED`/`SOLD`/`WITHDRAWN` refusés, **`quality` client ignoré** → `OVER` recalculé + plage du catalogue) → **suite complète 966/966** ✅ (94 fichiers) · `tsc` 0 · `eslint` 0 · `build` **exit 0** · **0 migration**.


- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S7 lot 4 : recherche live & modale « Ligne libre FM »** (branche `feat/marche-b3` ; plan §21 S7) :
  - **Symptômes user** : « obligé de cliquer sur Rechercher car les items n'apparaissent pas dynamiquement » · « le *Ligne libre FM* en dropdown vaut mieux une modale qui s'ouvre avec le choix ».
  - **S7.15 — recherche à la frappe** (`market-create-client.tsx` → `CataloguePicker`) : **debounce 300 ms** + **anti-course** (`requestId` : seule la dernière frappe écrit les résultats, aucune réponse obsolète), témoin de chargement dans le champ, message « aucun objet » conditionné à une recherche **aboutie**. Le bouton « Rechercher » **reste** (accessibilité + repli explicite) et la touche Entrée force la recherche.
  - **S7.16 — modale FM** (`market-jet-editor.tsx`) : le `Select` de 52 lignes est remplacé par un `Dialog` avec **recherche** (libellé / rune / libellé court), **icône officielle** (asset Dofus via `StatIcon`), **rune + densité/pt**, badges **Exo / Over +N** et la mention « déjà ajoutée » (entrée désactivée, aucun doublon).
  - **Icônes** : `dofus-stats-theme` résout désormais les **libellés courts** du référentiel FM (`PA`, `PM`, `PO`, `Renvoi`) — `Pods` ne tombe jamais sur l'icône Portée.
  - **Tests** : `dofus-stats-theme.test.ts` **9** (+1) → **suite complète 967/967** ✅ (94 fichiers) · `tsc` 0 · `eslint` 0 · `build` **exit 0** · **0 migration**.

- ✅ **Session 11/09/2026 (suite) — Module « Marché » · S7.18 : siphon des référentiels DofusDB réellement complet** (branche `feat/marche-b3` ; plan §21 S7 lot 5) :
  - **Symptôme user** : « le siphon de `/effects` est incomplet (49 lignes au lieu de ~872) ».
  - **Diagnostic mesuré** : l'API est **saine** (`?$limit=50&$skip=N` respecté, `total` = **123** `/characteristics` et **872** `/effects`) ; la base locale était restée à **48 / 49**. Cause = **règle d'arrêt** de la boucle : `rows.length < pageSize` (avec `pageSize = json.limit`) ⇒ l'API rendant parfois **moins** de lignes que `$limit` (48 < 50), la collecte s'arrêtait à la **1ʳᵉ page**. Le correctif « se caler sur `json.limit` » (S4.0b) était donc **insuffisant**.
  - **Correctif** : module **pur** `src/lib/market/referential-pagination.ts` — `collectDofusDbPages()` pagine tant que `skip < json.total` (**jamais** sur la taille de page reçue), **rejoue une fois** une page en échec puis la **signale** sans perdre le reste, borne `maxPages` (60) et timeout **par page** ; rapport honnête `{ rows, total, expected, truncated, pages, failedPages }`. Les deux siphons l'utilisent ; `siphonMarketReferentials` renvoie désormais `lues / stockées / exposées` + `truncated` (log `warn` explicite) et le panneau God affiche `123/123 lues (121 en base)` — plus de faux succès.
  - **Preuve « 100 % base »** : rattrapage local `src/temp/_siphon-referentials.mjs` (gitignoré, refusé hors `localhost`, **upsert idempotent**) → **123/123** caractéristiques lues (**121** stockées) et **872/872** effets lus (**871** stockés) ; les **3** entrées restantes (`id` non exploitable, ex. `0`) sont **légitimement ignorées** ⇒ ✅ « Référentiel 100 % base ».
  - **Tests** : `tests/unit/market-referential-pagination.test.ts` (**9**, dont la **régression exacte** « une page plus courte que `$limit` ne coupe pas la boucle », le rejeu d'une page en échec, la page définitivement en échec → troncature signalée, la borne `maxPages`, l'API sans `total`) → **suite complète 976/976** ✅ (95 fichiers) · `tsc` 0 · `eslint` 0 · `build` **exit 0** · **0 migration**.
- ✅ **Session 12/09/2026 — Module « Marché » · S8 lot 1 : la forge réelle (Transcendance + élément de frappe) et fin des « Effet »** (branche `feat/marche-s8` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` **§21 S8** · décisions **D40/D41/D42**) :
  - **Référentiel de forge** : nouveau module **pur & testé** `src/lib/market/smithmagic.ts` — `TranscendenceRune` (palier **Ta/PaTa/RaTa**, `statLabel`, `bonus`, `effectId`) · `ElementPotion` (élément Feu/Eau/Terre/Air, paliers **50/65/80 %**) · `resolveStrikeElement()` · `describeSmithmagicStatus()` (bloc STATUT) · `resolveElementPotions()` (les **12** potions restent proposées même si le siphon n'en a ramené que **8**). **Data-driven (D41)** : la source de vérité reste `GameItem` (`typeId 211` / `26`), **aucun nouveau siphon**.
  - **Référentiel Transcendance enfin étiqueté (S8.5)** : `fm-effects.ts` gagne `FM_TRANSCENDENCE_LABEL` (« **Empêche les futures forgemagies** »), `FM_TRANSCENDENCE_SEUILS` (Ta/PaTa/RaTa × 5 familles, donnée **communautaire** indicative — ne bloque jamais, D34/D35), `fmTranscendenceFamily()` / `fmTranscendencePalierFor()`, un motif de **lecture seule** pour la ligne de Transcendance et des **exceptions** (« **Arme de chasse** » n'est plus capturée par le motif « Dégâts de l'arme »).
  - **Fin des libellés « Effet »** : cause = le siphon `/effects` ramène des **gabarits** (« Effet 63 », « }{ soins ») — mesuré en base : **231** gabarits sur **871** effets, dont **47** réellement référencés par des items. `referential.ts` ne les **publie plus** (ils écrasaient `labels[characteristic]`, ex. `labels[0] = "Effet 11"`), `resolveFmEffectKey()` **refuse** un libellé-gabarit (mieux vaut `null` qu'une clé inventée), et l'action God **`purgePlaceholderEffectLabels()`** (+ bouton « Purger les libellés d'effets gabarits ») réécrit ce qui est réparable **depuis la caractéristique jointe** — **idempotent, aucune suppression, aucune invention** (les 231 gabarits portent `characteristic = 0` ⇒ comptés `unresolved` et ignorés à l'affichage).
  - **Carte d'item (S8.4)** : nouveau **bloc STATUT** (entre « Statut légendaire » et le bandeau EFFETS) = `Empêche les futures forgemagies` · `Élément de frappe : Feu` · `Arme de chasse`, piloté par les champs **déclarés** `transcended`/`transcendenceLabel`/`strikeElement`/`huntingWeapon` (jamais déduits du jet — D40) ; le mapping carte → lignes est **pur et testé**.
  - **Lecture serveur (S8.3)** : `getSmithmagicReferential(guildId)` (`market-actions.ts`) — gating **fail-closed** (`resolveMarketContext` : session + membre + `canViewMarket`), `GameItem.where({ typeId: { in: [211, 26] } })`, **cache mémoire court** (5 min, global — le contrôle d'accès est refait à chaque appel) et **fail-soft** (`logger.warn` + référentiel vide `degraded: true`, la page Marché ne casse jamais).
  - **Tests** : nouveaux `market-smithmagic.test.ts` (**16**) · `market-referential.test.ts` (**3**, hygiène des libellés) · `game-item-effect-labels.test.ts` (**5**, purge idempotente et non destructive) · `market-fm-effects.test.ts` **31** (+10 : Transcendance, seuils, gabarits) → **suite complète 1008/1008** ✅ (98 fichiers) · `tsc` **0 erreur** · `eslint` **0 erreur** · `build` **exit 0** · **0 migration** (le lot 2 portera l'unique migration additive).
  - ⚪ RESTE (lots 2→4) : éditeur (bloc **Forge** : rune de Transcendance ⇒ over/exo désactivés · potion ⇒ élément · arme de chasse), persistance **Zod + migration additive** + règles serveur `transcendé ⇒ aucun OVER/EXO`, retrait des lignes non forgeables de l'éditeur (**D42**), `acceptsTrade` effectif (**D43**).




- ✅ **Session 13/09/2026 — Hygiène dépôt (`guide_backup.sql` hors du dépôt) + raccord des documents** (branche `fix/untrack-guide-backup-sql` → **PR #638 mergée**, `68884e1a8` ; CI `dev` **verte** : `SigilOS CI` 5m21 ✅ · `CodeQL` ✅) :
  - **Dépôt** : le dump `guide_backup.sql` (**17,74 Mo**, suivi par git depuis le 26/07 **sans être référencé** par le code) est **sorti du dépôt** → `backups/guide_backup.sql` (**SHA256 `FE4EEF69…EA72` identique**, vérifié) ; `.gitignore` + `.dockerignore` durcis (**racine seulement**, `prisma/migrations/**` intact) ; `src/temp` documenté (`README.md` §6/§6.1/§7).
  - **Raccord du plan (piège réel désamorcé)** : `S5.1`→`S5.6`, `S5.8`, `S5.13` étaient marquées `[ ]` **alors que le code existe** (PR #633) ⇒ **cochées avec leur provenance**.
  - **0 fichier de code touché** ; branche **`feat/marche-s8-lot2`** créée depuis `dev`.
  - ⚪ RESTE (hors code) : purge `.git` (LOT B, ~2,3 Go) — **simulation validée, `-Apply` non lancé** (seul geste irréversible du chantier).
- ✅ **Session 13/09/2026 — Module « Marché » · S8 lot 2 : écran de déclaration (item de base + choix de forge)** (branche `feat/marche-s8-lot2` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` **§21 S8** · décisions **D40/D41/D42** ; mémo `src/temp/memo-2026-09-13-marche-s8-lot2.md`) :
  - **Socle (S8.10)** : `MarketListing` gagne **6 colonnes nullables** (`transcendenceRuneId`, `transcendenceLabel`, `strikeElement`, `elementPotionId`, `elementPotionTier`, `huntingWeapon`) — migration **additive idempotente** `20261114000000_add_market_forge_fields` (`ADD COLUMN IF NOT EXISTS`, **aucun backfill**) · la **présence** de la rune vaut « Transcendé » (aucun booléen redondant) · `elementPotionTier` porte la donnée de jeu car les **4 potions du palier 65 %** ne sont pas siphonnées (`elementPotionId` reste `NULL`).
  - **Gardes pures partagées (S8.11)** : nouveau `src/lib/market/forge-guards.ts` (**pur, testé**) — `marketForgeFieldsSchema` (Zod fusionné dans `marketListingBaseSchema`), `isWeaponItem()`, `describeTranscendenceConflicts()`, `validateForgeDeclaration()`. Côté serveur (`createMarketListing` / `updateMarketListing`) la **famille de l'objet est relue au catalogue** (`GameItem`) : le client n'est jamais cru ; **une annonce sans forge ne paie aucune requête supplémentaire**. Règles : **transcendé ⇒ aucun over/exo** (seul refus autorisé, D34/D35 intacts), élément/potion/arme de chasse **réservés aux armes**, **potion cohérente** avec élément + palier.
  - **Écran de déclaration (S8.7/S8.9)** : la **carte du catalogue** (jets **MAX** + EFFETS + STATUT) est rendue **au-dessus** de l'éditeur ; le bloc **« Forge »** ajoute (1) la **rune de Transcendance** (recherche + paliers, compteurs Ta/PaTa/RaTa), (2) l'**élément de frappe** + la **potion** (50/65/80 %, armes) et (3) l'**arme de chasse** (armes) — **icônes officielles obligatoires** (`iconUrl` exposé sur `TranscendenceRune`/`ElementPotion`, repli **élément** pour les potions non siphonnées) · référentiel **fail-soft** (`degraded` ⇒ bloc masqué) · une Transcendance **désactive over/exo** dans l'éditeur et bloque « Continuer » tant qu'il en reste (bandeau explicite) · récapitulatif de forge à l'étape **Publication**.
  - **D42 (S8.8)** : les lignes **non forgeables** (vol de vie, dégâts de l'arme, sorts, panoplie, conditions) sont **retirées de l'éditeur** (plus d'`<Input disabled>` ni de badge « LECTURE SEULE ») et restent **affichées sur la carte d'item**.
  - **Tests** : nouveau `tests/unit/market-forge-guards.test.ts` (**18** : armes & faux positifs mesurés « Parchemin/Archipel », Zod, D40, **non-régression D34/D35**, cohérence potion, icônes) + `market-smithmagic.test.ts` (**16**, `iconUrl`) → **suite complète 1041/1041** ✅ (100 fichiers) · `tsc` **0 erreur** · `eslint` **0 erreur** · `build` **exit 0** · **1 migration additive**.
  - ⚪ RESTE (lots 3→4) : embed Discord avec statut + élément de frappe (**S8.17**), `acceptsTrade` effectif (**D43**, S8.13), bulles profil Discord, libellé « Mon espace », onglet God « Marché », reliquat S5.9→S5.12/S5.14.
- ✅ **Session 13/09/2026 (suite) — Module « Marché » · S8 lot 2bis : fidélité des lignes de jet, du signe des malus et du bloc Forge** (branche `fix/marche-fidelite-lignes` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` **§21 S8.23→S8.30** ; mémo `src/temp/memo-2026-09-13-marche-fix-lignes.md`) :
  - **Cause racine du « +30 Effet » / « +100 Force »** : les libellés et le **signe** des malus ne dépendaient que du référentiel runtime (`GameEffect` via cache serveur + server action `getMarketStatReferential`). Un référentiel **vide** (client Prisma non régénéré après la migration — `prisma generate` oublié —, cache, ou appel arrivé après le choix de l'objet) laissait les lignes sans libellé (« Effet ») **et sans signe** (« +100 Force » au lieu de « -71 à -100 Force »).
  - **Table d'infobulle (S8.23)** : `CHAR_NAMES` complétée et **vérifiée `effectId` par `effectId`** contre les **gabarits de description FR de DofusDB** (`/effects/{id}?lang=fr`) et `GameCharacteristic` (**121** lignes) — corrections mesurées : `112` = **Dommages** (et non « Dommages Critiques »), `115` = **Critique (%)**, `176` = **Prospection**, `418`/`419` = **Dommages Critiques**, `420`/`421` = **Résistance Critiques**, `96→100` = **Dommages X (arme)**, `91→95` = **Vol de vie X**, `82` = Retrait PA, `84` = Dommages Poussée, `88` = Dommages Terre, `141` = Sorts (%), **séries de pénalités** (`101/105/116/127/133/134/145/152→157/168/169/171/175/177/179/186/265/411/413/415/417/754/755/215→219/245→249/2801→2814/2835→2861`).
  - **Ordre de résolution unique (S8.24)** : `resolveStatLabel()` = **table d'infobulle → référentiel siphonné → libellé déclaré** (le nom siphonné est le nom **court de la caractéristique** jointe — « Critiques (fixe) », « Terre (%) »). Consommé par la carte, l'éditeur de jet, `resolveServerStats` et `withDisplayReadyStats` (fiche, catalogue, embed) — fin des cascades recopiées.
  - **Signe déterministe (S8.25)** : `NEGATIVE_EFFECT_IDS` (**86** `effectId` **mesurés en base**) + `isNegativeNativeEffect()` ⇒ le signe ne dépend plus d'un référentiel disponible (`fx.isNegative` → référentiel → repli) — un référentiel indisponible n'affiche **plus jamais** un malus en positif.
  - **Lignes résolues serveur (S8.26)** : `enrichNativeEffects()` (pure) dans `searchLocalGameItems` **et** `getLocalGameItemDetails` ⇒ `label` + `isNegative` **voyagent avec l'item** (plus de course avec le 2ᵉ aller-retour) · `toMarketStatReferentialInput()` (règle écrite côté serveur) · `backfillNativeEffects()` persiste les lignes résolues.
  - **Anti-doublon (S8.27)** : `dedupeNativeEffects()` — DofusDB duplique la ligne de **dommages de base d'une arme** (`effectId` 100 ; mesuré sur `13649` : deux entrées `9 → 14`, y compris dans l'API) ⇒ la carte affichait deux fois « +14 … [9 à 14] ».
  - **Éditeur de jet (S8.28)** : fin du « **transcendance** » affiché sur **chaque** ligne — la colonne montre la **densité réellement consommée** (`X densité`) ou « — » (ligne native, non sur-forgeable, ou objet transcendé), avec `title` explicatif.
  - **Bloc Forge (S8.29)** : le **sélecteur de rune** (paliers + recherche) est **toujours rendu** sous la rune courante (il ne l'était que si aucune rune n'était choisie ⇒ rune **impossible à changer**), rune courante surlignée, compteurs `runeCounts ?? 0` (fin du « RaTa ? »).
  - **Preuve sur items réels** (script gitignoré `src/temp/_check-items.ts`) : **Cape de Glourdorak** `32237` → `+30 Dommages Critiques [21 à 30]` + **`-30 Résistance Critiques [-30]`** ; **Rouleau à Pâtisserie d'Aermyne** `13649` → `-1 PA`, `-100 Force/Intelligence/Chance/Agilité`, **`-15 Dommages Critiques`**, `+6 Esquive PA` (bonus de la même famille, non signé) et la ligne de dommages d'arme **dédoublonnée** — y compris **sans aucun référentiel** côté client.
  - **Tests** : `market-effects.test.ts` **34** (table d'infobulle, ordre `resolveStatLabel`, `NEGATIVE_EFFECT_IDS` **86**, `isNegativeNativeEffect`, anti-doublon, payloads **réels** `32237`/`13649` sans référentiel) · `market-fm-effects.test.ts` **33** (les **4** lignes perdues de l'éditeur : Critique / Prospection / Dommages Critiques / Résistance Critiques + séries de pénalités) → **suite complète 1061/1061** ✅ (100 fichiers) · `tsc` **0 erreur** · `eslint` **0 erreur** · `build` **exit 0** (`Compiled successfully in 7.8min`, génération des routes OK) · hook pre-commit ✅ · **0 migration**.
  - ⚠️ **Exploitation** : après une migration, **redémarrer le serveur de dev / régénérer le client Prisma** (`npx prisma generate`) — un client Prisma périmé renvoie un référentiel **vide** (c'était la cause exacte des captures user).
  - ⚪ RESTE : **lots 3→4** (S8.13→S8.17 : `acceptsTrade` serveur, embed forge, bulles profil, `StatIcon`, « Mon espace » · S8.18→S8.31 : God « Marché », `notifyGod`, cascade `WITHDRAWN`, tests expire/concurrence, tour+doc, fin de branche) — **état vérifié par tâche** : `src/temp/refonte-marche/REPRISE-S8-LOT3-ETAT.md` (**§0 = règles projet bloquantes** : `RULES.md` §Security · `SECURITY.md` · `.agents/workflows/{discord-module,add-cron-task,prisma-schema-change,git-push}.md` + checklist sécurité **par tâche**) · **amorce à coller** : `AMORCES-A-COPIER.md` § « ⏭️ MAINTENANT ».
- ✅ **Session 13/09/2026 (suite 3) — Module « Marché » · S8 lot 3 : « Discord & UX »** (branche `feat/marche-s8-lot3` depuis `dev` = `79e1c1547` ; plan `PLAN-MAITRE-MODULE-MARCHE.md` **§21 S8** · décisions **D40/D41/D43** ; mémo `src/temp/memo-2026-09-13-marche-s8-lot3.md`) :
  - **S8.13 — `acceptsTrade` enfin effectif (D43)** : `offers.ts` refusait une offre **sans kamas** uniquement sur `negotiable`. Désormais `TRADE_NOT_ACCEPTED` (nouveau motif) est renvoyé par `createMarketOfferCore` **et** par la **contre-offre** de `respondToMarketOfferCore` — gardes posées **avant toute écriture** (côté contre-offre : **avant la transaction**, l'offre en face reste `PENDING`, aucun demi-refus). Côté Discord : message éphémère dédié + **la modale l'annonce** (`buildMarketOfferModal(id, { acceptsTrade })` : libellés « Montant en kamas (obligatoire ici) » / « Troc proposé (refusé sur cette annonce) » ; **sans option, la sortie est identique** à avant — les champs restent `required: false`, Discord ne sachant pas exprimer « kamas OU troc »).
  - **S8.17 — l'embed publie la forge et le troc** : bloc **STATUT** construit par `buildMarketStatusLines()` (réutilise `describeSmithmagicStatus()`, **source unique** avec la carte d'item S8.4) → `Transcendé (Empêche les futures forgemagies)` · `Élément de frappe : Feu — potion 65 %` · `Arme de chasse : …` · **`Troc accepté` / `Kamas uniquement`**. Palier de potion **borné** aux 3 valeurs de jeu via `resolvePotionTierLabel()` (jamais « potion 0 % / 99 % »). Publication : `discord.ts` (champs déjà chargés, **0 requête ajoutée**) ; **aperçu fidèle** (l'assistant transmet désormais forge + troc au payload).
  - **S8.14 — bulles profil mutualisées** : nouveau composant partagé `src/components/shared/discord-profile-bubble.tsx` (avatar Discord résilient + repli initiales + `ClassIcon`), DTO **minimal** `{ id, name, image, classe }` (`id` = `UserProfile.id` **interne**, jamais un snowflake) posé sur la **fiche** (vendeur, 0 serveur), la **négociation** (demandeur / contre-offreur, `MarketCounterpartProfile` côté `getMyMarketData`) et **« Mon espace »** (membre courant, 0 requête — contexte déjà chargé).
  - **S8.15 — `StatIcon` partout où le jet était du texte nu** : nouveau composant `src/components/market/market-stat-lines.tsx` + type **partagé** `MarketStatLineView` (`market-constants`, pur ⇒ client + serveur). Branché sur **« Mon espace »** (stats déjà sérialisées), la **négociation** (`listing.stats` ajouté à `NEGOTIATION_OFFER_SELECT`, projection **lecture seule**) et la **modération** (dossiers signalés **et** annonces retirées — le litige « jet déclaré » se juge enfin sur place).
  - **S8.16 — libellé « Mon espace »** (singulier) : page, bouton catalogue, toast de brouillon, étape de tour `marche-my-listings`, `docs-catalog.ts` (4 occurrences) + commentaires. **La route `/marche/mes-espaces` et les `data-tour` sont inchangés** (aucun changement d'URL, donc aucun impact permissions/liens).
  - **Tests** : `market-offers` **44→47** (troc seul refusé + aucune écriture · kamas accepté malgré troc joint · contre-offre troc refusée avec offre en face toujours `PENDING`) · `market-discord-interactions` **37→40** (message dédié · modale kamas-only · **non-régression** de `buildMarketOfferModal(id)`) · `market-discord-payload` **19→24** (statut complet, bornage du palier, absence de statut, §13.7) · `market-moderation` (attentes alignées sur le jet exposé) → **suite complète 1072/1072** ✅ (100 fichiers).
  - **Vérifs** : `tsc --noEmit` **0 erreur** ✅ · `eslint` (fichiers touchés) **0 erreur** ✅ · `npm run build` **exit 0** ✅ (table de routes générée) · `tests/security/*` verts ✅ · **0 migration** (schéma inchangé) · `add-cron-task.md` lu mais **aucun cron** dans ce lot (S8.19 = lot 4).
  - 🔒 **Sécurité** : règle `acceptsTrade` **100 % serveur** (le client n'est jamais cru, gardes **avant** écriture/transaction) · `guildConfigId` **interne** dans chaque `WHERE` (aucun snowflake en entrée d'action) · **bornage** (booléen + palier 50/65/80) · **aucune** donnée perso dans l'embed (§13.7 conservé par test) · DTO profil **minimal** · `logger` (0 `console.*`) · assets d'icônes **locaux** · fail-closed inchangé (rate-limit/signature Discord en amont).
  - ⚪ RESTE : **Lot 4** — `S8.18` (onglet **God « Marché »**), `S8.19` (`notifyGod`), `S8.20` (cascade `WITHDRAWN`), `S8.21` (`market-expire` / concurrence), `S8.22` (tour + doc) puis fin de branche.
- 🔸 **Session 08/09/2026 — Module « Titans »** (branche `feat/slash-rework`, non commité ; mémo `src/temp/memo-2026-09-08-titans.md`) :
  - **Fonctionnalité de bout en bout** : modèle `Titan` + `UserTitanProgress` + `DjSearchMode.TITAN` + champs DJ (`titanId/titanName/questName/questUrl`) — migrations `20261101000000_add_titan` + `20261102000000_add_titan_quests` appliquées. Admin GOD `TitanManager`, server actions `titan-admin-actions`/`titan-actions`, seed Gargandyas (id 8062, zone Osavora).
  - **Dashboard DJ** : mode `TITAN` (création/filtre/embed/close/titres) + `maxMembers` plafonné au titan.
  - **Succès** : `SuccesTitanTab` (fiche boss-like) · **Cron** `sync-monster-stats` étendu aux Titans · **Overlay Bestiaire** : filtre « 👑 Titans ».
  - **Charte « fiche boss »** : icônes vitality/résistances + sorts Dofensive (dans `SuccesTitanTab`).
  - **Correctifs** : overlay zoom (en-tête + légende restent visibles), boss épinglé + agrandi (`SpellRangeGrid`), correctifs TS (`LocalImagePicker`, `DOFUS_JOBS`).
  - **Parité fiche boss** : onglets **Simulation + Monstres de salle** dans `SuccesTitanTab` · **Résolution Gargandyas** validée (8062, homonyme 8069) · **barre de vues** en assets Dofus + « Fiche Titans » à côté de « Fiches Boss ».
  - **DJ Titan création** : **taille FIXE = titan.maxMembers** · **date/heure calquée sur `scheduleConfig`** (jours + fenêtre horaire) · **cron** relances/nettoyage couvre TITAN · **file d'attente** déjà en place.
  - **UI /boss** : bouton « Overlay en jeu » retiré des cartes · overlay **fix flèche retour** (deep-linked une seule fois + clear search).
  - Vérifs : **tsc 0** (hors `SpellRangeGrid` cassé) · **eslint 0 erreur**.
  - ⚪ RESTE : **`SpellRangeGrid.tsx` JSX cassé à réparer** (préexistant) · branche/PR `feat/slash-rework`.


- ✅ **Session 01/09/2026 (suite) — Rush Sylvestre : correctifs, S6, S7, S5** (`dev` HEAD `4c6a395b`) :
  - **Correctifs dashboard (reliquats 3/7/9)** (#572) : recherche + `hideDone` (un bloc entièrement terminé contenant un résultat reste visible via `effHideDone`) · cible de validation ≥36×36 desktop / 44×44 mobile · `data-tour` limité au premier contrôle visible (`isFirstVisible`).
  - **S6 moments premium** (#572) : `MilestoneCelebrationBurst` — burst doré + label « Bloc validé ✦ » à la validation d'un bloc (cohérent `RushCurrentObjective`).
  - **S7 contexte chapitre** (#574) : `RushChapterSidebar` enrichi — « 🏰 Donjons à prévoir » + « 🔨 Métiers requis » du chapitre (dérivés des séquences, zéro fetch).
  - **S5 éditeur GOD** (#575, **🔸 open**) : import d'image pour l'icône de séquence (URL validée `isSafeImageUrl` + upload sécurisé `/api/upload`) + helper partagé `resolveRushSeqIcon` (clé preset → `/assets/icons/…`, sinon URL) ; CodeQL `js/xss-through-dom` corrigé via `safeImageUrl`.
  - **Fix PWA icônes après nav SPA** (#573) : `public/sw.js` network-first + fallback cache/placehodler (plus de `respondWith(undefined)` → `net::ERR_FAILED`).
  Vérifs : **vitest 465/465 (53 fichiers)** · **tsc 0** · **eslint 0 erreur** · **build OK**.

- ✅ **Session 02/09/2026 — Overlay Rush Sylvestre très mature + correctifs dashboard** (branche `fix/cron-maintenance-scripts` → PR `dev`) :
  - **Overlay** (`GuideOverlayClient` + `components/RushOverlay*`) : recherche globale accent-insensible (tout le guide), arbre de chapitres `<select>` + progression N/M, modale **Ressources** globale (bascule **Restantes/Toutes**, décrément en direct `aggregateRushResources(milestones, completedSeqIds)`), modale **Membres** qui est là, modale tutoriel, mode compact, header **7 boutons** (thème/ressources/masquer faites/tutoriel/dashboard/**bug**/**reset**) + puce **personnage** (pseudo+classe Main/Mule), validation « chapitre » fiable (synchro `completedStepsByMs` + rollback), blocs non cochables (`SEPARATEUR`/`INFO`/`DOFUS_OBTAINED`), `goToNextMs` saute les blocs faits, exclusivité validé/repère, bouton **bug** pré-remplit le contexte d'étape (`context`).
  - **Fix bug repère « disparaît après 2 s »** : le dashboard (`RushTimelineClient`) ne relisait que `currentStep` préfixé `seq:` dans son effet `[milestones]` → il republiait un snapshot vide sur `BroadcastChannel` → l'overlay écrasait son repère. Normalisation brut/`seq:` + validation par séquences (init + resync) + `handleBookmark` préserve les autres blocs.
  - **Reste dashboard** (voir `activeContext.md` NEXT) : modale Ressources globale + bascule Restantes/Toutes · contexte d'étape dans « Signaler » · puce personnage Main/Mule · suppression `RushOverlayQuestPanel.tsx` orphelin · ressources `kind:"unresolved"` (données).
  - Vérifs : **tsc 0** · **eslint 0 erreur** (fichiers touchés).

- ✅ **Session 04/09/2026 — Rush Sylvestre : Pense-bête + modale de lancement + config GOD** (branche `feat/chantier-2026-09-03-rush-ui-pense-bete` → **PR #588**) :
  - **Retrait bouton + modale « Ressources » du dashboard** (conservés dans l'overlay).
  - **Pense-bête** : bouton + modale **lecture seule** (préparatifs du rush, une seule croix de fermeture).
  - **Modale de lancement (4 étapes)** : personnage → préparation (Metamob détecté + bouton « Lier », reset alignement optionnel, métiers requis déclarés ✓ / non déclarés → « Déclarer ») → membres → prêt. Reset (« Réinitialiser ce personnage ») ré-ouvre la modale + **reset d'un autre perso (main/mules)**.
  - **Config UI/UX GOD** : `OptimizedGuide.rushUIConfig` (JsonB) + migration `20261013000000_add_rush_ui_config` + action `updateRushUIConfig` (audit `GOD_RUSH_UI_UPDATE`). Onglet GOD « **Lancement** » : aperçu + éditeur pense-bête (CRUD sections/items, métiers **alternative**, **réordonnancement ↑/↓**) + toggles modale. Fallback statique si vide.
  - **UI polish** : badges activité « pack +N » (dashboard via `classifyTags`), **célébration changement de chapitre** (jade), **checkboxes 3 états** (à faire / en cours doré / terminée jade).
  - **Bloc alignement** → lien vers `/dashboard/[guildId]/profile`. **Modale Ocre +/−** re-render + patch Metamob. **Fix** crash `AlignmentSection` (profil).
  - **Prisma** : migrations locales bloquantes résolues (`20261009`-`20261013`) → `Database schema is up to date!`.
  - Vérifs : **tsc 0** · **eslint 0 erreur** · **vitest 484/484** · **build OK**.


- ✅ **Session 01/09/2026 — Recrutement & Cycle de Vie (#RH), Refonte Documentation & Unification Boutons d'Aide** :
  - **Module Recrutement & Cycle de Vie (`/admin/recruitment`)** : Gestion des périodes d'essai J-X, annuaire des mules et personnages secondaires, historique des départs & exclusions, relances et alertes Discord automatiques. Modèle `MemberLifecycle`, actions serveur sécurisées et interface pro `MemberLifecycleManager.tsx`.
  - **Documentation Exhaustive & Sécurisation God** : 28 fiches rédigées sans slop dans `prisma/seed-docs.ts` couvrant les 35 modules. Suppression stricte de tout bouton d'édition côté lecteur, gestion documentaire réservée à `/god/docs`.
  - **Unification Globale des Boutons [Documentation] + [Tutoriel]** : Standardisation du binôme de boutons `ModuleHelpActions` (ouverture du tiroir latéral contextuel + tutoriel interactif) sur 100% des 35+ modules et sous-modules du Dashboard (Membres et Staff).
  Vérifs : **vitest 458/458 (52 fichiers)** · **tsc 0** · **build OK**.

- ✅ **Lot 3 : Performance & Optimistic UI (#186a) + PWA & Offline (#197) (31/08)** :
  - **#186a — Optimistic UI (Zero-Latency) & Virtualisation** : Hook `useOptimisticSet` (`use-optimistic-toggle.ts`) pour retours visuels 0ms et rollback automatique. Composant `VirtualList.tsx` pour scroll fluide 60-120 FPS.
  - **#197 — PWA (Progressive Web App) & Cache Offline** : Manifest enrichi (`src/app/manifest.ts`) avec raccourcis Quêtes/Almanax/Défis, icônes adaptatives maskable, Service Worker (`public/sw.js`) pour cache statique/offline et bannière d'installation 1-clic `PwaInstallBanner`.
  Vérifs : **vitest 448/448** · **tsc 0** · **build OK**.

- ✅ **Lot 2 : Double Boss (#198.1), Badges & Rules Engine (#198.2) + Reaction Roles V2 Pro (#222) (31/08)** :
  - **#198.1 — Double Boss & Défi Module + Icônes Dofus Quêtes** : Vignettes authentiques des Dofus dans les cartes de quêtes (`SuccesQuestsTab.tsx`), annuaire d'entraide guilde temps réel et support multi-boss 2 à 5 boss (`SuccesDefiTab.tsx` / `defi-actions.ts`).
  - **#198.2 — Système de Badges, No-Code Rules Engine & Ko-fi** : Modèles `Badge` et `UserBadge`, studio GOD `/god/badges` avec Live Card Preview, upload drag-and-drop / presets, moteur de règles de déblocage automatique 100% No-Code (`badge-triggers.ts` pour Quêtes Dofus, Défis, Missions) et route Webhook Ko-fi (`/api/webhooks/kofi`).
  - **#222 — Reaction Roles V2 Pro (DraftBot & Dyno Inspiration)** : Multi-rôles par sélection (`extraRoleIds`), rôles temporaires avec durée d'expiration (`durationDays`), enregistrement `TimedRoleGrant`, tâche de révocation automatique Discord (`processExpiredTimedRolesAction`), et éditeur pro dans `ReactionRolesManager.tsx`.
  Vérifs : **vitest 445/445** · **tsc 0** · **build OK**.

- ✅ **Lot 1 : Quick Wins & Robustesse Immédiate (31/08)** :
  - **#199 — Tour Tuto Succès (Filtres & Défi)** : Reciblage de l'étape « Recherche et filtres » sur `[data-tour="succes-filters"]` et ajout de l'étape dédiée à l'onglet **Défi** (`[data-tour="succes-view-defi"]`) dans `tour-provider.tsx`.
  - **#230 — Succession Automatique & Sécurisation Transfert** : Algorithme fail-safe de succession (`handleGuildOwnerSuccession`) si l'owner supprime son compte/quitte Discord (Owner Discord -> Officier `system:rbac` -> Ancien membre + audit log + alerte staff) + modale de confirmation manuelle par saisie du nom de guilde (`transferGuildOwnershipAction`). 6 tests unitaires passés (`guild-owner-succession.test.ts`).
  - **#174 — Rappels Automatiques Discord Sorties Inactives** : Relances automatiques Discord + Notifications Dashboard pour les sorties Donjons/Quêtes/Songes inactives depuis > 72h avec clôture progressive (`inactive-posts-actions.ts`).
  Vérifs : **vitest 438/438** · **tsc 0** · **build OK**.

- ✅ **Harmonisation Dark/Light Mode & Tokens Sémantiques (31/08)** :
  - **Switch Thème Public & God** : Intégration du `ThemeToggle` sur le `PublicHeader` (desktop + drawer mobile) et `GodTopNav`.
  - **Suppression des classes en dur** : Nettoyage de `text-white` et `bg-zinc-900` au profit des tokens sémantiques `text-foreground`, `bg-surface`, `bg-background`, `border-border` dans `GeoguesserHUD.tsx`, `SpellRangeGrid.tsx`, `ZoneManager.tsx`.
  - **Nettoyage CSS Global** : Correction de `.ganymade-step-text strong, b` dans `globals.css` vers `text-foreground` pour la lisibilité universelle dark/light.
  Vérifs : **vitest 432/432** · **tsc 0** · **build OK**.

- ✅ **Songes, Sidebar, Dolmanax, Grille Guilde & Rapport Staff #147 (31/08)** :
  - **Clôture Songes & Embed Discord** : Déplacement de `deleteDiscordRunEmbed` avant `db.dreamRun.delete` dans `dream-run-actions.ts` (support Forum `type === 15` et Textuel `type === 0`).
  - **Ordre Sidebar Dashboard** : `Donjons & Quêtes` en 1re position, `Songes` en 2e dans `NAV_TOOLS`.
  - **Custom Module Icons GOD** : Onglet `/god?tab=module-icons` pour upload & compression WebP 128x128 max (`image-downloader.ts`).
  - **Refonte Dolmanax (Anti-Slop / DPLN)** : Offrande du jour, bouton `+1 Page du Jour` net & lisible en dark/light mode, contrôles manuels et calendrier prévisionnel 7 jours.
  - **Refonte Vue Guilde (Quêtes Dofus)** : Grille de cartes compacte 3 colonnes + Drawer d'entraide (membres en cours avec étape `🚩`, membres l'ayant obtenu, accès direct au guide).
  - **Indexation Dofus & Quêtes dans Cmd+K** : Intégration de tous les Dofus (`db.dofusItem`) et étapes de quêtes (`db.dofusQuestEntry`) dans la recherche globale.
  - **Chantier #147 — Rapport Quotidien Staff (« Data or Nothing »)** : `sendDailySummaryReport` n'envoie de message que si au moins un événement critique existe sur 24h (Arrivées, Départs/Archivages, Absences, Tickets ouverts, Preuves à valider). Si 0 événement → 0 message Discord.
  - **Kralamoure Widget** : Confinement et adaptation du composant pour éviter tout débordement dans la sidebar 300px de `/quete-ocre`.
  Vérifs : **vitest 432/432** · **tsc 0** · **build OK**.

- ✅ **Correctif 429 & Autonomie Complète Items/Ressources #38 (31/08)** :
  - **Débridage Rate-Limit `/api/assets-dofus`** : Sortie de `/api/assets-dofus` du rate-limiter strict 60 req/min (comme `/api/storage`) dans `src/proxy.ts`.
  - **Rate-limit adaptatif `/api/dofusdb`** : Élévation à 120 req/min pour absorber la frappe interactive.
  - **Cache Mémoire Serveur** : Cache in-process LRU/TTL 5 min sur la recherche multi-catégories Dofusdude/DofusDB et TTL 10 min sur les fiches items et recettes (`/api/dofusdb/items/[id]`, `/api/dofusdb/recipes/[id]`).
  - **Chantier #38 Siphon & Autonomie Local-First** : Nouveau modèle Prisma `GameItem` indexé + migration `20261009000000_add_game_item_catalog` + action serveur `siphonGameItemsBatch` (lots de 50, hash MD5 différentiel, auto-siphon WebP non-bloquant).
  - **Studio GOD & Bascule Modules** : Sous-onglet GOD « 📦 Items & Ressources » (`GameItemSiphonPanel`) + bascule local-first prioritaire pour l'Encyclopédie, les Services et le Coffre/Prêts.
  Vérifs : **vitest 429/429** · **tsc 0** · **build OK**.

- ✅ **Synchro Dokille, Outbox Discord, Tour Onboarding & Logs Audit Discord (31/08)** :
  - **Synchro bidirectionnelle Dokille / Dolmanax** : Validation/invalidation globale synchronisée avec les 20 krokilles et quêtes.
  - **Réagencement Prérequis Dokille** : Vulkania placé avant le Safari des Krokilles.
  - **Contraste "Obtenu" Dofus** : Ratio YIQ dynamique pour dark/light mode.
  - **Outbox Discord** : Correction du faux échec d'envoi (`outbox:${jobId}`).
  - **Tour Onboarding** : Ciblage direct du composant Disponibilités (`[data-tour="profile-planning"]`) & conditionnement de « Présence & Feed » au mode vitrine.
  - **Services Discord** : Affichage du surnom sur le serveur Discord (`discordNickname` / `pseudoDofus`) dans les réponses et notifications.
  - **Admin Logs & Bot Gateway** : Résolution des surnoms serveur pour les cibles de logs et affichage du détail exact (`changeDetail` : rôles, surnom, arrivées, départs).
  Vérifs : **vitest 429/429** · **tsc 0** · **build OK**.

- ✅ **Refonte Complète Module Rush Sylvestre (28/08)** (`feat/dofusbook-spells-guide-refonte`, PR → dev) :
  - **Types partagés & Helpers purs** (`rush-guide-types.ts`, `rush-guide-utils.ts` avec 13 tests unitaires passés) : parsing exact `/travel`, détection déterministe des prérequis `isSequenceBlockedByPrereqs`, recherche de prochaine étape actionable ignorant les `info_sequence`.
  - **Composants UI Partagés** : `RushCoordinateChip` (copie `/travel`), `RushProgress` (barre fluide), `RushCurrentObjective` (objectif doré `✦ À FAIRE MAINTENANT`), `RushTagBadge`, `RushActionMenu`.
  - **Dashboard Membre** (`RushTimelineClient.tsx`) : prérequis déterministes, cibles de clic agrandies, modal de reprise connectée au repère exact (`effectiveBookmarkSeqId`) et nom de quête.
  - **Overlay In-Game Redesign** (`GuideOverlayClient.tsx`) : Mode Normal + Mode Compact focalisé sur le jeu, gestion intelligente d'`Escape` et raccourci `/`.
  - **Overlay PiP toujours-au-dessus** (`use-guide-pip.ts`, modèle Ganymède) : clic direct `documentPictureInPicture.requestWindow()` + `createPortal(<GuideOverlayClient/>, pipWindow.document.body)` (une seule fenêtre, checkboxes synchronisées dashboard↔overlay). Fallback Firefox/Safari : **popup vierge + `createPortal`** (`openFallbackPopup`) — réutilise la session dashboard, plus de rebond `/dashboard/{guildId}`. Vérifs : **tsc 0** · **eslint 0 erreur**.
  - **Studio d'administration GOD** (`RushSylvestreAdminClient.tsx`) : `SequenceEditForm` en 8 sections accordéons progressives, indicateur de statut local non enregistré (`dirty`), et Aperçu Live en temps réel.
  - **S4 « qui peut aider » (31/08)** : marquage GOD « 🔨 Métier requis » + `getSequenceHelpers` (garde guilde + Zod + rate-limit) + badge « X peut aider » (dashboard + overlay, `RushHelperBadge`) + **[Inviter/Partager]** (`inviteHelperForSequence` + `listRushTextChannels`). **Gap A** : `UserProfile.metiers` enrichi `[{id, name, level}]` — `src/lib/metiers.ts` (`normalizeMetiers`, rétro-compat `string[]` → niveau 200), éditeur profil avec niveau, consommateurs durcis, Zod élargi. **tsc 0** · **eslint 0 erreur** · **vitest 465/465** · **build OK**.
  Vérifs : **test:run 389/389** · **tsc 0** · **build OK**.

- ✅ **Game Data — État des lieux & UI (27/08)** (`feat/chantier-2026-08-27-game-data-ui`, branche créée depuis `dev`, PR → dev) :
  **bug « Siphonner les quêtes » corrigé** (DofusDB pagine via `$limit`/`$skip` — avec `limit`/`page` l'API renvoie `total:0` → « 0 quête siphonnée », reproduit) ·
  dé-doublonnage des points d'entrée (`/god/game-data` → `redirect` vers l'onglet canonique `/god?tab=game-data`,
  qui porte déjà stats réelles + GameDataInterface + EventZoneManager) · galerie des modales (succès/boss) enrichie
  (**recherche** + **suppression d'image**, nouveau `DELETE /api/god/list-local-images` fail-closed anti path-traversal) ·
  onglets aérés (rangée unique qui défile, padding/gap élargis) · onglet Quêtes clarifié (« Import initial » vs « Synchronisation »).
  Vérifs : **test:run 340/340** · **tsc 0** · **eslint 0 erreur** · **build OK**. Mémo : `src/temp/memo-2026-08-27-game-data.md`.
  ⚪ RESTE (optionnel) : « Archis & Boss » = onglet (tab) **et** route standalone `/god/game-data/archimonstres` (2 views du même module) ·
  2 galeries d'assets parallèles (`LocalImagePicker` vs `AssetGalleryModal`) à unifier · `EventZoneManager` à ne monter qu'une fois ·
  déploiement = re-build app.
  ➕ **Compléments (27/08 — A/B/C)** : `searchGameQuests` = **local-first + fallback DofusDB** (le picker membre profite désormais du fallback,
  + test `tests/unit/quest-picker-fallback.test.ts`) · bouton « Associer familles (auto) » = matching **normalisé** (casse/accents) + diagnostic
  `archisWithZone` (explique quand 0 association) · onglet Import/Export documenté (couverture = **4 tables** seulement, export Git **dev-only**,
  **complémentaire** au siphon DofusDB — pas obsolète mais partiellement supplanté). Vérifs : test:run **343/343** · tsc 0 · build OK.
  ✅ **COMMIT + PUSH** : `4b58cfe45` sur `feat/chantier-2026-08-27-game-data-ui` (poussée → origin, PR → dev). Ajouts finaux :
  donjon à 0 succès **visible** dans `/succes?dungeon=` (`SuccesTracker`) · même emplacement + **plusieurs boss** (aide de sémantique +
  seed `scripts/seed-harebourg-double-boss.ts` pour les 4 variantes du Comte Harebourg) · fiche boss = **map du boss uniquement**
  (`SpellRangeGrid`, filtre `shownMaps`). RESTE : merger la PR → dev · `sudo ./scripts/deploy-cd.sh beta` (aucun migrate Prisma,
  pas de changement de schéma) · siphonner les quêtes + ajouter les 4 variantes (UI recommandé ou seed tsx). `#57` ouverture prod toujours bloquant.


- 📌 **Galerie de Stuff — classe « Inconnu » + limite 30 + filtres responsive (27/08)** (`feat/chantier-2026-08-27-galerie-stuff-classe`, PR #561 → dev) :
  **🐛 Fini le « INCONNU »** : `processDofusbookRawData` ne produit plus un faux « Inconnu » ni un `classId` par défaut (1) quand Dofusbook ne renvoie pas de `character_class` (builds partagés / réponses partielles) — `classId`→0 + `className`→vide, et la modale `DofusbookPreview` préfère le `classId` (choisi/déduit) dès que `className` est absent ou « Inconnu » (fallback `getClassName(guessedClassId)`). → **classe correcte pour n'importe quelle classe**, ajout multi-classes OK (aucune restriction implicite). · **Limite perso 20→30** (`builds-card.tsx` compteur + seuil, `UpdateDofusBookLinksSchema.max(30)`). · **UI** : contraste dark modale (en-têtes `text-foreground/30`→`/70`, rangées `bg-black/*`→`bg-surface/60`) + popovers filtres Tags avancés / Classe en **largeur responsive** `w-[min(...,calc(100vw-2rem))]` (plus de sortie d'écran).
  Vérifs : **test:run 359/359** · **tsc 0** · **lint 0 erreur** · **build OK** (+ test `tests/unit/dofusbook-utils.test.ts`). Mémo : `src/temp/memo-2026-08-27-galerie-stuff-classe.md`.
- 📌 **Doubles boss & module Défi (27/08, ONE SHOT A+B+C+D)** (`feat/chantier-2026-08-27-double-boss-defi`, depuis `feat/chantier-2026-08-27-game-data-ui`, PR → dev) :
  **A — Correctif doubles boss + dropdown map** : cause racine = `bossName` « Comte + Klime » ne matche pas le monstre Dofensive → `shownMaps` affichait toutes les maps. Fix = dissociation **affichage / résolution** : `name`/`bossName` restent « Comte et X », + 2 champs optionnels `Dungeon.dofensiveMonsterName` (`Klime`…) + `Dungeon.dofensiveDungeonName` (« Donjon du Comte Harebourg ») → `resolveDofensiveDungeonDirect` cible la bonne « Balcon » (et lève l'ambiguïté vs les donjons **solo** homonymes). `SpellRangeGrid` ne retombe plus sur toutes les maps. Script `scripts/fix-double-boss-resolution.ts` (idempotent, préserve les donjons solo) + seed MAJ. · **Robustesse (post-beta)** : helper partagé `src/lib/dofensive-boss.ts` (`deriveDofensiveMonsterName` / `resolveMonsterKey`) dérive le monstre d'un `bossName` « X et Y » (« Comte et Klime » → « Klime ») quand `dofensiveMonsterName` est **vide en base** → `SuccesBossGuide` et `getDofensiveDungeonForBoss` résolvent la bonne « Balcon » même avec des données incomplètes. ·
  **B — Donjon sans succès** : toggle « Donjon sans succès » (`Dungeon.isNoAchievement`) → pseudo-succès « Donjon validé » (challenge `donjon-valide`) relié au donjon → cochable dans « Mes Succès ». ·
  **C — Sources communautaires** : déplacé dans les `actions` du `UnifiedModuleHeader` (`succes/page.tsx`). ·
  **D — Module « Défi »** : modèle dédié `Defi` + `UserDefiProgress` + `DjSearchMode`=DEFI ; onglet « Défi » God (`DefiManager`) et `/succes` (`SuccesDefiTab`) ; 3ᵉ mode DJ (pièce, embed, clôture → `applyDefiValidation`), filtres/cartes/détail/close ; type image `defi` whitelisté.
  Vérifs : **test:run 344/344** · **tsc 0** · **build OK** · eslint 0 erreur. Mémo : `src/temp/memo-2026-08-27-double-boss-defi.md`.
  ⚠️ **Migration** `20261006000000_add_defi_double_boss_resolution` (SQL manuel) — la base locale est en **drift** (`add_inter_guild`), ne pas faire `migrate dev` (reset), utiliser **`prisma migrate deploy`** en CI/prod. Merger **d'abord** la PR game-data-ui → dev (fichiers communs). ⚪ RESTE (non fait) : multi-défis DJ, annuaire « qui a fait / pas fait » par membre (compteur simple).
  ✨ **Modale Défi enrichie** : fenêtre d'événement (`isPermanent`/`startDate`/`endDate` sur `Defi`, migration `20261007000000_add_defi_event_schedule`) — toggle « Dispo en perpétuel » (défaut) ou dates début/fin (`datetime-local` + validation end>=start) ; **slug auto-généré** depuis le nom (`src/lib/defi-slug.ts`, module pur) ; **Zone en combobox** zones siphonnées (`searchZones`) ; **Boss en combobox** monstres Dofensive siphonnés (`searchMonstersForDefi`, plus de texte libre) ; fix **galerie** `game-data/defis` fail-soft (la route `list-local-images` crée le dossier au lieu de lever `ENOENT`).
- **#223 — Résilience Discord long terme** (point dur **16/11/2026**)
  P0 + P1 + P2 + fix CodeQL : ✅ FAIT + MERGÉ (PR #520, `6e5a779a3`).
  **RESTE (P3)** : outbox BullMQ/Redis écritures Discord · révocation session Auth.js sur
  `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants
  (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) ·
  veille mensuelle changelog + jour J.
  📄 Plan maître : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md`
  · ⚠️ §12 = VEILLE (à relire à chaque itération Discord).
- **Fiche Boss / Simulation** (06/10, terminé — 283/283) — ✅ **25/08** (`feat/chantier-2026-08-25-succes-fiche-boss-map-dofensive`, PR #548) : resolution donjon multi-boss par **token-overlap** (gère « Temple de l'Eliocalypse » ↔ « Tempête de l'Eliocalypse » chez Dofensive, générique pour futurs DJ) → la vraie map Dofensive (Déluge 204476422) se charge ; passage du `dungeonName` au resolver. ⚪ RESTE : icônes résistances/vitalité
  `public/assets/module-succes/*.png` (**à brancher ou supprimer**, chantier en cours) · onglet
  « Mes succès / Succès Commun » · prévisu zone sous-monde · bug faces noires 3D · butin par grade · zaaps · (option « graphe multi-boss en cartes séparées » à cadrer).
- **Accès membres / Discord (25/08)** : réglé le « Accès Banni » après réintégration (invalidation cache+session, PR #541 mergée) + UX « Exclure (réintégrable) ». **✅ CHANTIER 25/08** (`feat/chantier-2026-08-25-acces-timeout-archivage`) : reflet du **timeout Discord** (écran « Accès Temporairement Suspendu » + compte à rebours) · bug « Accès Banni » après réintégration définitivement corrigé (tombstone `findFirst({ liftedAt: null })`) · `wipeUserProfile` crée son tombstone · `getGuildMemberBans` sans `take:100` · **archivage auto 12 mois** · messaging honnête Archiver vs Supprimer. ⚪ RESTE (→ #223 résilience Discord) : invalidation des caches `member:`/`roles:`/`user:ctx` à un **changement de rôle / timeout Discord** — cache membre en mémoire (process app) non partageable avec le bot Gateway → Redis/endpoint interne ; + « Supprimer définitivement » réel = retrait du rôle d'accès Discord via le bot.
- **🧪 Session debug 26/08** (`feat/chantier-2026-08-26-dofus-icones-locales`, PR → dev) : fixes console/UI —
  icônes Dofus servies en **local** (`/module-dofus/*.png`, helper `dofus-image-url.ts` local-first, plus de dofusdb pour le profil/hub) ·
  recherche Ressources : partie **dofusbook retirée** (dofusdb seul) · recette craft sans « Copier la liste » ni copie/quantité (nom seul) ·
  WS `/socket.io/*` : **fix CORS même-origine** (400 → temps réel OK) · bloc **« Tarifs Forgemagie » retiré** de la carte Métiers du profil ·
  **Sigil Bomb** : volume son appliqué, décompte 3s synchronisé, mort subite **pré-avertie** (~3 échanges) + nouveau réglage (on/off + nb d'échanges).
  Vérifs : tsc 0 · eslint 0 · **340/340**. Mémo : `src/temp/memo-2026-08-26-fixes-console-ui-sigil-bomb.md`.


## 🟠 Bloc B — UX / Perf (valeur immédiate)

- **#186a** Optimistic UI (`useOptimistic` sur Rejoindre/Cocher/Toggle) + prefetch routes +
  skeletons + **virtualisation** (ladder, annuaire, galerie).
- **#129 / #1038** Responsivité : audit composant par composant (sweep à poursuivre).

## 🟠 Retours user (suite #202)

- **#227** — ✅ FAIT (24/08) : Épuration globale UI des notifications (cloches `NotificationBell` / `FeedBell` / `GodNotificationPanel` / page notifs — harmonisation des badges de compteurs, suppression des glow/gradients et ombres criardes, tokens OKLCH, dates en français).
- **#228** — ✅ FAIT + VALIDÉ (23/08, `feat/chantier-2026-08-23-one-shot`) : garde appliquée à galerie /
  présentation / services / donjons + interception `router.push`/`replace` **validée** : mécanisme confirmé
  sur Next 16 (`useRouter()` → instance router partagée & modifiable, `window.next.router`). Tests unitaires
  ajoutés (`tests/unit/unsaved-changes-guard.test.ts` : `isDirty` + `isExecutableScheme` sécu).

## 🟡 Bloc C — Fonctionnalités (valeur moyenne)

- **#198** Badges & Achievements (méta-succès, configurable God, raretés, ping Discord épique/légendaire).
- **#71** Prêts / Coffre : rappel auto @ping si prêt non clos (cron worker), historique/export par guilde, refonte modale.
- **#265** Épuration cartes + filtres + mode multi-donjons (2-5) + multi-embed Discord unique (1 ping).
- **#196 + #197** API Webhooks (HMAC, rate-limit, retry, OpenAPI) + PWA (service worker, push, install) — même socle.

## 🟡 Bloc D — God / Télémétrie

- **#34 / #194** Refonte Télémétrie God + **God Insights** (WAU/MAU, funnel d'activation, heatmap
  d'activité par module/heure, alertes, export).

## 🟢 Long terme / à planifier

#38 WebP items/ressources (God game-data) · #190 Worldmap (routes farm, zaaps, mines, traversées de mer)
  · **06/09/2026 — fix worldmap dézoom (EN COURS, `feat/refonte-onboarding`, non commité)** : tuiles/bandes noires + freeze dashboard (banque tuiles bornée, `keepBuffer 6→2`, fond océan, redraw unique rAF, highlight 4 Hz, icônes donjons mémorisées + nouvel asset `dungeon-boss.png`). Reste : validation runtime + PR → dev.
· #175 écart Ganymède→Sylvestre · #172 musiques de fond + réglages son + interface God sons
· #205 Guesser (dictionnaires API, modale fin d'épreuve responsive) · #234 audit scalabilité worldmap/guesser
· #40 benchmark galerie stuff · #1610 sécurité/infra (à cadrer en réunion) · #186b SEO long terme
· #4 grille agenda (semaine/mois) · #188 passe module Succès · #229 plan de croissance (**NOT FAIT**, lié ouverture prod).

## ✅ Déjà soldé (surveiller)

- **#242** — ✅ FAIT (26/08) : Refonte UI/UX de la **Fiche Boss** (module Succès) — `SuccesBossGuide.tsx` dé-sloppé (tokens OKLCH, type-scale, suppression ombres/`font-black`/`tracking-widest`/`transition-all`/scales, couleurs en dur→tokens) + enrichissement des onglets (synthèse « Mécaniques clés — N sorts à anticiper », cartes sorts détaillés en sections Effet principal / Déclenchement / Effets critiques, grades alignés à droite, butin en cartes homogènes icône+nom+taux, monstres de salle compacts). Vérifs : tsc 0 · lint 0 erreur · 339/339 · build OK.

#192 bouton « Suivant » · #199 tour tuto Succès · #202 / #204 RBAC · #206 Dofoobz centralisé
· #223 P0/P1/P2 · #127 audit RBAC · #85 blacklist embeds · #169 · #101 SEO almanax · #176 fiches boss
· #181 privacy OCR · #96 README déploiement CD · #41bis circuit-breaker Dofusbook · #140 landing God → `page.tsx`
· ✅ #228 garde anti-nav (4 formulaires + `router.push`/`replace` — interception validée + tests) · ✅ #226 cartes dj/quêtes (P1/3/4, P5 drawer → modale fermable, P2 hiérarchie créneau en tête, P6 transitions) · ✅ #225 Dokille (édition image God + seed 4 quêtes Safari + prérequis + trackeur krokilles 20 archis) · ✅ #233 Guide gestion guilde & Discord (permissions, architecture, sorties, synergie SigilOS) · ✅ #208 Planning & dispos (plages horaires explicites, icônes distinctes, chips textuelles) · ✅ #209 Contraste bouton « Suivant » / « Créer » Calendrier (`text-warning-foreground`) · ✅ #221 Polish UI/contrastes (onglets création Songes, modale marché Ocre + filtre hideOwned, harmonisation boutons DofusDB) · ✅ #224 Fiches Boss & Siphon (chargement instantané du catalogue, lazy-loading par boss sélectionné avec cache, sous-onglets épurés, alertes/notifications God crons siphon Dofensive, fix réactivité MonsterImage au changement de boss, garde isNumericId anti-CUID route proxy `/?url=`, monsterId de grille gardé par `typeof number`) · ✅ #180 Ocre, Metamob Sync, Troc & Place de Marché UI (transfert unitaire strict -1/+1, troc bilatéral avec étape archimonstre, boutons de stock +/-, refonte onglets) · ✅ Songes UI (bouton clôturer dé-jauni dark mode, boutons pros h-11) · ✅ Module Monumental Reaction Roles (RBAC, 4 modes NORMAL/UNIQUE/VERIFY/REVERSE, 2 styles BUTTONS/SELECT_MENU, swap auto removeRoleId, prérequis, blacklists, simulateur Discord live, 1-clic deploy, packs d'icônes GOD drag & drop visual importer) · ✅ Module Monumental Bot Ticket Discord Pro (Flotte GOD /god/ticket-bot, Module Guilde /dashboard/[guildId]/tickets, Inbox Zendesk-like, Formulaires Intake Modals dynamiques, Multi-Panels Discord live simulateur, Transcripts HTML horodatés, Notes internes staff chiffrées, Enquête CSAT 1-5 étoiles, RBAC staff:tickets) · ✅ Gestion membres & accès (`liftGuildMemberBan` : invalidation `user:ctx` + purge sessions à la réintégration · action « Supprimer » → « Exclure (réintégrable) » + modale honnête, PR #541). (#207 FAQ · #23/#134 avatar · #26/#177 donjons : traités/poussés le 23/08.)

- ✅ **#542 / #544 — Infra build & déploiement (25/08)** : pin `prisma@7.9.1` partout. **#542** = `npx prisma` dans `services/discord-bot/Dockerfile` (CI build du bot KO car `npx prisma` tirait `prisma@latest` = RC cassée `8.0.0-rc.10` sans la cmd `generate`). **#544** = pin dans `deploy-cd.sh` / `deploy.sh` / `audit.sh` (deploy VPS en ÉTAPE 4/5 : « No command registered for `migrate` »). ⚠️ Règle : **toujours épingler `prisma@<version>`** dans les cas où le CLI n'est pas installé localement (image runner = `.next/standalone`). ⚪ RESTE (optionnel) : durcir `deploy-cd.sh` (re-exec après `git pull` réussi — piège du « SHA local »).


---

## 🔄 Workflow d'une session (sur une branche propre)

1. `git checkout dev` puis `git pull origin dev`.
2. Créer la branche : `git checkout -b feat/chantier-<AAAA-MM-JJ>-<sujet>`
   (ex : `feat/chantier-2026-08-23-ouverture-prod`).
3. **ONE SHOT** : 1 chantier = 1 session (max 2 petits). Limite le scope, facilite la revue.
4. Avant tout commit : `npm run test:run` + `npm run build` (tsc + lint inclus).
   Ne jamais committer : `docs/audits/`, `src/audit-*`, `AUDIT_*.md`, `.env*`, `src/temp/`.
5. Mettre à jour en fin de session : `src/temp/chantier-actif.md` (statut) + `docs/ROADMAP.md` +
   un mémo `src/temp/memo-<AAAA-MM-JJ>-<sujet>.md`.
6. Pousser `feat/...` → PR vers `dev` (jamais directement sur `main`/`dev`).

## 📌 Semaine type (ordre conseillé)

1. **Semaine 1** : trancher la décision landing immersive → exécuter la checklist #57 (ouverture prod)
   + #227 / #228 (retours user).
2. **Semaine 2** : **Bloc B** (perf dashboard : Optimistic UI + virtualisation) — valeur ressentie max.
3. **Semaine 3** : un choix — **#198 Badges** (engagement) OU **#71 rappels prêts** (bouchage).
4. **En creux** (si session longue) : #223 P3 Discord + reliquats fiche boss (#188 icônes module-succès).
5. **Veille** : relecture du changelog Discord avant le **16/11/2026** (jour J résilience).

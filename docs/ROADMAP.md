# 🗺️ ROADMAP — SigilOS (feuille de route unique)

> **Rôle unique.** Ce fichier porte le **backlog** ET **l'ordre**. Une ligne = un chantier.
> **Règle d'or.** 1 rang = 1 lot = 1 branche = 1 PR → `dev`. On merge avant d'ouvrir le suivant.
> **Mémoire.** 6 dernières sessions : `docs/agents/activeContext.md`.
> Historique complet (171 blocs) : `docs/agents/journal-sessions-2026.md` — **à la demande**, jamais au démarrage.
> **Tenue.** Un chantier livré quitte le tableau et rejoint le §5. Aucun récit de session ici.
> **Dernière MàJ** : 26/10/2026 · SHA courant injecté par le hook `TaskStart`.

## 0. Reprise immédiate

- **Livré le 27/10/2026 — Rush : code mort retiré, `alignOrderReq` supprimé, un rang n'est pas une cité (branche
  `fix/rush-code-mort-legacy`).** ① `DofusProgressStrip.tsx` **supprimé** (composant **jamais monté**, 0 import) et le
  verrou T2 **repointé** sur le bandeau réel `GuildStatusPanel` (bouton + `aria-label`, titre/description de la modale,
  geste de filtre) : il ne gardait qu'un fichier mort. ② **S5-1 (partie sans migration)** : `alignOrderReq` n'est plus
  **ni lu ni écrit** (client, les 2 formulaires God, jumeau serveur, 2 seeds, sync enrichie) — mesuré : il valait `1` sur
  les **66** séquences qui le portaient, donc « Bontarien lv.1 » ne verrouillait rien ; le palier réel reste
  `alignLevelReq` + `alignmentCountForCamp`. La **colonne** reste en base (drop = **migration** ⇒ lot séparé + accord).
  ③ **Défaut mesuré, corrigé** : le payload enrichi porte un **rang** dans `alignReq` (1…99, **104** entrées) et le camp
  dans `alignment.camp` — écrire ce rang dans la colonne **masquait** la quête pour tout le monde (route fail-closed sur
  une cité inconnue) ; les deux chemins d'écriture n'écrivent plus qu'un **camp reconnu**. Suite **604 ✓ / 49 fichiers**
  `rush-*`, `tsc` 0, `lint` 0 erreur. **Aucune migration, aucune donnée touchée.**

- **Livré le 26/10/2026 — Guide interne : modale par Dofus + déslop du bandeau personnage.** Le clic sur un Dofus
  ouvre une **modale** (au lieu d'un panneau en ligne) qui dit **où en est chaque membre quête par quête** : X/Y quêtes,
  quête en cours **et sa catégorie**, dernière validée ; le filtre de timeline reste accessible depuis la modale
  (règle pure `src/lib/rush-dofus-progress.ts`, **8 cas** — une quête est faite quand **toutes** ses étapes le sont,
  l'étape courante du joueur prime). Déslop du bandeau : badge « Main/Mule » fait main **retiré**, bouton reset rouge
  **déplacé dans le menu du personnage** (par personnage), **3 crayons** du bloc Ordre retirés, « Rush Live » passe sur
  un **asset du jeu** (`/assets/dofus/modules/guild.png`), et les cinq blocs partagent **une anatomie** (asset nu 28 px,
  libellé 11 px, plus de `font-serif` décoratif). Les 4 gardes de `rush-guide-ui-polish` qui verrouillaient l'ancien
  design sont **réécrites sur l'intention** (pas de pastille faite main, reset atteignable et nommé, statut dans le
  menu, asset réel) — la demande du propriétaire contredisait l'ancien verrou. Suite **5 562 ✓ / 530 fichiers**.
- **Livré le 26/10/2026 — Rush : identité assistée, route éditable, import dry-run, contraste (branche
  `feat/rush-identite-quete`).** ① **Picker de quête** dans les deux formulaires God : le nom et le lien **DofusDB
  direct** viennent du catalogue `GameQuest` (**1 976** quêtes, **530 / 530** des quêtes Tougli présentes), le lien
  **DPLN reste la première source** (règle pure `src/lib/rush-quest-identity.ts`, **11 cas**). ② **`questDbIds`
  persisté** (`upsertRushSequence`, borné : entiers > 0, dédoublonnés, 10 max). ③ **S4-2** : cité / Ordre / palier /
  classe éditables sur une séquence **existante**. ④ **S4-4** : `importRushGuide(raw, apply)` — **dry-run par défaut**,
  l'import **ajoute** seulement (aucun `delete`/`update` dans son corps, verrou de source), idempotent. ⑤ **Référentiel
  d'Ordre corrigé** : le studio écrivait l'id court de `ORDERS` (`vaillant`) alors que la route attend `coeur_vaillant`
  — source unique `src/lib/rush-order-codes.ts`, comparaison normalisée, jumelles d'Ordre en code canonique.
  ⑥ **T-4 (O14/T2)** : contraste garanti des **24** accents Dofus (`src/lib/rush-dofus-accent.ts`, 4,5:1 sur fond
  clair **et** sombre). ⚠️ L'`aria-pressed` posé dans #1136 visait `DofusProgressStrip.tsx`, **jamais monté** : le
  fichier a été **supprimé le 27/10/2026** et le verrou T2 **repointé** sur le bandeau réel (`GuildStatusPanel`), livré
  avec #1137. **Aucune migration.** ⚠️ Restent **T-4** G7/G8/G9/O15 (composition visuelle, à juger à l'écran) et le sort
  de `questDbIds` (écrit ; seule la puce du studio God l'affiche, **aucune surface joueur**).
- **Livré le 26/10/2026 — outil « Trame Rush » hors dépôt (prépare S1).** Siphon Tougli mesuré : **530** quêtes,
  **36** blocs, séries d'alignement **100 / 102**, **30** quêtes d'Ordre (6 × 5), **19** quêtes de classe, **99**
  donjons (**99** rapprochés de `Dungeon`, dont **3** alias), **361 / 384** quêtes Dofusyelle rapprochées et
  **530 / 530** quêtes présentes dans `GameQuest` (`dofusDbId`) ⇒ l'export ne crée **aucune référence morte**.
  Sortie : `export-god.json` par route (**34** blocs, **434** séquences côté Bonta / **436** côté Brâkmar, **127**
  avec `dungeonIds` résolus) avec les champs de `GuideSequence` **pré-remplis**. **Non versionné**
  (`src/temp/trame-rush/`, `/src/temp/` ignoré) : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` §7bis.
  ⚠️ L'outil **n'écrit rien** : il produit un fichier, que God importe en **dry-run** (lot **S4-4**, livré le 26/10). Mesure du guide en base : **336**
  séquences / 96 blocs, `alignOrderCode` et `classReq` **à zéro** — c'est le trou que S1 doit combler.

- ⏳ **En attente de prod (26/10/2026)** — la **bêta** tourne `dev` `2a06ef26` (**287 migrations**, `sigilos-beta`) ; la
  **prod** reste sur `main` `66040052` (**267 migrations** ⇒ **20 en attente**). Lots non déployés : calendrier/membres/
  blacklist/succès (25/10) **puis stuff & variantes** (panoplies recalculées, pods, plafonds, veille auto-entretenue).
  Bascule : PR `dev` → `main` → CI verte → `./scripts/deploy-cd.sh prod` → **puis, dans cet ordre** :
  ① `backfill-dungeon-completion` (`docs/MAINTENANCE.md` § Rattrapage) ; ② `siphon-item-sets?apply=1` — **en premier**,
  le référentiel prod est **vide** et sans lui les variantes à panoplie sont refusées (fail-closed) ; ③
  `siphon-item-conditions?apply=1` (264) ; ④ un `data-watch` manuel (pose le filigrane des panoplies) ; ⑤ les lignes de
  crontab prod (`docs/MAINTENANCE.md` § Tâches planifiées — **une seule** `data-watch`, elle existe déjà sur le VPS).
  ⚠️ La crontab du VPS vise `beta.sigilos.fr` (`APP_URL`). Détail ordonné : `docs/plans/AMORCE-STUFF-VARIANTES-RESTE.md` §1.
- **Livré le 26/10/2026 — Bonus de panoplie recalculés dans une variante (lot A de l'amorce stuff/variantes).**
  Mesures : ① `GET /item-sets/242` (Danathor) → `effects` est un **tableau indexé par palier** (`index = pièces − 1`),
  ligne `{ characteristic, from, effectId }` ; **56 ko par panoplie** (elle embarque ses objets complets), 940 au
  total ≈ **53 Mo**, et `$select` **n'est pas supporté** ; ② `GET /characteristics` (**123 entrées**) tranche le
  mapping : `85` = « Poussée (fixe) » = une **réduction** (`rp`), `84` = dommages de poussée (`dp`) — le code rendait
  `dp` pour `85`, donc une panoplie « Ré Poussée » créditait les dommages ; ③ la pagination **perdait la dernière
  page** (900/940) parce que `skip` était avancé **avant** le test de fin. Fait : table `GameItemSet` (migration
  additive `20270120000000_item_sets`, `id` = id DofusDB, `tiers` JSONB normalisé), siphon `src/lib/item-sets-siphon.ts`
  + `npm run siphon:item-sets` (**938 panoplies** écrites, **2 refus** explicites — `38` absent du référentiel, `121`
  hors modèle —, **2ᵉ passage = 0 écriture**), règle pure `src/lib/dofus-set-bonuses.ts` (≥ 2 pièces **distinctes**,
  **palier le plus haut**, jamais d'addition) **extraite du parseur** (une seule vérité), `applyVariantsToBuild(base,
  variants, itemSets)` qui **retire** les bonus d'origine puis réapplique les nouveaux **via le mapping de stats
  existant** (aucune règle dupliquée), résolution serveur bornée `src/server/build-item-sets.ts` branchée sur la
  galerie et les **2** pages de profil, et `saveBuildVariant` qui évalue les conditions d'objet sur les stats
  **effectives** (au lieu de celles du stuff d'origine). Fail-closed : panoplie inconnue ou contexte incohérent ⇒ la
  variante n'est **pas calculée** (« Panoplie indisponible ») et le serveur **refuse** l'enregistrement. Verrou
  `dofus-set-bonuses` **5 → 24** (dont la pagination et le payload réel mesuré). Suite **5 442 ✓ / 517 fichiers**,
  `tsc` 0, ESLint 0 erreur. **1 migration additive.** ⚠️ **Ops** :
  `migrate deploy` + `generate`, `npm run siphon:item-sets -- --apply`, redémarrage de l'app.



- **Livré le 26/10/2026 — Pods, veille des conditions et finitions (lots B, C, E de l'amorce stuff/variantes).**
  Mesures : ① **Pods** — le payload Dofusbook ne porte **aucun poids** ; Dofusbook affiche **1950** (build
  `22329554`, Force **190**) et **1250** (build `23582119`, Force **50**) ⇒ `1000 + 5 × Force` colle aux **deux**
  exactement : c'est une **capacité**, pas une charge (`GameItem.realWeight` inutile) ; l'API restant bloquée par
  le WAF (403), la page n'a pas pu servir de 3ᵉ point — la formule est donc prouvée sur 2 builds et verrouillée
  par test. ② **Veille** — en base : **264** objets conditionnés (conforme au mesure du 25/10), **403** atomes,
  **12** non évaluables (`Être abonné` 8, `Niveau d'alignement` 2, `Être niveau {0} ou plus` 1, `Kamas` 1) et **13**
  types d'objet hors `VARIANT_SLOTS` ; **2ᵉ passe : `changed=false`, 0 nouveauté** (aucun bruit hebdomadaire).
  Fait : règle pure `src/lib/dofus-pods.ts` (`1000 + 5 × Force` + pods d'objets, `—` si Force inconnue), parser qui
  somme les pods d'équipement (`stats.pod`), `applyVariantsToBuild` qui déplace la capacité avec la Force ; atomes de
  condition (`listConditionAtoms`) + agrégateur pur `src/lib/item-conditions-watch.ts` (par élément **et** opérateur)
  + instantané Redis (`game-data:watch:item-conditions`) + branchement au cron **`data-watch`** (dry-run, aucune
  écriture métier) qui **alerte le God sur la nouveauté seule** ; `unknownVariantItemTypes` (types hors slots
  **signalés**, jamais devinés) ; **contrat de payload** verrouillé (deux formes d'`element`, relations `{and, or}`,
  opérateurs mesurés) avec deux corrections fail-closed : **relation inconnue ⇒ refus** (elle passait pour un ET) et
  **`int_value`/Force absents ⇒ refus** (`Number(null) === 0` faisait satisfaire « PA > -1 » et affichait `1000` de
  pods). Finitions **actées** (résistances secondaires hors carte, `% Do Finaux` inchangé, `criterions`/`twoHanded`
  sans passe complète). Verrous : `dofus-pods` **7** · `item-conditions-watch` **7** · `dofus-conditions` **+4 cas** ·
  `dofus-variant-rules` **+2 cas**. Suite **5 461 ✓ / 519 fichiers**, `tsc` 0, ESLint 0 erreur. **Aucune migration.**

- **Livré le 25/10/2026 — Synchro Dofusbook : `force` de bout en bout, stats `ii`/`ic` comptées, correspondances DofusDB prouvées.** Mesures : ① le worker CF mettait **toute** réponse 2xx en cache **24 h** (clé stable) et **ignorait `force`** ⇒ un item retiré sur Dofusbook restait affiché, et `storeClientDofusbookPreview` redatait `updatedAt` sans changement ; ② `processDofusbookRawData` ne mappait que `ini`/`invo` alors que les payloads — **et les panoplies** — portent **`ii`/`ic`** (`Panoplie de Danathor` = `ii+500@2`) ⇒ initiative bloquée au socle `level×5` (**1000** au lieu de **1788**), invocation à **1** ; ③ **siphon réel** du build `1awml` (id `23582119`, 35 ko) : `cloths[].effects[].count/value`, `items[].constraints` ; ④ **DofusDB porte les mêmes données** (`items/{ankamaId}` → `itemSetId`/`itemSet.name.fr` ; `/item-sets/{id}` → paliers `characteristic`+`from`, ex. `c44=500` initiative, `c26=1` invocation, `c79=5` tacle) ⇒ **aucune dépendance à Dofusbook pour être souverain**. Fait : `force` propagé (`bakeDofusbookFromBrowser(url, guildId, { force })` → `&force=1` → worker sans lecture de cache, `cf.cacheTtl: 0`, TTL **60 s**), `changed` renvoyé par l'action (plus de `updatedAt` menteur), mapping `ii`/`ic` (`sp`/`at` explicitement ignorés : sorts/atouts). Verrou `dofusbook-sync-force` **7**. Suite **5 371 ✓ / 513 fichiers**, `tsc` 0, ESLint 0 erreur. **Aucune migration.** ⚠️ **Ops** : redéployer le worker (`wrangler deploy` dans `cloudflare-workers/dofusbook-proxy`) sinon le cache 24 h reste actif.

- **Livré le 25/10/2026 — Exclusions : la guilde peut enfin réintégrer un exclu, et le ban God coupe tout.** Mesures : ① une exclusion dont le profil a été **purgé** était **invisible** dans `/admin/members` (carte « Exclus » à 0, seule la table God la voyait) ⇒ indéblocable par le staff ; ② la **modale** ne pose aucun tombstone (seul `deleteProfileByAdmin`, table God, en pose un) ; ③ « Lever l'exclusion » seul ne suffisait pas (`status = BANNED` bloque aussi) ; ④ `reintegrateMember` **supprime** le tombstone mais n'auditait pas et n'invalidait pas le cache 60 s ; ⑤ `banEntity('USER')` ne purgeait ni sessions ni caches ⇒ un banni plateforme voyait « Bêta Fermée ». Fait : règle pure `mergeExclusions` + carte « Exclus » comptée sur les deux sources + bandeau « Exclusion active » et « Lever l'exclusion » (lift puis réintégration) ; écran **« Membre exclu »** (ex-« Accès Banni ») avec le **motif** et les **rôles** de contact (jamais de personnes) ; écran **« Compte suspendu »** distinct + purge sessions/cache à la pose d'un ban plateforme ; **cartes Discord** branchées sur suppression/archivage/exclusion manuels ; réintégration **tracée** (`PROFILE_REACTIVATED`) et visible immédiatement. Côté God : tick 1 s du bandeau conditionné, squelettes statiques, `backdrop-blur` retiré, libellés d'actions de guilde alignés et confirmations traduites. Verrous `member-roster-exclusions` **8** + `permissions-contact-roles` **4**. **Aucune migration.** ⚠️ **Reste** : deslop God vagues 2-3 (Command Center, statuts de guilde, sous-pages roster, `ticket-dashboard`/`guild-table`/`platform-config-panel`/`changelog`) ; arbitrage « Compte Archivé » affiché quand le profil est `ACTIVE` mais le membre introuvable côté Discord.
- **Livré le 25/10/2026 — Succès : les doubles boss redeviennent cochables (« Donjon validé »), et l'écran respire.** Mesure : « Comte et Klime / Nileza / Sylargh / Missiz Frizz » affichaient « Succès — 0/0 » et **aucune coche** n'était possible (DofusDB ne liste pas leurs succès ⇒ le seed ne créait aucune ligne). Fait : le pseudo-succès `donjon-valide` est **réintroduit de façon ciblée** — rendu **uniquement** quand il est le **seul** succès du donjon (`visibleDungeonAchievements`, règle pure ; la décision du 11/10 reste vraie partout ailleurs), appliqué aux 3 lectures (hub, annuaire, fiche boss) ; rattrapage idempotent `scripts/backfill-dungeon-completion.ts` (**dry-run par défaut**, `--apply`, crée le challenge s'il a été purgé) + seed ; **mesuré en local** : 4 donjons sans succès reçoivent la coche, les 4 doubles boss la portent déjà. Bouton « Chercher un groupe » avec **vrai asset** Dofus (`game-icons/crossed-swords.png`) dans les 3 écrans ; CTA en `bg-elevated` + `border-border-strong` (fin du sombre sur sombre), sans `font-black` ni `uppercase tracking-wide`. Verrous `dungeon-completion` **7** + `succes-ui-deslop` **4**.

- **Livré le 26/10/2026 — Plafonds PA/PM/**PO/Invocations** et refus de variante **explicite** (retour utilisateur sur captures).**
  Constats : ① un familier **+1 PA** sur un build à 12 PA affichait **13 PA** — « impossible normalement sur
  Dofus ». Ce n'est **pas** un siphon (le +1 PA est réel) mais des **règles manquantes** : un build ne dépasse
  pas **12 PA**, **6 PM**, **6 PO** ni **6 invocations** (Dofus Wiki, `Characteristic` § Action Point / Movement
  Point / Range / Summons — « the bonus will not be included »). ② le badge « Panoplie indisponible » ne disait
  **pas sa cause** — impossible de distinguer « données non synchronisées » d'une donnée réellement absente.
  Mesures : la garde de cohérence **passe** sur le build signalé (*panda air* : 3/3), donc le badge venait d'un
  **rendu antérieur au siphon** ; **252 / 264** conditions d'objet sont évaluées, les **12** refusées sont des
  propriétés hors build (abonnement 8, alignement 2, kamas 1, niveau `{0}` exotique 1) ; le trophée *Dévastateur
  Feu majeur* (`Bonus de panoplies < 2`) est **refusé dès 2 panoplies** — règle du jeu, pas blocage.
  Fait : règle pure `src/lib/dofus-caps.ts` (4 plafonds) appliquée à l'**affichage** (badge, pastilles, fiche)
  avec le point excédentaire **dit** (« +1 ignoré (plafond 12) ») — le total brut reste en données ; conditions
  d'objet jugées sur la valeur **plafonnée** ; `explainVariantRefusal` distingue **3 causes** (contexte absent /
  panoplie inconnue / contexte incohérent) avec **noms** et action, dans le badge + l'infobulle ; **rattrapage**
  du contexte par la miniature (`getVariantItemSets`, lecture seule, 64 ids max, membres seulement).
  Verrous `dofus-caps` **6** · `dofus-set-bonuses` **+4 cas** (refus motivés). Suite **5 471 ✓ / 520 fichiers**,
  `tsc` 0, ESLint 0 erreur. **Aucune migration.**
- **Livré le 26/10/2026 — Variante **partagée** (image OG + embed Discord) et veille des conditions **visible côté God**.**
- **Livré le 26/10/2026 — Siphon des panoplies **exécutable en production** (route cron + curseur).**
  Constat mesuré : l'image de prod est un **build standalone** (le `Dockerfile` ne copie que `scripts/` et
  `.next/standalone`) ⇒ **ni `tsx` ni alias `@/`** dans le conteneur : `scripts/siphon-item-sets.ts` ne peut pas y
  tourner, et le référentiel restait **vide en bêta** (variantes refusées, faute de paliers). Fait : route
  **`GET /api/cron/siphon-item-sets`** (`x-cron-secret`, **dry-run par défaut**, `pages` borné pour rester sous les
  timeouts de proxy, `startSkip`/`nextSkip` pour enchaîner) qui exécute le **même cœur** `siphonItemSetsCore` —
  aucune logique dupliquée, aucun SSH. Ops : `curl -H "x-cron-secret: $CRON_SECRET"
  ".../api/cron/siphon-item-sets?apply=1"`. Verrou `dofus-set-bonuses` **+2 cas** (reprise + garde de la route).
  Le script local reste la voie de dev (`npm run siphon:item-sets -- --apply`).
- **Livré le 26/10/2026 — Maintien long terme : la veille **entretient** au lieu de seulement alerter.**
  Trois trous mesurés, trois fermés (détail et chiffres : `docs/agents/activeContext.md`). ① `data-watch` ne
  relançait la veille ciblée que `if (hasNews)` — un rééquilibrage de stats (3.7) ne bouge **aucun compteur** :
  l'entretien devient inconditionnel (seule la **notification** reste conditionnée). ② `GameItemSet` n'était
  rafraîchi par **rien** ⇒ `src/server/item-sets-refresh.ts` (passe ciblée `updatedAt[$gt]`, filigrane Redis
  sans TTL posé seulement sur passe complète, bornée, fail-open). ③ le siphon des conditions échoue **dans le
  conteneur** (`@prisma/driver-adapter-utils` absent du build standalone) ⇒ porté dans l'app
  (`src/lib/item-conditions-siphon.ts` + route + script enveloppe) : **plus aucune tâche manuelle**.
  `docs/MAINTENANCE.md` gagne les **deux lignes de crontab** et le tableau « ce qui suit le jeu tout seul / ce
  qui reste humain ». Verrous : `item-sets-refresh` **6** · `item-conditions-siphon` **7** ·
  `normalizeSince` **2** · `data-watch` **+1** (contrat « stocks alignés » inversé, motif écrit).

  Deux restes de l'amorce soldés : ① l'arbitrage du 23/10 (« afficher la variante avec un tag explicite ») est
  appliqué par **une seule règle** (`resolveVariantPreview`) : l'image OG montre les icônes de la variante + un
  badge **VARIANTE**, l'embed Discord met `· 🟡 Variante` dans le titre, affiche les stats **effectives** et liste
  les objets remplacés (6 max) ; le tag n'est posé **que si le calcul a réussi** (fail-closed). ② la veille des
  conditions a son **bandeau dans le Tableau God** (`getItemConditionsWatch`, réservé à `canAccessGameData`) :
  objets conditionnés, atomes non évaluables (élément + opérateur), types hors variantes, date du calcul —
  **lecture seule**, la source reste le cron `data-watch`. Verrou `dofus-variant-sharing` **5**. **Aucune migration.**

- **Livré le 26/10/2026 — Relais Dofusbook **redéployé** : `force` contourne enfin le cache.**
  Mesure avant : l'URL signée appelée avec `force=1` renvoyait **`X-SigilOS-Cache: HIT`** (au lieu de `BYPASS`) et
  le **même** payload que sans drapeau ⇒ la version **déployée** du worker était antérieure au correctif du 25/10
  (le code du dépôt était bon). Vérifié **en local** d'abord (`wrangler dev --local` : `MISS` → `HIT` → **`BYPASS`**),
  puis **déployé** (`wrangler deploy`, même nom `test-dofusbook`, **version `175b2e54`**) et **contrôlé en
  production** (`force=1` → `BYPASS` ✔, `X-Proxied-By: SigilOS-CF-Worker`). ⚠️ **En-tête de diagnostic corrigé** :
  c'est **`X-SigilOS-Cache`**, pas `X-Cache` (une mesure précédente avait conclu à tort « pas notre worker »).
  ⚠️ **Blocage source constaté juste après** : Dofusbook répond **403** sur le `BYPASS`, **aussi depuis une IP
  résidentielle et sur sa page d'accueil** ⇒ blocage **temporaire de la source** (bot-management / limiteur),
  pas un défaut du relais : l'app conserve les dernières données connues et l'annonce. **Aucun code applicatif
  changé par ce lot** (hors le message de l'UI et le `logger.warn` du tour précédent).


- **Livré le 25/10/2026 — Ancienneté : fin du scroll de 1 000 px.** Sept sous-onglets (Activation / Éligibilité / Paliers / Détail des paliers / Message / Prochains paliers / État & passes) ; l'enregistrement reste **hors** des onglets ; aperçu du salon résolu (`#nom` + lien Discord) ; paliers **triés par seuil** ; prochains paliers **paginés par 10** avec la colonne **« Rôle visé »** (`tierRoleIds` ajouté au payload). Verrou `seniority-roles-tabs` **10** (+ `seniority-roles-upcoming` réécrit sans l'affaiblir).
- **Livré le 25/10/2026 — Blacklist : l'embed Discord suit vraiment l'édition.** `editBlacklistEntry` avalait l'échec Discord (404, message supprimé, ID `outbox:`) et répondait « succès ». Désormais : PATCH si possible, **repost + ré-ancrage** sinon, statut honnête remonté (`posted/updated/reposted/deleted/no_channel/unavailable`) et affiché ; l'ajout ré-ancre le vrai ID ; la suppression remonte son statut ; écritures filtrées par `guildId`. Teintes sémantiques restaurées (pseudo signalé en rouge, guilde en ambre). Verrous `blacklist-discord-sync` **7** + `member-blacklist-deslop` **10**.
- **Livré le 25/10/2026 — Membres : onglet « Mules » et compteur « en guilde en jeu ».** L'inventaire des mules déclarées quitte l'onglet Membres (trop chargé) pour un onglet **Mules** dédié, qui porte le compteur demandé : **rôles Discord cochés** (une personne portant plusieurs rôles cochés ne compte **qu'une fois**) **+ mules taguées** « en guilde en jeu ». Fait : colonne **`GuildConfig.inGameGuildRoleIds`** (migration **additive** `20270118000000_add_in_game_guild_roles`, `TEXT[]` vide par défaut) ; règle pure `src/lib/in-game-guild.ts` (`tallyInGameGuild`, `normalizeInGameGuildRoleIds` borné à 50 + intersection avec les rôles réels, `withMuleInGameGuild` insensible casse/accents, `isMuleInGameGuild`) ; actions `setInGameGuildRoleIds` / `setMuleInGameGuild` (`src/server/actions/member-in-game-actions.ts`) avec RBAC fail-closed `Gérer les membres`, cible **résolue dans la guilde**, Zod borné, **rate limit Redis**, audit, `fetchGuildRoles` en **fail-closed** (Discord injoignable ⇒ refus) ; le tag vit dans le **JSON `altPseudos` existant** (`inGameGuild: true`, aucune migration, rétrocompatible) et se pose depuis la puce de mule (bouton accessible `aria-pressed`, badge « En guilde ») ; compteur calculé **côté client** depuis `RosterRow.roles` (déjà chargé par `listGuildMembers`) — **aucun appel Discord en plus** ; `@everyone` jamais proposé ; **bots Discord exclus** (la source les écarte déjà via `member.user.bot`, la règle `tallyInGameGuild` le vérifie explicitement — `RosterRow.isBot`) ; bouton **« Tout décocher »** dans le panneau (remise à zéro locale, l'enregistrement reste explicite) ; **onglet Blacklist refondu** (anti-slop : plus de `font-black`/italique, rayons ≤ 8 px, actions de ligne **toujours visibles** et nommées, une seule teinte d'accent, formulaire relié à son aide). Verrous : `in-game-guild` 13 · `in-game-guild-actions` 7 · `member-mules-tab` 12 · `member-blacklist-deslop` 8 (+ `member-mules` 18 inchangés). Suite **5 309 ✓ / 505 fichiers**, `tsc` 0, ESLint 0 erreur, build OK. **Ops : `deploy` joue la migration** (aucune action manuelle).


- **Harnais (24/10/2026)** — une règle manquait : **on ne touche pas à Discord sans avoir vérifié la source officielle**. Ajouts : `.clinerules/06-discord.md` (règle scopée, toujours chargée sur `src/app/api/discord/**`, `src/server/discord.ts`, `src/lib/discord/**`, tickets, `services/discord-bot/**`), skill `.cline/skills/discord-api/SKILL.md` (doc → types installés → `GET` de mesure → code, + pièges mesurés) et `docs/agents/discord-module.md` **§0** (le « pourquoi » : une donnée absente n'est pas une impossibilité). Table `harnais.md` et §2 d'`AGENTS.md` mis à jour. Verrou `harness-config` inchangé (frontmatter, `name` = dossier, `paths:`).

- **Prochaine étape** : **S1 — le contenu** (séries bontarienne/brâkmarienne, 30 quêtes d'Ordre, 19 classes, prérequis) — l'outil de saisie est prêt. **Livré le 23/10/2026 (une PR)** : ① **S4-1 vue Branches à 2 étages** (cité → Ordre, paires alignées par position, manques, cible **100 / 102**, orphelins signalés) — règle pure `src/lib/rush-branches.ts` + onglet God ; ② **passifs d'objets souverains** (effet natif **1175** → sort DofusDB, **117 sorts** siphonnés, `src/data/item-passives.json`, repli inventé Prysmaradite **supprimé**, description officielle des Prysmaradites dans la bibliothèque) ; ③ **peinture de la simulation réparée** (trou **rendu**, cloisonnement **par carte**, cases hors grille écartées) ; ④ **variantes proposées par le joueur** (persistées dans `dofusBookLinks[].variants`, bascule **Stuff ⇄ Variante** sur la miniature **et** la modale, stats/dégâts recalculés, synchro Dofusbook intacte) ; ⑤ **coche « fait »** des succès de donjon de la fiche boss (y compris **double boss**), table `UserDungeonAchievement` déjà en base. **Verrous** : `rush-branches` 9 · `item-passives` 8 + `dofus-passives` 4 · `sim-peinture` 8 · `dofus-variants-saved` 11 · `boss-achievement-check` 8 → **suite 5 086 ✓ / 480 fichiers**. **Aucune migration.**
- **Rush — parité guide interne/public (22/10/2026)** : trois écarts mesurés puis corrigés — ① le **rail de droite** ne suivait pas le scroll (deux boîtes de défilement intermédiaires, `overflow-hidden` + `overflow-y-auto`, annulaient le `sticky` ; le seul scrolleur est `<main data-scroll-container>`) ; ② les **positions** manquaient dans le guide interne (regex locale sur `pos_tags` au lieu de `getSequenceCoord`, qui lit aussi titre/tips/note), et l'en-tête d'un bloc à **une seule quête** affiche désormais la sienne (`blockHeaderCoord`) ; ③ **« qui peut aider » (S4) retiré** — badge interne seul, affichait « 0 peut aider » et coûtait un appel serveur par quête. **Le suivi entre membres reviendra en onglet dédié** (`D-G1`). Verrous : `rush-guide-rail-bloquee` **8** · `rush-guide-utils` **55** · `rush-public-parity` **38** · suite **4 913 ✓**. PR **#1089** (porte aussi le lot « rappels de raid J-1 / 24 h » de la session parallèle).
- **Prod 22/10/2026 — remise en état** : l'ordre des migrations était faux depuis le 10/10 (`add_component_stats` altérait une table créée un mois plus tard) → **32 migrations appliquées** avec succès sur la prod, 6 conteneurs `Healthy` en **Node 24.22.1**, `api/health` **200**. Deux correctifs sont poussés mais **pas encore actifs en prod** : le seed des donjons (colonne `slug` requise) et la vitrine Caddy (les `/images/*` répondaient `200 text/html` → carrés blancs). **Op** : `./scripts/deploy-cd.sh prod 6604005`, puis `curl -I https://sigilos.fr/images/songes-bosses/3828_Protozorreur.png` = `200 image/png`.
- **Rush Sylvestre — coche donjon + guide réparé (21/10/2026)** : les deux sources sont mesurées et figées (Tougli **100 / 102** séries + 30 Ordres + 19 classes ; Dofusyelle **57 étapes / 21 prépa / 40 saves / 62 succès**) · **union ressources 584**, donjons 99 + 83 (67 slugs identiques) · **verrou de donjons livré de bout en bout** : règle pure, table `PlayerGuideDungeonState` (**une coche par quête × donjon**), refus à la validation (quête **et** bloc), coche **DANS la quête** (pastille `Donjon ×N` → panneau ouvert) sur l'overlay (interne et invité), le dashboard et le guide public, **décocher un donjon dévalide la quête** (S0-7) · **guide interne réparé** : pagination par chapitre (23 pages fantômes → une page par chapitre/libellé), sommaire retiré, rail de droite réellement collant, prérequis ciblé visible. **Ops** : jouer la migration `20270115000000` en bêta puis prod (déjà en local). **Prochain lot** : `S0-6` (case « optionnel » par donjon dans God — sans elle tout donjon est requis) → `S4-1` (vue Branches 2 étages) → `S1` (contenu). Organisation complète : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md`.
- **Rush — overlay : verrou de donjons et notifications (22/10/2026)** : trois défauts mesurés puis corrigés — ① une quête dont un **donjon requis** n'était pas coché restait **cochable** (le verrou de l'overlay ne testait que les prérequis) → clic renvoyé au serveur → « erreur de synchronisation » ; ② ce message s'affichait **hors de l'overlay** (le `toast` de sonner rendait dans le Toaster du document hôte, pas dans le portail PiP) ; ③ la modale donjons était fade. Livrés : `missingRequiredDungeons` (clé + nom) + verrou composé **avec états chargés d'emblée**, mention « Donjons requis non validés » **avec les vignettes** des donjons manquants (clic = ouvre le panneau **en ciblant** le donjon), Toaster **dédié** `rush-overlay` dans le portail, et refonte de la carte donjon (aplats d'état, vignette 40 px, barre de progression). Verrou : `rush-overlay-dungeon-gate` **12 cas**. ⚠️ Restent hors périmètre : les sélecteurs **Ordre / Classe** côté joueur (voir §7 du présent fichier).
- **Décisions bloquantes** : `D-R1` (moteur de rôles), `D1`/`D2` (RAID), `D7` (landing), `D8` (Cloudflare).
- **Ops en attente** : migrations `20270112000000` + `20270113000000` · redéploiement du bot · crontabs (sondages `* * * * *`, ancienneté `30 4 * * *`, 4 rappels) · **redéploiement bêta** (image Node `24.22.1` + migration renumérotée, voir `docs/agents/node-runtime.md`).
- **Mesures du 19/10** : 155 `console.*` hors tests · **0** import de `src/lib/env.ts` · **Grafana retiré** de l'exposition publique (God → Système & Infra).
- **Bêta** : déployée en `5b31ad0` (19/10/2026) — 6 conteneurs `Healthy`, pages **200**, `monitor.sigilos.fr` **inaccessible** (voulu).

## 1. P0 — Bloquants prod / ops / sécurité (ordre strict)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 3 | `ouverture-prod` (#57) | `robots.txt`, `sitemap.xml` et `llms.txt` renvoient la page d'attente (HTML) ; 2 apps Discord à isoler ; hardlinks ; rewrite Caddy à retirer | mesuré le 21/09/2026 | robots/sitemap statiques + `noindex` ; checklist Jour J | `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md` · `docs/plans/SEO_REPRISE.md` | **D7** (landing) |
| 4 | `restore-db` (F7) | La restauration n'a jamais été jouée ; le script purge à **3 j** alors que la doc dit **30 j** | `scripts/backup_db.sh` ↔ `docs/MAINTENANCE.md` | jouer un restore sur base jetable + écrire date et RTO | `docs/agents/disaster-recovery.md` | — |
| 5 | `migrations-ops` | 2 migrations additives + bot + crontabs non déployés | `20270112000000` (GodNotification.details), `20270113000000` (DiscordMemberActivity) | jouer bêta puis prod ; redéployer le bot ; poser les 4 crontabs | `docs/MAINTENANCE.md` | — |
| 6 | `caddy-post-503` | Pendant une maintenance, un POST reçoit du HTML au lieu d'un `503 text/plain` | cause racine du 16/10 | durcir le `Caddyfile` (POST → 503) | `docs/MAINTENANCE.md` | — |
| 7 | `csp-enforce` (F10) | CSP en Report-Only : la protection XSS ne bloque rien | `CSP_ENFORCE` présent dans `src/proxy.ts` | poser `CSP_ENFORCE=true` après 48 h de rapports | `docs/SECURITY.md` | — |
| 8 | `presentation-access` | `presentation:view` existe mais n'est pas ouverte au rôle Membre ; l'ancienne page `/presentation` rend encore le règlement | 1 occurrence dans `src/` | ouvrir la permission + trancher la page | — | **D-P1** |
## 2. P1 — Chantiers produit (ordre proposé)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 9 | `rush-refonte` (T) | Rush Sylvestre : ergonomie, temps réel, éditeur God, habillage Dofus, perf | **T-1, T-2, T-2b, T-3 livrés** le 08/10 · **T-2c livré** le 20/10 · **T-4 partiel** le 26/10 (**O14** contraste des **24** accents Dofus + **T2** état accessible du **bandeau réel**, verrou T2 repointé le 27/10 après suppression du composant mort) | **T-4** reste G7/G8/G9/O15 → T-5 → T-6 | `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 10 | `rush-donnees` (V) | Rush Sylvestre : agrégation unique des ressources, ids/icônes, alignement, ocre, Metamob | **V-A, V-B livrés** le 10/10 · **V-G livré** · **V-F partiel** · **consolidation Tougli × Dofusyelle mesurée le 21/10** (100/102, 584 ressources, 30 Ordres, 19 classes) · **donjons cochables livrés** (S0-1 → S0-5bis, **S0-6**, **S0-7**) · **S4-1 livré** le 23/10/2026 (vue Branches 2 étages, `src/lib/rush-branches.ts`) · **outil Trame hors dépôt livré** le 26/10 · **S4-2 + S4-4 livrés** le 26/10 (route éditable sur une séquence **existante**, import **dry-run**, identité de quête assistée + `questDbIds` persistés) · **S5-1 partiel livré** le 27/10 (`alignOrderReq` ni lu ni écrit ; colonne conservée — drop = migration) | **S1** (contenu) → V-C → V-D → V-H | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` · `docs/plans/MAPPING-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 11 | `tickets-v2` (C) | Module Tickets : finir la v2 (SLA, auto-fermeture, i18n, doublons) | 5 chantiers UX livrés le 20/10 ; **commandes slash personnalisées livrées le 21/10** ; **perfectionnements UX embed, custom CSAT, variables {staff}/{moderateur} et RBAC staff commandes le 22/10** · **renommage Discord suivi par le salon (cron `sync-members`) le 25/10** · **renommage temps réel par le bot (surnom ou nom d'utilisateur) le 25/10** | C-1 → C-4 | `docs/plans/PLAN-REFONTE-TICKETS-V2.md` | — |
| 12 | `roles-multi` (Y+) | Moteur unique de rôles : ancienneté (projection) + vocal + contribution | cadré le 18/10, **aucun code** | R-1 (évaluateur + stockage) → R-2 (cron + annonces) → R-3 (onglet) | `docs/plans/PLAN-MOTEUR-ROLES-MULTI-SOURCES.md` | **D-R1** |
| 13 | `commandes-slash` (Z) | Commandes slash personnalisées (catalogue ∪ guilde, payloads dérivés) | **Z-1/Z-2 livrés le 24/10** (sync réelle rôles + salons, payloads dérivés du catalogue, scope God par guilde) · **25/10 : `/valider-recrue` fix pérenne anti-timeout** (résolution 0 ms à l'ouverture, deferred reply type 5 à la soumission) ; reste Z-3/Z-4 | Z-3 → Z-4 | `docs/plans/PLAN-COMMANDES-SLASH.md` | — |
| 14 | `roles-succes` (S) | Rôles par points de succès ladder (même moteur que Y) | migrations **accordées** le 15/10 | S-1 → S-3 | `docs/plans/PLAN-ROLES-SUCCES.md` | — |
| 15 | `activite-guilde` (N) | Activité de guilde enrichie + notifications | N-1 et N-4 livrés pour les paliers ; **4 sources restantes** (Dofus, succès, donjons/DJ, songes) | N-2 (4 sources) → N-3 → N-4 | `docs/plans/PLAN-ACTIVITE-GUILDE.md` | — |
| 16 | `raid` (G) | RAID : calendrier, clôture/no-show, strat, overlay, données | R1 et §3 livrés ; **R2 → R10 ouverts** | R2 (no-show) → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10 | `docs/plans/PLAN-RAID.md` · `docs/plans/AMORCE-RAID.md` | **D1 + D2** |
| 17 | `orphelins` (F) | Reprise de relai quand le créateur d'un raid/DJ/quête a disparu | né le 01/10 | F-A → F-B → F-C | — (à créer) | **D3** |
| 18 | `marche` (I) | Marché : images d'embeds, validation FR, lot multiple (5 objets), multi-embed | S7 livré ; reste le lot multiple et l'étape « Publication » | I-1 + lot multiple | — (à créer) | **D-M1** |
| 19 | `services` (J) | Services : clôture, inactivité, feedback, images, forum ; `valider-recrue` en ticket | ouvert · **25/10 — un salon par flux** (PR #1113 + branche empilée) : annonces en **forum obligatoire** (tags par catégorie), demandes en forum **ou** texte ; **anti-doublon** (édition = PATCH, jamais un 2ᵉ sujet) ; statut de publication remonté à l'écran (badge + bouton Publier) · **bouton Documentation `services` ajouté** (contenu écrit en local, à uploader) | J-1 → J-2 | — (à créer) | — |
| 20 | `succes` (K) | Succès & encyclopédie : onglet Monstres, succès imbriqués | ouvert | K-1 → K-2 | — (à créer) | — |
| 21 | `mini-jeux` (H) | Mini-jeux & salons temps réel : solidité Redis, solo, Panthéon, HUD/UX | ouvert | H-1 → H-2 | — (à créer) | — |
| 22 | `deslop` (L) | Déslop global : dashboard, admin, landing, modales, ressources, missions, ladder, worldmap | ouvert · demande du 20/10 : **aligner toutes les nouveautés** (landing incluse) | L-1 → L-4 | — (à créer) | — |
| 23 | `guildes-admin` (M) | Guildes & admin : calendrier, profil, stuff, édition staff, logs | volet `membres` livré (05/10) · **inventaire des mules déclarées livré le 25/10** (onglet Membres : total, pseudo, icône de classe, propriétaire) · **Pseudo Dofus vérifié au ladder + embed « fin d'essai » livrés le 25/10** | M-1 reste (calendrier/profil/stuff) → M-2 → M-3 | `docs/plans/PLAN-DESLOP-ANNUAIRE.md` | — |
| 24 | `god-refonte` (O) | Refonte God « Guildes & Users » : 12 chantiers, 7 lots | plan vivant | G1 → G12 | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` · `docs/plans/AMORCE-REFONTE-GOD-GUILDES.md` | — |
| 25 | `acquisition` (E) | SEO / contenu : autorité avant volume | dossier mesuré le 30/09 | E-1 → E-2 → E-3 ; **prérequis** backfill `MonsterStat` (~5 135 fiches) | `docs/plans/SEO_REPRISE.md` | **D6** |
| 26 | `demo-publique` (S) | Démo publique en lecture seule, essayable sans compte | S-0/S-1 livrés (02/10) | S-2a → S-2b → S-3 → S-4 → S-5 | `docs/plans/PLAN-DEMO-PUBLIQUE.md` · `docs/plans/AMORCE-DEMO-PUBLIQUE.md` | — |
| 27 | `salons-vocaux` (Q) | Module « salons vocaux temporaires » (cahier V2.1) | idée neuve, **à cadrer** | cadrage → lots | `docs/plans/PLAN-SALONS-VOCAUX.md` | **D4** |
| 28 | `onboarding` (ONB) | Onboarding & acquisition (prospect → guilde) | proposition du 06/09 | valider la proposition + migration | `docs/plans/PLAN-REFONTE-ONBOARDING.md` | **D5** |
| 29 | `reseau` (NET) | Durcissement réseau : Cloudflare/WAF devant `sigilos.fr` ? | à décider | décision + DPA + pages RGPD | — | **D8** |
| 30 | `observabilite` (W) | Sentry : couverture bot/workers, 25 crons, alertes | W-1/W-2 livrés le 11/10 | W-3 → W-6 | `docs/agents/journal-sessions-2026.md` (bloc 11/10) | — |
| 31 | `dofusdb-zero` (U) | Zéro dépendance DofusDB à l'exécution (5 points de contact mesurés) | cadré le 08/10 | U-1 → U-5 | `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` (cadrage § U) | — |
| 32 | `solveurs` | Solveurs tactiques (Kalisthe, Minogolem, Harebourg) : données de combat, pas de décompilation | prototypes dans `src/temp/` | cadrer → POC | `docs/plans/PLAN-SOLVEURS-TACTIQUES.md` | — |
## 3. P2 — Dette, hygiène, documentation (ordre souple)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| 33 | `menage` (B-2/B-3 → F) | 74 fichiers morts, 16 scripts, doublons, `seed.ts` IDs réels, `refs/cline` 307 + 2 stashes | lot A (7 deps) et B-1 (24 fichiers) livrés le 19/10 | B-2/B-3 → C → D → E → F | — |
| 34 | `hygiene-logs` (F5/F6) | **155** `console.*` hors tests ; masquage des logs à vérifier | mesuré le 19/10 | remplacer par `logger`, masquer snowflakes/e-mails | `docs/RULES.md` |
| 35 | `docs-arbo` | `AUDIT-ARBO-2026-09.md` + `ARCHIVES-TEMP-2026-09.md` : historique pur | 30 Ko | conserver ou supprimer après extraction | `docs/arbo/` |
| 36 | `references` | 3 références possiblement orphelines : `FACTS_GUILDE_2026.md`, `OCR_STRATEGY_2026.md`, `REDIS-OCR-SETUP.md` | 1 à 2 citations chacune | vérifier puis fusionner/supprimer | `docs/reference/` |
| 37 | `service-activity-log` | Table non bornée (preuves de litige) | ≈ 232 ko, hors top 30 | borner ou assumer le coût | `docs/MAINTENANCE.md` |
| 38 | `harebourg-solver` | `harebourg-solver.ts` : brancher ou retirer ? | 1 occurrence | trancher | — |
| 39 | `admin-members-doc` | Doc vivante `admin-members` à mettre à jour | `docs-catalog.ts` figé | éditer dans `/god/docs` | — |
| 40 | `captures-a3` | 3 captures 1440 / 1024 / 390 manquantes | session navigateur connectée | les prendre | — |
| 41 | `active-context-rotation` | Purge effective des blocs ou abandon de la règle des 6 ? | 6 blocs | trancher | `docs/agents/activeContext.md` |
| 42 | `harness-maintenance` | Harnais H0-H7 livré : re-mesurer après stabilisation | cette PR | re-mesure + ajustements | `docs/agents/harnais.md` |
| 43 | `god-system-polish` | Carte Conteneurs vide alors que Prometheus est 4/4 ; pas de détail par conteneur | bêta 19/10 | corriger la requête cAdvisor + tableau (nom, CPU, RAM, redémarrages) + charge CPU/version lisibles | `docs/MAINTENANCE.md` |
| 44 | `grafana-alerts-audit` | Règles d'alerte Grafana éventuelles dans `grafana_data` : plus exécutées | volume conservé, non audité | lister et recréer dans Sentry/webhook si nécessaire | `docs/MAINTENANCE.md` |
| 45 | `deploy-sha-normalize` | `deploy-cd.sh` refuse un SHA 8/40 alors que la CI publie 7 caractères | `5b31ad0f` refusé, `5b31ad0` accepté | normaliser le SHA à 7 dans `deploy-cd.sh` et `rollback.sh` | `docs/agents/deploy-vps.md` |
| 46 | `telemetrie-retention` | `TelemetryEvent` n'a **aucune purge** : la table grossit sans fin | mesuré sur le VPS le 20/10/2026 : **24 Mo**, 2ᵉ plus grosse table applicative ; aucun `deleteMany` dans `src/` | cadrer une rétention (90-180 j) + cron de purge idempotent, testé | `docs/MAINTENANCE.md` |
| 47 | `crits-incoherents` | Effets **critiques inférieurs** aux dégâts de base publiés sur les fiches boss (ex. Phossile : base 426-480, crit 71-80) | mesuré le 20/10/2026 sur **Comte Harebourg** : base 639-810, crit **71-90** (même symptôme) ; `isCoherentCritJet` existe (lot R-4) mais le chemin Dofensive formate les crits en **chaînes** (`criticalEffects?: string[]`) **avant** le contrôle → la règle ne s'applique pas | garder `{min,max}` jusqu'après le contrôle, puis formater ; test de non-régression sur un sort réel | — (à créer) |
| 48 | `donjons-sans-donnees` | **25** donjons de la base sans entrée au catalogue local ⇒ fiche « partielle » (ni résistances, ni butin) | mesuré le 20/10/2026 : **34/151** bandeaux, **9 corrigés par alias** (#1051) ; fichier déployé **identique au dépôt** (187 entrées) ⇒ pas un fichier périmé | vérifier la couverture de `siphon-dungeon-monsters.mjs`, relancer le siphon, puis `sync-assets.sh` (bind mount) | — (à créer) |
| 49 | `simulation-refonte` | Simulation tactique (fiche boss + overlay), **fer de lance** : doc développeur affichée (« Règle du jeu 3.6 », « Motte de zoom »), légende à 6 entrées, perf non mesurée, aucun état partageable | relevé le 20/10/2026 (captures) ; **23/10/2026** : glyphes & pièges détectés, sorts à charge signalés, barre de zoom déslopée ; **peinture réparée puis rendue visible** (trou noir sur fond noir, cases hors sol, cloisonnement par carte — `src/lib/sim-paint.ts` + surlignage pointillé, 10 verrous ; suite **5 096 ✓**) | S-1 **mesurer** → S-2 nettoyer (doc → repliable, un seul langage visuel) → S-3 état dans l'URL + page outil `/simulateur` ; **reste** : écart de dégâts (**D-SIM1**), chiffrage réel des charges (table officielle), glyphes au sol (dégâts par tour). **Abandonné le 23/10/2026** : état de simulation dans l'URL (« osef ») | — (à créer) |
| 50 | `boss-fiche-locale` | Les commandes Discord `/boss` et `/monstre` interrogent encore **DofusDB de façon synchrone** alors que `getLocalMonsterFiche` existe (siphon + bestiaire local, zéro réseau) | mesuré le 20/10/2026 : la route contient encore `getMonsterStats` (×2) et `mob.grades?.[mob.grades.length - 1]` ; le test « réponse < 3 s » (écrit le 16/10, conservé hors dépôt puis consigné ici) **échouerait** tant que la bascule n'est pas faite | basculer les 2 commandes sur `getLocalMonsterFiche`, garder un repli explicite (« fiche indisponible »), activer le test | — (à créer) |
| 51 | `galerie-variantes` | **Galerie Stuff** : variantes proposées par le joueur (trophée/dofus/objet remplacé), affichées sans toucher au stuff Dofusbook | **livré** le 23/10/2026 : `dofusBookLinks[].variants` (JSON, **aucune migration**), bascule **Stuff ⇄ Variante** sur la miniature et la modale, stats/dégâts recalculés (`applyVariantsToBuild`), action `saveBuildVariant` (auteur seul, rate limit) — 11 verrous · **complément** : **persistance** (auto-enregistrement 800 ms + brouillon local `src/lib/dofus-variant-storage.ts`, 6 verrous), **toggle dans le voile de la carte** (visible par tous), **icône locale** de l'objet varié · **complément du 25/10/2026** : la variante s'affiche **au clic** sur la miniature du profil et la carte de la galerie (grille d'icônes remplacée + récapitulatif des objets échangés, stats de la carte incluses) et le stuff d'un **autre membre** passe en **lecture seule** (ni éditeur de slot, ni brouillon local, ni « Réinitialiser ») — verrou `galerie-variantes-affichage` **13** | **image OG + embed Discord : afficher la variante avec un tag explicite** (décidé le 23/10/2026) — **livré** le 26/10/2026 (`resolveVariantPreview` : une seule règle ; tag `VARIANTE` sur l'image, `· 🟡 Variante` + liste des objets remplacés dans l'embed, stats **effectives**) · **règles de combinaison souveraines** : bonus de panoplie **recalculés** quand une variante change une pièce — **livré** le 26/10/2026 (`GameItemSet`, 938 panoplies siphonnées, verrou `dofus-set-bonuses` **24**) · **Pods + veille + finitions** — **livrés** le 26/10/2026 (lots B/C/E) · **tuile God de la veille** — **livrée** le 26/10/2026 (`getItemConditionsWatch` + bandeau du Tableau God) | — (à créer) |
| 52 | `passifs-objets` | **Effets passifs officiels** des objets (Dofus, légendaires, bénédictions, Prysmaradites) | **livré** le 23/10/2026 : ligne native **`effectId 1175`** → `diceNum` = sort passif → `GET /spells/{id}` ; **117 sorts** dans `src/data/item-passives.json` (`scripts/siphon-item-passives.mjs`), repli inventé **supprimé**, description officielle des Prysmaradites dans la bibliothèque (12 verrous) | 38 sorts DofusDB sans description (percepteurs, 2 Dofus) : rien d'inventé, à rejouer via le siphon | — (à créer) |
| 53 | `supply-chain` | **Débloquer la porte de sécurité** : `zod` 3.25.76 → **4.6.7** (HIGH `GHSA-mrhx-c7xc-m3w5`) et `undici` 7.0.0 → **7.30.1** (HIGH `GHSA-4qv8-2p9j-2685`) | **livré** le 23/10/2026 (PR #1101) : override `undici` bumpé (transitif : discord.js, cheerio, jsdom), migration zod 3 → 4 sur **26 fichiers** (`errors` → `issues`, `required_error` → `message`, `z.record(clé, v)`, codes v4 dans `market/listing-schemas`, chemins `PropertyKey[]`, resolver du calendrier) — `security:audit` **franchie**, **5 099 ✓**, `tsc` 0, ESLint 0 | — (rien) | — | — |

## 4. Décisions en attente (elles bloquent un rang)

| # | Décision | Bloque |
|---|---|---|
| **D1** | Facteur Kamas Violets de la clôture : `*10` (code) vs `*10 000` (seuil) | rang 16 (RAID R2) |
| **D2** | Stocker `raidPurpleKamasCost` à la clôture (sinon `undo` rembourse `?? 30`) | rang 16 |
| **D3** | ~~Orphelins : fermer ou laisser vivre un raid sans capitaine ?~~ **Tranché le 25/10/2026** : clôture d'office à **+48 h** (après le rappel de +24 h), **traçable** (`closedBySystem`) et **rattrapable** (présents + score possibles ensuite, annulation 24 h) | — (soldé) |
| **D4** | `PLAN-SALONS-VOCAUX` : retenir et cadrer, ou archiver ? | rang 27 |
| **D5** | Onboarding 06/09 : proposition validée ? (migration à appliquer) | rang 28 |
| **D6** | Acquisition : ordre des lots + une page n'entre au sitemap que si elle porte de la donnée réelle | rang 25 |
| **D7** | Landing : `maintenance.html` vs `page.tsx` | rang 3 |
| **D8** | Cloudflare devant `sigilos.fr` : oui (DPA + cookie `__cf_bm`) ou non (Caddy seul) ? | rang 29 |
| **D-R1** | Moteur de rôles : voie A (vocal **total** universel, recommandée) ou voie B (fenêtres + reset bot, 1 migration) ? | rang 12 |
| **D-M1** | Marché lot multiple : valeur d'`enum` (migration additive ?) + une `MarketDiscordMessage` par objet (migration ?) | rang 18 |
| **D-S1** | `ServiceActivityLog` : borner (purge) ou conserver comme preuve de litige ? | rang 37 |
| **D-P1** | `/presentation` : redirection vers le hub, ou retrait du bloc + entrée de menu ? | rang 8 |
| **D-H1** | `harebourg-solver.ts` : brancher (quel écran ?) ou retirer ? | rang 38 |
| **D-AC1** | `activeContext.md` : purge effective des blocs, ou abandon de la règle des 6 ? | rang 41 |
| **D-SIM1** | **Écart de dégâts en simulation** : Intelligence 1991 (jeu) vs 1323 (calcul) — ratio 1,39 = exactement 1242/893. Trancher : (a) fournir le **payload Dofusbook brut** de la fiche concernée, ou (b) autoriser un dump temporaire des stats passées à `computeSpellDamage`. Sans mesure, aucun chiffre ne bouge : la géométrie d'`Attirance` est déjà prouvée par test, mais la référence de poussée (« vers le centre de la zone » vs « vers le lanceur ») reste à confirmer pour Glacier | rendu fidèle de la simulation (rang 49) |
| **D-G1** | Guide Rush — **onglet de suivi entre membres** (présence, donjons validés, métiers) : quel périmètre et quelle surface (guide interne / overlay) ? | aucun — idée notée le 22/10/2026, remplace le badge « qui peut aider » retiré |

## 5. Registre des chantiers clos (une ligne, jamais de détail)

| ID | Chantier | Livré |
|---|---|---|
| `A` | Siphons game-data (A1 → A5) | 28/09/2026 |
| `B` | Membres `/admin/members` (B-1 → B-3) | 14/10/2026 |
| `X-1` | Sondages programmés | 13/10/2026 |
| `Y` | Rôles automatiques par ancienneté (Y-1 → Y-5) | 14/10/2026 |
| `W-1/W-2` | Observabilité Sentry (traces + runtimes) | 11/10/2026 |
| `T-1/T-2/T-2b/T-3` | Rush Sylvestre — affichage, temps réel, prérequis, studio God | 08/10/2026 |
| `V-A/V-B` | Rush Sylvestre — agrégation unique + ids/icônes | 10/10/2026 |
| `R-1 → R-4` | Raccord DofusDB (résistances, tacle/fuite, critiques, icônes) | 15/10/2026 |
| `STATS-1` | Socle de lecture des stats + 4 bugs d'exploitation (montures 5401, panoplies 9 406 PV, placeholder vert, inventaire siphon, statut PARTIAL, sorts communs officiels) — `fix/socle-stats-siphons`, **0 migration** | 26/10/2026 |
| `STATS-2` | Encyclopédie + Marché branchés sur le socle (`nativeEffects` résolus transmis par `/api/dofusdb/search`, `% Do Sorts/Armes/Mêlée` avec asset, `isStatBearingNativeEffect` écarte les métadonnées à valeur) **+ carte de build : les codes Dofusbook non-stat (`at` = attitude, `sp`) sortent de la liste chiffrée** — **0 migration** | 26/10/2026 |
| `DOFUSBOOK-2` | Stats Dofusbook : initiative et socles secondaires (détail dans `journal-sessions-2026.md`) | 25/10/2026 |
| `CAL-1` | Calendrier : statut décidé à un seul endroit + messages Discord | 25/10/2026 |
| `SLASH-1` | Commandes slash alignées sur Discord (2 PR) | 24/10/2026 |
| `DEMO S-0/S-1` | Démo publique — mesure + route `/demo` | 02/10/2026 |
| `M-1 membres` | Deslop de l'annuaire (volet membres) | 05/10/2026 |
| `menage A/B-1` | 7 dépendances mortes + 24 fichiers morts | 19/10/2026 |
| `supply-chain` | Garde-fou des scripts d'installation npm | 19/10/2026 |
| `codeql` | XSS overlay + SSRF `redirect: error` | 19/10/2026 |
| `env-validation` (F8) | Validation d'environnement au démarrage (`instrumentation.ts`), fail-closed en prod, avertissement CSP | 19/10/2026 |
| `monitor-private` (F9) | Grafana retiré de l'exposition publique et du compose ; Prometheus interne épinglé v3.15.0 ; accès God — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `node-runtime` | Runtime Node **épinglé** : `22.23.4` (correctif du 21/10) **puis `24.22.1` LTS active** le même jour — `.nvmrc` = source unique, `engines.node`, les 3 `FROM node:` des images, CI sur `.nvmrc`, verrou `node-runtime-pin`, procédure `docs/agents/node-runtime.md` + règle + skill · **CI verte sur Node 24** (suite + build) | 22/10/2026 |
| `god-system` | God → Système & Infra : CPU, RAM, disque, Redis, PostgreSQL, conteneurs, crons — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `harnais H0-H7` | Roadmap unique, journal archivé, zone temp unique, 4 règles, 6 skills, 3 hooks, `.clineignore`, garde | 19/10/2026 |
| `seo-extraits-serp` | Extraits SERP bornés (`src/lib/seo.ts`, 60/155) : fiches boss, hub `/almanax`, 7 guides FR + garde `seo-serp-extraits` — **mesuré** : 6 156 impr. / 109 clics, guides = 44 % des clics | 20/10/2026 |
| `T-2c` · `V-G` · alignement (lots 1-5) | Rush — prérequis par id stable, liaison Metamob dans l'overlay, modale d'alignement (camps → Ordres → tranches), route `resolveRushRoute`, présence temps réel, jumelle de branche (God), **tranches supprimées (saisie + affichage)**, **reset des quêtes d'alignement au changement de cité (cascade comprise)**, **arbre cité → Ordre** (migration additive), **verrou de palier calculé** et **jumelle d'Ordre** | 20/10/2026 |

| `rush-consolidation` | Rush — siphon exhaustif des 2 sources (Tougli API + Dofusyelle) : séries **100 / 102** (Dofusyelle = préfixe exact de 99), 30 quêtes d'Ordre (palier dérivé par position), 19 classes, 1 085 contraintes inventoriées, **584** ressources (408 communes), 99 + 83 donjons (67 slugs), 62 succès ; **verrou de donjons** (requis/optionnel, multi-donjons) en règle pure + 12 tests | 21/10/2026 |

## 6. Archives et mémoire froide

- `docs/agents/journal-sessions-2026.md` — **171 blocs de session** + ancien backlog, conservés pour la mémoire du projet ; **ne pas lire au démarrage**.
- `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` — ancien ordre (étapes 1 → 64). **Les numéros d'étape sont historiques** : utiliser les IDs ci-dessus.
- `docs/agents/archive/BRIEF-REPRISE-2026-10-14.md` — fil des demandes et décisions du 14/10.
- `docs/agents/archive/session-amorce-2026-09.md` — remplacé par `AGENTS.md` + `docs/agents/harnais.md`.
- `src/temp/archive/` — corpus volatil (audits 20/09, maquettes, siphons) déplacé, **jamais versionné**.
- Volume Docker `grafana_data` conservé (non monté) — suppression seulement sur accord explicite.
- Règles d'alerte Grafana : aucune n'a été auditée ; elles ne tournent plus. Le volume les conserve peut-être.
- Prod **non déployée** : `main` = `07c0500e` (12/10), `dev` a **100+ commits d'avance** (dont les 4 lots du 25/10). Procédure de bascule et rattrapages : §0 « ⏳ En attente de prod ».
- `src/temp/archive/duplicates-2026-10-19/` — 3 doublons exacts (hash identique) : `ARCHITECTURE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `MODULE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `PLAN-REFONTE-…SYLVERSTRE` = `PLAN-DESLOP-ANNUAIRE.md`.

## 7. Tenue de cette feuille

1. Un chantier livré → sa ligne **sort** et rejoint le §5 (une ligne, sans récit).
2. Un nouveau chantier → une ligne au §1/§2/§3 + un plan durable dans `docs/plans/`.
3. Aucune session ne s'écrit ici : le récit va dans `activeContext.md` (6 blocs), l'historique dans le journal.
4. Garde automatique : `docs/ROADMAP.md` doit rester **< 60 Ko** (`tests/unit/harness-config.test.ts`).
5. **Les rangs sont stables** : un chantier livré laisse un trou dans la numérotation, il n'est pas réattribué (les décisions citent les rangs).

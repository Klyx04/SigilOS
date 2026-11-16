# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 16/11/2026 (suite 5) — **Stats · restes soldés, auth avant cache, 404 chartées et journalisées** — branche `fix/stats-restes-et-404`

> **Demande user (verbatim)** : « enchaine tout dans l'ordre , un commit par lot , une seule grosse pr à merger et surveiller ».
> **Mesure** : les 4 restes de « Stats Guilde » étaient bien morts — `/stats` absent de `src`, « Stats Guilde » rendu par `permission-card.tsx:100`, `stats` retiré du registre (`DEFAULT_MODULES`), aucune commande slash `stats` (l'aperçu `EMBED_PREVIEWS.stats` ne pouvait donc jamais être lu). Sécurité : `getGuildStats` lisait `redis.get` **avant** `getUserContext` ; l'action étant POST-able, un `guildId` au cache chaud renvoyait les stats sans membership. 404 : **aucun** `not-found.tsx` dans le dépôt (22 `notFound()`), `x-pathname` déjà posé par `proxy.ts:312`.
> **Fait** : **commit 1** — les 4 restes supprimés, `redirects()` **308** `/dashboard/:guildId/stats` → `/dashboard/:guildId` (et non 410 : le contenu vit sur l'accueil) + 4 assertions · **commit 2** — autorisation **avant** le cache (`logger.warn` si Redis indisponible) + verrou d'ordre · **commit 3** — `src/app/not-found.tsx` (registre + `PublicHeader`/`GalacticFooter`, CTA selon session, `robots index:false`), `dashboard/[guildId]/not-found.tsx` (guildId lu par regex snowflake **bornée**), `espace-visiteur/not-found.tsx`, helper pur `src/lib/not-found-log.ts` (query retirée, Referer réduit à l'hôte, UA tronqué, 1/4 sans Referer) + wrapper serveur `cache()` (dédoublonne les deux rendus par requête).
> **Preuves** : `test:run` **726 fichiers / 7 642 tests ✅** (26 neufs) · `tsc` 0 · ESLint 0 erreur · `npm run build` **EXIT 0**, `/_not-found` **ƒ dynamique** · `next start` + `curl` : `/cette-page-n-existe-pas` **404** (contenu charté), `/guides/inconnu` **404**, `/dashboard/<id>/stats` **308**, `/dashboard/<id>/inconnu` et `/espace-visiteur/inconnu` **404**, **1 ligne de log par requête**.
> **Reste / ops** : PR à merger · la mesure `next start` exige `STORAGE_SIGNING_SECRET` (≥ 32) et `GOD_ROUTE` (`/mng-…`) · `/visiteurs/<id>` anonyme répond **200** (porte d'accès `noindex`) : `notFound()` ne couvre que le viewer authentifié — comportement existant, non modifié · une URL non reconnue rend les 404 imbriquées **sans** le layout du segment (mesuré) · `/god/guilds/<id>` inconnu rend la 404 publique (aucun écran dans `/god`, pas de fuite).
> **Rotation** : bloc « Session 15/11/2026 (suite 3) — Docs · un seul fichier de chantiers » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 4) — **Visiteur · guide Rush : l'accueil ne redemande plus un profil** — branche `feat/rush-accueil-connecte`

> **Demande user (verbatim)** : « on doit forcer la creation de son profil / mules optionnel non sur le rush en connecté ? on est d'accord ? c'est tout ? ».
> **Mesure** : l'accueil du guide Rush (3 étapes, 1×/navigateur, « Passer ») partait **toujours** de l'étape 1 et ouvrait le formulaire **anonyme** (`GuestCharacterModal`, localStorage), même pour un compte connecté. Un visiteur sans `PublicProfile` a `visitor = null` (`getPublicAccount`) : il était traité comme un anonyme, avec un texte qui promettait « dans ton espace visiteur dès que tu te connectes » alors qu'il l'était déjà. « Enregistrer » ne passait pas par `onClose` : l'accueil restait bloqué après le personnage.
> **Fait** : règle pure `src/lib/rush-onboarding.ts` (`resolveRushOnboardingStart` : anonyme/profil partiel ⇒ étape 1 ; profil complet sans alignement ⇒ étape 2 ; tout déclaré ⇒ aucun accueil) · `PublicOnboardingModal` distingue 4 audiences (`anonymous`, `connectedWithoutProfile`, `connectedPartial`, `connected`) + lien « Mon espace visiteur » + bouton « Choisir » masqué quand le compte a déjà son personnage · `handleOnboardingPickCharacter` route vers la **bascule de compte** (mules) ou le formulaire local, jamais un formulaire de création pour un compte complet · formulaire local prérempli depuis le profil (pseudo/classe/serveur) · `advanceOnboardingAfterCharacter` fait avancer l'accueil après « Enregistrer », « Annuler » et la bascule · **aucun profil n'est requis**, les mules restent optionnelles.
> **Preuves** : suite **724 fichiers / 7 616 tests ✅** · `npx tsc --noEmit` 0 · `npm run lint` 0 erreur · ciblés : `rush-onboarding-start` 6, `rush-public-onboarding` 6, `guest-character-modal` 11.
> **Reste / ops** : rien à déployer (client seul, aucun schéma). Contrôle bêta : compte sans profil → guide Rush → accueil « personnage local » ; compte complet → pas d'étape personnage.
> **Rotation** : bloc « Session 15/11/2026 (suite 2) — Notifications · N1→N4 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 3) — **Visiteur · entrée guidée : attente neutre, fail-closed 5xx, cache 60 s, accueil de création** — branche `feat/visiteur-entree`

> **Demande user (verbatim)** : « on devrait pas plutôt le guider en arrivant que lui prompter une page brut pas de guilde etc ? ça donne pas franchement envie ».
> **Mesure** : le 1er écran était un **verdict** (« Accès restreint / Aucune guilde ») affiché pendant que Discord répondait **429** ; le 429 venait du **double appel** `GET /users/@me/guilds` (callback `signIn` puis portail, même seconde). L'auto-reload était un `window.location.reload()` à **10 s fixes** (plafond 6 ⇒ 60 s). Second défaut fail-closed : un **5xx/réseau** (`TRANSIENT`) n'était ni `rateLimited` ni `needsReconnect` ⇒ `guildLookupFailed = false` ⇒ redirection visiteur alors que Discord n'avait pas répondu.
> **Fait** : ① **fail-closed** — `getGuildsSeparated` expose `lookupFailed` (429, scope, 5xx, réseau, jeton absent) ; `/dashboard` et `/` le lisent tel quel. ② **écran d'attente neutre** `guild-check-pending.tsx` (« Ton espace se prépare. », jalons, note « ton espace visiteur s'ouvrira tout seul »), reprise **2/4/8/16 s** via `router.refresh()` (`guildLookupRetryDelayMs`, `MAX_PORTAL_AUTO_RELOAD = 4`), navigation complète au dernier recours ; `NoGuildMessage` ne porte plus que le **verdict**. ③ **cause racine** — snapshot **60 s** des serveurs (`src/lib/discord-guilds-snapshot.ts` Zod borné + `src/server/discord-guilds-cache.ts` Redis), écrit par `signIn` et après un fetch réussi, lu avant tout appel Discord. ④ **accueil visiteur** — « Bienvenue {pseudo} » + 3 bénéfices (icônes Dofus réelles) + formulaire requalifié « Étape 1 — Ton personnage », lien « Installer SigilOS » ; **visite de création** 3 pas (`visitorOnboarding`, 2 ancres posées) ; nav limitée aux 3 onglets franchissables (`filterVisitorNav`) tant que le profil n'existe pas.
> **Preuves** : `npm run test:run` **723 fichiers / 7 610 tests ✅** · `npx tsc --noEmit` 0 · `npm run lint` 0 erreur · ciblés : `onboarding-portal` 11, `visitor-entry` 11, `public-tour` 22, `discord-guilds-snapshot` 7, `visitor-nav-filter` 3, `visitor-shell` 7.
> **Reste / ops** : aucune migration, aucun env ; le cache s'active au redéploiement (Redis requis, repli = appel Discord).
> **Rotation** : bloc « Session 15/11/2026 (suite) — Notifications · N1 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 2) — **Discord · Commande slash `/legendaire` (artisanat et éligibilité quête)** — branche `feat/commande-legendaire`

> **Demande user** : « ajouter une nouvelle commande slash discord dans /dashboard/.../commandes manageable comme les autres dans /admin/commandes, l'objectif: trouvez qui peut craft tel objet legendaire... exemple /legendaire meriana affiche un bel embed avec la liste des pseudo qui ont le métier + la quete animaux fantastique faites donc eligible, l'icone de l'image dans l'embed etc ».
> **Mesure** : `LegendaryItem` (métier, catégorie, passif, imageUrl) et `UserProfile` (`hasLegendaryPrerequisites`, `legendaryCrafts`, `metiers`) existaient déjà en BDD. Seul manquait le raccordement au catalogue des commandes slash et au routeur d'interactions Discord.
> **Fait** : Commande ajoutée au catalogue `SLASH_COMMANDS_CATALOG` (`COMMUNAUTE`, rôles par défaut membre/officier/meneur) · Définition Discord dans `COMMAND_PRESENTATION` avec autocomplétion dynamique sur `item` (filtre nom/catégorie/métier insensible à la casse et accents) · Gestionnaire Discord interaction dans `route.ts` (recherche fuzzy, filtrage des membres actifs de la guilde, séparation artisans éligibles vs artisans métier 200 sans quête validée, ping Discord `<@id>`, vignette miniature `fullImageUrl`, passif et métadonnées) · Aperçu visuel dans `CommandsVisualGuide` (`EMBED_PREVIEWS`) · Pilotage et permissions RBAC automatiquement actifs dans `/dashboard/[guildId]/commandes` et `/admin/commandes`.
> **Revue pratiques Discord (même branche)** : saisie bornée à la source (`max_length: 100`, valeur re-bornée dans le routeur) · champs d'embed bornés à 1024/256 avant envoi (`src/lib/discord/embed-limits.ts`, réexporté par les tickets — source unique) avec liste d'artisans qui préserve la ligne « … et N autres » (`src/lib/discord/legendary-crafters.ts`) · autocomplete borné (`take: 200`, type de `focusedOption.value` vérifié) · `allowed_mentions: { parse: [] }` sur le message d'erreur qui réaffiche la saisie · champ `level` mort retiré.
> **Preuves** : Tests `slash-commands` (18/18), `discord-command-scope` (24/24), `discord-legendaire-embed` (7/7), `lot4-slash-commands-api-keys` (4/4), `tickets-lot1-bugs` (14/14) verts · `npx tsc --noEmit` 0 erreur · `npm run lint` 0 erreur.
> **Reste / ops** : Synchroniser les commandes slash sur Discord via le bouton « Resynchroniser » de l'administration des commandes ou le panneau God.
> **Rotation** : bloc « Session 15/11/2026 — Tickets God · G4-1 → G4-4 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 16/11/2026 (suite) — **Visiteur · tours publics (profil + guide Rush), rejouables et fermables** — branche `feat/tour-public`

> **Décisions user (verbatim)** : « on créé juste un tour publique » — un tour **première fois seulement** sur le profil perso, un tour **complet** des briques du Rush « connecté / non connecté » (connecté = briques en plus), « tous les tours rejouable et fermable » ; `PUBLIC_VISITOR_ENTRY=1` ✅ **posé** ; God visiteurs **à placer** (trop d'onglets côté God) ; D7 à réexpliquer.
> **Mesure** : le moteur de tour existant (`src/components/tour/tour-provider.tsx`) était **couplé à la guilde** (signature `guildId: string`, clés `sigilos-tour-*-${guildId}`, auto-start `?tour=1` du dashboard) ; aucune route God « visiteurs » n'existe (`src/app/god/` sans dossier dédié) ; `PlatformBan` existe déjà.
> **Fait** : règle pure `src/lib/public-tour.ts` (deux builders, filtre `visitor`/`anonymous`, drapeau `sigilos:visitor-tour-seen`, `shouldAutoStartVisitorTour`) · provider étendu (`scope="public"`, `guildId?`, `storageScope`, `visitorConnected`, `locale`, phases `rushPublic`/`visitorSpace` dans `MODULE_TOUR_PHASES`) · **15 ancres** `data-tour` dans `PublicRushGuideClient` + **11** dans `visitor-nav`/`general` · launcher de première arrivée (`visitor-tour-launcher.tsx`, drapeau posé au démarrage effectif) · rejeu : bouton « Visite guidée » + entrée Options du guide, carte « Revisiter » dans Réglages (`?tour=1`) · bulle `TourOverlay` **déslopée** (violet/glass/`font-black`/`rounded-2xl` retirés, accent produit).
> **Preuves** : `public-tour` **19** · `tour-overlay-viewport` **7** (clé scopée) · `rush-public-parity` **48** · `rush-public-onboarding` **6** · `visitor-shell` **7** · ciblé **100/100** · `tsc` 0 · ESLint 0 erreur.
> **Reste / ops** : V3 God visiteurs (emplacement à trancher) · **D7** (landing `maintenance.html` vs `page.tsx`) · contrôle visuel 390/768/1024/1440 de la bulle et des deux parcours · rebuild bêta/prod.
> **Rotation** : bloc « Session 14/11/2026 (suite) — Support · captures paramétrables, doc produit, cadrage G4 et notifications » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
## 📝 Session 16/11/2026 — **Sentry · un log n'est pas une exception, bruit mesuré filtré, impact par utilisateur** — branche `fix/sentry-bruit`

> **Décisions user (verbatim)** : « pousse déjà tout ce qui doit être en local vers git et on repart là-dessus » ; les issues déjà résolues sont clôturées ; priorité au tri du bruit avant 1M/2R.
> **Mesure** : 16 issues non résolues / 124 occurrences (14 j) ; `usersImpacted = 0` partout. 2H/2G clôturées par le user ; **2G/2N/2M déjà couverts par #1331** (429 Metamob passé en `warn`, clé Krala déchiffrée — dernières occurrences le 09/11, avant le déploiement du correctif). **1M n'a aucun message** : le filtre d'entrée Sentry `react-hydration-errors` jette **16 événements/14 j** (`find_dropped_events`) — l'issue ne vit que par le replay ; filtre désactivé, les événements réels sont apparus sous **2T** (3 occurrences, `/guides/:slug`). **26** = script inline injecté (`app:///elevage:3`, « global code ») : aucune source n'appelle `toLowerCase` sur `@context`.
> **1M — cause racine mesurée après déploiement bêta** (Playwright + Chrome headless, `16/11`) : React **#418** reproduit sur `/guides/raid-gigalodon-dofus-guide` ; le texte servi dit « Mini-fenêtre flottante » alors que Chrome dit « Fenêtre PiP détachable » + badge « PiP ✓ ». `isDocumentPipSupported()` était lu **pendant le rendu** (capacité client) dans `RaidOverlayLaunchBanner`, même motif dans `RaidStratDrawer`.
> **Fait** : lot local de 10 commits poussé et **PR #1385 mergée** (`c780da22`, source maps incluses) ; **PR #1386 mergée** (`1dc17562`) : `InvalidCheck` Auth.js en `warn` + `type`/cause réels au log (2F/2S), motifs 2J/2K/D+2P/2Q dans `sentry-ignores`, `beforeSend` pour 2A (refus ancré) et 2D (chemin exact du tunnel), `Sentry.setUser({ id })` avec l'id interne opaque (jamais Discord) — verrou `sentry-bruit-mesure` **10** ; **PR #1388 mergée** (`ad2e9659`) : capacité PiP posée dans un `useEffect` (premier rendu identique au serveur) — verrou `hydration-pip-capability` **3**.
> **Preuves** : `test:run` **715 fichiers / 7 552 tests ✓** · `tsc` 0 · ESLint 0 erreur · `gh pr checks` vert sur #1385, #1386 et #1388 · **sonde post-déploiement `ad2e9659` : zéro #418** sur `/guides/raid-gigalodon-dofus-guide`, `/guilds` et `/elevage` · **1 issue restante (2R)** sur 16.
> **Reste / ops** : **2R** — attendre une occurrence post-déploiement pour valider les source maps (`/guilds`, dernier événement le 12/11) · 1M/2T closes : les anciennes occurrences `/god` et `/profile` n'ont pas été reproduites (pages privées) ⇒ elles rouvriront l'issue si elles réapparaissent · issues **closes le 16/11** avec leur motif : 2F/2J/2K/2A/D/2P/2Q/2S (filtres #1386), 2M/2N (corrigées par #1331), 26 (extension) · impact **serveur** encore nul (point d'entrée requête-scopé à prévoir) · `sudo reboot` pour passer sur le noyau 6.8.0-149 · **prod** pas encore déployée avec #1386/#1388.
> **Rotation** : bloc « Session 14/11/2026 — Signalements · fusion dans `SupportTicket` » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
















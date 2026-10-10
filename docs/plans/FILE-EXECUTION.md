---
description: File d'exécution unique — tous les chantiers (A→V), un seul ordre pas à pas ; porte l'ORDRE, pointe vers les plans (ne duplique rien)
---

# 🧵 File d'exécution — tous les chantiers, un seul ordre

> **Rôle (unique).** Ce fichier porte **l'ordre d'exécution** : la seule liste qui répond à « c'est quoi,
> la prochaine chose ? ». Il **ne duplique pas** le contenu : chaque ligne renvoie au **plan durable** qui
> décrit le chantier (BESOIN → ÉTAT MESURÉ → CHANGEMENTS → TESTS → ACCEPTATION → VIGILANCE).
> **Règle d'or.** **1 étape = 1 lot = 1 branche = 1 PR → `dev`.** On **merge** un lot avant d'ouvrir le
> suivant ; la branche suivante naît de `dev` **après** le merge (`git fetch origin dev && git merge origin/dev`).
> **On ne supprime jamais un chantier** : livré, il passe en `✅` **ici** (son détail part dans un bloc de
> session du `docs/ROADMAP.md`).
> **Dernière mise à jour** : 10/10/2026 (chantier **V** ajouté : Rush Sylvestre données & ocre/Metamob) · `dev` = `39517953` (**#871** zaaps mergée) · **assets : identité id-entité ≠ id-apparence corrigée + boss de raid sans carte (PR #872)** · **T-1, T-2, T-2b et T-3 du chantier T (rush Sylvestre) livrés** (lot 1 « affichage » — **PR #851** ; lot 2 « temps réel » — **PR #853** ; **T-2b** prérequis résolus au **nom exact** — **PR #856** ; **T-3** studio God robuste : E1/E3/E4/E5/E6 — **PR #857**). Le détail est aux blocs du 08/10 du `docs/ROADMAP.md`, la file ne le duplique pas. Restent **T-2c** (id de quête dans le tag `prereq_text`) puis les lots 4 à 6 · **chantier U « zéro dépendance DofusDB » cadré** (5 points de contact mesurés, lots U-1 → U-5, §1) · **session du 08/10 « one shot »** (**PR #858 mergée**, branche `feat/rush-one-shot` supprimée au merge) : pictos réels, rail de droite défilant, **alignement en lecture seule**, **table Dofus unique**, bruit Sentry — détail au bloc du 08/10 du `docs/agents/activeContext.md` (la file ne le duplique pas).

## 0. Comment s'en servir

1. Ouvrir **ce fichier** → prendre la **première étape non `✅`** du §2.
2. Ouvrir le **plan** cité (colonne « Plan » du §1) → il porte le contenu et le détail.
3. Si l'étape est **⏸ bloquée** → poser la décision listée au §3 **avant** de coder.
4. Coder, tester, PR, merge → revenir ici **cocher la ligne**. Rien d'autre à tenir à jour pour l'ordre.

> ⚠️ **Ce fichier devient la source de l'ORDRE.** Il remplace les **trois** ordres concurrents qui
> existaient (consigne volatile « Ordre de réalisation (reste) », `PLAN-RAID` §6, `AMORCE-RAID` §0 — et
> leurs contradictions). Ces documents restent **la référence de contenu** de leur chantier, mais **ne
> portent plus l'ordre**. *(Nettoyage de leurs mentions d'ordre : à faire dans un lot doc dédié ; non fait
> volontairement maintenant pour ne rien casser.)*

## 1. Index des chantiers (rien n'est supprimé)

| # | Chantier | État | Plan durable (contenu) | Lots |
|---|---|---|---|---|
| **A** | Siphons game-data | ✅ **clos** (28/09, A1→A5) | blocs 28/09 du `docs/ROADMAP.md` | — |
| **B** | Membres `/admin/members` | ouvert | `docs/ROADMAP.md` § B | B-1, B-2 |
| **C** | Tickets v2 | en cours | `docs/plans/PLAN-REFONTE-TICKETS-V2.md` | C-1 → C-4 |
| **D** | UI God (hors refonte O) | en cours (reste D-3) | `docs/ROADMAP.md` § D | D-3 |
| **E** | Acquisition (SEO / contenu) | ouvert | `docs/plans/SEO_REPRISE.md` + `docs/ROADMAP.md` § E | E-1 → E-3 |
| **F** | Orphelins / reprise de relai | ouvert | `docs/ROADMAP.md` § F | F-A → F-C |
| **G** | RAID (calendrier, clôture, overlay, données) | en cours | `docs/plans/PLAN-RAID.md` | R0 → R10 |
| **H** | Mini-jeux & salons temps réel | non consigné (volatile §2/§5) | **à créer** | H-1, H-2 |
| **I** | Marché | ouvert (volatile §10) | **à créer** | I-1 |
| **J** | Services & recrue | ouvert (volatile §12/§13) | **à créer** | J-1, J-2 |
| **K** | Succès & encyclopédie | ouvert (volatile §9/§11) | **à créer** | K-1, K-2 |
| **L** | Déslop global (dashboard / admin / landing / modales / ressources / missions / ladder / worldmap) | ouvert (volatile §19/§21/§22/§23) | **à créer** | L-1 → L-4 |
| **M** | Guildes & admin (calendrier/membres/profil/stuff, édition staff, logs) | ouvert (volatile §16/§17/§18) — **M-1 `membres`** (deslop annuaire) **codé le 02/10** | `docs/plans/PLAN-DESLOP-ANNUAIRE.md` (volet `membres`) | M-1 → M-3 |
| **N** | Onboarding & acquisition (prospect → guilde) | proposition (06/09) | `docs/plans/PLAN-REFONTE-ONBOARDING.md` | — |
| **O** | Refonte God « Guildes & Users » | plan vivant (25/09) | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` (+ `AMORCE-REFONTE-GOD-GUILDES.md`) | G1 → G12 (7 lots) |
| **P** | Ouverture prod & durcissement | ouvert (bloquant prod) | `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md` + `docs/plans/DECISION-OUVERTURE-LANDING.md` | — |
| **Q** | **Salons vocaux** (module, cahier V2.1 du 30/09) | **idée neuve, à cadrer** | `docs/plans/PLAN-SALONS-VOCAUX.md` (cahier rapatrié le 01/10) | — |
| **R** | **Durcissement réseau** (Cloudflare devant le domaine ? WAF/DDoS + impact RGPD) | à décider | — (décision **D8**) | — |
| **S** | **Démo publique** — une guilde de démonstration **en lecture seule**, essayable sans compte depuis la landing | **S-0 ✅ fait** (02/10, mesure, 0 PR) — S-1 → S-5 à faire | `docs/plans/PLAN-DEMO-PUBLIQUE.md` | S-1 → S-5 |
| **T** | **Rush Sylvestre — refonte** (overlay & guide : ergonomie, temps réel, éditeur God, habillage Dofus, perf) | en cours — **T-1, T-2, T-2b + T-3 ✅ livrés le 08/10** | `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md` (carte du module : `docs/plans/MODULE-RUSH-SYLVESTRE.md`) | T-1 → T-6 |
| **U** | **Zéro dépendance DofusDB** — règle du propriétaire : **plus aucun appel à DofusDB à l'exécution** (le produit doit vivre sans lui) | **cadré le 08/10/2026** (mesures ci-dessous) — **aucun lot commencé** | **à créer** (tant qu'il n'existe pas, le cadrage vit ici ; l'image `V-C` s'y rattache) | U-1 → U-5 |
| **V** | **Rush Sylvestre — données & ocre/Metamob** (agrégation unique des ressources, ids/icônes, couverture Tougli ∪ Dofusyelle, alignement Bonta/Brâkmar, ocre capturé, liaison Metamob dans l'overlay) | **cadré le 10/10/2026** (mesures au plan) — **aucun lot commencé** | `docs/plans/MODULE-RUSH-SYLVESTRE.md` | V-A → V-H |

> ### 🚫 Chantier U — cadrage mesuré le 08/10/2026 (règle : « aucune dépendance à DofusDB »)
> **Déjà autonome** : **27 003** images d'objets, **2 701** monstres, **5 300** sorts **sur disque** ; guide, overlay, progression, donjons, cartes, quêtes = **100 % local**. Si DofusDB ferme demain, tout cela continue de fonctionner.
> **Les 5 points de contact restants (mesurés, jamais supposés)** :
> 1. **Repli image** — `/api/assets-dofus/{type}/{id}` : quand un WebP local manque, la route **va le chercher chez DofusDB** (et y lit `monsters|items|spells` en JSON pour retrouver les ids d'icônes). Déclenché par `resolveItemImage` / `getItemImageFallback`, les fiches de sorts et les chasses. *Symptôme si DofusDB tombe : un placeholder au lieu de l'icône.*
> 2. **Recherches** — `/api/dofusdb/{search,items,recipes,quests}` : Ressources, recettes de craft et quêtes liées partent chez DofusDB **et Dofusdude**. *Symptôme : la recherche ne renvoie rien.*
> 3. **Proxy image** — `/api/proxy-image?url=…` : allowlist contenant `dofusdb.fr`, `api.dofusdb.fr`, `static.dofusdb.fr` (annuaire, crafts légendaires, `ganymede-parser`).
> 4. **Health check** — `/api/health` **ping `api.dofusdb.fr`** ⇒ une panne DofusDB déclare **notre** site « unhealthy » (fausse alerte).
> 5. **Crons** — `data-watch` (`DOFUSDB_API`) et `sync-monster-stats` (repli d'URL d'image) : échec + alerte Discord.
> **Racine du point 1** : **~1 626 URL `api.dofusdb.fr`** dans les 28 `prisma/seed-data/dofus-quests/*-compiled.json` (208 pour `sylvestre-compiled.json` seul) — stockées en base, elles **arment** le repli réseau.
> **Mesure PNJ (08/10/2026)** : `api.dofusdb.fr/npcs/196` n'expose **aucune image** (seulement `look`) ; `/img/npcs/*`, `/img/npc/*`, `/img/quests/*`, `/img/looks/*` ⇒ **404** ; seuls `/img/items/{id}.png` et `/img/monsters/{id}.png` répondent **200** ⇒ **rien à siphonner côté PNJ** : l'import God manuel reste la voie (déjà livré).
> **Hors périmètre** : les **liens sortants** (ouvrir une fiche DofusDB dans un onglet) et l'**attribution de licence** (déjà en place : « Données issues de DofusDB. Utilisation soumise à la licence LPNC-IA 1.0. ») — un lien n'est pas une dépendance technique.
> **Definition of Done** : plus aucun appel réseau à DofusDB déclenché par un usage ; `/api/health` ne le consulte plus ; une **garde** échoue s'il réapparaît dans un code servi au client.


> **Volets partagés — tranchés une fois pour toutes** (chaque étape n'appartient qu'à **un** chantier) :
> **§16** = volet `calendrier` → **G·R8**, volet `membres/profil/stuff` → **M-1** ;
> **§22/§23** = volet `raid/rosters` → **G·R9**, volet `global` → **L-4**.

## 2. La file — ordre unique, pas à pas

> Les étapes **1 → 23** suivent **l'ordre officiel** (celui de la consigne, « Ordre de réalisation
> (reste) » — celui qui faisait foi dans `PLAN-RAID`/`ROADMAP`). Les étapes **24 → 31** sont les chantiers
> **hors consigne** (pré-existants ou orphelins), que j'ai **placés en fin de file** ; remonte-les si tu
> veux (ex. `B`/`C` en tête : c'était ton ordre initial **A → B → C**).

| Étape | Chantier · lot | Sujet | Taille | Bloqué par |
|---|---|---|---|---|
| **1** | **G · R0** | P0 sécu : RBAC `calendar` (+ `bounties`, `relance`) | S | — |
| **2** | **G · R1** | ✅ **livré le 09/10/2026** — §4 agenda : miroir **lecture seule** DJ/Songes (**PR #866**) | M+ | — |
| **3** | **G · R2** | §14 clôture raid + **no-show** (1 migration additive) | M/L | ⏸ **D1 + D2** |
| **4** | **F · F-A** | Orphelins : lever les impasses capitaine / leader | S | ⏸ **D3** |
| **5** | **J · J-1** | §12 services (clôture, inactivité, feedback, images, forum) | M | — |
| **6** | **J · J-2** | §13 `valider-recrue` en salon ticket | S | — |
| **7** | **I · I-1** | §10 marché : images d'embeds + validation FR | S/M | — |
| **8** | **H · H-1** | §5 solidité salons Redis + solo au classement + Panthéon | L | — |
| **9** | **G · R3** | §6 anomalies sans stats + overlay Simulation | M | — |
| **10** | **G · R4** | §7 rangs de monstre 1-5 (fin des `G1-G10`) | M | — |
| **11** | **G · R5** | §8 maps multi-donjons (générique encyclopédie) | M | — |
| **12** | **K · K-1** | §9 onglet **Monstres** du dashboard `/succes` | S/M | — |
| **13** | **K · K-2** | §11 succès imbriqués (générique tous Dofus) | M | — |
| **14** | **G · R6** | §15 dashboard vie : vignettes raid / agenda + activité | S/M | — |
| **15** | **M · M-1** | §16 calendrier/membres/profil/stuff (+ **G·R8** filtre `OTHERS`) — **volet `membres` livré le 02/10** : deslop de l'annuaire + icônes en assets réels (`docs/plans/PLAN-DESLOP-ANNUAIRE.md`) ; restent `calendrier` / `profil` / `stuff` | M | — |
| **16** | **M · M-2** | §17 édition **staff** pseudo + classe | S | — |
| **17** | **M · M-3** | §18 logs guildes (avatar exécutant + anti-fantômes) | M | — |
| **18** | **L · L-1** | §19 `/ressources` déslop (registre partout) | M | — |
| **19** | **G · R7** | §20 guides internes + **strat dans la modale raid** | S/M | — |
| **20** | **L · L-2** | §21 missions (paliers, couleurs songes, responsive, zones) | M | — |
| **21** | **L · L-3** | §22 ladder / planning / worldmap | M | — |
| **22** | **L · L-4** | §23 passe globale dashboard / admin / landing / modales (+ **G·R9/R10**) | L | — |
| **23** | **H · H-2** | §2 mini-jeux : déslop + UX (HUD, boutons, settings) | M | — |
| **24** | **B** | Membres `/admin/members` : **B-1** puis **B-2** (migration) | M | — |
| **25** | **C** | Tickets v2 : **C-1** → **C-4** | M | — |
| **26** | **D · D-3** | `/dofus-guides` déslop | S | — |
| **27** | **Q** | Salons vocaux : reprendre le cahier V2.1 → `PLAN-…` → lots | ? | ⏸ **D4** |
| **28** | **N** | Onboarding : valider la proposition 06/09 (migration à appliquer) | ? | ⏸ **D5** |
| **29** | **O** | Refonte God « Guildes & Users » : 7 lots | L | — |
| **30** | **E** | Acquisition : E-1 monstres → E-2 objets → E-3 quêtes | L | ⏸ **D6** |
| **31** | **P** | Ouverture prod : durcissement audit 20/09 + #57 | M (ops) | ⏸ **D7** |
| **32** | **R** | Cloudflare devant `sigilos.fr` (WAF/DDoS) **ou** durcissement Caddy équivalent — décision + DPA + MAJ pages RGPD | M (ops) | ⏸ **D8** |
| **33** | **S · S-1** | ✅ **livré le 02/10/2026** (PR #830) — démo publique : source de démo + route `/demo` + bandeau « Démonstration » + annuaire réel en lecture seule | M | — |
| **34** | **S · S-2a** | Songes réels en lecture seule (`canJoinSonges={false}`) | S | étape 33 |
| **35** | **S · S-2b** | Sorties + succès en **vues de démo dédiées** | M | étape 33 |
| **36** | **S · S-3** | Interactions **locales non persistées** (inscription, filtrage, scène Discord) | M | étapes 34 & 35 |
| **37** | **S · S-4** | La landing autour : CTA « Essayer la démo », hero, fuites produit (FR en dur, état unique masqué) | S/M | étape 33 |
| **38** | **S · S-5** | Perf des pages publiques (prérendu, une seule langue au client, `framer-motion` hors graphe public) | M | — |
| **39** | **T · T-1** | ✅ **livré le 08/10/2026** (**PR #851 mergée**) — rush Sylvestre : **une seule barre de chapitre**, enchaînement auto, vrais pictos Dofus, conseils en puces (Lot 1 du plan) | M | — |
| **40** | **T · T-2** | ✅ **livré le 08/10/2026** (**PR #853**) — temps réel dé-slopé : fil d'activité à avatar Discord, toast de validation dans l'overlay, **présence honnête** (en ligne = WebSocket, hors ligne = dernière position) | M | — |
| **41** | **T · T-2b** | ✅ **livré le 08/10/2026** (**PR #856**) — prérequis résolus au **nom exact** (règle pure `resolvePrereqTarget`, plus d'`includes` aveugle), surbrillance de la cible **1,2 s** (constante unique), page serveur à **deux lectures parallèles** | S/M | — |
| **42** | **T · T-2c** | Stocker l'**id** de la quête dans le tag `prereq_text` (God + backfill — `activityTags` est du JSON, donc **pas de migration**) pour supprimer la résolution par nom | S/M | — |
| **43** | **T · T-3 → T-6** | **T-3 ✅ livré le 08/10/2026** (**PR #857**) — studio God robuste : suppression d'un bloc par `Dialog` (plus de `confirm()`), conteneur de défilement **déclaré** par le layout (**2 sites**), `order` du nouveau bloc **ouvert dans la transaction** (plus de renumérotation du guide), conseils « une ligne = une puce » + **aide de syntaxe exacte**, aperçu live des composants du **membre**. **Reste** : habillage Dofus (O14/O15, G7/G8, T2) · overlay avancé (O9/O10/O11/O13) · perf (G6 + `useOptimistic`) | L | — |
| **44** | **U · U-1** | Inventaire **verrouillé** : garde qui **compte** les occurrences DofusDB (`src/**` + payloads servis au client) et échoue si le nombre **augmente** (ratchet — la garde ne peut pas être verte avant U-2 → U-4) | S | — |
| **45** | **U · U-2** | Données : réécrire ou vider les `img` des 28 `*-compiled.json` (l'`id` suffit, `resolveItemImage` reconstruit le chemin local) + re-seed | M | — |
| **46** | **U · U-3** | Images : **plus de repli réseau** (`resolveItemImage`/`getItemImageFallback` → placeholder local), et `/api/assets-dofus` cesse de `fetch` DofusDB (ou disparaît s'il n'a plus d'appelant) | M | étape 45 |
| **47** | **U · U-4** | Recherches : basculer `/api/dofusdb/*` sur le **catalogue local** (`GameItem`, cf. « chantier #38 Siphon & Autonomie Local-First ») ; trancher le sort des routes devenues sans appelant | M/L | — |
| **48** | **U · U-5** | Ops : retirer DofusDB du `/api/health`, des crons (`data-watch`, `sync-monster-stats`) et de l'allowlist `proxy-image` | S | — |
| **49** | **V · V-A** | **Une seule agrégation des ressources** sur les 6 surfaces (supprimer l'agrégation locale de `RushChapterSidebar`) + test de parité | S/M | — |
| **50** | **V · V-G** | **Liaison Metamob dans l'overlay** (brique partagée avec le dashboard) | S | — |
| **51** | **V · V-B** | **Ids des ressources** : sonde en lots (`items?id[$in][]`) → ids invalides (repli 666) et noms divergents ; corriger via Tougli/Dofusyelle | M | — |
| **52** | **V · V-C** | **Purge des WebP corrompus + siphon « jamais deviné »** pour les objets (rattaché à **U-3**) | M | étape 51 |
| **53** | **V · V-D** | **Couverture des ressources 391 → ~609** (Tougli ∪ Dofusyelle) + re-seed + pré-chauffage | M | étape 51 |
| **54** | **V · V-F** | **Route d'alignement Bonta/Brâkmar + Ordres** (données + `resolveRushRoute` + gates cité/ordre + God) | L | étape 53 |
| **55** | **V · V-H** | **Donjons « ocre à capturer »** : état capturé/à capturer + ouverture de la fenêtre Ocre (overlay + guide interne) | M | étape 50 |

`S` < 1 jour · `M` quelques jours · `L` chantier.

## 3. Décisions en attente (à trancher avant l'étape citée)

| # | Décision | Bloque |
|---|---|---|
| **D1** | **Facteur Kamas Violets** de la clôture : `*10` (code actuel) vs `*10 000` (seuil d'inscription) | étape 3 |
| **D2** | **Stocker `raidPurpleKamasCost`** à la clôture (sinon `undo` rembourse une valeur de repli `?? 30`) | étape 3 |
| **D3** | Orphelins : **fermer** ou **laisser vivre** un raid sans capitaine ? (recommandation : laisser vivre + marquer « orphelin ») | étape 4 |
| **D4** | `module-salons-vocaux` : on le **retient** (→ `PLAN-…`) ou on l'archive ? | étape 27 |
| **D5** | Onboarding 06/09 : la proposition est-elle **validée** ? (migration `…_add_onboarding_governance` à appliquer) | étape 28 |
| **D6** | Acquisition : **ordre des lots** + une page n'entre au sitemap **que** si elle porte de la donnée réelle | étape 30 |
| **D7** | Landing immersive : `maintenance.html` vs `page.tsx` (`DECISION-OUVERTURE-LANDING.md`) | étape 31 |
| **D8** | **Cloudflare devant le domaine** : **oui** (→ DPA + sous-traitant + cookie `__cf_bm` à déclarer dans la politique) ou **non** (garder Caddy seul, mesuré aujourd'hui : `Server: Caddy`, DNS A `213.32.18.129` OVH) | étape 32 |

## 4. Volatil & fichiers à trancher (inventaire 01/10/2026)

> **Aucun chantier, plan ni rapport n'est supprimé.** Cette section **classe** le volatile (deux zones
> **gitignorées** : `temp/` racine et `src/temp/`) et **consigne ce qui a été retiré le 01/10/2026**.

**`src/temp/` (brouillons de session)**
- `consigne-2026-09-30-raid-calendrier-mini-jeux.md` — **la source de cette file** : à **dissoudre** (chaque
  `§` vit déjà dans un plan ou un chantier du §1) **puis supprimer**.
- `chantiers-ouverts/AMORCES-A-COPIER.md` — **superseded** (amorces A5/B/C) : l'ordre est **ici**, B/C dans
  leurs plans.
- `memo-2026-09-28-telemetrie-god.md`, `prompt-next-chantier-telemetrie-god-D2.md` — **obsolètes** (D-2 et
  D-2bis livrés).

**`temp/` (racine) — corpus d'audit 20/09 + un module neuf**
- `module-salons-vocaux.md` (29 Ko, 30/09) — **front Q** : **rapatrié** le 01/10 dans
  `docs/plans/PLAN-SALONS-VOCAUX.md` (copie à l'octet près, empreinte SHA256 `DF423F5A…B4F27`) ; l'original
  reste ici jusqu'à décision (**D4**) — **à ne pas supprimer** tant que le plan Q n'est pas cadré.
- `A-LIRE-EN-PREMIER.md`, `CROISEMENT-AUDITS-2026-09-20.md`, `PLAN-ACTION-CROISE-2026-09-20.md`,
  `FIXES-A-FAIRE.md`, `FIXES-EXPLIQUES-SIMPLEMENT.md`, `AUDIT-SIGILOS-{cline,opus,muse-spark}-2026-09-20.md`,
  `SEO-GSC-ETAT-MESURE-2026-09-21.md`, `ETUDE-METAMOB-PUBLIC-RUSH-CROISE-2026-09-21.md` — matériau de
  l'audit → alimente **P** (durcissement) et **E** (SEO).
- `memo-2026-09-24-audit-god-refonte.md` → alimente **O** ; `sigilos-cahier-audit-discord-guildes.md`,
  `sigilos-tickets-blueprint-produit-technique.md` (68 Ko) → **C**.
- **RETIRÉ le 01/10** (accord user) : `PROMPT-REPRISE-SESSION.md`, `PROMPT-REPRISE-TICKETS-V2.md`,
  `commit-docs-god.txt` (raccourcis de session). Le prompt Tickets v2 ne décrivait que **§4.1 « Parcours » +
  §4.2 branchement Discord** = **✅ livrés (PR #725)** puis remplacés par l'onglet **« Motifs »** (28/09) ; le
  reste du chantier tickets vit dans `PLAN-REFONTE-TICKETS-V2.md` + `ROADMAP` § C (**C-1 → C-4**).
- **À GARDER** (décision 01/10) : `debug.tmp`, `debug2.tmp` — **servent au propriétaire**.

**Artefacts gitignorés divers**
- **RETIRÉ le 01/10** : `public/uploads/proofs/temp/**` — 3 webp orphelins (dossier **gitignoré**
  `.gitignore:73`, cité par aucun code).
- `src/audit-cyber` (3,8 Ko), `src/audit-infra` (4,5 Ko) — artefacts d'audit (**à garder**).
- `scripts/convert-console-to-logger.ps1`, `scripts/test-dofusdb.ts` (466 o), `scripts/test-guide-actions.ts`
  (1 Ko) — sondes gitignorées (non suivies, à garder).

**④ SUPPRIMÉE le 01/10 — `A:\SigilOS--purge-2026-09-20`** (archive externe, 19 Mo, hors dépôt)
> Supprimée **avec l'accord du propriétaire**, en connaissance de cause : le **ticket GitHub #4775252 est
> archivé** (raison ① tombée) et le propriétaire n'a plus besoin ni de traduire d'ancien SHA (le `commit-map`)
> ni de revenir à l'histoire d'avant la réécriture (`RESTAURER-SUR-GITHUB.ps1`). **Perdu définitivement** :
> correspondance ancien→nouveau SHA, refs d'avant réécriture, `guide_backup.sql` (17,7 Mo).

**⑤ Caches de build locaux (nettoyés le 01/10 — tous régénérés automatiquement)**
- `.next/` (**8,18 Go**) · `tsconfig.tsbuildinfo` · `scripts/tsconfig.tsbuildinfo` · `next-env.d.ts` ·
  `cloudflare-workers/dofusbook-proxy/.wrangler/` (+ `wrangler-dev.log`).
- **Conservés** (utiles) : `node_modules/`, `services/discord-bot/{dist,node_modules}`, `temp/debug.tmp`,
  `temp/debug2.tmp`. Zones volatiles utiles non touchées : `temp/` et `src/temp/` (voir ② et ③).

**Rien de suivi à nettoyer**
- `git status --short` : propre — 0 untracked **hors** les 2 fichiers de ce lot (`FILE-EXECUTION.md`,
  `PLAN-SALONS-VOCAUX.md`).
- `.md` hors `docs/` : `AGENTS.md`, `README.md`, `cloudflare-workers/dofusbook-proxy/README.md`,
  `prisma/seed-data/README.md` — **tous légitimes**.
- **0** schéma probe/scratch suivi (seuls 2 dossiers de **migration** contiennent « v2/old » → à **ne pas
  renommer**, Prisma).

## 5. Tenue de cette file

- Un lot **livré** → sa ligne du §2 passe en `✅` (**on garde la ligne** : on ne supprime pas un chantier).
- Une **décision** tranchée → sort du §3 et rejoint le plan du chantier.
- Un **nouveau front** (ex. `Q`) → une ligne au §1 **et** une ligne au §2 ; il n'entre **jamais** seulement
  dans `temp/`.
- Les ordres cités ailleurs (consigne volatile, `PLAN-RAID` §6, `AMORCE-RAID` §0) **pointent ici** au fur et
  à mesure de leurs lots.

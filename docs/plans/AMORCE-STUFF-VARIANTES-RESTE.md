# AMORCE — Stuff & variantes : la suite

> **Ce fichier n'est pas la source d'ordre** : l'ordre vit dans `../ROADMAP.md` (rang 51).
> Il sert d'**amorce de reprise** : ce qui est livré (mesuré), ce qui reste, dans quels fichiers,
> avec quels tests et quels pièges. Un point soldé se **retire d'ici** et se note au `ROADMAP`.

## 0. État livré (mesuré le 26/10/2026)

| Sujet | Preuve |
|---|---|
| Stats | initiative **1883** (= Fo+Ag+Ch+In), esq/ret **40** (⌊Sag/10⌋), tacle/fuite **58/33** (⌊Ag/10⌋), 5 résistances secondaires + renvoi — build `22329554`, page Dofusbook **rendue** |
| Icônes | 6 assets siphonnés (`resCritique`, `resPoussee`, `resMelee`, `resDistance`, `renvoi`, `doFinaux`), `check-media-metadata` **0** |
| Synchro | `force` de bout en bout (worker CF, TTL 60 s après rafraîchissement), `updatedAt` seulement si la donnée change |
| Légalité | slot ↔ type, niveau ≤ build, doublons, **1 Prysmaradite**, arme à deux mains vs bouclier, **conditions d'objet** (arbre DofusDude) |
| Règles 3.7 | panoplie active dès **2 pièces**, **palier qui remplace**, **pièces distinctes** |
| Panoplies recalculées | référentiel `GameItemSet` (**938/940** siphonnées, `npm run siphon:item-sets --apply`) · bonus **retirés puis recalculés** sur les items effectifs · **2 refus** explicites, **2ᵉ passage = 0 écriture** · `characteristic` → code court mesuré sur `/characteristics` (123 entrées) |
| Pods | **capacité** `1000 + 5 × Force` (+ pods d'objets, caractéristique `40`) — vérifiée sur 2 builds (1950 pour 190, 1250 pour 50) · affichée dans la fiche · Force inconnue ⇒ **`—`** |
| Veille | compteur d'inconnues (**264** objets conditionnés, **12** atomes non évaluables) · instantané Redis (`game-data:watch:item-conditions`) · alerte God **sur nouveauté seule** (atome ou type) · types hors `VARIANT_SLOTS` signalés, jamais devinés · **2ᵉ passe sans bruit** |
| Contrat de payload | test des **deux formes** d'`element` (objet / `"@{name=PA; id=12}"`), relations `{and, or}`, opérateurs mesurés ; relation ou valeur inconnue ⇒ **refus** (jamais un ET implicite, jamais `Number(null) === 0`) |
| Données | **3** migrations additives (`criterions`/`twoHanded`/`conditions`, puis `GameItemSet`) · **264 conditions** chargées en local (siphon **idempotent**) · **938 panoplies** |
| Verrous | `dofus-set-bonuses` **24** · `dofus-pods` **7** · `dofus-caps` **4** · `item-conditions-watch` **7** · `dofus-conditions` **+4 cas** (contrat de payload) · `dofus-variant-rules` **+2 cas** · `dofus-criteria` 12 · `dofusbook-sync-force` 16 · `galerie-variantes-affichage` 13 |

## 1. Lot D — Ops prod (la **bêta** est faite, mesurée le 26/10/2026)

État bêta : **938** panoplies · **264** conditions · **3 646** liens objets↔panoplies · 2ᵉ passage = **0 écriture**
sur les deux siphons (idempotence prouvée, JSONB réordonne les clés). Ce qui reste est **la prod**, dans cet ordre :

1. PR `dev` → `main` → CI verte → `./scripts/deploy-cd.sh prod` (applique les **20** migrations en attente, dont
   les **3 additives** de ce chantier : `criterions`/`twoHanded`/`conditions` puis `20270120000000_item_sets`).
2. `GET /api/cron/siphon-item-sets?apply=1` (**938** attendues) — **en premier** : le référentiel prod est
   **vide**, donc tant qu'il l'est, toutes les variantes à panoplie sont **refusées** (fail-closed, voulu).
3. `GET /api/cron/siphon-item-conditions?apply=1` (**264** attendues ; sans `apply` = dry-run).
4. `GET /api/cron/data-watch` **une fois à la main** : pose le filigrane des panoplies (sans lui la veille repart
   sur 60 jours) et met les objets à jour.
5. Poser les **deux lignes de crontab** prod (`docs/MAINTENANCE.md` § Tâches planifiées) : la veille
   `0 5 * * 0` — elle **existe déjà** sur le VPS, **ne pas ajouter de doublon** — et le siphon mensuel des
   conditions (`5 5 1 * *`). Un `.mjs` lancé par `docker exec` **échoue** (`@prisma/driver-adapter-utils` absent
   du build standalone, mesuré le 26/10/2026) : ces opérations passent par les **routes**.
6. Redéployer le worker CF (`wrangler deploy` dans `cloudflare-workers/dofusbook-proxy`) s'il ne l'est pas déjà
   — sans ça, le cache Dofusbook de 24 h reste actif.
7. Vérifier dans l'UI : condition affichée sur un objet contraint ; variante invalide **refusée avec sa raison**
   (« Bonus de panoplies < 2 »…) ; variante qui retire une pièce d'une panoplie active → les totaux **baissent**
   du palier perdu.


## 2. Décisions actées (finitions, 26/10/2026)

Ces points ne se **codent** pas : ils sont tranchés, et la raison est écrite pour ne pas les rouvrir.

- **Résistances secondaires sur la carte** : **non** — le bandeau garde PA/PM/PO/CC (320 px de
  large, 5 valeurs de plus écraseraient le reste). La fiche les affiche déjà (Ré Crit., Ré Pouss.,
  %Ré Mêlée/Dist., Renvoi). Rien à faire.
- **`% Do Finaux`** (`deg`) : **ne rien changer** — Dofusbook ne l'agrège pas dans son panneau de
  dommages non plus (mesuré) ; il reste dans la puce FM.
- **`criterions` / `twoHanded`** : **pas de passe complète** — colonnes vides en local, impact
  mesuré : `criterions` = audit seul, `twoHanded` = **1 objet** dans tout Dofus.
- **Types/slots** : `VARIANT_SLOTS` reste écrit à la main ; la **veille** signale désormais les
  types hors slots (instantané + alerte sur **nouveauté**), elle ne les devine pas.
- **Conditions non évaluables (12 objets / 264)** : abonnement (8), alignement (2), kamas (1),
  niveau `{0}` exotique (1) — propriétés **hors d'un build**. Sélection refusée, condition
  **affichée** ; aucune devinette (cf. `GALERIE-DOFUSBOOK-RELAIS.md` §10).

## 3. Pièges mesurés (à ne pas repayer)

1. **Prisma 7 exige un driver adapter** : un script Node doit charger `.env.local`/`.env` et
   passer `PrismaPg` (sinon « A driver adapter is required »).
2. **JSONB réordonne les clés** : comparer avec une sérialisation **stable** (sinon le siphon
   réécrit à chaque passage et n'est plus idempotent).
3. **Dofusbook bloque** après une rafale d'appels (403) — d'où le worker + `force` + TTL court.
4. **Dofusbook peut servir un payload plus vieux que la page** (mesuré : 3 panoplies dans l'API
   contre 4 sur la page) — ne jamais conclure « l'API dit X donc c'est X » sans la page.
5. **`element` de condition** : objet `{name,id}` **ou** chaîne `"@{name=PA; id=12}"` — même
   réponse, deux formes.
6. **Un palier de panoplie remplace le précédent** (3.7) : additionner était un **bug**.
7. **Le candidat ne se compte pas lui-même** dans les conditions PA/PM (Heaume Oplate : +1 PA
   avec « PA < 12 »).
8. **`/item-sets` est énorme** : 56 ko par panoplie (elle embarque ses objets complets), 940 au
   total ≈ 53 Mo. `$select` n'est **pas** supporté (mesuré : ne renvoie que `_id`). On pagine par
   `$limit=50` et on **stripe immédiatement**.
9. **Pagination** : tester la fin **avant** d'avancer `skip` (`hasMorePages(skip, longueur, total)`
   compare déjà `skip + longueur` au total). Avancer d'abord a fait perdre la dernière page
   (mesuré : **900/940** panoplies lues). Règle extraite dans `nextPageState()` + test.
10. **Panoplie sans bonus ≠ panoplie inconnue** : les panoplies cosmétiques existent (aucun
    palier, mesuré sur `/item-sets` 504-535). Les refuser déclarait « inconnues » toutes les
    variantes des builds qui les portent.
11. **`characteristic` ≠ `effectId`** : `85` = « Poussée (fixe) » (une **réduction**, `rp`) alors
    que `84` = dommages de poussée (`dp`). Le mapping rendait `dp` pour `85` ⇒ une panoplie
    « Ré Poussée » créditait les dommages. Corrigé sur la mesure de `/characteristics`.
12. **`Number(null)` vaut `0`** : une Force absente affichait `1000` de pods, une `int_value`
    absente satisfaisait « PA > -1 ». Toute donnée optionnelle se teste `=== null || === undefined`
    **avant** `Number()`.
13. **Une veille doit alerter sur la nouveauté, pas sur l'état** : le catalogue contient des types
    `equipment` qui ne se portent pas (caution, certificat, bannière…) ; alerter sur « il reste N
    inconnues » ferait sonner le cron chaque semaine. On stocke l'état, on n'alerte que sur le
    **diff** (atome ou type jamais vu).
14. **12 PA / 6 PM / 6 PO / 6 invocations, pas plus** : un build ne peut pas dépasser ces valeurs
    (Dofus Wiki, `Characteristic` § Action Point, Movement Point, **Range**, **Summons** — « the bonus
    will not be included »). Un familier +1 PA sur 12 PA affichait **13** ⇒ `src/lib/dofus-caps.ts`
    plafonne l'**affichage** et **dit** le point ignoré ; le total brut reste dans les données.
15. **Un refus doit dire sa cause** : « Panoplie indisponible » n'apprend rien. `explainVariantRefusal`
    distingue contexte absent / panoplie inconnue / contexte incohérent, **nomme** les panoplies et
    l'action (recharger, synchroniser). Et si le contexte manque parce que la page précède la
    synchronisation, la miniature le **rattrape** elle-même (`getVariantItemSets`).
16. **« Actualiser » ne prouve rien si le relais est obsolète** : mesuré le 26/10/2026, `force=1`
    renvoyait **`X-SigilOS-Cache: HIT`** (au lieu de `BYPASS`) et le **même** payload que sans
    drapeau ⇒ le worker **déployé** était antérieur au correctif (le code du dépôt était bon).
    L'en-tête à lire est **`X-SigilOS-Cache`** (pas `X-Cache` : un diagnostic a conclu à tort « pas
    notre worker » en cherchant le mauvais nom). Un payload identique après `force` **ne veut pas
    dire** « rien n'a changé sur Dofusbook » ⇒ l'UI le dit, le serveur journalise. Remise en état :
    `wrangler deploy` (même nom), contrôle `BYPASS` sur `force=1`.
17. **Un relais à jour peut quand même échouer** : le 26/10/2026, après redéploiement, Dofusbook a
    répondu **403** au `BYPASS` **depuis tous les clients** (worker **et** IP résidentielle, page
    d'accueil comprise) ⇒ blocage **temporaire de la source** (bot-management / limiteur, aggravé par
    des sondes répétées). Ne pas « corriger » le worker pour ça : réessayer plus tard, l'app conserve
    les dernières données connues et le dit.

## 4. Définition de fini (commune à tous les lots)

- [ ] Règle pure dans `src/lib/**` + test de **comportement** dans `tests/unit/**` (nommé en français).
- [ ] **Fail-closed** : donnée manquante ou inconnue ⇒ refus explicite, jamais d'approximation.
- [ ] Isolation de guilde et auth inchangées ; aucune écriture sans revalidation serveur.
- [ ] `npm run test:run` + `npx tsc --noEmit` + `npm run lint` verts.
- [ ] Migration (si schéma) **additive**, écrite à la main, jouée en local puis listée en ops.
- [ ] `docs/ROADMAP.md` (statut) + `docs/agents/activeContext.md` (bloc de session) à jour ;
      ce fichier **allégé** des points soldés.

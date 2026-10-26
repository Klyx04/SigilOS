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
| Données | 2 migrations additives (`criterions`, `twoHanded`, `conditions`) · **264 conditions** chargées en local (siphon **idempotent**) |
| Verrous | `dofus-conditions` 16 · `dofus-criteria` 12 · `dofus-variant-rules` 12 · `dofus-set-bonuses` 5 · `dofusbook-sync-force` 16 · `galerie-variantes-affichage` 13 |

## 1. Lot A — Bonus de panoplie **recalculés** dans une variante (priorité 1)

**Problème mesuré.** `applyVariantsToBuild` remplace `items[slot]` et ajuste les stats, mais **ne
touche pas `cloths`** : une variante qui casse (ou active) une panoplie laisse les bonus du stuff
d'origine. Le payload Dofusbook ne contient que le **palier actif** ⇒ impossible de recalculer
sans stocker les **paliers complets**.

**Données.** DofusDB `/item-sets` (940 panoplies) fournit `effects` : tableau indexé par palier,
chaque ligne `{ characteristic, from (valeur), effectId, elementId }` — mesuré (`/item-sets/242`
Danathor : `c13=40`, `c44=500` initiative, `c48=20`, `c79=5`).

**Fait à faire.**
1. Migration additive `GameItemSet` : `id` (DofusDB), `name`, `itemsIds Int[]`, `tiers Json`
   (paliers normalisés `[{ count, effects: [{ characteristic, value, effectId }] }]`).
2. Siphon **à créer** `src/lib/item-sets-siphon.ts` (pagination `/item-sets`, hash de changement
   sur le modèle de `src/lib/game-items-siphon.ts`).
3. Règle pure **à créer** `src/lib/dofus-set-bonuses.ts` (`activeSetBonuses(items, sets)`),
   **extraite** du parseur `src/lib/dofusbook-utils.ts` pour n'avoir qu'une source de vérité —
   pièces **distinctes**, **plus haut palier atteint seulement**, jamais d'addition.
4. `applyVariantsToBuild` : retirer les bonus d'origine (`cloths[].bonuses`), ajouter les nouveaux
   calculés sur les items **effectifs** (base + variantes), en réutilisant la même règle que le
   parseur (une seule source de vérité).
5. `saveBuildVariant` : refuser une variante qui rend une condition `Bonus de panoplies` fausse
   (déjà branchée — elle utilise `itemSetId` du catalogue).

**Tests.** `tests/unit/dofus-set-bonuses.test.ts` (extension) : 3 pièces → palier 3 seul ; anneau
doublé = 1 pièce ; variante qui ajoute une 2ᵉ pièce active la panoplie ; variante qui retire une
pièce fait **baisser** le palier. Interdits : addition de paliers, comptage non distinct.

**DoD.** Migration jouée en local, siphon dry-run puis `--apply`, `tsc`/lint/suite verts, doc
`GALERIE-DOFUSBOOK-RELAIS.md` mise à jour.

## 2. Lot B — Pods

**Mesure.** Le payload Dofusbook ne porte **aucun poids** ; DofusDude expose `pods` par objet, et
`GameItem.realWeight` est déjà siphonné. Dofusbook affiche **1950** (build `22329554`) et **1250**
(build `23582119`).

**Fait à faire.** Vérifier la formule sur les deux builds (`1000 + Force + Σ poids` ?), puis
enrichir `DofusbookPreviewData` d'un `pods` calculé **côté action serveur** (jointure
`GameItem.realWeight` par `ankamaId`) ; afficher « Pods » dans le panneau secondaire. Tant que la
formule n'est pas prouvée : **ne rien afficher** (pas d'approximation).

**Tests.** Un cas par build de référence + un cas « poids inconnu ⇒ pas de valeur » (jamais 0).

## 3. Lot C — Veille & garde-fous (pérennité face aux MAJ Dofus)

1. **Compteur d'inconnues.** `evaluateDofusConditions` (`src/lib/dofus-conditions.ts`) renvoie
   déjà `unsupported` (liste des éléments hors contexte) dans `ConditionsEvaluation` : agréger par
   élément/opérateur et **alerter le God** (comme `#41bis` pour Dofusbook) quand un nouvel élément
   apparaît. Aujourd'hui : refus silencieux côté UI, pas de trace agrégée.
2. **Job de veille.** Étendre l'état de veille existant (`src/server/game-data-sync-state-store.ts`)
   à `conditions` : dernière synchro, nb d'objets conditionnés, nb d'inconnues. Planification :
   même famille que le sync items (BullMQ / cron), jamais un `setInterval` en mémoire.
3. **Contrat de payload.** Un test de forme sur un échantillon réel (anonymisé) : `element` peut
   être un objet **ou** la chaîne `"@{name=PA; id=12}"` (mesuré), `relation` ∈ {and, or},
   opérateurs ∈ {<, =, >}. Toute autre forme = CI rouge **avant** la prod.
4. **Règles versionnées.** Un seul module (`dofus-variant-rules.ts`) porte les règles 3.7 avec
   source + date ; chaque règle a son test. Une MAJ Ankama = 1 fichier + 1 test.
5. **Siphons idempotents.** `--apply` explicite, comparaison JSON **stable** (JSONB réordonne les
   clés — piège déjà payé), hash de changement.

## 4. Lot D — Ops bêta/prod (humain)

1. `npx prisma migrate deploy` (2 migrations additives) puis `npx prisma generate`.
2. `node scripts/siphon-item-conditions.mjs --apply` (264 objets attendus).
3. Redémarrer l'app (client Prisma en mémoire).
4. Redéployer le worker CF (`wrangler deploy` dans `cloudflare-workers/dofusbook-proxy`) —
   sans ça, le cache Dofusbook de 24 h reste actif.
5. Vérifier dans l'UI : fiche d'un build → condition affichée sur un objet contraint ; tentative de
   variante invalide → refus explicite.


## 5. Lot E — Finitions (faible risque)

- **Résistances secondaires sur la carte** : aujourd'hui affichées seulement dans la fiche (le
  bandeau de la carte garde PA/PM/PO/CC). Décider si la carte les montre (place limitée).
- **`% Do Finaux`** : libellé OK dans la puce FM (`deg`), pas agrégé au panneau des dommages —
  Dofusbook ne l'y met pas non plus : ne rien changer sans mesure.
- **`criterions` / `twoHanded`** : colonnes vides en local (remplies au prochain siphon items).
  Impact mesuré : `criterions` = audit seul ; `twoHanded` = **1 objet dans tout Dofus**
  (« Balai rudimentaire »). Ne pas lancer une passe complète pour ça.
- **Types/slots** : `VARIANT_SLOTS` est écrit à la main. Si Dofus ajoute un type d'objet, la
  recherche ne le proposera pas — la veille (Lot C) doit le **signaler**, pas le deviner.

## 6. Pièges mesurés (à ne pas repayer)

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

## 7. Définition de fini (commune à tous les lots)

- [ ] Règle pure dans `src/lib/**` + test de **comportement** dans `tests/unit/**` (nommé en français).
- [ ] **Fail-closed** : donnée manquante ou inconnue ⇒ refus explicite, jamais d'approximation.
- [ ] Isolation de guilde et auth inchangées ; aucune écriture sans revalidation serveur.
- [ ] `npm run test:run` + `npx tsc --noEmit` + `npm run lint` verts.
- [ ] Migration (si schéma) **additive**, écrite à la main, jouée en local puis listée en ops.
- [ ] `docs/ROADMAP.md` (statut) + `docs/agents/activeContext.md` (bloc de session) à jour ;
      ce fichier **allégé** des points soldés.

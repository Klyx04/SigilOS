# AMORCE — Souveraineté 100 % des visuels (images de jeu)

> **Ce fichier n'est pas la source d'ordre** : l'ordre vit dans `../ROADMAP.md` (rang 61).
> Il sert d'**amorce de reprise** : ce qui est mesuré, ce qui reste, dans quels fichiers, avec
> quels verrous et quels pièges. Un point soldé se **retire d'ici** et se note au `ROADMAP`.

## 0. Ce que « souverain » veut dire (critères vérifiables)

Une image est **souveraine** quand les quatre conditions sont vraies :

| # | Critère | Vérification |
|---|---|---|
| 1 | Le **navigateur** ne contacte jamais un tiers | CSP `img-src 'self'` + aucune URL absolue dans un `src` |
| 2 | Le **HTML servi** ne contient aucune URL distante | le document ne contient pas `api.dofusdb.fr` |
| 3 | Le **serveur** ne fait aucun appel réseau pour servir une image | aucun `fetch` sortant dans le chemin de requête |
| 4 | **Toute** cible a son fichier chez nous | script de couverture = 0 manquant sur le périmètre |

Aujourd'hui : **1 est tenu, 2 partiellement, 3 et 4 ne le sont pas.**

## 1. Constat mesuré (09/11/2026, bêta `8fde214b`)

| Sujet | Mesure |
|---|---|
| Proxy, image jamais vue | `GET /api/assets-dofus/monsters/646?…&sprite=1` → **118 octets**, en-tête `X-SigilOS-Placeholder: 1` |
| Amont DofusDB | `https://api.dofusdb.fr/img/monsters/646.png` → **200**, `20 954` octets |
| Même code en local | même route → **5 482** octets (vraie image) ⇒ le code est bon, l'environnement du conteneur ne l'est pas |
| Image déjà sur le disque | `/api/assets-dofus/monsters/649` → **4 020** octets ⇒ seules les images **pré-chauffées** s'affichent |
| Ids et espaces | `monsters/646` (entité) → **404** « No record found » ; le nombre est un **`gfxId`** (espace apparence) |
| Origine des URLs | `Archimonstre.imageUrl` = `https://api.dofusdb.fr/img/monsters/<gfx>.png` — 4 901 lignes, **4 898** avec image (277 archis, 179 boss, 4 445 monstres) |
| Transport dans le DOM | `internalDofusDbImageUrl` produit `/api/assets-dofus/monsters/<n>?url=https%3A%2F%2Fapi.dofusdb.fr%2F…&sprite=1` ⇒ **l'URL amont voyage dans la query** |
| Dépôt local | `public/assets/dofus/monsters` = **633 PNG** (indexés par id d'entité) |
| Cibles de la quête Ocre | **337** (286 archis + 51 gardiens) d'après l'écran ; `Archimonstre` n'en couvre qu'une partie (graphies divergentes, ex. « Kaskapointe » vs « Kaskapoin**th**e ») |

**Conséquence directe** : le module Ocre dépend d'un téléchargement runtime vers un service tiers,
et ce téléchargement est aujourd'hui **en panne dans le conteneur**. La souveraineté repose donc
sur un cache rempli par chance.

## 2. Décisions à trancher avant de coder

1. **Où vit le stockage ?** volume Docker (comme aujourd'hui) ou S3/R2 (déjà utilisé pour d'autres
   assets ?). Le volume impose un backup et ne survit pas à un `docker compose down -v`.
2. **Quelle source de siphon ?** dump du client de jeu (`monsters_2x`, via
   `scripts/import-dofus-assets.cjs`, indexé par `gfxId`), téléchargement one-shot contrôlé depuis
   `api.dofusdb.fr` (`scripts/dofus-asset-siphoner.ts`), ou les deux (dump d'abord, réseau en secours).
3. **Périmètre de la première vague** : les **337 cibles Ocre** seules, ou tous les monstres
   (`Archimonstre`, 4 901 lignes) + items/sorts/succès du produit.
4. **Sort de `?url=`** : le retirer du chemin nominal (l'URL amont ne sert plus qu'au script) —
   c'est la seule façon de tenir le critère 2. Le proxy devient **lecteur de cache**.
5. **Comportement si le fichier manque** : picto du jeu (statu quo) ou image « à importer »
   explicite côté God ? Recommandation : picto côté joueur, **liste God** des manquants.

## 3. Lots proposés

### S1 — Siphon des cibles Ocre (débloque le symptôme actuel)

- Construire la liste des 337 cibles depuis la **source réelle** (Metamob) et la rapprocher de
  `Archimonstre` par nom **normalisé** (NFD, sans accents), en journalisant les **non-résolus**
  (graphies divergentes : « Kaskapointe »/« Kaskapoin**th**e »).
- Pour chaque cible : `gfxId` depuis `imageUrl` → fichier `monsters/<gfx>.sprite.webp`
  (même clé que le proxy, cf. `src/app/api/assets-dofus/[type]/[id]/route.ts`).
- Sortie : rapport `cibles / siphonnées / non résolues` + écriture sur le stockage retenu.
- **Aucun** changement de comportement applicatif à ce stade : on remplit le cache.

### S2 — Le proxy devient un lecteur de cache

- `src/app/api/assets-dofus/[type]/[id]/route.ts` : supprimer le `fetch` sortant du chemin de
  requête (ou le placer derrière un drapeau `ASSETS_REMOTE_FETCH=false` par défaut).
- `src/lib/dofus-image-url.ts` : ne plus produire `?url=` pour les monstres ; l'espace apparence
  reste désigné par `?sprite=1` (clé de cache distincte, déjà en place).
- Fichier absent ⇒ `placeholderResponse()` (inchangé), et **log** de la cible manquante.

### S3 — Verrous et couverture

- `tests/unit/souverainete-visuels.test.ts` : étendre au **transport** (aucune URL amont dans une
  URL produite pour le DOM).
- `tests/unit/assets-dofus-route.test.ts` : la route ne contient **aucun** `fetch(` hors script.
- Nouveau `scripts/assets-coverage.mjs` : liste les cibles sans fichier, par type ; sortie
  exploitable en CI (échec si le périmètre Ocre n'est pas à 100 %).

### S4 — Ops

- Exécuter le siphon sur la **bêta** puis la **prod**, vérifier la couverture = 100 % sur le
  périmètre Ocre, puis rejouer une page du module et `logs app` (zéro `[assets-dofus]` d'échec).
- Documenter la procédure dans `docs/MAINTENANCE.md` (commande, durée, idempotence, rollback).

## 4. Verrous attendus (après livraison)

| Verrou | Ce qu'il interdit |
|---|---|
| `souverainete-visuels` (étendu) | une URL amont dans une URL produite pour le DOM |
| `assets-dofus-route` (étendu) | un `fetch` sortant dans la route proxy |
| `assets-coverage` (neuf) | un périmètre (Ocre d'abord) qui n'est pas à 100 % de fichiers présents |

## 5. Critères de sortie (Definition of Done)

- [ ] Le HTML d'une page du module Ocre ne contient **aucune** occurrence de `api.dofusdb.fr`.
- [ ] `assets-coverage` : **337 / 337** cibles Ocre avec fichier, 2ᵉ passage = **0 écriture**.
- [ ] Aucun `fetch` sortant dans le chemin de requête du proxy (vérifié par test).
- [ ] Avec le réseau **coupé** dans le conteneur, les vignettes du module Ocre s'affichent.
- [ ] `npm run test:run` vert, `tsc` 0, ESLint 0 erreur, aucune migration.

## 6. Hors périmètre

- Les images **produits** (objets, sorts, succès) : même mécanique, lot ultérieur.
- Les **données** (noms, niveaux, zones) : déjà en base, rien à siphonner.
- Le **dump du client de jeu** lui-même (il vit hors dépôt).

## 7. Pièges connus (à ne pas rejouer)

1. **`img/monsters/<n>.png` est un `gfxId`**, pas un id d'entité : `/monsters/646` répond 404 et
   `/monsters/90` sert une **autre** créature (mesure du 12/10/2026, corrigée par `?sprite=1`).
2. **Deux clés de cache distinctes** : `<id>.webp` (entité) et `<id>.sprite.webp` (apparence). Les
   mélanger sert la mauvaise image, figée un an (`immutable`).
3. **Le placeholder est un PNG 1×1 transparent** (`no-store`) : ce n'est pas un 404, donc un
   composant qui ne vérifie pas `naturalWidth <= 1` affiche un vide silencieux.
4. **Les graphies divergent** entre Metamob et `Archimonstre` (« Kaskapointe » / « Kaskapoin**th**e ») :
   un rapprochement strict par nom laisse des cibles sans image — d'où le rapport de non-résolus.
5. **Le `catch` muet de la route** a caché une panne totale : toute nouvelle branche de
   téléchargement doit **logguer sa cause** avant de replier sur le placeholder.


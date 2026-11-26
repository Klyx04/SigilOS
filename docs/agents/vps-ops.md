---
description: Ops VPS — runbook d'écriture (dump, archive Rush, vérification), conteneur d'ops dédié et garde-fous
---

# 🛠️ Ops VPS — écriture contrôlée

> **Rôle** : ce document dit **comment** exécuter une opération d'écriture sur le VPS
> (sauvegarde, remplacement du guide Rush, vérification) sans bricolage. La **lecture**
> seule vit dans `vps-read-only.md` ; ici, c'est l'écriture : **humaine**, sauvegardée et prouvée.

## 0. Pourquoi un conteneur dédié

Mesure du 20/11/2026 : `docker compose exec app-beta node scripts/archive-rush-guide.mjs`
échoue sur `@prisma/driver-adapter-utils`, puis `postgres-array`. L'image `runner` est un
standalone Next : elle ne contient que les paquets importés par l'app. Copier les paquets
un par un est une dette. La réponse est le **stage `ops`** du Dockerfile (dépendances
complètes + client Prisma généré, sans build Next), exposé par `ops-beta` / `ops-prod`
dans `docker-compose.prod.yml` (profil `ops`, jamais démarré par `up`).

## 1. Matrice des verbes

| Verbe | Écrit ? | Ce qu'il fait | Garde |
|---|---|---|---|
| `dump <env>` | hôte | `pg_dump` daté dans `~/backups` | refuse un dump vide |
| `rush-archive <env>` | non (dry-run) | montre l'archive + le guide vide | — |
| `rush-archive <env> --apply` | oui | renomme l'actuel en archive, crée un guide vide | transaction du script |
| `rush-delete-archive <env> <slug>` | non | montre la suppression | préfixe `rush-sylvestre-archive-` |
| `rush-delete-archive … --apply` | oui | supprime l'archive (cascade) | préfixe + dump préalable |
| `rush-verify <env>` | non | séquences, conseils, `pos_tags`, tags avec monstres | lecture seule |
| `rush-combats <env>` | non | combats `constraints`, images manquantes, tags `activityTags`, séquences tags/combats | lecture seule |
| `class-watch <env>` | non (dry-run) | compare DofusDB **prod** + **bêta**, affiche les classes nouvelles/modifiées/retirées | — |
| `class-watch <env> --apply` | oui | écrit le manifeste de CET env, télécharge les icônes hors code dans `assets-dofus`, journalise | additif uniquement, **aucune suppression** |

## 2. Procédure (bêta puis prod)

```bash
cd ~/SigilOS
./scripts/ops/vps.sh dump beta
./scripts/ops/vps.sh rush-archive beta
./scripts/ops/vps.sh rush-archive beta --apply
# God ▸ Rush Sylvestre ▸ JSON : analyser puis appliquer le seed
./scripts/ops/vps.sh rush-verify beta
./scripts/ops/vps.sh rush-combats beta
```

## 3. Rollback

- L'archive est le rollback : `rush-sylvestre-archive-<date>` (inactive, tout son contenu intact).
- Renommage inverse manuel (archive → `rush-sylvestre`) puis suppression du guide vide.
- Le dump PostgreSQL de l'étape 1 est la ceinture.

## 3bis. Veille des classes (`class-watch`)

La prod DofusDB est la **vérité live** ; la bêta est un **aperçu** (contenu en avance,
parfois incomplet jusqu'à la sortie officielle). La commande ne supprime jamais une
classe : une disparition devient `retired` + une entrée `REMOVED` dans le journal God.

```bash
cd ~/SigilOS
./scripts/ops/vps.sh dump beta                 # ceinture (additif, mais on garde l'habitude)
./scripts/ops/vps.sh class-watch beta          # dry-run : lire le diff
./scripts/ops/vps.sh class-watch beta --apply  # manifeste + icônes + journal
cat public/uploads/assets-dofus/class-catalog.json | head   # preuve (volume beta)
```

- Le manifeste et les icônes sont dans le **volume de l'environnement** (`assets-beta-data`
  ou `assets-prod-data`) : beta et prod ne se contaminent pas.
- Une classe **bêta seule** reste `preview` ; elle n'entre dans le bundle client que par
  une PR relue sur `DOFUS_CLASSES`. Le veilleur prépare l'icône et alerte, il n'édite pas
  le code.
- Les grimoires à rafraîchir sont persistés dans `class-spell-refresh-pending.json` ;
  le cron `class-watch` les met en file et les reprend au passage suivant si la file est
  occupée. Le **dimanche**, il met en file une **passe complète** des grimoires (un
  rééquilibrage de sorts ne change pas le nombre de sorts de la classe).

## 4. Ce que ce runbook ne fait pas

- Il ne déclenche **pas** l'import God : le seed reste local et part par le navigateur.
- Il ne remplace pas les décisions : reset de progression, ouverture prod, V-C.
- Il ne donne **aucune** clé d'écriture à l'agent : `agent-ro` reste lecture seule.

## 5. Dette connue

- Le Dockerfile doit rester la **seule** source des dépendances d'ops : ne jamais copier
  un paquet à la main dans un conteneur (mesure de l'incident du 20/11/2026).
- Le skill `vps-ops` route l'agent ; il ne code pas la logique.

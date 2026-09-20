---
description: How to compile and seed quest data for a new or existing Dofus (Argenté, Ébène, Pourpre...)
---

# Workflow — Compiler & Seeder un Dofus

Ce workflow permet d'enrichir les données d'un Dofus depuis DofusDB et les injecter en base, pour n'importe quel Dofus.

## Étapes

### 1. Créer ou mettre à jour la config

Si c'est un nouveau Dofus :
```bash
cp scripts/dofus-configs/argent.json scripts/dofus-configs/<slug>.json
```

Éditer le nouveau fichier JSON :
- `slug` : identifiant court (`ebene`, `pourpre`, `ivoire`, `ocre`...)
- `displayName` : nom complet (`"Dofus Ébène"`)
- `color` : couleur hex du Dofus (`"#3d1a00"`)
- `successes` : liste des succès (dans l'ordre) avec leurs quêtes

### 2. Compiler les données depuis DofusDB

```bash
npx tsx scripts/dofus-compiler.ts --dofus <slug>
```

Ex : `npx tsx scripts/dofus-compiler.ts --dofus ebene`

Cela produit `prisma/seed-data/dofus-quests/<slug>-compiled.json` avec :
- `level` (niveaux recommandés)
- `coords` (position carte du NPC de départ)  
- `isDungeon` (flag si donjon requis)
- `itemsRequired` (objets à apporter)

⚠️ Vérifier les lignes `⚠️ NOT FOUND` en sortie → corriger les noms dans la config si besoin.

### 3. Vérifier le JSON généré

```bash
cat prisma/seed-data/dofus-quests/<slug>-compiled.json | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log('Succès:',j.chains.length,'Quêtes:',j.chains.reduce((n,c)=>n+c.entries.length,0),'Coords:',j.chains.flatMap(c=>c.entries).filter(e=>e.coords).length)"
```

### 4. Seeder en base de données

```bash
npx tsx scripts/seed-argent-tree.ts --dofus <slug>
```

Note : le script `seed-argent-tree.ts` est générique malgré son nom.

### 5. Vérifier dans l'interface God

Ouvrir [http://localhost:3000/god/quetes-dofus](http://localhost:3000/god/quetes-dofus)

- Le Dofus doit apparaître dans la liste
- Vérifier les coordonnées, niveaux et flags donjons
- Corriger manuellement via l'éditeur si nécessaire

### 6. Vérifier côté joueur

Ouvrir un dashboard de guilde → onglet Dofus → sélectionner le nouveau Dofus.

---

## Dofus disponibles et leurs configs

| Slug | Config | Status |
|---|---|---|
| `argent` | `scripts/dofus-configs/argent.json` | ✅ compilé + seedé |
| `ebene` | À créer | 🔄 en attente |
| `pourpre` | À créer | 🔄 en attente |
| `ivoire` | À créer | 🔄 en attente |
| `ocre` | À créer | 🔄 en attente |

---

## Corriger un nom de quête introuvable

Si DofusDB ne trouve pas une quête (ligne `⚠️ NOT FOUND`) :

1. Rechercher le vrai nom sur [https://dofusdb.fr/fr/database/quest](https://dofusdb.fr/fr/database/quest)
2. Copier le nom exact (avec accents)
3. Mettre à jour le nom dans `scripts/dofus-configs/<slug>.json`
4. Relancer les étapes 2 à 4

---

## Notes techniques

- Le compiler respecte un délai de **300ms entre chaque requête** DofusDB (rate limiting)
- La compilation de 57 quêtes prend environ **20-30 secondes**
- Le seeder purge les anciennes chains avant d'insérer — donc idempotent
- Les IDs des entrées sont stables (`<slug>-<dofusdbId>`) → pas de doublons même si on re-seed

# Données de Jeu - Guide de Remplissage

Ce document explique comment remplir les tables de référence (Donjons, Zones, Monstres) utilisées par le module Missions.

## Où populer les données ?

Tu peux utiliser **Prisma Studio** (`npx prisma studio`) pour ajouter les données directement.

Sinon, tu peux créer un script seed dans `prisma/seed.ts`.

---

## Table: Dungeon (Donjons)

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String (unique) | Nom du donjon |
| `bossName` | String | Nom du boss final |
| `level` | Int | Niveau recommandé |
| `dpnlUrl` | String? | Lien vers dofuspourlesnoobs |
| `imageUrl` | String? | URL de l'image du boss |

### Exemples à ajouter:

```
Manoir des Katrepat | Anerice la Shushess | 200 | https://www.dofuspourlesnoobs.com/manoir-des-katrepat.html
Galeries d'Ereboria | Marteau-Aigris | 190 | https://www.dofuspourlesnoobs.com/...
```

---

## Table: Zone (Zones de monstres)

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String (unique) | Nom de la zone |
| `level` | Int | Niveau de la zone |
| `dpnlUrl` | String? | Lien vers dofuspourlesnoobs |

### Exemples:

```
Galeries d'Ereboria | 190
```

---

## Table: Monster (Monstres par zone)

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String | Nom du monstre/famille |
| `zoneId` | String (FK) | ID de la zone parente |
| `imageUrl` | String? | URL de l'image du monstre |

### Exemples:

```
Marteaux-Aigris | [ID de Galeries d'Ereboria]
Brûlâmes | [ID de zone correspondante]
```

---

## Script Seed (Optionnel)

Si tu veux automatiser, crée `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Donjons
    await prisma.dungeon.createMany({
        data: [
            { 
                name: 'Manoir des Katrepat', 
                bossName: 'Anerice la Shushess', 
                level: 200,
                dpnlUrl: 'https://www.dofuspourlesnoobs.com/manoir-des-katrepat.html'
            },
            // ... autres donjons
        ],
        skipDuplicates: true
    });

    // Zones
    const zone = await prisma.zone.create({
        data: {
            name: "Galeries d'Ereboria",
            level: 190,
            monsters: {
                create: [
                    { name: 'Marteaux-Aigris' },
                ]
            }
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

Puis dans `package.json`:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

Exécute avec: `npx prisma db seed`

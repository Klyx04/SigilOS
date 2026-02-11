# SigilOS - Developer Documentation

> **Bot Discord pour la gestion de guildes Dofus**  
> Next.js 16 • Prisma • PostgreSQL • Discord.js • Redis

---

## 📚 Table des Matières

- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Workflows](#-workflows)
- [Scripts Disponibles](#-scripts-disponibles)
- [Structure du Projet](#-structure-du-projet)
- [Conventions](#-conventions)
- [Déploiement](#-déploiement)
- [Backup & Restore](#-backup--restore)

---

## 🛠️ Stack Technique

### Core
- **Next.js 16** (App Router + Server Actions + RSC)
- **React 19** (Client + Server Components)
- **TypeScript 5**  
- **Tailwind CSS 4** (avec animations)

### Backend & Data
- **Prisma 7** (ORM avec PostgreSQL prod + SQLite dev)
- **NextAuth v5** (Discord OAuth)
- **Redis** (BullMQ pour jobs, rate-limiting)
- **PostgreSQL** (backup chiffré daily vers Cloudflare R2)

### Discord Integration
- **Discord.js v14** (webhook + interactions)
- **Métam OB V2** (sync ladder externe)

### AI & Processing
- **TensorFlow.js** (NSFW detection)
- **Sharp** (image processing + WebP optimization)

### Security & Monitoring
- **Sentry** (error tracking)
- **Fail2Ban** (SSH protection en prod)
- **GPG encryption** (DB backups)

---

## 🏗️ Architecture

### Paradigmes
- **Server-First** : Maximum de logique côté server actions
- **Guild Isolation** : Toutes les données scopées par `guildId`
- **Multi-Tenant** : Une seule app pour toutes les guildes

### Layers

```
User Request
    ↓
Next.js App Router (pages/routes)
    ↓
Server Actions (business logic + auth)
    ↓
Prisma (ORM + migrations)
    ↓
PostgreSQL / Redis
```

### Sécurité
- **Auth sur chaque action** : `await auth()` obligatoire
- **Admin guards** : `checkAdmin()` avant mutations critiques
- **Input validation** : Zod schemas sur toutes les entrées
- **Guild scoping** : `where: { guildId }` systématique

Voir [SECURITY.md](./SECURITY.md) pour plus de détails.

---

## 🚀 Installation

### Prérequis
- **Node.js ≥ 22.x**
- **PostgreSQL ≥ 17** (prod) ou SQLite (dev)
- **Redis ≥ 7.x** (prod seulement)
- **Git**

### Setup Local

```bash
# 1. Clone
git clone https://github.com/Klyx04/SigilOS.git
cd SigilOS

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local
# Éditer .env.local avec vos secrets Discord, Database, etc.

# 4. Database setup
npx prisma generate
npx prisma db push   # Dev: SQLite sur prisma/dev.db
npm run seed         # Charge les données de référence

# 5. Run dev server
npm run dev
```

**Accessibles localement** :
- App : `http://localhost:3000`
- God Interface : `http://localhost:3000/god/game-data` (super-admin)

---

## � Workflows

### Dev Local → Beta → Prod

```
┌────────────┐
│ Local Dev  │ (branche feat/xxx)
└─────┬──────┘
      │ PR merge
      ↓
┌────────────┐
│    dev     │ → beta.sigilos.fr (auto-deploy)
└─────┬──────┘
      │ Test 24-48h
      │ PR merge
      ↓
┌────────────┐
│    main    │ → sigilos.fr (auto-deploy)
└────────────┘
```

### Git Branching

| Branch | Description | Protection |
|--------|-------------|-----------|
| `main` | Production | 🔒 Protected |
| `dev` | Beta/Integration | 🔒 Protected |
| `feat/*` | Features | Delete after merge |
| `fix/*` | Bugfixes | Delete after merge |

**Workflow type** :
```bash
# Créer une feature
git checkout dev
git pull origin dev
git checkout -b feat/ma-feature

# Commit et push
git add .
git commit -m "feat: description"
git push origin feat/ma-feature

# PR vers dev → test beta → PR vers main
```

### Game Data Updates

**Pour ajouter des donjons, mobs, etc.** :

```bash
# 1. Local: Modifier via /god/game-data
# 2. Export
chmod +x scripts/export-seeds.sh
./scripts/export-seeds.sh local

# 3. Commit
git add prisma/seeds/game-data.json public/game-data/
git commit -m "feat: ajout donjon Skeunk"

# 4. Deploy (auto via workflow)
# Sur VPS lors du deploy: npm run seed
```

**⚠️ Les données de référence ne doivent jamais être modifiées directement en PROD**

---

## 📜 Scripts Disponibles

### Dev & Build
```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm test             # Vitest (watch mode)
npm run test:run     # Vitest (CI mode)
```

### Database
```bash
npx prisma studio    # Visual DB editor
npx prisma generate  # Regenerate Prisma Client
npx prisma db push   # Sync schema (dev only)
npx prisma migrate dev --name xxx  # Create migration
npm run seed         # Load game data seeds
```

### Game Data Management
```bash
./scripts/export-seeds.sh local     # Export DB → JSON
./scripts/export-seeds.sh beta      # Export depuis beta
./scripts/export-seeds.sh production # Export depuis prod
```

### Backup & Restore (VPS)
```bash
./scripts/backup_db.sh              # Manual backup → R2
./scripts/restore_db.sh backup.gpg  # Restore from R2
./scripts/restore_db.sh --download-latest
```

### Discord
```bash
./scripts/register-discord-commands.sh  # Sync slash commands
```

---

## 📁 Structure du Projet

```
SigilOS/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   ├── dashboard/          # User dashboard
│   │   ├── god/                # Super-admin interface
│   │   └── (auth)/             # Auth pages
│   ├── components/
│   │   ├── ui/                 # Radix UI + shadcn
│   │   ├── missions/           # Mission system
│   │   ├── ladder/             # Ladder/OCR
│   │   └── admin/              # Admin components
│   ├── server/
│   │   ├── actions/            # Server Actions (main business logic)
│   │   ├── discord.ts          # Discord API integration
│   │   └── redis.ts            # Redis client
│   └── lib/                    # Utilities, constants
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Prisma migrations
│   └── seeds/                  # Reference data (JSON)
├── public/                     # Static assets
│   └── game-data/              # Game images (monsters, dungeons, etc.)
├── scripts/                    # Shell scripts (backup, deploy, etc.)
├── tests/                      # Vitest tests
└── .env                        # Environment variables (gitignored)
```

---

## 📐 Conventions

### Naming
- **Files** : `kebab-case.ts`
- **Components** : `PascalCase.tsx`
- **Functions** : `camelCase()`
- **Types** : `PascalCase`
- **Server Actions** : `verbNoun()` (ex: `createMission`, `getUserContext`)

### Import Order
```typescript
// 1. React/Next
import { useState } from "react";
import Link from "next/link";

// 2. Third-party
import { toast } from "sonner";

// 3. Internal (components, lib, types)
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

### Server Actions Pattern
```typescript
"use server";

export async function myAction(data: FormData) {
  // 1. Auth
  const ctx = await getUserContext(guildId);
  if (!ctx.isAuthenticated) return { success: false, error: "..." };

  // 2. Validation (Zod)
  const validated = schema.safeParse(data);
  if (!validated.success) return { success: false, error: "..." };

  // 3. Business logic
  const result = await prisma.xxx.create({ data: { guildId, ... } });

  // 4. Revalidate cache
  revalidatePath("/dashboard/[guildId]/missions");

  return { success: true, data: result };
}
```

### Component Pattern
```typescript
"use client";

interface Props {
  guildId: string;
  // ...
}

export function MyComponent({ guildId }: Props) {
  // Hooks, state, handlers
  // Return JSX
}
```

---

## 🚢 Déploiement

### VPS Setup (fait 1 fois)
```bash
./scripts/init-vps.sh       # Init Docker, Nginx, Let's Encrypt
./scripts/secure_vps.sh     # SSH hardening, Fail2Ban
```

### Deploy Beta/Prod
```bash
# SSH vers VPS
ssh sigilos@vps

# Beta
cd /opt/sigilos/beta
./scripts/deploy.sh beta

# Prod
cd /opt/sigilos/production
./scripts/deploy.sh prod
```

**Automatisation** : GitHub Actions déploie automatiquement :
- `dev` → Beta
- `main` → Prod

---

## � Backup & Restore

### Backup Automatique
- **Fréquence** : Quotidienne (2h00 via cron)
- **Destination** : Cloudflare R2 (chiffré GPG)
- **Retention** : 7 jours

### Restore Manuel
```bash
# 1. Lister les backups
./scripts/restore_db.sh

# 2. Download + Restore dernier backup
./scripts/restore_db.sh --download-latest

# 3. Ou restore un backup spécifique
./scripts/restore_db.sh /var/backups/sigilos/2026-02-09.sql.gz.gpg
```

**⚠️ ATTENTION** : Le restore écrase toute la base de données.

---

## 🔐 Secrets & Environment

Variables critiques (`.env`) :

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sigilos
DATABASE_URL_BETA=postgresql://user:pass@vps:5432/sigilos_beta

# Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=

# Redis
REDIS_URL=redis://localhost:6379

# Backup
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=sigilos-backups
BACKUP_ENCRYPTION_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

**Stockage** : Utiliser 1Password ou `.env.local` (jamais committé).

---

## 🧪 Tests

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Single run (CI)
npm run test:run
```

Tests importants :
- `tests/ladder-actions.test.ts` (OCR Ladder)
- `tests/mission-actions.test.ts` (Mission system)

---

## 📚 Documentation Complémentaire

- **[SECURITY.md](./SECURITY.md)** : Politique de sécurité
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** : Guide de contribution (à créer)
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** : Guide de déploiement détaillé (à créer)
- **[MAINTENANCE.md](./MAINTENANCE.md)** : Guide de maintenance VPS (Backup, Cleanup, Monitoring)
- **[API.md](./API.md)** : Documentation des routes API (à créer)

---

## � Troubleshooting

### Build fails avec "sharp not found"
```bash
npm rebuild sharp
```

### Prisma génération échoue
```bash
npx prisma generate --force
```

### Redis connection error (local)
Redis n'est pas requis en dev. Commenter `REDIS_URL` dans `.env.local`.

### L'interface God ne charge pas les images
Vérifier que les dossiers existent :
```bash
mkdir -p public/game-data/{monsters,achievements,dungeons}
```

---

## 👥 Contributeurs

- **Klyx04** : Lead Developer

---

## � License

Propriétaire - Tous droits réservés

---

**Questions ?** Ouvre une issue ou contacte [@Klyx04](https://github.com/Klyx04)

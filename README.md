# SigilOS

[![Security](https://img.shields.io/badge/security-OWASP%20Top%2010-green)](./SECURITY.md)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-blue)](./.github/dependabot.yml)
[![License](https://img.shields.io/badge/license-Private-red)](#)

> **The Guild Operating System** — Plateforme de gestion pour guildes Dofus.

---

## 🛠️ Stack Technique

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript 5+ |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL (Prisma ORM) |
| Auth | Auth.js (Discord OAuth) |
| Infra | Docker |

---

## 🎮 Modules

- **🌙 Songes Infinis** — Coordination des runs de Songes
- **🎯 Missions** — Système de missions hebdomadaires avec preuves
- **👹 Archimonstres** — Intégration Metamob pour échanges
- **👤 Profils** — Gestion des membres et disponibilités

---

## 🚀 Installation

### Pré-requis
- Node.js 20+
- Docker & Docker Compose
- Discord Developer Application

### Setup

```bash
# 1. Clone & install
npm install

# 2. Start database
docker-compose up -d

# 3. Configure environment
cp .env.example .env
# → Fill in your keys

# 4. Generate Prisma client
npx prisma generate

# 5. Run migrations
npx prisma db push

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🐳 Docker & VPS (Production)

Le projet utilise une architecture duale (Bêta/Prod) sur un VPS sécurisé via Docker Compose.

### Environnements
- **Production** : [sigilos.fr](https://sigilos.fr) (Branche `main`)
- **Bêta** : [beta.sigilos.fr](https://beta.sigilos.fr) (Branche `dev` + Pass Protection)
- **Monitoring** : [monitor.sigilos.fr](https://monitor.sigilos.fr) (Grafana/Prometheus)

### Déploiement
```bash
# Sur le VPS
./scripts/deploy.sh [beta|prod]
```

---

## 📖 Documentation

| File | Description |
|------|-------------|
| [MAINTENANCE.md](./MAINTENANCE.md) | Manuel technique d'administration |
| [RULES.md](./RULES.md) | Development standards |
| [SECURITY.md](./SECURITY.md) | Security policy |
| [WORKFLOW.md](./WORKFLOW.md) | Git workflow |
| [.antigravity](./.antigravity) | Full project context |

---

## 🛑 Clean Shutdown

```bash
# 1. Stop dev server: CTRL+C
# 2. Stop database
docker-compose down
```

---

## 📜 License

Private — All rights reserved.



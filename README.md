# SigilOS

**SigilOS** (The Guild Operating System) est une plateforme de gestion pour guildes sur le MMORPG Dofus.

## 🛠 Stack Technique

- **Framework:** Next.js 15+ (App Router)
- **Langage:** TypeScript 5+
- **Style:** Tailwind CSS v4 + shadcn/ui
- **Base de données:** PostgreSQL (via Prisma ORM)
- **Auth:** Auth.js (Discord)
- **Infra:** Docker (Local & Prod)

## 🚀 Pré-requis

- Node.js 18+
- Docker & Docker Compose
- Un compte Discord / Developer Application

## 📦 Installation

1. **Cloner le projet**

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer l'infrastructure locale (Base de données)**
   ```bash
   docker-compose up -d
   ```

4. **Configurer les variables d'environnement**
   Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
   Remplissez les clés (DATABASE_URL, DISCORD_ID, etc.).

5. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```
   Accédez à [http://localhost:3000](http://localhost:3000).

## 🐳 Docker (Production)

Pour construire l'image de production :
```bash
docker build -t sigilos .
```

## 📜 Licence

Projet privé.

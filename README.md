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

## 🛑 Maintenance & Arrêt Clean

Pour éteindre proprement l'infrastructure et éviter les processus fantômes :

1.  **Stopper le Serveur de Dev :**
    - Dans le terminal `npm run dev` : Appuyez sur `CTRL + C` (une ou deux fois).

2.  **Stopper Prisma Studio (si lancé) :**
    - Dans le terminal `prisma studio` : Appuyez sur `CTRL + C`.

3.  **Éteindre la Base de Données (Docker) :**
    - Si vous avez lancé via `docker-compose up` :
    ```bash
    docker-compose down
    ```
    - *Note : Cela éteint le conteneur PostgreSQL proprement.*

4.  **Vérification Ultime (En cas de doute) :**
    - Vérifiez qu'aucun processus Node ne tourne en fond (via Gestionnaire des tâches ou `netstat -ano | findstr :3000`).


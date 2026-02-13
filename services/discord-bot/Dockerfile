FROM node:22-alpine

WORKDIR /app

# 1. Install dependencies
COPY services/discord-bot/package*.json ./
RUN npm install

# 2. Setup Prisma
COPY prisma/ ./prisma/
COPY prisma.config.js ./
# Ensure @prisma/client is installed
RUN npm list @prisma/client || npm install @prisma/client

# 3. Generate Prisma Client (dummy vars for build-time only, real values injected at runtime)
RUN POSTGRES_USER=build POSTGRES_PASSWORD=build POSTGRES_DB=build npx prisma generate

# 4. Copy bot source code
COPY services/discord-bot/ ./

# 5. Compile TypeScript to JavaScript
RUN npm run build

CMD ["npm", "start"]

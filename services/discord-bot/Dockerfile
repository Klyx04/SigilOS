FROM node:22-alpine

WORKDIR /app

# 1. Install dependencies
COPY services/discord-bot/package*.json ./
RUN npm install

# 2. Setup Prisma
COPY prisma/ ./prisma/
# Ensure @prisma/client is installed
RUN npm list @prisma/client || npm install @prisma/client

# 3. Generate Prisma Client (dummy URL for build-time only, real URL injected at runtime)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate --schema=./prisma/schema.prisma

# 4. Copy bot source code
COPY services/discord-bot/ ./

# 5. Compile TypeScript to JavaScript
RUN npm run build

CMD ["npm", "start"]

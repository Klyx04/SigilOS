FROM node:22-alpine AS builder

WORKDIR /app

# 1. Install dependencies
COPY .npmrc* ./
COPY services/discord-bot/package*.json ./
RUN npm install

# 2. Setup Prisma
COPY prisma/ ./prisma/
COPY prisma.config.js ./
# Pin `prisma` au projet (^7.9.1) : sans cela, `npx prisma` tire `prisma@latest`
# (actuellement une RC cassée 8.0.0-rc.10 qui n'a pas la commande `generate`)
# → build KO. Le CLI est aligné sur la version du projet.
RUN POSTGRES_USER=build POSTGRES_PASSWORD=build POSTGRES_DB=build npx prisma@7.9.1 generate

# 3. Copy bot source code
COPY services/discord-bot/ ./

# 4. Compile TypeScript to JavaScript
RUN npm run build

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 sigilos && \
    adduser --system --uid 1001 sigilos

# Copy essential files from builder
COPY --from=builder --chown=sigilos:sigilos /app/node_modules ./node_modules
COPY --from=builder --chown=sigilos:sigilos /app/dist ./dist
COPY --from=builder --chown=sigilos:sigilos /app/package.json ./
COPY --from=builder --chown=sigilos:sigilos /app/prisma ./prisma
COPY --from=builder --chown=sigilos:sigilos /app/prisma.config.js ./

USER sigilos

CMD ["npm", "start"]

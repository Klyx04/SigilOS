FROM node:22-alpine AS builder

WORKDIR /app

# 1. Install dependencies
COPY .npmrc* ./
COPY services/discord-bot/package*.json ./
RUN npm install

# 2. Setup Prisma
COPY prisma/ ./prisma/
COPY prisma.config.js ./
RUN POSTGRES_USER=build POSTGRES_PASSWORD=build POSTGRES_DB=build npx prisma generate

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

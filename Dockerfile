FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Reinstall sharp for the correct platform (Alpine = linuxmusl-x64)
# This ensures libvips .so files are present and get traced into .next/standalone
RUN npm install --os=linux --libc=musl --cpu=x64 sharp

# Generate Prisma Client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

ARG BETA_PASSWORD
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# DSN public Sentry figé dans le bundle client au build (non secret : visible
# dans le JS + quota protégé par Allowed Domains côté Sentry). Sans lui,
# le navigateur ne remonte jamais rien même si le VPS a les vars.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# Plafond mémoire du build Next : la phase « Running TypeScript » de `next build`
# (type-check complet du projet + client Prisma généré) atteint ~2 Go → OOM avec le
# heap Node par défaut (~2 Go), y compris sur le runner GitHub de deploy.yml.
# 4 Go = marge confortable (runner/VPS ≥ 8 Go). Le stage `runner` n'en hérite pas.
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Build seeds
RUN npm run build:seeds

# Build maintenance scripts
RUN npm run build:maintenance

# Build siphon script (guide image downloader)
RUN npm run build:siphon

# Build worker script
RUN npm run build:worker

# Build WebSockets server
RUN npm run build:ws

# -----------------------------------------------------------------------------
# CLI Prisma (devDependency → ABSENTE de .next/standalone)
# -----------------------------------------------------------------------------
# Les déploiements exécutent `prisma migrate deploy` / `db push` DANS le conteneur.
# Sans cette étape, le CLI était retéléchargé par `npx` à CHAQUE déploiement
# (conteneur recréé = cache npm vide) : 1 à 3 minutes d'attente MUETTE à l'étape
# 4/5 de scripts/deploy-cd.sh (incident du 19/09/2026).
# Installation LOCALE dans un dossier autonome → une seule copie à faire, et
# aucune ambiguïté sur l'aplatissement des dépendances (contrairement à une copie
# partielle de node_modules). Même base Alpine → mêmes moteurs (linux-musl) que
# le client généré au build.
# ⚠️ La version doit rester alignée sur `prisma` de package.json ET sur PRISMA_PIN
# de scripts/deploy-cd.sh.
FROM base AS prisma-cli
ARG PRISMA_VERSION=7.10.0
WORKDIR /prisma-cli
RUN npm init -y >/dev/null 2>&1 \
    && npm install --no-audit --no-fund --loglevel=error "prisma@${PRISMA_VERSION}"

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN apk add --no-cache curl

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Keep a backup of static uploads so they can be synced into the Docker volume at runtime
# (Docker volume mount hides build-time files)
RUN cp -r /app/public/uploads /app/public-static-uploads 2>/dev/null || mkdir -p /app/public-static-uploads

# Writable asset dirs (siphon + proxy self-heal). Pré-créés nextjs-owned dans
# l'image : les volumes nommés frais (assets-*-data) héritent de ce propriétaire.
# Sans ça, le point de montage est root:root → EACCES (mkdir) → proxy 500 + sync 0/100.
RUN mkdir -p /app/public/uploads/assets-dofus/monsters /app/public/uploads/assets-dofus/items /app/public/uploads/assets-dofus/spells \
    && chown -R nextjs:nodejs /app/public/uploads

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema and config (after standalone to ensure they are in the final root)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# CLI Prisma embarqué (utilisé par scripts/deploy-cd.sh pour `migrate deploy` et
# `db push` dans le conteneur) : supprime le `npx` + le téléchargement npm à
# CHAQUE déploiement. scripts/deploy-cd.sh garde un repli npx automatique si cet
# artefact disparaissait → un déploiement ne peut pas casser pour ça.
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli /opt/prisma-cli

# Copy bundled seeds
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed-data/seed.js ./prisma/seed-data/
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed.js ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed-docs.js ./prisma/

# Copy bundled worker
COPY --from=builder --chown=nextjs:nodejs /app/dist/worker.js ./worker.js

# Copy WebSockets server
COPY --from=builder --chown=nextjs:nodejs /app/dist/ws-server.js ./ws-server.js

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

CMD ["./docker-entrypoint.sh"]

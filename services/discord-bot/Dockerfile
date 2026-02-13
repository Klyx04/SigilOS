FROM node:22-alpine

WORKDIR /bot

# Copy bot package files
COPY services/discord-bot/package*.json ./
RUN npm install --production

# Copy bot source
COPY services/discord-bot/ ./

# Copy Prisma schema from root
COPY prisma/ /app/prisma/

# Generate Prisma Client
WORKDIR /app
RUN npx prisma generate

WORKDIR /bot

CMD ["npm", "start"]

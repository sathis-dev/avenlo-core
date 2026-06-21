# ====================================
# AVENLO CORE - ARCHITECT DOCKERFILE
# Lightweight Pre-Built Runner
# ====================================

FROM node:20-slim

WORKDIR /app

# Install wget for docker-compose healthchecks and pnpm
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Install pnpm (strict-ssl disabled for local Docker cert chain issue)
RUN npm install -g pnpm --strict-ssl=false
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy workspace manifest (for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml* ./
RUN npm pkg delete packageManager

# Copy built shared package
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist

# Copy built architect service
COPY services/architect/package.json ./services/architect/
COPY services/architect/dist ./services/architect/dist

# Install production dependencies only
RUN pnpm install --prod --config.strict-ssl=false

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "services/architect/dist/index.js"]

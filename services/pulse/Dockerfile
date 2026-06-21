# ====================================
# AVENLO CORE - PULSE DOCKERFILE
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

# Copy built pulse service
COPY services/pulse/package.json ./services/pulse/
COPY services/pulse/dist ./services/pulse/dist

# Install production dependencies only
RUN pnpm install --prod --config.strict-ssl=false

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "services/pulse/dist/index.js"]

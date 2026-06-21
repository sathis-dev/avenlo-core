# ====================================
# AVENLO CORE - GATEWAY DOCKERFILE
# Lightweight Pre-Built Runner
# ====================================

FROM node:20-slim

WORKDIR /app

# Install wget for docker-compose healthchecks, pnpm, fontconfig/fonts for canvas, and ffmpeg for audio streaming
RUN apt-get update && apt-get install -y wget fontconfig fonts-liberation ffmpeg && rm -rf /var/lib/apt/lists/*

# Install pnpm (strict-ssl disabled for local Docker cert chain issue)
RUN npm install -g pnpm --strict-ssl=false
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy workspace manifest (for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml* ./
RUN npm pkg delete packageManager

# Copy built shared package
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist

# Copy built gateway service
COPY services/gateway/package.json ./services/gateway/
COPY services/gateway/dist ./services/gateway/dist

# Install production dependencies only (allow scripts so ffmpeg-static downloads the binary)
RUN pnpm install --prod --config.strict-ssl=false --config.ignore-scripts=false

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "services/gateway/dist/index.js"]

# ====================================
# AVENLO CORE - PULSE DOCKERFILE
# Multi-stage build with Distroless
# ====================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/pulse/package.json ./services/pulse/

RUN pnpm install

COPY packages/shared ./packages/shared
COPY services/pulse ./services/pulse
COPY tsconfig.base.json ./

RUN pnpm --filter @avenlo/shared build
RUN pnpm --filter @avenlo/pulse build

# Production dependencies stage
FROM node:20-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/pulse/package.json ./services/pulse/

RUN pnpm install --prod

# Runtime stage
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/pulse/dist ./services/pulse/dist
COPY --from=builder /app/services/pulse/package.json ./services/pulse/

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/pulse/node_modules ./services/pulse/node_modules

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["services/pulse/dist/index.js"]

# ====================================
# AVENLO CORE - LEDGER DOCKERFILE
# Multi-stage build with Distroless
# ====================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/ledger/package.json ./services/ledger/

RUN pnpm install

COPY packages/shared ./packages/shared
COPY services/ledger ./services/ledger
COPY tsconfig.base.json ./

RUN pnpm --filter @avenlo/shared build
RUN pnpm --filter @avenlo/ledger build

# Production dependencies stage
FROM node:20-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/ledger/package.json ./services/ledger/

RUN pnpm install --prod

# Runtime stage
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/ledger/dist ./services/ledger/dist
COPY --from=builder /app/services/ledger/package.json ./services/ledger/

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/ledger/node_modules ./services/ledger/node_modules

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

CMD ["services/ledger/dist/index.js"]

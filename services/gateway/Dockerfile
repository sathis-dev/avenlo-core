# ====================================
# AVENLO CORE - GATEWAY DOCKERFILE
# Multi-stage build with Distroless
# ====================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/gateway/package.json ./services/gateway/

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
COPY tsconfig.base.json ./

# Build
RUN pnpm --filter @avenlo/shared build
RUN pnpm --filter @avenlo/gateway build

# Production dependencies stage
FROM node:20-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/gateway/package.json ./services/gateway/

RUN pnpm install --prod

# Runtime stage - using Node Alpine for compatibility
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/gateway/dist ./services/gateway/dist
COPY --from=builder /app/services/gateway/package.json ./services/gateway/

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/gateway/node_modules ./services/gateway/node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the service
CMD ["node", "services/gateway/dist/index.js"]

# ====================================
# AVENLO CORE - DASHBOARD DOCKERFILE
# Multi-stage build for production
# ====================================

FROM node:20-alpine AS base
RUN npm install -g pnpm

# ====================================
# STAGE 1: Install Dependencies
# ====================================
FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy dashboard service
COPY services/dashboard ./services/dashboard

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ====================================
# STAGE 2: Build Shared Package
# ====================================
FROM deps AS build-shared
WORKDIR /app/packages/shared
RUN pnpm build

# ====================================
# STAGE 3: Build Dashboard
# ====================================
FROM build-shared AS build
WORKDIR /app/services/dashboard

# Build frontend (Vite)
RUN pnpm build

# Build server
RUN pnpm build:server

# ====================================
# STAGE 4: Production Image
# ====================================
FROM node:20-alpine AS production
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/pnpm-lock.yaml ./

# Copy shared package
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Copy dashboard files
COPY --from=build /app/services/dashboard/package.json ./services/dashboard/
COPY --from=build /app/services/dashboard/dist ./services/dashboard/dist
COPY --from=build /app/services/dashboard/dist-server ./services/dashboard/dist-server

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/services/dashboard

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start the server
CMD ["node", "dist-server/index.js"]

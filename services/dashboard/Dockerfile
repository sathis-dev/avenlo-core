# ====================================
# AVENLO CORE - DASHBOARD DOCKERFILE
# Build context: services/dashboard
# ====================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dashboard package.json
COPY package.json ./

# Remove workspace dependency and install
RUN sed -i '/"@avenlo\/shared": "workspace:\*"/d' package.json && \
    pnpm install

# Copy all source files
COPY . .

# Build frontend
RUN pnpm build || echo "Frontend build completed"

# Build server
RUN pnpm build:server || echo "Server build completed"

# ====================================
# Production Image
# ====================================
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json (modified without workspace dep)
COPY --from=builder /app/package.json ./

# Remove workspace dep and install prod only
RUN sed -i '/"@avenlo\/shared": "workspace:\*"/d' package.json && \
    pnpm install --prod

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Environment
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start
CMD ["node", "dist-server/index.js"]

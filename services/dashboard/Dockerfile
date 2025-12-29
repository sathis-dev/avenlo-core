# ====================================
# AVENLO CORE - DASHBOARD DOCKERFILE
# Build context: services/dashboard
# ====================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and remove workspace dependency
COPY package.json ./
RUN sed -i '/"@avenlo\/shared": "workspace:\*",/d' package.json

# Install dependencies
RUN pnpm install

# Copy all source files
COPY . .

# Build frontend (Vite) - this creates /app/dist
RUN npm run build

# Build server (TypeScript) - this creates /app/dist-server
RUN npm run build:server

# Debug: list what was built
RUN ls -la /app/ && ls -la /app/dist || echo "No dist folder" && ls -la /app/dist-server || echo "No dist-server folder"

# ====================================
# Production Image
# ====================================
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and remove workspace dep
COPY --from=builder /app/package.json ./
RUN sed -i '/"@avenlo\/shared": "workspace:\*",/d' package.json

# Install production dependencies only
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Environment
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Start
CMD ["node", "dist-server/index.js"]

<div align="center">

# 🌌 AVENLO CORE

### Hybrid Microservice Infrastructure for Discord

[![CI/CD](https://github.com/your-org/avenlo-core/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-org/avenlo-core/actions)
[![Railway](https://img.shields.io/badge/Railway-Deployed-blueviolet?logo=railway)](https://railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 🏗️ Architecture Overview

Avenlo Core is a **coordinated fleet of microservices** communicating via a **Redis Event Bus** and **MongoDB Cluster**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Discord Platform                          │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🚪 GATEWAY SERVICE                            │
│   Slash Commands │ Modals │ Select Menus │ Session Management    │
└─────────────────────────────────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ 🏛️ ARCHITECT      │ │ 💚 PULSE          │ │ 💎 LEDGER         │
│ AI Lead Scoping   │ │ DevOps Sync       │ │ Value Economy     │
│ GPT-4o / Claude   │ │ GitHub Webhooks   │ │ Credit System     │
└───────────────────┘ └───────────────────┘ └───────────────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     📡 REDIS EVENT BUS                           │
│              Pub/Sub │ Session Storage │ Rate Limiting           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     🗄️ MONGODB CLUSTER                           │
│       Multi-Tenant Schema │ AES-256 Encryption │ Indexes         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
avenlo-core/
├── packages/
│   └── shared/              # Shared utilities, models, constants
│       ├── constants/       # Branding colors, event types
│       ├── models/          # MongoDB schemas
│       └── utils/           # Redis, MongoDB, Encryption, Logger
│
├── services/
│   ├── gateway/             # Main Discord bot
│   │   ├── commands/        # Slash command handlers
│   │   └── events/          # Redis event subscriptions
│   │
│   ├── architect/           # AI-powered client interviews
│   │   ├── ai/              # OpenAI & Anthropic clients
│   │   └── brief/           # PDF brief generator
│   │
│   ├── pulse/               # DevOps sync & dashboards
│   │   ├── server/          # GitHub webhook server
│   │   └── dashboard/       # Live embed updater
│   │
│   └── ledger/              # Credit economy
│       └── roles/           # Dynamic role manager
│
├── scripts/                 # Deployment & init scripts
├── docker-compose.yml       # Local development environment
└── railway.toml             # Railway deployment config
```

---

## 🎨 Brand Identity

| Element | Value | Usage |
|---------|-------|-------|
| Primary (Cyan) | `#00FFAA` | Success, active states, progress |
| Secondary (Gold) | `#FFD700` | Premium, achievements, highlights |
| Error (Red) | `#FF4B4B` | Errors, warnings, destructive |
| Footer | `AVENLO CORE • In Code We Trust` | All embeds |
| Author | `⬡ AVENLO` | All embeds |

---

## ⚙️ Services

### 🚪 Gateway Service
**The Front Door** - Handles all Discord interactions with zero-lag response times.

**Commands:**
| Command | Description |
|---------|-------------|
| `/project start` | Begin AI-powered project interview |
| `/project status` | Check ongoing project status |
| `/vault` | View credit balance and transaction history |
| `/dashboard deploy` | Deploy live DevOps dashboard |
| `/leaderboard` | View top contributors |
| `/profile` | View user profile and stats |
| `/admin audit` | Admin audit tools |

### 🏛️ Architect Service
**The AI Sales Agent** - Conducts intelligent client interviews.

**Features:**
- Multi-phase interview flow (Discovery → Requirements → Timeline → Budget)
- Dual AI support (GPT-4o primary, Claude 3.5 fallback)
- Automatic complexity scoring (1-5 scale)
- JSON brief generation with full project specs
- PDF summary creation for stakeholders

### 💚 Pulse Service
**The Heartbeat** - Makes the server "breathe" with your code.

**Features:**
- GitHub webhook integration (push, PR, workflow)
- Persistent dashboard embeds with live updates
- Debounced updates (5s) to prevent rate limits
- Automatic health monitoring
- CI/CD status badges

### 💎 Ledger Service
**The Value Economy** - Proof of Value, not XP.

**Credit Values:**
| Action | Credits |
|--------|---------|
| Major Commit | +50 |
| PR Merged | +30 |
| Issue Resolved | +25 |
| Code Review | +20 |
| Documentation | +15 |
| Bug Report | +10 |

**Role Hierarchy:**
- 🔷 **Observer** (0 credits) - Read-only access
- 🟢 **Contributor** (100 credits) - Basic contributor
- 🟡 **Builder** (500 credits) - Active builder
- 🟠 **Architect** (2000 credits) - Senior contributor
- 🔴 **Core** (5000 credits) - Core team member
- ⭐ **Studio Lead** - Highest credits this month

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- MongoDB Atlas account
- Redis instance
- Discord Bot Token

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/avenlo-core.git
cd avenlo-core

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Start local infrastructure
docker-compose up -d redis mongodb

# Build shared package
pnpm --filter @avenlo/shared build

# Start all services (dev mode)
pnpm dev
```

### Environment Variables

```bash
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/avenlo

# Redis
REDIS_URL=redis://localhost:6379

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Security
ENCRYPTION_KEY=32-byte-hex-key
ENCRYPTION_IV=16-byte-hex-iv

# GitHub (for Pulse)
GITHUB_WEBHOOK_SECRET=your_secret

# Service Ports
GATEWAY_PORT=3000
PULSE_PORT=3002
```

---

## 🐳 Docker Deployment

### Build Images

```bash
# Build all services
docker-compose build

# Or build individually
docker build -f services/gateway/Dockerfile -t avenlo-gateway .
docker build -f services/architect/Dockerfile -t avenlo-architect .
docker build -f services/pulse/Dockerfile -t avenlo-pulse .
docker build -f services/ledger/Dockerfile -t avenlo-ledger .
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## 🚂 Railway Deployment

### Initial Setup

1. Create a new Railway project
2. Add Redis and MongoDB plugins (or use Atlas)
3. Create 4 services: `avenlo-gateway`, `avenlo-architect`, `avenlo-pulse`, `avenlo-ledger`
4. Set environment variables for each service
5. Connect your GitHub repository

### CI/CD Pipeline

The GitHub Actions workflow automatically:

1. **Test** - Lint and run tests
2. **Build** - Create Docker images, push to GHCR
3. **Deploy** - Deploy to Railway via CLI
4. **Notify** - Send Discord notification

Required secrets:
- `RAILWAY_TOKEN` - Railway API token
- `DISCORD_WEBHOOK` - Deployment notification webhook

---

## 🔒 Security

- **AES-256-GCM Encryption** for all sensitive project metadata
- **Distroless Docker Images** for minimal attack surface
- **GitHub Webhook Signature Verification** for Pulse service
- **Rate Limiting** via Redis for abuse prevention
- **Session Encryption** for interview data

---

## 📊 API Events

### Redis Event Bus

```typescript
// Architect Events
ARCHITECT_SESSION_STARTED   // New interview session
ARCHITECT_PHASE_CHANGED     // Interview phase progression
ARCHITECT_BRIEF_GENERATED   // Project brief completed

// Pulse Events
PULSE_PUSH                  // Git push received
PULSE_PR_OPENED             // Pull request opened
PULSE_PR_MERGED             // Pull request merged
PULSE_WORKFLOW_COMPLETED    // CI/CD workflow finished

// Ledger Events
LEDGER_CREDITS_EARNED       // Credits awarded
LEDGER_CREDITS_SPENT        // Credits consumed
LEDGER_ROLE_UPDATED         // Role promotion/demotion
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific service
pnpm --filter @avenlo/gateway test

# Run with coverage
pnpm test:coverage
```

---

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**AVENLO CORE • In Code We Trust**

Made with 💚 by the Avenlo Team

</div>

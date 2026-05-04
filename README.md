# GRC Platform

AI-native Governance, Risk & Compliance (GRC) SaaS platform.

## Architecture

| App / Package | Technology | Hosted |
|---|---|---|
| `apps/web` | Next.js 16 (App Router + Turbopack) | Vercel |
| `apps/api` | Fastify (Node.js) | GCP Cloud Run |
| `apps/worker` | Node.js (Cloud Tasks handler) | GCP Cloud Run Jobs |
| `packages/db` | Prisma v7 + PostgreSQL | GCP Cloud SQL |
| `packages/types` | TypeScript + Zod | — |
| `packages/ai` | Anthropic Claude via Vertex AI | — |
| `packages/ui` | React + shadcn/ui + Tailwind v4 | — |
| `packages/config` | ESLint + TypeScript + Tailwind configs | — |
| `infra/` | Terraform (GCP) | — |

## Prerequisites

- Node.js ≥ 20 LTS
- pnpm ≥ 9
- Docker Desktop (for local GCP service emulation)
- GCP project with billing enabled (for staging)
- Terraform ≥ 1.7 (for infrastructure)

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start local infrastructure

```bash
docker compose up -d
# Starts: Cloud SQL Proxy (:5432) + Redis (:6379)
```

### 4. Start all apps

```bash
pnpm dev
# apps/web  → http://localhost:3000
# apps/api  → http://localhost:3001
# apps/worker → http://localhost:3002
```

## Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run all tests |
| `pnpm type-check` | TypeScript type checking |
| `pnpm clean` | Remove all build outputs and node_modules |

## Database

```bash
# Generate Prisma client
pnpm --filter @grc/db db:generate

# Run migrations (development)
pnpm --filter @grc/db db:migrate:dev

# Open Prisma Studio
pnpm --filter @grc/db db:studio
```

## Infrastructure (GCP)

```bash
cd infra/environments/staging
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Project Structure

```
grc/
├── apps/
│   ├── web/        # Next.js frontend (Vercel)
│   ├── api/        # Fastify REST API (Cloud Run)
│   └── worker/     # Async job processor (Cloud Run Jobs)
├── packages/
│   ├── db/         # Prisma schema + client
│   ├── types/      # Shared TypeScript types + Zod schemas
│   ├── ai/         # LLM utilities (Claude via Vertex AI)
│   ├── ui/         # Shared component library
│   └── config/     # Shared ESLint + TypeScript + Tailwind configs
└── infra/          # Terraform (GCP)
```

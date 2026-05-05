FROM node:20-alpine AS base
RUN npm install -g pnpm@10.33.2
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/ai/package.json ./packages/ai/
COPY packages/evidence-ingestion/package.json ./packages/evidence-ingestion/
RUN pnpm install --frozen-lockfile --filter @grc/api...

FROM base AS builder
# prisma CLI needed to run `prisma generate` during @grc/db build
RUN npm install -g prisma@6
# Root and per-package node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/packages/evidence-ingestion/node_modules ./packages/evidence-ingestion/node_modules
COPY . .
# Build workspace packages in dependency order before the API
RUN pnpm --filter @grc/types build
RUN pnpm --filter @grc/db build
RUN pnpm --filter @grc/ai build
RUN pnpm --filter @grc/evidence-ingestion build
RUN pnpm --filter @grc/api build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
# Root node_modules carries the .pnpm virtual store (all actual package files).
# Per-package node_modules contain only symlinks into that store, so they are
# small and must be present for Node.js resolution to walk up correctly.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json
# Each workspace package: compiled dist + package.json (exports now point to dist/)
# + node_modules (symlinks into the .pnpm store for their external deps)
COPY --from=builder /app/packages/db/dist /app/packages/db/dist
COPY --from=builder /app/packages/db/package.json /app/packages/db/package.json
COPY --from=builder /app/packages/db/node_modules /app/packages/db/node_modules
COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/types/package.json /app/packages/types/package.json
COPY --from=builder /app/packages/types/node_modules /app/packages/types/node_modules
COPY --from=builder /app/packages/ai/dist /app/packages/ai/dist
COPY --from=builder /app/packages/ai/package.json /app/packages/ai/package.json
COPY --from=builder /app/packages/ai/node_modules /app/packages/ai/node_modules
COPY --from=builder /app/packages/evidence-ingestion/dist /app/packages/evidence-ingestion/dist
COPY --from=builder /app/packages/evidence-ingestion/package.json /app/packages/evidence-ingestion/package.json
COPY --from=builder /app/packages/evidence-ingestion/node_modules /app/packages/evidence-ingestion/node_modules
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]

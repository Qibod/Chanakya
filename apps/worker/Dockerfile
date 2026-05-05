FROM node:20-alpine AS base
RUN npm install -g pnpm@10.33.2
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .pnpmfile.cjs ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/ai/package.json ./packages/ai/
RUN pnpm install --frozen-lockfile --filter @grc/worker...

FROM base AS builder
RUN npm install -g prisma@6
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY . .
RUN pnpm --filter @grc/types build
RUN pnpm --filter @grc/db build
RUN pnpm --filter @grc/ai build
RUN pnpm --filter @grc/worker build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=builder /app/apps/worker/dist /app/apps/worker/dist
COPY --from=builder /app/apps/worker/package.json /app/apps/worker/package.json
COPY --from=builder /app/packages/db/dist /app/packages/db/dist
COPY --from=builder /app/packages/db/package.json /app/packages/db/package.json
COPY --from=builder /app/packages/db/node_modules /app/packages/db/node_modules
COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/types/package.json /app/packages/types/package.json
COPY --from=builder /app/packages/types/node_modules /app/packages/types/node_modules
COPY --from=builder /app/packages/ai/dist /app/packages/ai/dist
COPY --from=builder /app/packages/ai/package.json /app/packages/ai/package.json
COPY --from=builder /app/packages/ai/node_modules /app/packages/ai/node_modules
WORKDIR /app/apps/worker
EXPOSE 3002
CMD ["node", "dist/index.js"]

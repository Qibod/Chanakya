FROM node:20-alpine AS base
RUN npm install -g pnpm@10.33.2
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .pnpmfile.cjs ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile --filter @grc/api...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @grc/api build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
# Mirror the monorepo structure so pnpm symlinks resolve correctly:
# node_modules resolution walks up from /app/apps/api/dist → finds packages
# in /app/apps/api/node_modules and /app/node_modules.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]

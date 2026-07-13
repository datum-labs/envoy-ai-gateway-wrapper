# Based on the official Next.js Docker example (standalone mode):
# https://github.com/vercel/next.js/tree/canary/examples/with-docker

ARG NODE_VERSION=24-slim

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable pnpm && pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG BASE_PATH=/dashboard
ENV BASE_PATH=${BASE_PATH}

RUN corepack enable pnpm && pnpm build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:${NODE_VERSION} AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/public ./public

# Ensure the prerender cache directory is writable by the runtime user
RUN mkdir .next && chown node:node .next

# Standalone output contains server.js plus only the node_modules it needs
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]

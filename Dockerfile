# 构建阶段
FROM node:24-alpine AS builder
ARG NPM_REGISTRY

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV npm_config_registry=$NPM_REGISTRY
ENV PNPM_HOME=/tmp/pnpm-home

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store

COPY . .

RUN pnpm build

# 运行阶段
FROM node:24-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p data && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(function(r){if(!r.ok)process.exit(1)}).catch(function(){process.exit(1)})" || exit 1

VOLUME ["/app/data"]

CMD ["node", ".output/server/index.mjs"]

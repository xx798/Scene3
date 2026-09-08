FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=5000 TZ=Asia/Shanghai
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
RUN mkdir -p /app/data/reports && chown -R node:node /app/data
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]

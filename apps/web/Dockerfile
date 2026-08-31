# Web app container. Build context = repo root (monorepo).
# Stages:
#   deps   — full workspace + node_modules, no Next build. Used by the one-shot
#            db-migrate / db-seed compose services (drizzle-kit + tsx need
#            source and devDeps, not a compiled app).
#   build  — Next standalone build on top of deps.
#   runner — ships only the standalone bundle (`node apps/web/server.js`,
#            not `next start`). Container port 3070 (compose maps host 3071).
# @spec L2-INF-04, L2-INF-16
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
RUN corepack yarn install --immutable

FROM deps AS build
RUN corepack yarn workspace web build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3070
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone bundle mirrors the monorepo: server at apps/web/server.js, minimal
# node_modules at the root. Static assets are not traced — copy them in place.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
# Drop root: the standalone server writes nothing to disk at runtime, so the
# built-in unprivileged `node` user (uid 1000) can run it read-only. Limits the
# blast radius of any RCE in the app or a dependency.
USER node
EXPOSE 3070
CMD ["node", "apps/web/server.js"]

# syntax=docker/dockerfile:1

# ---- Stage 1: build the SPA (needs devDependencies: vite, tailwind, postcss) ----
FROM node:22-slim AS build
WORKDIR /app

# package.json has no "packageManager" field, so pin pnpm explicitly instead of
# letting corepack choose. 10.24.0 matches pnpm-lock.yaml (lockfileVersion 9.0).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Dependency layer, cached until package.json / pnpm-lock.yaml change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source layer. Vite needs index.html, src/, public/, and the *.config.js files.
COPY . .
RUN pnpm build

# ---- Stage 2: runtime (Express API + built assets, production deps only) ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY backend ./backend

USER node

# Documentation only. Cloud Run injects PORT (8080 by default) and
# backend/index.js already reads process.env.PORT.
EXPOSE 8080

CMD ["node", "backend/index.js"]
